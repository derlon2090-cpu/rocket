import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {RenderComposition} from './RenderComposition.jsx';

function Root(){return <Composition id="EditorExport" component={RenderComposition} width={1080} height={1920} fps={30} durationInFrames={300} defaultProps={{media:{src:''},start:0,end:10,aspect:'9:16',words:[],caption:false}} calculateMetadata={({props})=>({durationInFrames:Math.max(1,Math.ceil((props.project?.duration??props.end-props.start)*30)),width:props.aspect==='16:9'?1920:1080,height:props.aspect==='16:9'?1080:props.aspect==='1:1'?1080:1920})}/>}
registerRoot(Root);
