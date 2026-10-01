import {test} from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
import {createHash} from "node:crypto";
import {PcmSender} from "./sender.mjs";

const generation = "a".repeat(32);

test("sender windows four RPCs and bounds buffered provider output", async () => {
  const waiting = [];
  const sender = await PcmSender.open(async m => {
    if (m.op === "open") return {generation, next_seq: 0};
    if (m.op === "cancel") return {cancelled: true};
    return new Promise(resolve => waiting.push(() => resolve({seq: m.seq, forwarded_samples: (m.seq + 1) * 4800})));
  }, "response_1");
  sender.append(new Uint8Array(48000 * 4));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(waiting.length, 4);
  assert.equal(sender.inFlight.size, 4);
  assert.throws(() => sender.append(new Uint8Array(48000 * 30)), /duration limit/);
  await sender.cancel();
  waiting.forEach(resolve => resolve());
  await assert.rejects(sender.finish(), /cancelled/);
  assert.equal(sender.queue.length, 0);
  assert.equal(sender.inFlight.size, 0);
});

test("transport failure cannot emit a successful end or reopen a cancelled turn", async () => {
  const calls = [];
  const sender = await PcmSender.open(async m => {
    calls.push(m.op);
    if (m.op === "open") return {generation, next_seq: 0};
    if (m.op === "push") throw new Error("private backend detail");
    if (m.op === "cancel") return {cancelled: true};
    throw new Error("unexpected end");
  }, "response_1");
  sender.append(new Uint8Array(4800));
  await assert.rejects(sender.finish(), /forwarding failed/);
  await sender.cancel();
  assert(!calls.includes("end"));
  assert.throws(() => sender.append(new Uint8Array(4800)), /not open/);
});

test("browser sender and Python ingress preserve exact PCM across arbitrary provider chunks", {timeout: 10000}, async () => {
  const process = spawn("python3", [new URL("protocol_fixture.py", import.meta.url).pathname], {stdio: ["pipe", "pipe", "pipe"]});
  const pending = new Map();
  let nextId = 0, errors = "", maxInFlight = 0, inFlight = 0;
  process.stderr.on("data", data => { errors += data; });
  const exited = new Promise(resolve => process.once("exit", resolve));
  createInterface({input: process.stdout}).on("line", line => {
    const message = JSON.parse(line), result = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) result.reject(new Error(message.error)); else result.resolve(message.result);
  });
  function request(message) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("fixture timeout")), 5000);
      pending.set(id, {resolve: v => {clearTimeout(timeout); resolve(v);}, reject: e => {clearTimeout(timeout); reject(e);}});
      process.stdin.write(JSON.stringify({id, ...message}) + "\n");
    });
  }
  try {
    const sender = await PcmSender.open(async payload => {
      if (payload.op === "push") {inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);}
      try {return await request({payload});} finally {if (payload.op === "push") inFlight--;}
    }, "response_1");
    const original = Uint8Array.from({length: 48000 * 4}, (_, i) => (i * 17) % 256);
    let offset = 0;
    for (const size of [19200, 7200, 14800, 4800, original.length]) {
      if (offset === original.length) break;
      const end = Math.min(original.length, offset + size);
      sender.append(original.slice(offset, end));
      offset = end;
    }
    const ended = await sender.finish();
    assert.equal(ended.sealed, true);
    const result = await request({inspect: true});
    const expected = Buffer.from(original);
    assert.equal(result.bytes, expected.length);
    assert.equal(result.sha256, createHash("sha256").update(expected).digest("hex"));
    assert.equal(result.clears, 0);
    assert.equal(result.ends, 1);
    assert.equal(result.phase, "sealed");
    assert(maxInFlight <= 4);
    await sender.cancel();
    assert.equal((await request({inspect: true})).clears, 1);
  } finally {
    process.stdin.end();
    assert.equal(await exited, 0);
    assert.equal(errors, "");
  }
});
