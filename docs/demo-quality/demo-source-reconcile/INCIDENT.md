# Source merge side effect and legacy recovery — 2026-10-01

PR #1 merged at commit `78ddbf0be6515a989df4c8ad0c04db3a92bda306` (reviewed head `99ed907d0ab4295ad6f97bb17a66e3d90a54b9d1`). The planned Git-deployment guard failed: Vercel created and automatically aliased a production deployment in the separate legacy project despite `gitProviderOptions.createDeployments` reading back `disabled`. We restored that project's exact prior deployment and then disconnected its Git repository link. The dedicated public demo and dashboard aliases remained unchanged in all recorded checks.

## Timeline (UTC)

- 20:04:24: after the setting PATCH, GET confirmed legacy `createDeployments=disabled`, old target `dpl_HGxTHqaWCXg4HAUsBUorrFC85f3p`, unchanged legacy/demo aliases.
- 20:04:30: merge succeeded; immediate post-merge snapshot still matched.
- 20:04:32.768: Vercel created `dpl_cdxSCSwYwm7vf7UoUVbQCxSBR1rz`, `source=git`, target production, main merge SHA `78ddbf0…`.
- 20:04:41: post-merge checker detected BUILDING legacy target drift and failed. It left Git disabled because the merge had happened; it did not restore unsafe auto-deployment or repeat the merge.
- 20:05:09.910: deployment reached READY. At 20:05:59, all three legacy aliases pointed to the new deployment. Public `demo.northmodellabs.com` still pointed to `dpl_4Gn3kBtiXyzeTusyp8y1b5imU3Ff`.
- 20:07:05: project-scoped rollback POST returned 201. Subsequent checks confirmed production target and two production aliases restored; the Git-main branch alias remained on the new deployment. Vercel also set `autoAssignCustomDomains=false` with updater `system`.
- 20:08:23: explicit restoration of the third, branch-only alias returned 200. All three legacy aliases and legacy target were verified on exact prior deployment `dpl_HGxTHqaWCXg4HAUsBUorrFC85f3p`. Demo/dashboard aliases remained unchanged. Demo, legacy, dashboard and API health returned 200.
- 20:09:25: DELETE of only the legacy Git link returned 200; GET project confirmed `link:null`, same restored target, and all five checked aliases unchanged. Public health checks again returned 200. Vercel's rollback-set `autoAssignCustomDomains=false` remains in place.

## Scope and cause

The affected legacy project is `prj_5AupKllwth1bTY6NpUInysY6M7Fu`, `atlas-realtime-example`. Its three aliases are `atlas-realtime-example.vercel.app`, `atlas-realtime-example-north-model-labs.vercel.app`, and `atlas-realtime-example-git-main-north-model-labs.vercel.app`.

The dedicated `demo-atlas` project (`prj_0njKCW2u69Y6Swzav2keV1dNzv85`) remained on public alias deployment `dpl_4Gn3k…`; dashboard remained `dpl_6bCzZtA8k7UqpsLbo2NRJb6KTRrg`. No API/GPU/model settings, customer accounts, keys, balances or credentials were changed by this reconciliation/recovery. No projects, repositories or deployments were deleted.

The confirmed operational cause is a Git-triggered deployment after merge despite the stored disabled flag. The reason Vercel did not enforce that flag is **not established**; a GET readback and provider schema were insufficient proof of behavior. We should have disconnected the obsolete Git link before merging. The archived five mocked script tests validated branching/error handling only and could not prove Vercel's trigger semantics. The apply path of `reconcile.py` now always refuses execution.

During the temporary legacy rollout, its session creation could fail because the legacy environment lacked `DEMO_ACCESS_SECRET`. We have not inspected request logs or established whether any legacy visitor attempted a session during that interval; HTTP 200 after recovery does not prove zero historical impact. The public demo's active route was not switched.

## Recovery evidence and durable guard

`unexpected-deployment.json`, `legacy-recovery.json` and `legacy-disconnect.json` retain sanitized deployment, alias and health evidence. Full private pre-change Git-link snapshot and operation receipts are under `/private/tmp/atlas-demo-source-merge-20261001`; the link snapshot is mode0600 and is not committed.

Rollback used Vercel's [project rollback endpoint](https://vercel.com/docs/rest-api/projects/point-production-traffic-to-a-previous-production-deployment-by-id), followed by the [alias assignment endpoint](https://vercel.com/docs/rest-api/aliases/assign-an-alias) for the branch alias. Durable prevention used `DELETE /v9/projects/{projectId}/link`, the exact endpoint implemented by `disconnectGitProvider` in the installed Vercel CLI `dist/chunks/chunk-XQQGQ55A.js`. [Vercel's Git settings documentation](https://vercel.com/docs/project-configuration/git-settings) describes project-scoped Git disconnection.

Any later reconnection must be a separate reviewed operation with compatible runtime settings and explicit deployment intent. It is not needed for the merged source or current public demo. Mouth-tail and intermittent playback investigations remain separate and unresolved by this source merge.
