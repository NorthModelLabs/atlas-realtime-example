#!/usr/bin/env python3
"""Read-only by default. --apply requires current expected SHAs and passing review receipt.
Changes only legacy Git deployment creation, PR draft state and exact-head source merge.
Never deploys/promotes, edits credentials, or changes domains. Run from repo root.
"""
import argparse, datetime, hashlib, json, os, subprocess, time
from pathlib import Path
import requests

TEAM = 'team_gx50ehY8YErh4QlNv0Z205bm'
LEGACY = 'prj_5AupKllwth1bTY6NpUInysY6M7Fu'
DEMO = 'prj_0njKCW2u69Y6Swzav2keV1dNzv85'
REPO = 'NorthModelLabs/atlas-realtime-example'
EXPECTED_ALIAS = 'dpl_4Gn3kBtiXyzeTusyp8y1b5imU3Ff'
PATHS = ['app', 'public', 'vendor', 'package.json', 'package-lock.json', 'next.config.ts', 'eslint.config.mjs', 'tests']

def command(args, body=None):
    p = subprocess.run(args, input=None if body is None else json.dumps(body), text=True, capture_output=True)
    if p.returncode: raise RuntimeError('Command failed: ' + ' '.join(args[:4]))
    return p.stdout

def gh(path, method='GET', body=None):
    args = ['gh', 'api', path, '--method', method]
    if body is not None: args += ['--input', '-']
    return json.loads(command(args, body))

def fingerprint():
    h = hashlib.sha256()
    names = command(['git', 'ls-files', '-z', '--', *PATHS]).split('\0')
    for name in sorted(filter(None, names)):
        h.update(name.encode() + b'\0' + Path(name).read_bytes() + b'\0')
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-head', required=True)
    parser.add_argument('--expected-base', required=True)
    parser.add_argument('--receipt', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.apply:
        raise RuntimeError("Retired: createDeployments=disabled did not prevent a Git production deployment. Do not reuse this merge procedure; see INCIDENT.md.")
    os.umask(0o077)
    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    session = requests.Session()
    session.headers['Authorization'] = 'Bearer ' + json.loads((Path.home()/'Library/Application Support/com.vercel.cli/auth.json').read_text())['token']
    def vercel(path, method='GET', payload=None):
        response = session.request(method, 'https://api.vercel.com'+path, params={'teamId': TEAM}, json=payload, timeout=35)
        if not response.ok: raise RuntimeError(f'Vercel {method} {path}: HTTP {response.status_code}')
        return response.json()
    def write(name, value):
        (args.output/name).write_text(json.dumps(value, indent=2)+'\n')
    def snapshot():
        projects={}
        for project in [LEGACY,DEMO]:
            p=vercel('/v9/projects/'+project)
            assert p['id']==project and p['accountId']==TEAM
            deps=vercel('/v6/deployments?projectId='+project+'&limit=20')['deployments']
            projects[project]={
                'git':p.get('gitProviderOptions',{}),'link':None if not p.get('link') else {k:p['link'].get(k) for k in ['type','repo','org','productionBranch']},
                'target':p.get('targets',{}).get('production',{}).get('id'),
                'deployments':[{k:d.get(k) for k in ['uid','state','readyState','target','created']} for d in deps],
            }
        aliases={}
        for host in ['demo.northmodellabs.com','atlas-realtime-example.vercel.app']:
            a=vercel('/v4/aliases/'+host)
            aliases[host]={'deployment':a.get('deploymentId') or a.get('deployment',{}).get('id'),'project':a.get('projectId')}
        return {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'projects':projects,'aliases':aliases}
    before=snapshot(); write('before.private.json',before)
    pr=gh('repos/'+REPO+'/pulls/1')
    base=gh('repos/'+REPO+'/branches/main')['commit']['sha']
    assert pr['state']=='open' and pr['head']['sha']==args.expected_head
    assert pr['head']['ref']=='fix/restore-apple-demo-20260930' and pr['base']['ref']=='main'
    assert base==args.expected_base and pr['base']['sha']==base
    assert pr['mergeable'] is True
    assert before['projects'][DEMO]['link'] is None
    assert before['projects'][LEGACY]['link']=={'type':'github','repo':'atlas-realtime-example','org':'NorthModelLabs','productionBranch':'main'}
    assert before['projects'][LEGACY]['git'].get('createDeployments')=='enabled'
    assert before['aliases']['demo.northmodellabs.com']=={'deployment':EXPECTED_ALIAS,'project':DEMO}
    assert before['aliases']['atlas-realtime-example.vercel.app']['project']==LEGACY
    for p in before['projects'].values():
        assert not any(d.get('state') in ['QUEUED','INITIALIZING','BUILDING'] or d.get('readyState') in ['QUEUED','INITIALIZING','BUILDING'] for d in p['deployments'])
    checks=gh('repos/'+REPO+'/commits/'+args.expected_head+'/status')
    assert checks['state']=='success', 'Commit status not successful'
    write('plan.json',{'head':args.expected_head,'base':base,'apply_requested':args.apply,'runtime_sha256':fingerprint(),'change':{'project':LEGACY,'gitProviderOptions':{'createDeployments':'disabled'}},'merge_method':'merge','live_alias_changes':False})
    if not args.apply:
        print(json.dumps({'mode':'read-only','preflight':'passed','head':args.expected_head,'runtime_sha256':fingerprint()})); return
    assert args.receipt, 'Passing review receipt required'
    review=json.loads(args.receipt.read_text())
    assert review['runtime_sha256']==fingerprint()
    assert all(review['checks'].get(x)=='passed' for x in ['unit','lint','typecheck','build','http_boundary','secret_review'])
    assert command(['git','rev-parse','HEAD']).strip()==args.expected_head
    assert not command(['git','diff','--name-only','HEAD','--',*PATHS]).strip(), 'Runtime worktree differs from reviewed commit'
    original_git=before['projects'][LEGACY]['git']; modified={**original_git,'createDeployments':'disabled'}
    changed=False; made_ready=False
    try:
        vercel('/v9/projects/'+LEGACY,'PATCH',{'gitProviderOptions':modified}); changed=True
        disabled=snapshot(); write('disabled.private.json',disabled)
        assert disabled['projects'][LEGACY]['git'].get('createDeployments')=='disabled'
        assert disabled['aliases']==before['aliases']
        assert disabled['projects'][DEMO]['link'] is None
        assert gh('repos/'+REPO+'/branches/main')['commit']['sha']==base
        fresh=gh('repos/'+REPO+'/pulls/1'); assert fresh['head']['sha']==args.expected_head and fresh['state']=='open'
        if fresh['draft']:
            gh('graphql','POST',{'query':'mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id isDraft}}}','variables':{'id':fresh['node_id']}})
            made_ready=True
        merged=gh('repos/'+REPO+'/pulls/1/merge','PUT',{'sha':args.expected_head,'merge_method':'merge'})
        write('merge.json',merged); assert merged.get('merged') is True
        for index in range(5):
            current=snapshot(); write(f'after-{index}.private.json',current)
            assert current['aliases']==before['aliases']
            assert current['projects'][LEGACY]['git'].get('createDeployments')=='disabled'
            for project in [LEGACY,DEMO]:
                assert current['projects'][project]['target']==before['projects'][project]['target']
                assert {d['uid'] for d in current['projects'][project]['deployments']}=={d['uid'] for d in before['projects'][project]['deployments']}
            if index<4: time.sleep(10)
        final=gh('repos/'+REPO+'/pulls/1'); assert final['merged'] and final['merge_commit_sha']==merged['sha']
        for url in ['https://demo.northmodellabs.com','https://dashboard.northmodellabs.com','https://api.atlasv1.com/health']:
            assert requests.get(url,timeout=25).status_code==200
        write('result.json',{'merged':True,'merge_sha':merged['sha'],'aliases_unchanged':True,'new_deployments_observed':False,'legacy_git_deployments':'disabled'})
        print(json.dumps({'merged':True,'merge_sha':merged['sha'],'live_aliases_unchanged':True}))
    except Exception as error:
        # A merge API timeout may have committed. Never re-enable Git based on an ambiguous failure.
        rollback={'error_type':type(error).__name__,'git_restored':False,'draft_restored':False}
        try:
            fresh=gh('repos/'+REPO+'/pulls/1'); branch=gh('repos/'+REPO+'/branches/main')['commit']['sha']
            if changed and not fresh['merged'] and branch==base:
                state=snapshot()
                if state['aliases']==before['aliases'] and state['projects'][LEGACY]['git']==modified:
                    vercel('/v9/projects/'+LEGACY,'PATCH',{'gitProviderOptions':original_git})
                    rollback['git_restored']=vercel('/v9/projects/'+LEGACY).get('gitProviderOptions')==original_git
                if made_ready and fresh['state']=='open' and not fresh['draft']:
                    gh('graphql','POST',{'query':'mutation($id:ID!){convertPullRequestToDraft(input:{pullRequestId:$id}){pullRequest{id isDraft}}}','variables':{'id':fresh['node_id']}})
                    rollback['draft_restored']=True
        except Exception as rollback_error: rollback['rollback_error_type']=type(rollback_error).__name__
        write('failure.json',rollback)
        raise

if __name__=='__main__': main()
