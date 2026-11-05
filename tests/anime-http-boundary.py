"""Exercise the real Next routes against a local Atlas stub; no paid calls."""
import http.server
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import threading
import time
import requests

ROOT = Path(__file__).resolve().parents[1]
SESSION = 'ses_' + 'c' * 20
calls = []

class Atlas(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def reply(self, method):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        calls.append((method, self.path, body))
        assert self.headers.get('Authorization') == 'Bearer synthetic-anime-test'
        if self.path == '/v1/realtime/anime/enrollments':
            data = {'enrollment_id': 'test_enrollment', 'poll_url': '/v1/realtime/anime/enrollments/test_enrollment', 'realtime_ready': True}
        else:
            data = {'session_id': SESSION, 'status': 'closed' if method == 'DELETE' else 'active'}
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_POST(self): self.reply('POST')
    def do_GET(self): self.reply('GET')
    def do_DELETE(self): self.reply('DELETE')

upstream = http.server.ThreadingHTTPServer(('127.0.0.1', 3318), Atlas)
threading.Thread(target=upstream.serve_forever, daemon=True).start()
base = 'http://127.0.0.1:3210'
env = {**os.environ, 'ATLAS_API_URL': 'http://127.0.0.1:3318',
       'ATLAS_ANIME_API_URL': 'http://127.0.0.1:3318', 'ATLAS_ANIME_TARGET': '',
       'ATLAS_ANIME_DEMO_ENABLED': 'true', 'ATLAS_API_KEY': 'synthetic-anime-test',
       'DEMO_PUBLIC_ORIGIN': base, 'DEMO_ACCESS_SECRET': secrets.token_hex(32),
       'OPENAI_API_KEY': 'synthetic-not-called', 'ATLAS_ANIME_RASTER_JSON_UPLOAD_ENABLED': 'false'}
with tempfile.TemporaryFile() as log:
    proc = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3210'], cwd=ROOT, env=env, stdout=log, stderr=log)
    try:
        for _ in range(100):
            try:
                if requests.get(base + '/api/config', timeout=1).status_code == 200:
                    break
            except requests.RequestException:
                pass
            time.sleep(.2)
        else: raise RuntimeError('Next server failed to start')
        config = requests.get(base + '/api/config').json()
        assert config['animeEnabled'] is True and config['voice'] == 'openai-realtime'
        image = (ROOT / 'public/faces/anime.png').read_bytes()
        def create(origin):
            return requests.post(base + '/api/anime-session', headers={'Origin': origin}, files={'face': ('anime.png', image, 'image/png')}, timeout=10)
        assert create('https://foreign.invalid').status_code == 403
        assert calls == []
        response = create(base)
        assert response.status_code == 200, (response.status_code, response.text)
        cookie_header = response.headers['set-cookie']
        assert all(x in cookie_header for x in ('HttpOnly', 'Secure', 'SameSite=strict', 'Path=/api/session/' + SESSION))
        cookie = cookie_header.split(';')[0]
        assert [c[1] for c in calls] == ['/v1/realtime/anime/enrollments', '/v1/realtime/session']
        assert json.loads(calls[-1][2]) == {'mode': 'passthrough', 'mouth_mode': 'anime_realtime', 'anime_enrollment_id': 'test_enrollment'}
        assert image in calls[0][2], 'Original portrait bytes must reach enrollment'
        count = len(calls)
        session = base + '/api/session/' + SESSION
        assert requests.get(session).status_code == 403
        assert requests.get(session, headers={'Cookie': cookie}).status_code == 200
        assert requests.post(session + '/voice', headers={'Origin': base}).status_code == 403
        assert requests.post(session + '/voice', headers={'Origin': base, 'Cookie': cookie}, json={}).status_code == 415
        assert requests.delete(session, headers={'Origin': 'https://foreign.invalid', 'Cookie': cookie}).status_code == 403
        assert requests.delete(session, headers={'Origin': base, 'Cookie': cookie}).status_code == 200
        assert len(calls) == count + 2, 'Denied requests must never reach Atlas'
        response = create(base)
        assert response.status_code == 200 and response.headers['X-Atlas-Anime-Enrollment-Cache'] == 'hit'
        assert sum(path.endswith('/enrollments') for _, path, _ in calls) == 1
        print(json.dumps({'passed': True, 'same_api': True, 'original_portrait_bytes': True, 'session_capability_and_voice_guards': True, 'cached_enrollment': True, 'real_provider_calls': 0}))
    finally:
        proc.terminate()
        proc.wait(timeout=15)
        upstream.shutdown()
