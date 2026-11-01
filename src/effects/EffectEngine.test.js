import test from 'node:test';
import assert from 'node:assert/strict';
import {createEffect,effectStyles,validateEffects} from './EffectEngine.js';

test('registered effects get safe defaults and stack in order',()=>{
  const exposure={...createEffect('exposure'),value:1,start:0,end:12};
  const blur={...createEffect('blur'),value:4,start:0,end:12};
  const valid=validateEffects([exposure,blur],12);
  const styles=effectStyles(valid,3);
  assert.match(styles.filter,/brightness\(2\)/);
  assert.match(styles.filter,/blur\(4px\)/);
  assert.match(effectStyles(valid,13).filter,/brightness\(1\)/);
});

test('validation rejects unknown effects and unsafe values',()=>{
  assert.throws(()=>validateEffects([{id:'x',type:'arbitrary',value:0,start:0,end:1}],2));
  const blur={...createEffect('blur'),value:999,end:1};
  assert.throws(()=>validateEffects([blur],2));
});

test('keyframes interpolate in the shared preview and export style engine',()=>{
 const exposure={...createEffect('exposure'),value:0,start:0,end:10,keyframes:[{time:0,value:0},{time:10,value:2}]};
 const effects=validateEffects([exposure],10);
 assert.match(effectStyles(effects,5).filter,/brightness\(2\)/);
 assert.throws(()=>validateEffects([{...exposure,keyframes:[{time:11,value:1}]}],10));
});
