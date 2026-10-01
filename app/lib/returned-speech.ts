// Observe the avatar's returned audio, not the provider's earlier generation
// events. This only drives a status label; it never changes media or buffering.
export function observeReturnedSpeech(
  context: AudioContext,
  track: MediaStreamTrack,
  changed: (speaking: boolean) => void,
) {
  const source = context.createMediaStreamSource(new MediaStream([track]));
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let speaking = false;
  let lastSpeech = -Infinity;
  let stopped = false;
  const interval = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let power = 0;
    for (const sample of samples) power += sample * sample;
    const rms = Math.sqrt(power / samples.length);
    const now = performance.now();
    if (rms > (speaking ? 0.001 : 0.005)) lastSpeech = now;
    // Keep brief gaps between words from flickering the label.
    const next = now - lastSpeech < 300;
    if (next !== speaking) { speaking = next; changed(next); }
  }, 60);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    track.removeEventListener("ended", stop);
    source.disconnect();
    analyser.disconnect();
    if (speaking) changed(false);
  };
  track.addEventListener("ended", stop, {once: true});
  return stop;
}
