'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 function validate(input){const url=new URL(window.TCGWorkspaceLabProvider.normalizeUrl(input));
  if(!/^\/maximelaburthe-commits\/tcgate_db_cyberpunk\/[a-f0-9]{40}\/manifest\.json$/i.test(url.pathname))throw Error('La Candidate doit utiliser son SHA DB immuable.');return url.href;
 }
 function status(message){$('candidateLabStatus').hidden=false;$('candidateLabStatus').textContent=message;}
 function inspectCandidate(input,fromQuery=false){
  try{const manifestUrl=validate(input);$('tab-lab').click();
   if($('labSource').disabled||$('labInspect').disabled){
    if(fromQuery)throw Error('Session Lab occupée ; ouvrir une nouvelle session pour inspecter cette Candidate.');
    const next=new URL('/workspace.html',location.origin);next.searchParams.set('labCandidate',manifestUrl);
    const link=document.createElement('a');link.href=next.href;link.target='_blank';link.rel='noopener noreferrer';link.click();
    status('Candidate ouverte dans une nouvelle session du Lab. Le flux et les captures de cette session sont conservés.');return;
   }
   $('labSource').value='test';$('labSource').dispatchEvent(new Event('change'));
   $('labManifestUrl').value=manifestUrl;$('labManifestUrl').dispatchEvent(new Event('input'));
   status('Manifest Candidate prérempli sur un SHA immuable. Inspection en cours ; activer l’identification reste votre choix.');
   $('labInspect').click();
  }catch(error){status('Inspection Candidate impossible : '+error.message);}
 }
 window.addEventListener('tcgate-workspace-test-candidate',event=>inspectCandidate(event.detail?.manifestUrl));
 const initial=new URL(location.href).searchParams.get('labCandidate');if(initial)queueMicrotask(()=>inspectCandidate(initial,true));
})();
