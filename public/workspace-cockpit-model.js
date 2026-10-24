(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.TCGWorkspaceCockpit=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  // Preserve the original permanent Workspace formula; all categories contribute.
  function eligible(items){return items.filter(item=>item.roadmap&&item.status!=='abandoned'&&Number.isFinite(+item.weight)&&+item.weight>0);}
  function score(items){const scope=eligible(items),weight=scope.reduce((sum,item)=>sum+(+item.weight),0);return weight?Math.round(scope.reduce((sum,item)=>sum+(+item.progress||0)*(+item.weight),0)/weight):0;}
  function metrics(items){return {overall:score(items),count:items.length,stableCount:items.filter(item=>['stable','qualified'].includes(item.status)).length,attentionCount:items.filter(item=>['attention','experimental','prototype'].includes(item.status)).length,roadmapCount:eligible(items).length};}
  function category(items,id){return items.filter(item=>item.category===id);}
  return Object.freeze({eligible,score,metrics,category});
});
