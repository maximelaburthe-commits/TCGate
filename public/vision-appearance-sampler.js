(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.TCGVisionAppearanceSampler=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DEFAULT_W=12;
  const DEFAULT_H=18;
  const BORDER_RGB=119;

  function channel(data,width,height,x,y,offset){
    if(x<0 || y<0 || x>=width || y>=height) return BORDER_RGB;
    return data[(y*width+x)*4+offset];
  }

  function bilinear(data,width,height,x,y,offset){
    const x0=Math.floor(x), y0=Math.floor(y);
    const fx=x-x0, fy=y-y0;
    const a=channel(data,width,height,x0,y0,offset);
    const b=channel(data,width,height,x0+1,y0,offset);
    const c=channel(data,width,height,x0,y0+1,offset);
    const d=channel(data,width,height,x0+1,y0+1,offset);
    return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
  }

  function descriptor(detection,frame,outW=DEFAULT_W,outH=DEFAULT_H){
    if(!detection || !frame?.data || !frame.width || !frame.height) return null;
    // Pixel-center bilinear sampling mirrors the established affine canvas
    // descriptor. Chrome synthetic fixtures stay >= 0.966 cosine similarity,
    // comfortably above the unchanged 0.76 re-identification threshold.
    const sx=frame.width/Math.max(1,Number(frame.sourceW)||frame.width);
    const sy=frame.height/Math.max(1,Number(frame.sourceH)||frame.height);
    const cx=Number(detection.cx||0)*sx;
    const cy=Number(detection.cy||0)*sy;
    const w=Math.max(2,Number(detection.w||0)*sx);
    const h=Math.max(2,Number(detection.h||0)*sy);
    const shortSide=Math.max(2,Math.min(w,h));
    const longSide=Math.max(2,Math.max(w,h));
    let theta=Number(detection.angle||0);
    if(w>h) theta+=Math.PI/2;
    const cos=Math.cos(theta), sin=Math.sin(theta);
    const innerW=outW-2, innerH=outH-2;
    const count=innerW*innerH;
    const rgb=new Float32Array(count*3);
    const lumas=new Float32Array(count);
    let mean=0, p=0;

    for(let y=1;y<outH-1;y+=1){
      const localY=((y+.5)-outH/2)*longSide/outH;
      for(let x=1;x<outW-1;x+=1){
        const localX=((x+.5)-outW/2)*shortSide/outW;
        const sourceX=cx+cos*localX-sin*localY-.5;
        const sourceY=cy+sin*localX+cos*localY-.5;
        const r=bilinear(frame.data,frame.width,frame.height,sourceX,sourceY,0)/255;
        const g=bilinear(frame.data,frame.width,frame.height,sourceX,sourceY,1)/255;
        const b=bilinear(frame.data,frame.width,frame.height,sourceX,sourceY,2)/255;
        const lum=.299*r+.587*g+.114*b;
        rgb[p*3]=r;rgb[p*3+1]=g;rgb[p*3+2]=b;lumas[p]=lum;
        mean+=lum;p+=1;
      }
    }
    if(!count) return null;
    mean/=count;
    let variance=0;
    for(let i=0;i<count;i+=1) variance+=(lumas[i]-mean)**2;
    // Preserve the established Visual Lock normalization exactly: the legacy
    // descriptor used the square root of the summed squared deviations.
    const std=Math.max(.06,Math.sqrt(variance));
    const values=new Float32Array(count*3);
    for(let i=0;i<count;i+=1){
      const r=rgb[i*3],g=rgb[i*3+1],b=rgb[i*3+2],lum=lumas[i];
      const sum=r+g+b+.12;
      values[i*3]=Math.max(-2.5,Math.min(2.5,(lum-mean)/std));
      values[i*3+1]=(r-g)/sum;
      values[i*3+2]=(b-g)/sum;
    }
    return values;
  }

  function batch(detections,frame){
    return (Array.isArray(detections)?detections:[]).map(item=>descriptor(item,frame));
  }

  return {descriptor,batch};
});
