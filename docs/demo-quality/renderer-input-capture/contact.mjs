import fs from 'node:fs/promises';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const data=JSON.parse(await fs.readFile(dir+'/queued-observation.json','utf8'));
for(let trial=0;trial<3;trial++){
 const frames=data.frames.filter(f=>f.trial===trial).sort((a,b)=>a.audio_frame-b.audio_frame);if(!frames.length)continue;
 const layers=[];const width=4*256,height=Math.ceil(frames.length/4)*286;
 for(const [i,f] of frames.entries()){
  const left=i%4*256,top=Math.floor(i/4)*286;
  layers.push({input:await sharp(dir+'/'+f.file).resize(256,256).toBuffer(),left,top:top+30});
  layers.push({input:Buffer.from(`<svg width="256" height="30"><rect width="256" height="30" fill="white"/><text x="4" y="20" font-size="13">${f.after_last_voiced_frame_ms}ms / RMS ${f.paired_audio_rms}</text></svg>`),left,top});
 }
 await sharp({create:{width,height,channels:3,background:'#bbb'}}).composite(layers).jpeg({quality:93}).toFile(dir+'/trial-'+trial+'-contact.jpg');
 console.log(JSON.stringify({trial,frames:frames.length}));
}
