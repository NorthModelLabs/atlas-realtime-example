BASE='37243fe60e0bc7760dc4c60d54a4f8caa7175b19fd039ae62a0bb6ecdac8599c'
AFTER='bc4c608860e8910af60ae7a09469f563325b9e4a85a4ddc5327a73182eb96be3'
OLD='                    await self._warmup_request_task\n'
NEW='                    try:\n                        await self._warmup_request_task\n                    except asyncio.CancelledError:\n                        # Cancelling an idle request for a launch must not kill the loop.\n                        if asyncio.current_task().cancelling():\n                            raise\n                        self.telemetry.record("warmup_request_cancelled")\n'
OLD_FACE='        image_path = os.environ.get("AVATAR_IMAGE_PATH", "").strip()\n'
NEW_FACE='        image_path = os.environ.get("AVATAR_WARMUP_IMAGE_PATH", "/workspace/warmup-face.jpg").strip()\n'
import hashlib,pathlib,ast
p=pathlib.Path('/workspace/dispatcher.py')
def unchanged_files():
 return {str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in pathlib.Path('/workspace').rglob('*') if f.is_file() and f != p}
before_files=unchanged_files()
s=p.read_text()
assert hashlib.sha256(s.encode()).hexdigest()==BASE, 'unexpected dispatcher base'
assert s.count(OLD)==1 and s.count(OLD_FACE)==1
updated=s.replace(OLD,NEW).replace(OLD_FACE,NEW_FACE)
ast.parse(updated)
assert hashlib.sha256(updated.encode()).hexdigest()==AFTER
p.write_text(updated)

assert unchanged_files()==before_files, 'unrelated application file changed'
print('All non-dispatcher workspace files unchanged')
