const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
(async()=>{
 const dir=__dirname;
 const data=JSON.parse(await fs.readFile(path.join(dir,'observation.json'),'utf8'));
 for(const trial of [0,1]){
  const conditions=['baseline','clamp','repeat'];
  const available=data.frames.filter(f=>f.trial===trial);
  const times=[...new Set(available.map(f=>f.after_last_voiced_frame_ms))].sort((a,b)=>a-b);
  for(const phase of ['speech','tail']){
   const selected=times.filter(t=>phase==='tail'?t>=0:t<0);
   for(let start=0;start<selected.length;start+=5){
    const cols=selected.slice(start,start+5),layers=[];
    for(let row=0;row<3;row++) for(let col=0;col<cols.length;col++){
     const f=available.find(f=>f.condition===conditions[row]&&f.after_last_voiced_frame_ms===cols[col]);
     if(!f)continue;
     const left=col*256,top=row*286;
     layers.push({input:await fs.readFile(path.join(dir,f.file)),left,top:top+30});
     layers.push({input:Buffer.from(`<svg width="256" height="30"><rect width="256" height="30" fill="white"/><text x="4" y="20" font-size="13">${f.condition} ${cols[col]}ms RMS ${f.paired_audio_rms}</text></svg>`),left,top});
    }
    const output=path.join(dir,`trial-${trial}-${phase}-${start}.jpg`);
    await sharp({create:{width:256*cols.length,height:286*3,channels:3,background:'#aaa'}}).composite(layers).jpeg({quality:95}).toFile(output);
    console.log(output);
   }
  }
 }
})().catch(e=>{console.error(e.message);process.exit(1)});
