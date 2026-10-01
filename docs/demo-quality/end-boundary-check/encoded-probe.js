(() => {
 window.__encodedFrames=[];window.__providerEvents=[];
 window.__encodedSupport=typeof RTCRtpScriptTransform;
 const code=`self.postMessage({workerStarted:true});self.onrtctransform=({transformer})=>{self.postMessage({transformStarted:true});
  let count=0;
  transformer.readable.pipeThrough(new TransformStream({transform(frame,controller){
   try{if(count++<15000){const m=frame.getMetadata();const b=new Uint8Array(frame.data);self.postMessage({at:Date.now(),size:b.length,toc:b[0],sequenceNumber:m.sequenceNumber,rtpTimestamp:m.rtpTimestamp,audioLevel:m.audioLevel,mimeType:m.mimeType,payloadType:m.payloadType,receiveTime:m.receiveTime});}}catch(e){self.postMessage({error:e.name});}
   controller.enqueue(frame);
  }})).pipeTo(transformer.writable).catch(()=>self.postMessage({error:'transform_failed'}));
 };`;
 const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
 const create=RTCPeerConnection.prototype.createDataChannel;
 RTCPeerConnection.prototype.createDataChannel=function(label,...args){
  const channel=create.call(this,label,...args);
  if(label==='oai-events'){
   channel.addEventListener('message',({data})=>{try{const e=JSON.parse(data);if(window.__providerEvents.length<2000)window.__providerEvents.push({at:Date.now(),type:e.type,keys:Object.keys(e).filter(k=>!['event_id','response_id','item_id'].includes(k)),audioBytes:typeof e.delta==='string'&&e.type==='response.output_audio.delta'?e.delta.length:undefined});}catch{}});
   this.addEventListener('track',({track,receiver})=>{
    if(track.kind!=='audio')return;
    if(typeof RTCRtpScriptTransform!=='function'){window.__encodedFrames.push({error:'not_supported'});return;}
    const worker=new Worker(url);worker.onmessage=({data})=>window.__encodedFrames.push(data);
    worker.onerror=e=>window.__encodedFrames.push({workerError:e.message});receiver.transform=new RTCRtpScriptTransform(worker);window.__encodedReceiver=receiver;window.__encodedFrames.push({attached:receiver.transform instanceof RTCRtpScriptTransform});
    track.addEventListener('ended',()=>worker.terminate(),{once:true});
   });
  }
  return channel;
 };
})();
