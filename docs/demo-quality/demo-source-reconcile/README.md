# Demo source PR reconciliation — 2026-10-01

The source PR is mergeable, but merging it now is not deployment-safe for the separately hosted legacy demo. This audit made no remote changes. The smallest resolution is to disable Git-triggered deployments on the legacy project, verify that setting and its existing aliases, then merge the reviewed source without moving any live alias. Keep the dedicated demo project manually released until a separate, tested deployment connection is desired.

## Current authoritative state

Read-only GitHub and Vercel checks at approximately 19:51 UTC are retained in `observed-state.json` (environment names only; no values or credentials).

| Item | Verified state |
| --- | --- |
| PR | [NorthModelLabs/atlas-realtime-example #1](https://github.com/NorthModelLabs/atlas-realtime-example/pull/1), open/draft, mergeable/clean |
| Source base | `main`, `8f0436c06ec212aaff02a742463443c1ecd3d54f` |
| Reviewed head | `f35b6e1c055f71aa79c0a530ccb1cc78358466ea` |
| GitHub Vercel check | Successful build in **atlas-realtime-example**, not the dedicated demo project |
| Dedicated project | `demo-atlas`, `prj_0njKCW2u69Y6Swzav2keV1dNzv85`; Git `link:null` |
| Public alias | `demo.northmodellabs.com` → `dpl_4Gn3kBtiXyzeTusyp8y1b5imU3Ff`, source `d618f07a59c7e9a4e6dba575f3ec1297043b96cb` |
| Legacy project | `atlas-realtime-example`, `prj_5AupKllwth1bTY6NpUInysY6M7Fu`; GitHub repository linked, production branch `main`, Git deployments enabled |
| Legacy production | `dpl_HGxTHqaWCXg4HAUsBUorrFC85f3p`, source `8f0436c…`; `atlas-realtime-example.vercel.app` registered to project |
| Legacy required configuration | No `DEMO_ACCESS_SECRET` or `DEMO_PUBLIC_ORIGIN`; new `creationGuard()` returns HTTP 503 when signing secret is missing/short |

`demo-atlas.targets.production` names an older deployment (`dpl_7CQ53…`), whereas the public hostname's alias names `dpl_4Gn3…`. The hostname alias is the relevant evidence for what users receive. Do not infer public deployment from the project target pointer alone or run a blanket project promotion to reconcile it.

The head adds only preview-gated diagnostics to runtime files relative to the public commit: `app/demo.tsx` and `app/lib/voice-diagnostics.ts`. Each new observer immediately returns when `NEXT_PUBLIC_VOICE_DIAGNOSTICS` is not `true`. Other changes include extensive retained evidence and isolated experiments, not proof that outstanding mouth-tail or glitch issues are fixed. This audit is not a full security review of the 834-file PR.

## Smallest proposed change (not executed)

1. Immediately before mutation, re-read both project settings, both live aliases, current PR/base/head and active deployments. Save a private full rollback snapshot. Assert the identifiers above and no overlapping legacy production deployment.
2. In team `team_gx50ehY8YErh4QlNv0Z205bm`, PATCH only legacy project `prj_5AupKllwth1bTY6NpUInysY6M7Fu`, preserving any other current Git options:

   ```json
   {"gitProviderOptions":{"createDeployments":"disabled"}}
   ```

   Endpoint: `/v9/projects/prj_5AupKllwth1bTY6NpUInysY6M7Fu?teamId=team_gx50ehY8YErh4QlNv0Z205bm`.

3. GET the project again and require `createDeployments == "disabled"`; verify existing domains/aliases still point to their prior deployments, the dedicated project still has no Git link, and public demo still loads. This preserves the existing hosted legacy application while preventing future pushes/merges from replacing it.
4. Finish review of the exact final head and existing relevant validation; update stale PR description to distinguish deployed demo behavior, diagnostics, and unresolved visual issues. Mark draft ready and merge with an exact-head condition only after those checks. Parent owns the merge decision; this subtask did not grant itself mutation scope.
5. Re-read merge SHA, both projects' deployment lists and aliases. Require no unexpected new production deployment and unchanged public demo alias. Record the source merge separately from any later demo deployment.
6. Keep legacy Git deployments disabled after merge: restoring enabled immediately would recreate the same risk on the next push. Before any future re-enable, prepare and accept the legacy runtime configuration or explicitly retire that host. Dedicated `demo-atlas` releases continue through the existing exact-project, tested-preview/alias workflow.

The update endpoint and Git options are represented in [Vercel's project API](https://vercel.com/docs/rest-api/projects/update-an-existing-project) and [Vercel's maintained provider implementation](https://github.com/vercel/terraform-provider-vercel/blob/main/client/project.go). The recommended setting is project-scoped; adding `vercel.json` to the shared repo could unintentionally affect every linked project.

## Rollback and limits

Before merging, restore the saved legacy Git option to `enabled` if the reconciliation is abandoned and the main SHA is still unchanged. After merging, do not re-enable until legacy deployment safety is resolved. No DNS, environment values, keys, customer data, GPU settings, model images or live alias changes are needed for this source-only merge plan.

No setting was changed, no PR merged, no deployment created, and no live session started by this audit. This document resolves the reason the PR is still open and gives a concrete execution path; it does not claim the execution is complete or either playback issue fixed.
