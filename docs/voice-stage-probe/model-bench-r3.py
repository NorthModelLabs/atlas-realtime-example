import io,struct,uuid,wave

def benchmark_model(face, pcm):
    def wav(samples):
        out=io.BytesIO()
        with wave.open(out,'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(samples)
        return out.getvalue()
    def call(count,trial):
        boundary='voiceprobe'+uuid.uuid4().hex
        # Supply genuinely shorter audio as well as its requested output count.
        # The source face/model are unchanged; this is a separate experiment.
        clip=pcm[:count*960*2]
        parts=[]
        for key,value in {'cache_key':'voice-probe-fixed-r2','max_frames':str(count),'stream_format':'binary'}.items():
            parts.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+key+'"\r\n\r\n'+value+'\r\n').encode())
        for key,name,ctype,data in [('audio_file','audio.wav','audio/wav',wav(clip)),('image_file','face.jpg','image/jpeg',face)]:
            parts.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+key+'"; filename="'+name+'"\r\nContent-Type: '+ctype+'\r\n\r\n').encode()+data+b'\r\n')
        body=b''.join(parts)+('--'+boundary+'--\r\n').encode();start=time.monotonic();first=None;frames=0;shape=None;milestones={};end_seen=False
        result={'frames_requested':count,'audio_frames_supplied':count,'trial':trial}
        try:
            req=urllib.request.Request('http://127.0.0.1:8000/tasks/stream/bytes',data=body,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
            with HTTP.open(req,timeout=120) as response:
                if response.status!=200:raise RuntimeError('unexpected_http_status')
                if 'application/x-avatar-stream' not in response.headers.get('Content-Type',''):raise RuntimeError('unexpected_stream_content_type')
                def exact(n):
                    chunks=[]
                    while n:
                        b=response.read(n)
                        if not b:raise RuntimeError('truncated_stream')
                        chunks.append(b);n-=len(b)
                    return b''.join(chunks)
                while True:
                    length=struct.unpack('>I',exact(4))[0]
                    if not 0<length<200000000:raise RuntimeError('invalid_record_length')
                    record=exact(length)
                    if record[0]==2:end_seen=True;break
                    if record[0]==3:raise RuntimeError('model_error_record')
                    if record[0]!=1:continue
                    if len(record)<10:raise RuntimeError('short_frame_header')
                    index,h,w,c=struct.unpack('>IHHB',record[1:10])
                    if len(record[10:])!=h*w*c:raise RuntimeError('frame_byte_count_mismatch')
                    if first is None:first=time.monotonic()-start
                    shape=[h,w,c];frames+=1
                    if frames in [1,8,16,32]:milestones[str(frames)]=round((time.monotonic()-start)*1000,1)
                    if frames>64:raise RuntimeError('frame_count_exceeds_probe_bound')
        except Exception as error:
            # Only fixed local parser labels/type; no server response body or URL.
            result['error_type']=type(error).__name__
            if isinstance(error,RuntimeError):result['error_label']=str(error)
        result.update(first_frame_ms=round(first*1000,1) if first is not None else None,total_ms=round((time.monotonic()-start)*1000,1),frames=frames,shape=shape,end_seen=end_seen,frame_count_matches_request=frames==count,frame_milestones_ms=milestones)
        print('VOICE_BENCH_RESULT '+json.dumps(result),flush=True)
    for trial in range(4):call(32,trial)
    for count in [8,16]:
        for trial in range(4):call(count,trial)
