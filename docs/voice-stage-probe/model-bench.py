import io,struct,uuid,wave

def benchmark_model(face, pcm):
    def wav(samples):
        out=io.BytesIO()
        with wave.open(out,'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(samples)
        return out.getvalue()
    def call(count,trial):
        boundary='voiceprobe'+uuid.uuid4().hex
        # Match the runner's 32-frame padded model input, while requesting only
        # the real leading frame count. Never change weights or model options.
        clip=pcm[:count*960*2].ljust(32*960*2,b'\0')
        parts=[]
        for key,value in {'cache_key':'voice-probe-'+str(count),'max_frames':str(count),'stream_format':'binary'}.items():
            parts.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+key+'"\r\n\r\n'+value+'\r\n').encode())
        for key,name,ctype,data in [('audio_file','audio.wav','audio/wav',wav(clip)),('image_file','face.jpg','image/jpeg',face)]:
            parts.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+key+'"; filename="'+name+'"\r\nContent-Type: '+ctype+'\r\n\r\n').encode()+data+b'\r\n')
        body=b''.join(parts)+('--'+boundary+'--\r\n').encode();start=time.monotonic();first=None;frames=0;shape=None
        req=urllib.request.Request('http://127.0.0.1:8000/tasks/stream/bytes',data=body,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
        with HTTP.open(req,timeout=120) as response:
            assert response.status==200 and 'application/x-avatar-stream' in response.headers.get('Content-Type','')
            def exact(n):
                chunks=[]
                while n:
                    b=response.read(n)
                    if not b:raise RuntimeError('truncated stream')
                    chunks.append(b);n-=len(b)
                return b''.join(chunks)
            while True:
                length=struct.unpack('>I',exact(4))[0];assert 0<length<200000000
                record=exact(length)
                if record[0]==2:break
                if record[0]==3:raise RuntimeError('model stream error')
                if record[0]!=1:continue
                index,h,w,c=struct.unpack('>IHHB',record[1:10]);assert len(record[10:])==h*w*c
                if first is None:first=time.monotonic()-start
                shape=[h,w,c];frames+=1
        assert frames==count
        result={'frames_requested':count,'trial':trial,'first_frame_ms':round(first*1000,1),'total_ms':round((time.monotonic()-start)*1000,1),'frames':frames,'shape':shape}
        print('VOICE_BENCH_RESULT '+json.dumps(result),flush=True)
    for trial in range(4):
        for count in [32,8,16]:call(count,trial)
