import test from 'node:test';
import assert from 'node:assert/strict';
import {alignClipToUtterances} from './LocalAIProvider.js';

test('semantic clip bounds expand to complete timestamped Whisper utterances',()=>{
  const words=[{word:'هذه',start:0,end:.4},{word:'جملة.',start:.4,end:1},{word:'ثم',start:1.2,end:1.5},{word:'أكمل.',start:1.5,end:2}];
  const utterances=[{start:0,end:1,text:'هذه جملة.'},{start:1.2,end:2,text:'ثم أكمل.'}];
  assert.deepEqual(alignClipToUtterances(.4,1.5,words,utterances,2),{start:0,end:2});
});

test('semantic clip bounds reject invalid and out-of-duration words',()=>{
  assert.equal(alignClipToUtterances(0,4,[{word:'خطأ',start:-1,end:1}],[],3),null);
  assert.deepEqual(alignClipToUtterances(.1,.9,[{word:'صالح',start:0,end:1}],[],3),{start:0,end:1});
});
