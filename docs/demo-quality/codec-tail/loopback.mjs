import { chromium } from '/private/tmp/atlas-demo-browser-20260930/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import http from 'node:http';
const root='/private/tmp/atlas-mouth-codec-20261001';
const fixture=await fs.readFile('/private/tmp/atlas-voice-stage-probe-20260930/question.pcm');
const worklet=`class Envelope extends AudioWorkletProcessor {
 constructor(){super();this.n=0;this.sum=0;this.peak=0;}
 process(inputs,outputs){const channels=inputs[0];const x=channels?.[0];if(x){for(let i=0;i<x.length;i++){const v=x[i];this.sum+=v*v;this.peak=Math.max(this.peak,Math.abs(v));this.n++;if(this.n>=sampleRate*.02){this.port.postMessage({time:currentTime+i/sampleRate,rms:Math.sqrt(this.sum/this.n),peak:this.peak});this.sum=0;this.peak=0;this.n=0;}}}return true;}}
registerProcessor('envelope',Envelope);`;
const server=http.createServer((req,res)=>{if(req.url==='/fixture'){res.end(fixture);}else if(req.url==='/worklet.js'){res.setHeader('Content-Type','application/javascript');res.end(worklet);}else{res.setHeader('Content-Type','text/html');res.end('<title>Owned audio codec loopback</title>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-features=WebRtcHideLocalIpsWithMdns']});
const page=await browser.newPage();
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const results=[];
 for(const gain of [1,.01])for(const dtx of [true,false]){
  const result=await page.evaluate(async({gain,dtx})=>{
   const context=new AudioContext({sampleRate:48000});await context.resume();await context.audioWorklet.addModule('/worklet.js');
   const dest=context.createMediaStreamDestination();const track=dest.stream.getAudioTracks()[0];
   const a=new RTCPeerConnection(),b=new RTCPeerConnection();const sourceEvents=[],returnedEvents=[];
   let remoteNode,sourceNode;const candidates=[];
   const gathered=async(peer)=>{for(let i=0;i<200&&peer.iceGatheringState!=='complete';i++)await new Promise(r=>setTimeout(r,25));};
   const received=new Promise(resolve=>{b.ontrack=({track})=>{const stream=new MediaStream([track]);const audio=new Audio();audio.srcObject=stream;audio.muted=true;audio.play();const s=context.createMediaStreamSource(stream);remoteNode=new AudioWorkletNode(context,'envelope');remoteNode.port.onmessage=({data})=>returnedEvents.push(data);s.connect(remoteNode).connect(context.destination);resolve();};});
   const sender=a.addTrack(track,dest.stream);
   const offer=await a.createOffer();await a.setLocalDescription(offer);await gathered(a);await b.setRemoteDescription(a.localDescription);
   const answer=await b.createAnswer();answer.sdp=answer.sdp.replace(/a=fmtp:(\d+) ([^\r\n]*)/g,(line,id,config)=>config.includes('useinbandfec')?`a=fmtp:${id} ${config};usedtx=${dtx?1:0};stereo=1`:line);
   await b.setLocalDescription(answer);await gathered(b);await a.setRemoteDescription(b.localDescription);await received;
   for(let i=0;i<100&&a.connectionState!=='connected';i++)await new Promise(r=>setTimeout(r,50));
   if(a.connectionState!=='connected')throw Error('Loopback failed to connect '+JSON.stringify({a:a.connectionState,b:b.connectionState,iceA:a.iceConnectionState,iceB:b.iceConnectionState,candidatesA:a.localDescription.sdp.split('\r\n').filter(x=>x.startsWith('a=candidate')).length,candidatesB:b.localDescription.sdp.split('\r\n').filter(x=>x.startsWith('a=candidate')).length}));
   const raw=new Int16Array(await (await fetch('/fixture')).arrayBuffer());
   const buffer=context.createBuffer(1,raw.length+24000*3,24000);const channel=buffer.getChannelData(0);for(let i=0;i<raw.length;i++)channel[i]=raw[i]/32768*gain;
   const source=context.createBufferSource();source.buffer=buffer;source.connect(dest);
   sourceNode=new AudioWorkletNode(context,'envelope');sourceNode.port.onmessage=({data})=>sourceEvents.push(data);source.connect(sourceNode).connect(context.destination);
   const start=context.currentTime+1;const end=start+raw.length/24000;source.start(start);
   await new Promise(r=>setTimeout(r,(buffer.duration+4)*1000));
   const stats=[...(await b.getStats()).values()].filter(x=>x.type==='inbound-rtp'&&x.kind==='audio').map(({packetsReceived,packetsLost,concealedSamples,silentConcealedSamples,jitterBufferDelay,jitterBufferEmittedCount})=>({packetsReceived,packetsLost,concealedSamples,silentConcealedSamples,jitterBufferDelay,jitterBufferEmittedCount}));
   const format=answer.sdp.split('\r\n').filter(x=>/^a=(rtpmap|fmtp)/.test(x));
   const senderStats=[...(await a.getStats()).values()].filter(x=>x.type==='outbound-rtp'||x.type==='media-source');const report={senderStats,gain,dtx,sourceStart:start,sourceEnd:end,sourceDuration:buffer.duration,trackSettings:track.getSettings(),format,stats,sourceEvents,returnedEvents};
   source.disconnect();sourceNode.disconnect();remoteNode.disconnect();a.close();b.close();track.stop();await context.close();return report;
  },{gain,dtx});
  results.push(result);await fs.writeFile(root+'/loopback-results-v3.json',JSON.stringify(results));
  const tail=result.returnedEvents.filter(e=>e.time>result.sourceEnd+.2&&e.time<result.sourceEnd+2);
  console.log(JSON.stringify({gain,dtx,stats:result.stats,tailAboveGate:tail.filter(e=>e.rms>.0001).length,tailPeak:Math.max(...tail.map(e=>e.rms)),speechPeak:Math.max(...result.returnedEvents.map(e=>e.rms))}));
 }
}finally{await browser.close();server.close();}
