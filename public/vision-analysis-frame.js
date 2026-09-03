(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.TCGVisionAnalysisFrame=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function dimensions(sourceWidth,sourceHeight,maxWidth=640){
    const sourceW=Math.max(1,Number(sourceWidth)||1);
    const sourceH=Math.max(1,Number(sourceHeight)||1);
    const width=Math.min(Math.max(1,Number(maxWidth)||640),sourceW);
    return {width:Math.round(width),height:Math.max(1,Math.round(sourceH*width/sourceW))};
  }

  function projectDetection(detection,frame){
    const sourceW=Math.max(1,Number(frame?.sourceW)||1);
    const sourceH=Math.max(1,Number(frame?.sourceH)||1);
    const analysisW=Math.max(1,Number(frame?.analysisW)||sourceW);
    const analysisH=Math.max(1,Number(frame?.analysisH)||sourceH);
    const sx=sourceW/analysisW;
    const sy=sourceH/analysisH;
    return {
      ...detection,
      cx:Number(detection.cx||0)*sx,
      cy:Number(detection.cy||0)*sy,
      w:Number(detection.w||0)*sx,
      h:Number(detection.h||0)*sy,
      angle:detection.angle
    };
  }

  function projectDetections(detections,frame){
    return (Array.isArray(detections)?detections:[]).map(item=>projectDetection(item,frame));
  }

  return {dimensions,projectDetection,projectDetections};
});
