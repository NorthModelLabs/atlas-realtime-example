import test from 'node:test';
import assert from 'node:assert/strict';
import { token, valid } from '../app/lib/demo-capability.mjs';
const key = 'a'.repeat(64), now = 1790800000000;
test('bound to exact resource and kind, rejects forgery', () => {
 const x = token('job', 'abc', key, now);
 assert.equal(valid(x, 'job', 'abc', key, now), true);
 for (const args of [[x,'job','other',key],[x,'session','abc',key],[x,'job','abc','b'.repeat(64)],['garbage','job','abc',key]]) assert.equal(valid(...args, now),false);
});
test('expiry and missing configuration fail closed', () => {
 const x = token('session','ses_abc',key,now);
 assert.equal(valid(x,'session','ses_abc',key,now+3600000),false);
 assert.equal(valid(x,'session','ses_abc','',now),false);
 assert.throws(() => token('job','abc',''));
});
