import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(){
 let Processor;
 const env={sampleRate:48000,currentFrame:0,AudioWorkletProcessor:class{constructor(){this.port={onmessage:null,postMessage(){}};}},registerProcessor(_name,ctor){Processor=ctor;}};
 vm.runInNewContext(readFileSync(new URL('./rejected-worklet.js',import.meta.url),'utf8'),env);
 const node=new Processor();
 return {event(data){node.port.onmessage({data});},block(amplitude,channels=1){const input=Array.from({length:channels},()=>Float32Array.from({length:128},(_,i)=>amplitude*Math.sin(i*.3)));const output=Array.from({length:channels},()=>new Float32Array(128));node.process([input],[output]);env.currentFrame+=128;return {input,output};},advance(ms){env.currentFrame+=ms*48;}};
}
function equal({input,output}){assert.equal(output.length,input.length);for(let c=0;c<input.length;c++)assert(output[c].every((v,i)=>v===input[c][i]), 'output changed a required preserved sample');}
test('active speech is sample-identical at normal, quiet and whisper levels, without a block delay',()=>{
 const f=fixture();f.event('active');for(const level of [.2,.01,.001,.0001,.00001])for(let i=0;i<60;i++)equal(f.block(level,2));
});
test('quiet audio is never conditioned without an explicit drain',()=>{
 const f=fixture();for(let i=0;i<500;i++)equal(f.block(.0003));
});
test('drain alone does not suppress audible speech buffered at the receiver',()=>{
 const f=fixture();f.event('drained');for(let i=0;i<100;i++)equal(f.block(.02));
});
test('quiet post-drain tail is attenuated only after the quiet interval, with unchanged sample count',()=>{
 const f=fixture();f.event('drained');for(let i=0;i<29;i++)equal(f.block(.0003));
 const ramp=f.block(.0003);assert.equal(ramp.output[0].length,128);assert.equal(ramp.output[0][127],0);
 assert(f.block(.0003).output[0].every(x=>x===0));
});
test('new response preserves its first quiet sample even after a suppressed tail',()=>{
 const f=fixture();f.event('drained');for(let i=0;i<40;i++)f.block(.0003);
 f.event('active');equal(f.block(.00001));equal(f.block(.02));
});
test('conditioner expires after one second even without another control event',()=>{
 const f=fixture();f.event('drained');for(let i=0;i<40;i++)f.block(.0003);
 f.advance(1000);equal(f.block(.00001));
});

test('quiet buffered signal survives a provider drain event (required acceptance)',()=>{
 const f=fixture();f.event('drained');
 for(let i=0;i<100;i++)equal(f.block(.0003));
});
