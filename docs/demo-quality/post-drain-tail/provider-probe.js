// Numeric-only probe used in an owned synthetic conversation; requires a Playwright page.
await page.addInitScript(()=>{
 window.__providerTail=[];window.__providerTailCleanup=[];
 const create=RTCPeerConnection.prototype.createDataChannel;
 RTCPeerConnection.prototype.createDataChannel=function(label,...args){
  if(label==='oai-events')this.addEventListener('track',async({track})=>{
   if(track.kind!=='audio')return;
   const context=new AudioContext();await context.resume();
   const source=context.createMediaStreamSource(new MediaStream([track]));const analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);
   const mute=context.createGain();mute.gain.value=0;analyser.connect(mute).connect(context.destination);
   const samples=new Float32Array(analyser.fftSize);let previous=0;
   const timer=setInterval(()=>{
    if(window.__providerTail.length>=6000)return;
    analyser.getFloatTimeDomainData(samples);let sum=0,sum2=0,diff2=0,peak=0;
    for(const x of samples){sum+=x;sum2+=x*x;diff2+=(x-previous)**2;previous=x;peak=Math.max(peak,Math.abs(x));}
    const mean=sum/samples.length,rms=Math.sqrt(sum2/samples.length);
    window.__providerTail.push({at:Date.now(),mean,rms,acRms:Math.sqrt(Math.max(0,sum2/samples.length-mean*mean)),derivativeRms:Math.sqrt(diff2/samples.length),peak});
   },20);
   window.__providerTailCleanup.push(()=>{clearInterval(timer);source.disconnect();context.close();});
  });
  return create.call(this,label,...args);
 };
});
