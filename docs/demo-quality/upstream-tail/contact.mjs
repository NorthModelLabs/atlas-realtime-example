import fs from 'node:fs/promises';
import sharp from '/Users/ericsheen/Desktop/avatarhub-production-audit/.codex-work/apple-demo-restore-20260930/node_modules/sharp/dist/index.cjs';
const p='/private/tmp/atlas-mouth-upstream-trace-20261001';const a=JSON.parse(await fs.readFile(p+'/analysis.json'));
const layers=[];
for(let i=0;i<a.tail_windows.length;i++)for(let j=0;j<3;j++){
 const t=a.tail_windows[i],file=p+'/'+t.files[j];const m=await sharp(file).metadata();
 const face=await sharp(file).extract({left:0,top:0,width:m.width,height:m.width}).resize(320,320).toBuffer();
 layers.push({input:face,left:j*320,top:i*350+30});
 const svg=Buffer.from(`<svg width="320" height="30"><rect width="320" height="30" fill="#181818"/><text x="10" y="21" fill="white" font-size="16">Tail ${i+1} · +${t.screenshot_offsets_ms[j]} ms</text></svg>`);
 layers.push({input:svg,left:j*320,top:i*350});
}
await sharp({create:{width:960,height:a.tail_windows.length*350,channels:3,background:'#181818'}}).composite(layers).jpeg({quality:90}).toFile(p+'/contact.jpg');
