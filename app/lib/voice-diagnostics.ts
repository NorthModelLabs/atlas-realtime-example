// Enabled only on an explicitly instrumented preview. No transcripts, audio,
// credentials, addresses or account identifiers are logged or transmitted.
const enabled = process.env.NEXT_PUBLIC_VOICE_DIAGNOSTICS === "true";
export function voiceProbe(stage: string, fields: Record<string, unknown> = {}) {
  if (enabled) console.info("NML_VOICE_PROBE", JSON.stringify({at: Date.now(), stage, ...fields}));
}
export function probeAudio(context: AudioContext, stream: MediaStream, stage: string) {
  if (!enabled) return () => {};
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser(); analyser.fftSize = 1024; source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let active = false;
  const interval = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const next = rms > (active ? 0.001 : 0.005);
    if (next !== active) {active = next; voiceProbe(stage, {active, rms: Math.round(rms * 100000) / 100000});}
  }, 20);
  return () => {clearInterval(interval); source.disconnect(); analyser.disconnect();};
}
export function probeStats(read: () => Promise<RTCStatsReport | undefined>, stage: string) {
  if (!enabled) return () => {};
  let stopped = false, reading = false;
  const fields = ["kind", "packetsReceived", "packetsSent", "packetsLost", "jitter", "jitterBufferDelay", "jitterBufferEmittedCount", "concealedSamples", "silentConcealedSamples", "concealmentEvents", "totalSamplesReceived", "framesDecoded", "framesDropped", "freezeCount", "totalFreezesDuration", "totalDecodeTime", "currentRoundTripTime", "availableOutgoingBitrate", "totalPacketSendDelay", "bytesSent", "bytesReceived"];
  const interval = setInterval(async () => {
    if (reading) return; reading = true;
    try {
      const report = await read(); if (stopped) return;
      report?.forEach(row => {
        if (!["inbound-rtp", "outbound-rtp", "candidate-pair"].includes(row.type)) return;
        if (row.type === "candidate-pair" && !row.nominated) return;
        const values: Record<string, unknown> = {type: row.type};
        for (const key of fields) if (typeof row[key] === "number" || key === "kind") values[key] = row[key];
        voiceProbe(stage, values);
      });
    } catch { /* Diagnostics never interfere with a live call. */ }
    finally {reading = false;}
  }, 1000);
  return () => {stopped = true; clearInterval(interval);};
}
