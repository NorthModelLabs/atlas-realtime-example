import fs from 'node:fs/promises';
import sharp from '/Users/ericsheen/Desktop/avatarhub-production-audit/.codex-work/apple-demo-restore-20260930/node_modules/sharp/dist/index.cjs';
const dir='/private/tmp/atlas-mouth-model-20261001/quiet-speech-control';
const data=JSON.parse(await fs.readFile(dir+'/observation.json','utf8'));
for(let trial=0;trial<3;trial++){
 const frames=data.frames.filter(x=>x.trial===trial);const positions=[...new Set(frames.map(x=>x.audio_frame))].sort((a,b)=>a-b);if(!frames.length)continue;
 // Four selected times per row, three conditions stacked for each group.
 const layers=[],w=4*210,h=Math.ceil(positions.length/4)*3*190;
 for(const f of frames){const k=positions.indexOf(f.audio_frame),left=(k%4)*210,top=(Math.floor(k/4)*3+['baseline','small','candidate'].indexOf(f.condition))*190;
 layers.push({input:await sharp(dir+'/'+f.file).extract({left:85,top:75,width:95,height:72}).resize(210,159).toBuffer(),left,top:top+29});
 layers.push({input:Buffer.from(`<svg width="210" height="29"><rect width="210" height="29" fill="white"/><text x="4" y="19" font-size="10">${f.condition} F${f.audio_frame} / ${f.after_last_voiced_frame_ms}ms / RMS ${f.paired_audio_rms}</text></svg>`),left,top});}
 await sharp({create:{width:w,height:h,channels:3,background:'#bbb'}}).composite(layers).jpeg({quality:91}).toFile(dir+'/gain-'+[1,0.1,0.01][trial]+'-mouth-contact.jpg');
 console.log(JSON.stringify({trial,frames:frames.length,positions:positions.length,conditions:data.complete.length}));
}
