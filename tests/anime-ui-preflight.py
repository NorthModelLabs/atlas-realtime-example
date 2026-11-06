"""Local Chrome routing/layout check. Session requests are deliberately blocked."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import requests
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = Path(os.environ['ANIME_UI_TEST_OUTPUT'])
out.mkdir(parents=True, exist_ok=True)
base = 'http://127.0.0.1:3038'
env = {**os.environ, 'ATLAS_API_URL': 'http://127.0.0.1:1', 'ATLAS_ANIME_API_URL': 'http://127.0.0.1:1',
       'ATLAS_ANIME_TARGET': '', 'ATLAS_ANIME_DEMO_ENABLED': 'true', 'ATLAS_API_KEY': 'synthetic-not-called',
       'OPENAI_API_KEY': 'synthetic-not-called', 'DEMO_ACCESS_SECRET': secrets.token_hex(32), 'DEMO_PUBLIC_ORIGIN': base}
with tempfile.TemporaryFile() as log:
    proc = subprocess.Popen(['npm', 'run', 'start', '--', '--hostname', '127.0.0.1', '--port', '3038'], cwd=root, env=env, stdout=log, stderr=log, start_new_session=True)
    try:
        for _ in range(60):
            try:
                if requests.get(base + '/api/config', timeout=2).json().get('llm'):
                    break
            except (requests.RequestException, ValueError):
                pass
            time.sleep(.5)
        else: raise RuntimeError('Local UI did not start')
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless=True)
            page = browser.new_page(viewport={'width': 1440, 'height': 1080})
            errors, calls = [], []
            page.on('pageerror', lambda e: errors.append(str(e)))
            def blocked(route):
                calls.append(route.request.url.removeprefix(base))
                route.fulfill(status=503, json={'error': 'local_preflight', 'message': 'No real session created'})
            page.route(base + '/api/session', blocked)
            page.route(base + '/api/anime/enrollment', blocked)
            page.goto(base + '/?ui=apple&voice=ai', wait_until='networkidle')
            page.get_by_role('button', name='Start avatar', exact=True).click()
            expect(page.get_by_role('button', name='Start avatar', exact=True)).to_be_enabled()
            assert calls == ['/api/session'], calls
            expect(page.get_by_role('alert').filter(has_text='No real session created')).to_contain_text('No real session created')
            page.get_by_role('button', name='Open settings', exact=True).click()
            expect(page.get_by_role('button', name='Use Anime avatar', exact=True)).to_be_visible()
            page.get_by_role('button', name='Use Anime avatar', exact=True).click()
            expect(page.get_by_role('button', name='Use Anime avatar', exact=True)).to_be_visible()
            page.screenshot(path=str(out / 'anime-settings-desktop.png'))
            page.get_by_role('button', name='Close settings', exact=True).click()
            page.get_by_role('button', name='Start avatar', exact=True).click()
            expect(page.get_by_role('button', name='Start avatar', exact=True)).to_be_enabled()
            page.wait_for_timeout(500)
            (out / 'after-anime-start.txt').write_text(page.locator('body').aria_snapshot())
            page.screenshot(path=str(out / 'after-anime-start.png'))
            assert calls == ['/api/session', '/api/anime/enrollment'], calls
            expect(page.get_by_role('alert').filter(has_text='No real session created')).to_contain_text('No real session created')
            assert 'Preparing anime portrait' not in page.locator('body').inner_text()
            page.get_by_role('button', name='Open settings', exact=True).click()
            page.set_viewport_size({'width': 390, 'height': 844})
            expect(page.get_by_role('button', name='Use Anime avatar', exact=True)).to_be_visible()
            page.screenshot(path=str(out / 'anime-settings-mobile.png'))
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.get_by_role('button', name='Use Enterprise avatar', exact=True).click()
            expect(page.get_by_role('button', name='Use Enterprise avatar', exact=True)).to_be_visible()
            page.get_by_role('button', name='Close settings', exact=True).click()
            page.get_by_role('button', name='Start avatar', exact=True).click()
            expect(page.get_by_role('button', name='Start avatar', exact=True)).to_be_enabled()
            assert calls == ['/api/session', '/api/anime/enrollment', '/api/session'], calls
            for mode in ('teacher', 'tiktok', 'meet'):
                page.goto(base + '/?ui=' + mode + '&voice=ai', wait_until='networkidle')
                if mode == 'meet':
                    page.get_by_role('button', name='More call actions', exact=True).click()
                # Available preset controls prove the flag is applied to each layout.
                snapshot = page.locator('body').aria_snapshot()
                (out / (mode + '-snapshot.txt')).write_text(snapshot)
                page.screenshot(path=str(out / (mode + '-layout.png')))
                assert page.get_by_role('button', name='Use Anime avatar', exact=True).count() == 1, mode
            assert not errors, errors
            browser.close()
            (out / 'result.json').write_text(json.dumps({'passed': True, 'session_routes': calls, 'page_errors': errors, 'native_e2e': False, 'real_provider_calls': 0}, indent=2) + '\n')
            print((out / 'result.json').read_text())
    finally:
        import signal
        os.killpg(proc.pid, signal.SIGTERM)
        proc.wait(timeout=20)
