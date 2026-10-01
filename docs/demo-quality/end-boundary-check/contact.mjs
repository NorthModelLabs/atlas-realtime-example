import sharp from 'sharp';
import fs from 'node:fs/promises';
const dir=new URL('.',import.meta.url);
const frames=JSON.parse(await fs.readFile(new URL('frames.json',dir),'utf8'));
const layers=[];
for(const [i,f] of frames.entries()){
 const left=(i%3)*280,top=Math.floor(i/3)*305;
 layers.push({input:await sharp(new URL(f.file,dir).pathname).resize(280,280).toBuffer(),left,top:top+25});
 layers.push({input:Buffer.from(`<svg width="280" height="25"><rect width="280" height="25" fill="white"/><text x="5" y="18" font-size="13">Turn ${Math.floor(i/3)+1}: quiet +${f.sinceAudioEndMs}ms</text></svg>`),left,top});
}
await sharp({create:{width:840,height:Math.ceil(frames.length/3)*305,channels:3,background:'#aaa'}}).composite(layers).jpeg({quality:92}).toFile(new URL('contact.jpg',dir).pathname);
