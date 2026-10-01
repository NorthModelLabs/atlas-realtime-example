// Experimental, preview-only post-drain conditioning. No buffering or resampling.
// An explicit provider drain event is required; response.done does not arm it.
class PostDrainTail extends AudioWorkletProcessor {
  constructor() {
    super();
    this.until = -1;
    this.quietSamples = 0;
    this.gain = 1;
    this.wasSuppressed = false;
    this.port.onmessage = ({ data }) => {
      if (data === "active") {
        this.until = -1;
        this.quietSamples = 0;
        this.gain = 1;
      } else if (data === "drained") {
        // Bound the effect even if a future control event is missing.
        this.until = currentFrame + sampleRate;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0], output = outputs[0];
    const count = output[0]?.length || 0;
    let sum = 0, samples = 0;
    for (const channel of input) {
      for (const value of channel) { sum += value * value; samples++; }
    }
    const rms = samples ? Math.sqrt(sum / samples) : 0;
    this.quietSamples = rms <= 0.001 ? this.quietSamples + count : 0;
    const suppress = currentFrame < this.until && this.quietSamples >= sampleRate * 0.08;
    const previousGain = this.gain;
    this.gain = suppress ? 0 : 1;
    for (let channel = 0; channel < output.length; channel++) {
      const source = input[Math.min(channel, input.length - 1)];
      for (let i = 0; i < count; i++) {
        // Quiet-tail attenuation ramps over one existing render quantum.
        // Resuming speech is immediate and sample-identical, without a fade-in.
        const gain = suppress ? previousGain * (1 - (i + 1) / count) : 1;
        output[channel][i] = (source?.[i] || 0) * gain;
      }
    }
    if (suppress !== this.wasSuppressed) {
      this.wasSuppressed = suppress;
      this.port.postMessage({ suppressed: suppress, rms });
    }
    return true;
  }
}
registerProcessor("post-drain-tail", PostDrainTail);
