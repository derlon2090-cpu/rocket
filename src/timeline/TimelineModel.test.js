import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteClip,duplicateClip,makeClip,makeTrack,moveClip,resizeClip,snapFrame,splitClip,timelineDuration} from './TimelineModel.js';

test('timeline edits use frame-aligned positions and preserve source trims',()=>{
 const clip=makeClip({id:'media',url:'/media/a.mp4',name:'a',duration:4},0,4);let track={...makeTrack('video'),clips:[clip]};
 track=splitClip(track,clip.id,2);assert.equal(track.clips.length,2);assert.equal(track.clips[0].sourceEnd,2);assert.equal(track.clips[1].sourceStart,2);
 track=moveClip(track,track.clips[1].id,4,[0,2,4]);assert.equal(track.clips[1].start,4);assert.equal(track.clips[1].end,6);
 track=resizeClip(track,track.clips[1].id,'end',7);assert.equal(track.clips[1].end,6);assert.equal(track.clips[1].sourceEnd,4);
 assert.equal(snapFrame(1.011),1);assert.equal(timelineDuration([track]),6);
 const copy=duplicateClip(track,track.clips[0].id);assert.equal(copy.clips.length,3);assert.equal(deleteClip(copy,copy.clips[0].id).clips.length,2);
});

test('track creation accepts supported types and rejects invalid ones',()=>{for(const type of ['video','audio','text','image','effects'])assert.equal(makeTrack(type).type,type);assert.throws(()=>makeTrack('unknown'));});
