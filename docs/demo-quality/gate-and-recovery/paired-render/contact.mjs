import fs from 'node:fs/promises';
import sharp from '/Users/ericsheen/Desktop/avatarhub-production-audit/.codex-work/apple-demo-restore-20260930/node_modules/sharp/dist/index.cjs';
const dir='/private/tmp/atlas-mouth-model-20261001/paired-control-zone-c-r2';
const data=JSON.parse(await fs.readFile(dir+'/observation.json','utf8'));
for(const condition of ['baseline','candidate']){
 const frames=data.frames.filter(x=>x.condition===condition);
 if(!frames.length)continue;
 const layers=[];
 for(const f of frames){
  const col=[0,80,200,400,600,800,1000,1280,1600,2000].indexOf(f.after_last_voiced_frame_ms),left=col*170,top=f.trial*220;
  layers.push({input:await sharp(dir+'/'+f.file).resize(170,170).toBuffer(),left,top});
  layers.push({input:Buffer.from(`<svg width="170" height="50"><rect width="170" height="50" fill="white"/><text x="3" y="16" font-size="12">${condition} T${f.trial+1} +${f.after_last_voiced_frame_ms}ms</text><text x="3" y="33" font-size="12">Noise ${f.noise_level_pcm16}; RMS ${f.paired_audio_rms}</text></svg>`),left,top:top+170});
 }
 await sharp({create:{width:1700,height:880,channels:3,background:'#ddd'}}).composite(layers).jpeg({quality:93}).toFile(dir+'/'+condition+'-contact.jpg');
 console.log(JSON.stringify({condition,frames:frames.length,complete:data.complete.some(x=>x.condition===condition&&x.passed)}));
}
