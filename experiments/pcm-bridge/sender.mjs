// Experimental PCM sender. No connection/token creation and no production imports.
const CHUNK_BYTES = 9600;
const MAX_TURN_BYTES = 30 * 24000 * 2;
const WINDOW = 4;

function encode(bytes) {
  let text = "";
  for (const value of bytes) text += String.fromCharCode(value);
  return btoa(text);
}

export class PcmSender {
  static async open(rpc, turn) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(turn)) throw new Error("Invalid PCM turn");
    const state = await rpc({op: "open", turn});
    if (!/^[a-f0-9]{32}$/.test(state?.generation) || state.next_seq !== 0)
      throw new Error("PCM open did not establish a fresh generation");
    return new PcmSender(rpc, state.generation);
  }

  constructor(rpc, generation) {
    this.rpc = rpc;
    this.generation = generation;
    this.phase = "open";
    this.queue = [];
    this.inFlight = new Map();
    this.nextSeq = 0;
    this.acceptedBytes = 0;
    this.cancelPromise = null;
    this.done = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    // finish() still rejects, but a provider failure before finish isn't unhandled.
    this.done.catch(() => {});
  }

  append(pcm) {
    if (this.phase !== "open") throw new Error("PCM turn is not open");
    if (!(pcm instanceof Uint8Array) || !pcm.length || pcm.length % 2)
      throw new Error("PCM must contain complete 16-bit samples");
    if (this.acceptedBytes + pcm.length > MAX_TURN_BYTES)
      throw new Error("PCM turn exceeds duration limit");
    this.acceptedBytes += pcm.length;
    for (let offset = 0; offset < pcm.length; offset += CHUNK_BYTES)
      this.queue.push(pcm.slice(offset, offset + CHUNK_BYTES));
    this.pump();
  }

  pump() {
    if (!["open", "finishing"].includes(this.phase)) return;
    while (this.inFlight.size < WINDOW && this.queue.length) {
      const seq = this.nextSeq++;
      const pcm = this.queue.shift();
      const request = Promise.resolve().then(() => this.rpc({
        op: "push", generation: this.generation, seq, pcm: encode(pcm),
      }));
      this.inFlight.set(seq, request);
      request.then(ack => {
        if (!["open", "finishing"].includes(this.phase)) return;
        if (ack?.seq !== seq || !Number.isSafeInteger(ack.forwarded_samples) || ack.forwarded_samples < pcm.length / 2)
          throw new Error("Invalid PCM acknowledgement");
        this.inFlight.delete(seq);
        this.pump();
      }).catch(() => this.fail());
    }
    if (this.phase === "finishing" && !this.queue.length && !this.inFlight.size) {
      this.phase = "ending";
      Promise.resolve().then(() => this.rpc({op: "end", generation: this.generation, count: this.nextSeq}))
        .then(ack => {
          if (this.phase !== "ending") return;
          if (ack?.sealed !== true) throw new Error("Invalid PCM end acknowledgement");
          this.phase = "sealed";
          this.resolve(ack);
        }).catch(() => this.fail());
    }
  }

  finish() {
    if (this.phase === "open") { this.phase = "finishing"; this.pump(); }
    return this.done;
  }

  fail() {
    if (["failed", "cancelled", "sealed"].includes(this.phase)) return;
    this.phase = "failed";
    this.queue = [];
    this.inFlight.clear();
    this.reject(new Error("PCM forwarding failed; reconnect required"));
    void this.cancel().catch(() => {});
  }

  async cancel() {
    if (this.cancelPromise) return this.cancelPromise;
    const failed = this.phase === "failed";
    this.phase = failed ? "failed" : "cancelled";
    this.queue = [];
    this.inFlight.clear();
    this.reject(new Error("PCM turn cancelled"));
    this.cancelPromise = Promise.resolve()
      .then(() => this.rpc({op: "cancel", generation: this.generation}))
      .then(ack => {
        if (ack?.cancelled !== true) throw new Error("PCM cancellation not acknowledged");
      }).catch(() => {
        this.phase = "failed";
        throw new Error("PCM cancellation failed; reconnect required");
      });
    return this.cancelPromise;
  }
}

// Use only with the server-verified agent identity for this owned session.
// The passed RPC implementation must enforce a finite transport timeout.
export function liveKitRpc(participant, agentIdentity) {
  if (!agentIdentity) throw new Error("Missing assigned PCM agent");
  return async payload => JSON.parse(await participant.performRpc({
    destinationIdentity: agentIdentity,
    method: "atlas.pcm.v1",
    payload: JSON.stringify(payload),
    responseTimeout: 6000,
  }));
}
