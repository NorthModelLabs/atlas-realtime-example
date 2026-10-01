(() => {
  const original = window.RTCPeerConnection;
  let count = 0;
  window.RTCPeerConnection = new Proxy(original, {
    construct(target, args, newTarget) {
      const pc = Reflect.construct(target, args, newTarget);
      const peer = ++count;
      let reading = false;
      const timer = setInterval(async () => {
        if (pc.connectionState === 'closed') { clearInterval(timer); return; }
        if (reading) return;
        reading = true;
        try {
          const report = await pc.getStats();
          const rows = [];
          report.forEach(row => {
            if (row.type !== 'inbound-rtp') return;
            const value = {kind:row.kind};
            for (const key of ['timestamp','estimatedPlayoutTimestamp','nackCount','pliCount','firCount','packetsLost','packetsDiscarded','retransmittedPacketsReceived','framesReceived','framesDecoded','framesDropped','framesAssembledFromMultiplePackets','totalAssemblyTime','totalProcessingDelay','jitter','jitterBufferDelay','jitterBufferEmittedCount','concealedSamples','concealmentEvents']) {
              if (typeof row[key] === 'number') value[key] = row[key];
            }
            rows.push(value);
          });
          console.info('NML_VOICE_PROBE', JSON.stringify({at:Date.now(),monotonicMs:performance.now(),stage:'paired_receiver_stats',peer,rows}));
        } catch { /* Read-only observer must not affect a call. */ }
        finally { reading = false; }
      }, 500);
      return pc;
    }
  });
})();
