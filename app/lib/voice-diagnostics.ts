// Enabled only on an explicitly instrumented preview. No transcripts, audio,
// credentials, addresses or account identifiers are logged or transmitted.
const enabled = process.env.NEXT_PUBLIC_VOICE_DIAGNOSTICS === "true";
export function voiceProbe(stage: string, fields: Record<string, unknown> = {}) {
  if (enabled) console.info("NML_VOICE_PROBE", JSON.stringify({at: Date.now(), stage, ...fields}));
}
// Correlate media disturbances with main-thread scheduling in test previews.
// This observes clocks only; it never changes audio or receiver buffering.
export function probeScheduler(context: AudioContext) {
  if (!enabled) return () => {};
  let previous = performance.now(), reported = previous, maxDelay = 0;
  let previousAudio = context.currentTime;
  let longTasks = 0, longestTask = 0;
  let observer: PerformanceObserver | undefined;
  if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        longTasks++; longestTask = Math.max(longestTask, entry.duration);
      }
    });
    observer.observe({entryTypes: ["longtask"]});
  }
  const interval = setInterval(() => {
    const now = performance.now();
    maxDelay = Math.max(maxDelay, now - previous - 50); previous = now;
    if (now - reported < 1000) return;
    voiceProbe("browser_scheduler", {
      intervalMs: Math.round(now - reported), maxDelayMs: Math.round(maxDelay),
      longTasks, longestTaskMs: Math.round(longestTask),
      audioClockMs: Math.round((context.currentTime - previousAudio) * 1000),
      baseLatencyMs: Math.round(context.baseLatency * 1000),
      outputLatencyMs: typeof context.outputLatency === "number" ? Math.round(context.outputLatency * 1000) : undefined,
      audioState: context.state, visible: document.visibilityState === "visible",
    });
    reported = now; previousAudio = context.currentTime;
    maxDelay = longTasks = longestTask = 0;
  }, 50);
  return () => {clearInterval(interval); observer?.disconnect();};
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
  const fields = ["kind", "packetsReceived", "packetsSent", "packetsLost", "jitter", "jitterBufferDelay", "jitterBufferTargetDelay", "jitterBufferMinimumDelay", "jitterBufferEmittedCount", "concealedSamples", "silentConcealedSamples", "concealmentEvents", "insertedSamplesForDeceleration", "removedSamplesForAcceleration", "totalSamplesReceived", "framesDecoded", "framesDropped", "freezeCount", "totalFreezesDuration", "totalDecodeTime", "currentRoundTripTime", "availableOutgoingBitrate", "totalPacketSendDelay", "bytesSent", "bytesReceived"];
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
