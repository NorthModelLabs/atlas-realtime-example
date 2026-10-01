# Apple demo restoration

Correct source: Desktop/realtime-example-app/my-app, committed main 8f0436c. The isolated release checkout preserves the Desktop uncommitted anime experiments. The older Desktop/demo-atlas checkout is not the Apple demo.

Direct OpenAI support originated in commit f085667. This release uses direct OpenAI chat, the working Apple demo ElevenLabs credential, and a dedicated owner Atlas key. It has no Helicone or Prodia dependency. Credentials remain encrypted server-only Vercel variables.

Session operations require signed browser capabilities; session creation and provider routes validate request origin. Creation origin checks are CSRF protection, not user authentication. Viewer links carry a scoped, expiring capability in their fragment. The server requires DEMO_ACCESS_SECRET (32+ random characters) and DEMO_PUBLIC_ORIGIN. Configure these before deploying this branch to any existing project: the old atlas-realtime-example project is separately linked to main and must not receive an unprepared automatic deployment.

The restored client uses the Desktop SDK 0.2.3 video-readiness fixes, resumes audio before publication, and keeps the video element attached when changing UI modes. Next 16.3.8, production build, lint, signature tests and local mock HTTP ownership tests passed. Run the HTTP suite after npm run build with Python requests installed: python3 tests/http-boundary.py. It uses synthetic credentials and loopback servers only.

Hosted acceptance passed on September 30, 2026 (October 1 UTC): live 512x512 avatar frames, direct OpenAI chat, ElevenLabs TTS, scoped viewer video, cross-browser session-control rejection and no JavaScript errors. The public URL also passed real transcription from a synthesized microphone fixture: “Please say hello from Atlas” -> direct OpenAI reply -> ElevenLabs audio. All owned sessions were ended after testing.

The approved repair added exactly two network policies permitting agent-worker-launch-25 and agent-worker-launch-30-extra to their already-configured main-security dispatchers on TCP 8089. Every one of the 30 realtime agents reached all ten dispatchers. Both ten-GPU pools preserved actual immutable image IDs, readiness and replica counts. A public demo session subsequently succeeded on agent-worker-launch-30-extra, confirming the previously broken route.

Live URL: https://demo.northmodellabs.com. Dedicated Vercel project demo-atlas, production deployment dpl_G1ETQfSzE72KJjiCojRGsmh8We11, runtime source 93229d49de8094425856f8bf814c484ab2ec9ae0. It was promoted from the accepted preview; later source commits only add release documentation, example environment setup and retained tests. Custom hostname is public; Vercel preview URLs remain protected. The separate production dashboard's aliases and settings were verified unchanged.

The seven earlier dashboard/API rollout PRs are merged. This demo source PR remains a draft because merging main would separately auto-deploy the pre-existing atlas-realtime-example Vercel project, which lacks the new required configuration. That separate project was not changed; this source branch is already deployed in demo-atlas.
