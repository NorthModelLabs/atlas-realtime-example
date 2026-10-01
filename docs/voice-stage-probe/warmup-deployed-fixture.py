# Extracted unchanged from the pinned deployed dispatcher for a local async regression test.
class WorkerLauncher:

    async def _cancel_warmup_request(self) -> None:
        task = self._warmup_request_task
        if task and (not task.done()):
            self.telemetry.record('warmup_cancel_for_launch')
            task.cancel()
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass

    async def _warmup_loop(self) -> None:
        self.telemetry.record('warmup_loop_started', detail={'interval_seconds': DISPATCHER_WARMUP_INTERVAL_SECONDS})
        while True:
            try:
                if not self.draining and (not self.has_active_workers()):
                    self._warmup_request_task = asyncio.create_task(self._run_avatar_service_warmup())
                    await self._warmup_request_task
                await asyncio.sleep(max(1.0, DISPATCHER_WARMUP_INTERVAL_SECONDS))
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self._warmup_last_error = type(exc).__name__
                self.telemetry.record('warmup_failed', detail={'error': type(exc).__name__})
                await asyncio.sleep(max(5.0, DISPATCHER_WARMUP_INTERVAL_SECONDS))
