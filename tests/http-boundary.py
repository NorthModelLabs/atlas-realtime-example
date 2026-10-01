import http.server,threading,subprocess,os,time,requests,json,secrets,tempfile
from pathlib import Path
calls=[]
class Mock(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  calls.append(self.path);self.rfile.read(int(self.headers.get('Content-Length',0)));self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'session_id':'ses_'+'a'*20,'status':'active'}).encode())
 def do_GET(self):
  calls.append(self.path);self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"status":"active"}')
server=http.server.HTTPServer(('127.0.0.1',3317),Mock);threading.Thread(target=server.serve_forever,daemon=True).start()
env={**os.environ,'ATLAS_API_URL':'http://127.0.0.1:3317','ATLAS_API_KEY':'synthetic-test-key','DEMO_PUBLIC_ORIGIN':'http://127.0.0.1:3209','OPENAI_API_KEY':'synthetic-not-used','DEMO_ACCESS_SECRET':secrets.token_hex(32)}
p=Path(tempfile.mkdtemp(prefix='apple-demo-boundary-'))
with (p/'apple-boundary-server.log').open('w') as log:
 proc=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3209'],cwd=Path(__file__).resolve().parents[1],env=env,stdout=log,stderr=log)
 try:
  base='http://127.0.0.1:3209'
  for _ in range(80):
   try:
    if requests.get(base,timeout=1).status_code==200:break
   except requests.RequestException:pass
   time.sleep(.25)
  else:raise RuntimeError('Local server not ready')
  session='/api/session/ses_'+'a'*20
  assert requests.get(base+session).status_code==403
  assert requests.post(base+'/api/session',headers={'Origin':'https://foreign.invalid'},json={}).status_code==403
  assert calls==[]
  r=requests.post(base+'/api/session',headers={'Origin':base},json={});assert r.status_code==200,(r.status_code,r.text)
  cookie=r.headers['set-cookie'].split(';')[0]
  assert 'HttpOnly' in r.headers['set-cookie'] and 'Secure' in r.headers['set-cookie'] and 'SameSite=strict' in r.headers['set-cookie']
  assert requests.get(base+session,headers={'Cookie':cookie}).status_code==200
  count=len(calls)
  for path in [session, '/api/session/ses_'+'b'*20]:
   headers={'Cookie':cookie} if path!=session else {}
   assert requests.get(base+path,headers=headers).status_code==403
  assert requests.patch(base+session,headers={'Cookie':cookie,'Origin':'https://foreign.invalid'}).status_code==403
  assert requests.post(base+session+'/viewer',headers={'Origin':base}).status_code==403
  assert requests.post(base+session+'/viewer',headers={'Origin':base,'Cookie':cookie}).status_code==200
  assert len(calls)==count+1
  share=requests.get(base+session+'/share',headers={'Cookie':cookie});assert share.status_code==200
  capability=share.json()['path'].split('#view=')[1]
  assert requests.post(base+session+'/viewer',headers={'Origin':base,'X-Demo-Viewer-Capability':capability}).status_code==200
  assert requests.post(base+'/api/session/ses_'+'b'*20+'/viewer',headers={'Origin':base,'X-Demo-Viewer-Capability':capability}).status_code==403
  assert requests.delete(base+session,headers={'Origin':base,'X-Demo-Viewer-Capability':capability}).status_code==403
  count=len(calls)
  voice=session+'/voice'
  assert requests.post(base+voice,headers={'Origin':base},data='v=0').status_code==403
  assert requests.post(base+voice,headers={'Cookie':cookie,'Origin':'https://foreign.invalid'},data='v=0').status_code==403
  assert requests.post(base+voice,headers={'Cookie':cookie,'Origin':base},json={}).status_code==415
  assert requests.post(base+voice,headers={'Cookie':cookie,'Origin':base,'Content-Type':'application/sdp'},data='invalid').status_code==400
  assert requests.post(base+voice,headers={'Cookie':cookie,'Origin':base,'Content-Type':'application/sdp'},data='v=0'+('x'*65536)).status_code==400
  assert requests.post(base+'/api/session/ses_'+('b'*20)+'/voice',headers={'Cookie':cookie,'Origin':base,'Content-Type':'application/sdp'},data='v=0').status_code==403
  assert len(calls)==count
  result={'voice_guards_passed':True,'passed':True,'cross_browser_denied':True,'cross_resource_denied':True,'cross_origin_denied':True,'authorized_session_allowed':True,'real_provider_calls':0}
  (p/'apple-boundary-test.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
 finally:
  proc.terminate();proc.wait(timeout=15);server.shutdown()
