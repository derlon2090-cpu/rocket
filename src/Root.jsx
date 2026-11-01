import React from 'react';
import {Composition} from 'remotion';
import {Video} from './index';
export const RemotionRoot=()=> <Composition id="Short" component={Video} width={1080} height={1920} fps={30} durationInFrames={436}/>;
