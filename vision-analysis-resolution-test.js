'use strict';

const assert=require('assert');
const fs=require('fs');
const {dimensions,projectDetection}=require('./public/vision-analysis-frame.js');

function close(actual,expected,label){
  assert(Math.abs(actual-expected)<1e-9,`${label}: expected ${expected}, got ${actual}`);
}

function validate(sourceW,sourceH){
  const size=dimensions(sourceW,sourceH,640);
  assert.deepStrictEqual(size,{width:640,height:360});
  const frame={sourceW,sourceH,analysisW:size.width,analysisH:size.height};
  const sx=sourceW/size.width, sy=sourceH/size.height;
  const cases=[
    {cx:320,cy:180,w:160,h:240,angle:.37},
    {cx:0,cy:0,w:32,h:48,angle:-.2},
    {cx:640,cy:360,w:64,h:72,angle:1.1}
  ];
  for(const input of cases){
    const output=projectDetection({...input,conf:.9,cls:0},frame);
    close(output.cx,input.cx*sx,'cx'); close(output.cy,input.cy*sy,'cy');
    close(output.w,input.w*sx,'width'); close(output.h,input.h*sy,'height');
    close(output.angle,input.angle,'angle');
    const analysisArea=(input.w*input.h)/(size.width*size.height);
    const sourceArea=(output.w*output.h)/(sourceW*sourceH);
    close(sourceArea,analysisArea,'area fraction');
  }
}

validate(1920,1080);
validate(1280,720);

const core=fs.readFileSync(require.resolve('./public/vision-core.js'),'utf8');
const capture=core.slice(core.indexOf('function captureAnalysisFrame()'),core.indexOf('function appearanceDescriptor'));
const run=core.slice(core.indexOf('async function runInference()'),core.indexOf('async function toggleDetection()'));
assert(capture,'captureAnalysisFrame must exist');
assert.strictEqual((capture.match(/drawImage\(els\.video/g)||[]).length,1,'analysis snapshot must copy the source once');
assert(run.includes('captureAnalysisFrame()'),'inference must use the shared analysis snapshot');
assert(run.includes('createImageBitmap(analysisFrame.canvas)'),'detector bitmap must come from reduced snapshot');
assert(!run.includes('createImageBitmap(els.video)'),'detector must not copy full-resolution video');

console.log('VISION_ANALYSIS_RESOLUTION_OK 1920x1080->640x360 1280x720->640x360 sourceCopies=1');
