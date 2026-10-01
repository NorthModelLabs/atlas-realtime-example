"""Derived visual review only: 25fps index playback, not measured live timing."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
P=Path(__file__).parent
summary=json.loads((P/'capture-analysis.json').read_text())
conditions=[x['condition'] for x in summary['reports'] if x['archive_integrity_verified']]
for trial in [0,1]:
 frames=[]
 for index in range(100,166):
  canvas=Image.new('RGB',(280,160*len(conditions)),'white');draw=ImageDraw.Draw(canvas)
  for row,c in enumerate(conditions):
   root=P/(c+'-capture');m=json.loads((root/'manifest.json').read_text())
   im=next(x for x in m['images'] if x['trial']==trial and x['kind']=='mouth' and x['frame']==index)
   image=Image.open(root/im['file']);assert image.size==(64,48)
   canvas.paste(image.resize((128,96)),(4,row*160+36))
   draw.text((4,row*160+2),f'{c}: trial{trial} frame{index} / {(index-105)*40}ms',fill='black')
   draw.text((4,row*160+18),f"RMS {im['paired_audio_rms']:.7f}; JPEG q{im['jpeg_quality']}",fill='black')
  frames.append(canvas)
 if frames:
  frames[0].save(P/f'trial-{trial}-mouth-index-sequence.gif',save_all=True,append_images=frames[1:],duration=40,loop=0,optimize=False)
 for name,indices,kind in [('speech',[52,82],'full'),('tail',[105,107,111,120,130,150,165],'mouth')]:
  width=256 if kind=='full' else 128;height=width if kind=='full' else 96
  sheet=Image.new('RGB',(len(indices)*width,len(conditions)*(height+34)),'white');draw=ImageDraw.Draw(sheet)
  for row,c in enumerate(conditions):
   root=P/(c+'-capture')
   for col,index in enumerate(indices):
    image=Image.open(root/f'visuals-{trial}/{kind}-{index:04}.jpg')
    sheet.paste(image.resize((width,height)),(col*width,row*(height+34)+34))
    draw.text((col*width+2,row*(height+34)+3),f'{c} frame{index}',fill='black')
    draw.text((col*width+2,row*(height+34)+17),f'{(index-105)*40}ms ref',fill='black')
  sheet.save(P/f'trial-{trial}-{name}-contact.png')
print('Derived contacts and66frame25fps index sequences created; no live timing or visual acceptance claimed.')
