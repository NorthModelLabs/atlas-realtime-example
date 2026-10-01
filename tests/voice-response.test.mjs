import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const temp=mkdtempSync(join(tmpdir(),'voice-response-'));
execFileSync('node',['node_modules/typescript/bin/tsc','app/lib/voice-response.ts','--outDir',temp,'--module','commonjs','--target','es2020','--skipLibCheck']);
const {VoiceResponseQueue}=createRequire(import.meta.url)(join(temp,'voice-response.js'));
after(()=>rmSync(temp,{recursive:true,force:true}));
function fixture(){const sent=[];return {sent,q:new VoiceResponseQueue(e=>sent.push(e)),count:type=>sent.filter(e=>e.type===type).length};}
test('two submissions before acknowledgement never create overlapping responses',()=>{
 const {q,sent,count}=fixture();q.submit('Count');q.submit('Stop. Say hello.');
 assert.equal(count('response.create'),1);assert.equal(count('response.cancel'),0);
 q.created('first');assert.deepEqual(sent.slice(-2),[{type:'response.cancel',response_id:'first'},{type:'output_audio_buffer.clear'}]);
 assert.equal(count('response.create'),1);assert(q.ignores('first'));
 q.done('first');assert.equal(count('response.create'),2);assert(q.busy);
 q.created('second');assert(!q.ignores('second'));q.done('second');assert(!q.busy);
});
test('multiple corrections preserve every input and request only one replacement',()=>{
 const {q,sent,count}=fixture();q.submit('A');q.created('one');q.submit('B');q.submit('C');
 assert.equal(count('response.cancel'),1);assert.equal(count('response.create'),1);
 assert.deepEqual(sent.filter(x=>x.type==='conversation.item.create').map(x=>x.item.content[0].text),['A','B','C']);
 q.done('one');assert.equal(count('response.create'),2);q.done('one');assert.equal(count('response.create'),2);
});
test('interrupt a server-created voice response and ignore stale completion',()=>{
 const {q,count}=fixture();q.created('spoken');q.submit('hello');q.done('spoken');q.created('typed');
 q.done('spoken');assert(q.busy);assert.equal(count('response.create'),1);assert(!q.ignores('typed'));
 q.done('typed');assert(!q.busy);
});
test('new text after generation finishes clears buffered output without cancelling a completed response',()=>{
 const {q,count}=fixture();q.created('spoken');q.done('spoken');q.submit('hello');
 assert.equal(count('response.cancel'),0);assert.equal(count('output_audio_buffer.clear'),1);assert.equal(count('response.create'),1);
});

test('a rejected creation permits retry without treating an unrelated error as completion',()=>{
 const {q,sent,count}=fixture();q.submit('first');const id=sent.find(x=>x.type==='response.create').event_id;
 q.failed('unrelated');assert(q.busy);q.failed(id);assert(!q.busy);q.submit('retry');
 assert.equal(count('response.create'),2);assert(q.busy);
});
