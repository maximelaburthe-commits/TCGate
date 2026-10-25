'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const lf=s=>s.replace(/\r\n/g,'\n'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function section(html,id){const start=html.indexOf('<section id="'+id+'"');assert(start>=0,'Missing '+id);const tags=/<section\b[^>]*>|<\/section>/g;tags.lastIndex=start;let depth=0,match;while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(!depth)return html.slice(start,tags.lastIndex);}throw Error('Unbalanced '+id);}
function assertHome(html){
 const home=section(html,'screenHome');for(const id of ['goCreate','goJoin','resumeSessionCard','resumeSessionButton'])assert(home.includes('id="'+id+'"'),'Missing Home action '+id);
 for(const page of ['accueil','fonctionnement','fonctions','jeux','alpha']){assert(home.includes('data-home-page="'+page+'"'),'Missing internal page '+page);assert(home.includes('id="ui12-home-'+page+'"'),'Missing internal panel '+page);}
 assert(!home.includes('home-alpha-orbit-hero-approved.webp'),'Orbit is not used in Home');assert(!home.includes('tcgate-home-visual'),'No decorative right illustration');
 assert(home.includes('La plateforme webcam pensée pour les TCG'));assert(home.includes('TCGate assiste la partie, il ne la remplace pas.'));assert(!/SWU|Neuroscape|Hellbreak/.test(home));
 const images=[...home.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m=>m[1]);assert(images.every(src=>src==='/assets/tcgate-logo-final.png'),'Only the approved identity asset is used on Home');
}
function withoutGigAdoption(source){let value=lf(source);const adopt='  const previousGigDiceEnabled = state.gigDiceEnabled;\n  state.gigDiceEnabled = gigDiceEnabledFromSnapshot(snapshot);\n';assert(value.includes(adopt),'Missing authoritative room bool adoption');value=value.replace(adopt,'');const render='  } else if (previousGigDiceEnabled !== state.gigDiceEnabled) {\n    renderGigDicePanel();\n  }\n  syncHubSessionControls();';assert(value.includes(render),'Unexpected room adoption scope');return value.replace(render,'  }');}
function assertGame(html,ux){
 assert.equal(hash(lf(section(html,'screenGame'))),'6e6806461eb164695df0a4b3721e067fe24547c73c8d829b339713502a13a091','Full Table HTML must remain unchanged');
 let suffix=lf(ux.slice(ux.indexOf('  const game =')));const guard="      if (gigTotem.disabled || gigTotem.hidden || (typeof root.gigDiceEnabledForCurrentGame === 'function' && !root.gigDiceEnabledForCurrentGame())) return;\n";
 assert(suffix.includes(guard),'Disabled Gig presentation gate missing');suffix=suffix.replace(guard,'');
 assert.equal(hash(suffix),'7951599b64b740224f7e9b8f443f47f131e8d06075f504d37d7070eb8acbc7f8','Existing Table presentation must remain unchanged except the disabled-module gate');
}
module.exports={section,assertHome,assertGame,withoutGigAdoption,hash,lf};
