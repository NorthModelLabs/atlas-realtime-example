import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const temp = mkdtempSync(join(tmpdir(), 'voice-captions-'));
execFileSync('node', ['node_modules/typescript/bin/tsc', 'app/lib/voice-captions.ts', '--outDir', temp, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck']);
const {emptyCaptions, captionEvent: step} = createRequire(import.meta.url)(join(temp, 'voice-captions.js'));
after(() => rmSync(temp, {recursive:true, force:true}));
const input = (type, item_id, extra={}) => ({type:'conversation.item.input_audio_transcription.'+type, item_id, ...extra});
const started = id => ({type:'input_audio_buffer.speech_started', item_id:id});
test('stream input and keep final user words while the answer streams', () => {
 let s = step(emptyCaptions(), started('one'));
 s = step(s,input('delta','one',{delta:'What is '}));
 s = step(s,input('delta','one',{delta:'two plus two?'}));
 assert.equal(s.partial,'What is two plus two?');
 s = step(s,{type:'input_audio_buffer.speech_stopped',item_id:'one'});
 assert.equal(s.partial,'What is two plus two?');
 s = step(s,{type:'response.created',response:{id:'r1'}});
 s = step(s,input('completed','one',{transcript:'What is two plus two?'}));
 s = step(s,{type:'response.output_audio_transcript.delta',response_id:'r1',delta:'Four.'});
 assert.equal(s.user,'What is two plus two?');
 assert.equal(s.partial,''); assert.equal(s.assistant,'Four.');
});
test('late transcription from an earlier turn cannot overwrite current speech', () => {
 let s=step(emptyCaptions(),started('one'));
 s=step(s,started('two'));
 s=step(s,input('delta','two',{delta:'Next question'}));
 s=step(s,input('completed','one',{transcript:'Old question'}));
 assert.equal(s.partial,'Next question');assert.equal(s.user,'');
});
test('interruption rejects late assistant fragments and starts fresh captions', () => {
 let s=step(emptyCaptions(),{type:'response.created',response:{id:'r1'}});
 s=step(s,{type:'response.output_audio_transcript.delta',response_id:'r1',delta:'Old answer'});
 s=step(s,started('two'));
 s=step(s,{type:'response.output_audio_transcript.done',response_id:'r1',transcript:'Old answer complete'});
 assert.equal(s.assistant,'');assert.equal(s.speechActive,true);
 s=step(s,{type:'response.created',response:{id:'r2'}});
 s=step(s,{type:'response.output_audio_transcript.delta',response_id:'r2',delta:'New answer'});
 assert.equal(s.assistant,'New answer');
});
test('cancelled responses clear captions and reject trailing deltas', () => {
 let s=step(emptyCaptions(),{type:'response.created',response:{id:'r1'}});
 s=step(s,{type:'response.done',response:{id:'r1',status:'cancelled'}});
 s=step(s,{type:'response.output_audio_transcript.delta',response_id:'r1',delta:'Stale'});
 assert.equal(s.assistant,'');
});
