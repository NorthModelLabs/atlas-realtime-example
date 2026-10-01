"""Offline guard tests: all GitHub/Vercel calls mocked, no credentials/network."""
import copy, importlib.util, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs
spec=importlib.util.spec_from_file_location('reconcile',Path(__file__).with_name('reconcile.py'))
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

class Response:
    ok=True; status_code=200
    def __init__(self,value): self.value=value
    def json(self): return copy.deepcopy(self.value)

class GuardTests(unittest.TestCase):
    def run_case(self,scenario='success',apply=True,head='head'):
        state={'git':'enabled','draft':True,'merged':False,'base':'base','writes':[]}
        def api(path,method='GET',body=None):
            if path.endswith('/branches/main'): return {'commit':{'sha':state['base']}}
            if path.endswith('/commits/head/status'): return {'state':'success'}
            if path.endswith('/pulls/1'):
                return {'state':'open' if not state['merged'] else 'closed','head':{'sha':'head','ref':'fix/restore-apple-demo-20260930'},'base':{'sha':'base','ref':'main'},'mergeable':True,'draft':state['draft'],'node_id':'synthetic','merged':state['merged'],'merge_commit_sha':'merged' if state['merged'] else None}
            if path=='graphql':
                state['writes'].append('draft');state['draft']='convertPullRequestToDraft' in body['query'];return {}
            if path.endswith('/merge'):
                state['writes'].append('merge')
                if scenario=='merge_rejected': raise RuntimeError('synthetic rejection')
                state['merged']=True;state['base']='merged'
                if scenario=='merge_timeout': raise TimeoutError('synthetic ambiguous response')
                return {'merged':True,'sha':'merged'}
            raise AssertionError(path)
        def request(method,url,params=None,json=None,timeout=None):
            p=urlparse(url);path=p.path
            if path.startswith('/v9/projects/'):
                project=path.rsplit('/',1)[1]
                if method=='PATCH': state['git']=json['gitProviderOptions']['createDeployments'];state['writes'].append('git:'+state['git'])
                return Response({'id':project,'accountId':m.TEAM,'gitProviderOptions':{'createDeployments':state['git'] if project==m.LEGACY else 'enabled'},'link':{'type':'github','repo':'atlas-realtime-example','org':'NorthModelLabs','productionBranch':'main'} if project==m.LEGACY else None,'targets':{'production':{'id':'old-'+project}}})
            if path=='/v6/deployments': return Response({'deployments':[{'uid':'existing','state':'READY'}]})
            if path.startswith('/v4/aliases/'):
                is_demo=path.endswith('/demo.northmodellabs.com')
                return Response({'deploymentId':m.EXPECTED_ALIAS if is_demo else 'legacy-live','projectId':m.DEMO if is_demo else m.LEGACY})
            raise AssertionError(path)
        def command(args,body=None):
            if args[:2]==['git','rev-parse']: return 'head\n'
            if args[:2]==['git','diff']: return ''
            raise AssertionError(args)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);auth=root/'Library/Application Support/com.vercel.cli';auth.mkdir(parents=True)
            (auth/'auth.json').write_text('{"token":"synthetic"}')
            receipt=root/'receipt.json';receipt.write_text(json.dumps({'runtime_sha256':'fixture','checks':{x:'passed' for x in ['unit','lint','typecheck','build','http_boundary','secret_review']}}))
            argv=['reconcile.py','--expected-head',head,'--expected-base','base','--receipt',str(receipt),'--output',str(root/'output')]+(['--apply'] if apply else [])
            class Session:
                headers={}
            Session.request=staticmethod(request)
            with patch.object(m,'gh',api),patch.object(m,'command',command),patch.object(m,'fingerprint',lambda:'fixture'),patch.object(m.requests,'Session',Session),patch.object(m.requests,'get',lambda *a,**k:Response({})),patch.object(m.Path,'home',lambda:root),patch.object(m.time,'sleep',lambda _:None),patch('sys.argv',argv):
                error=None
                try:m.main()
                except Exception as e:error=e
            state['error']=error
            return state
    def test_read_only_never_writes(self):
        s=self.run_case(apply=False);self.assertIsNone(s['error']);self.assertEqual(s['writes'],[])
    def test_retired_apply_blocks_all_writes(self):
        s=self.run_case();self.assertIsInstance(s['error'],RuntimeError)
        self.assertIn('Retired:',str(s['error']));self.assertEqual(s['writes'],[])

if __name__=='__main__':unittest.main()
