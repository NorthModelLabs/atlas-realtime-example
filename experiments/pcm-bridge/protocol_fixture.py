"""Local test subprocess only. Synthetic PCM, no network, no credentials."""
import asyncio
import hashlib
import json
import sys

from bridge import PcmBridge


async def main():
    class Sink:
        def __init__(self):
            self.frames = []
            self.now = 0.0
            self.clears = 0
            self.ends = 0

        async def sleep(self, seconds):
            self.now += seconds
            await asyncio.sleep(0)

        async def write(self, data):
            self.frames.append(data)

        async def end(self):
            self.ends += 1

        async def clear(self):
            self.clears += 1

    sink = Sink()
    bridge = PcmBridge("fixture-driver", sink, enabled=True,
                       clock=lambda: sink.now, sleep=sink.sleep)
    tasks = set()

    async def request(message):
        try:
            if message.get("inspect"):
                data = b"".join(sink.frames)
                result = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                          "clears": sink.clears, "ends": sink.ends, "phase": bridge.phase}
            else:
                result = json.loads(await bridge.handle(message.get("caller", "fixture-driver"),
                                                        json.dumps(message["payload"])))
            reply = {"id": message["id"], "result": result}
        except Exception as error:
            reply = {"id": message["id"], "error": str(error)}
        print(json.dumps(reply), flush=True)

    try:
        while line := await asyncio.to_thread(sys.stdin.readline):
            task = asyncio.create_task(request(json.loads(line)))
            tasks.add(task)
            task.add_done_callback(tasks.discard)
        await asyncio.gather(*tasks)
    finally:
        await bridge.close()


if __name__ == "__main__":
    asyncio.run(main())
