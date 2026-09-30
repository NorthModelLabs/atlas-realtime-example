# Apple demo restoration

Correct source: Desktop/realtime-example-app/my-app, committed main 8f0436c. The isolated release checkout preserves the Desktop uncommitted anime experiments. The older Desktop/demo-atlas checkout is not the Apple demo.

Direct OpenAI support originated in commit f085667. This release uses direct OpenAI chat, the working Apple demo ElevenLabs credential, and a dedicated owner Atlas key. It has no Helicone or Prodia dependency. Credentials remain encrypted server-only Vercel variables.

Session operations require signed browser capabilities; session creation and provider routes validate request origin. Creation origin checks are CSRF protection, not user authentication. Viewer links carry a scoped, expiring capability in their fragment. The server requires DEMO_ACCESS_SECRET (32+ random characters) and DEMO_PUBLIC_ORIGIN. Configure these before deploying this branch to any existing project: the old atlas-realtime-example project is separately linked to main and must not receive an unprepared automatic deployment.

The restored client uses the Desktop SDK 0.2.3 video-readiness fixes, resumes audio before publication, and keeps the video element attached when changing UI modes. Next 16.3.8, production build, lint, signature tests and local mock HTTP ownership tests passed. Run the HTTP suite after npm run build with Python requests installed: python3 tests/http-boundary.py. It uses synthetic credentials and loopback servers only.

Hosted checks: direct chat, ElevenLabs TTS and transcription-token creation returned 200. Browser media acceptance remains pending: capacity workers assigned the owned test sessions cannot reach their configured main-security GPU dispatchers. A separately documented narrow network repair awaits specific approval. No GPU image or replica change is part of this demo release.

The deployment remains protected on its preview URL; demo.northmodellabs.com has not been attached. The seven earlier dashboard/API rollout PRs are merged; this new demo restoration is a separate change.
