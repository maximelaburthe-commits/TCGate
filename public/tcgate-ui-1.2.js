'use strict';
// Site UI 2.0 owns navigation and setup presentation; existing controllers own Room/media/game actions.
(()=>{
 const $=id=>document.getElementById(id);
 function tabs(buttonSelector,panelSelector,key){
  const buttons=[...document.querySelectorAll(buttonSelector)],panels=[...document.querySelectorAll(panelSelector)];
  function activate(value,focus=false){buttons.forEach(button=>{const active=button.dataset[key]===value;button.classList.toggle('ui12-active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus();});panels.forEach(panel=>panel.hidden=panel.dataset[key==='homePage'?'homePanel':'lobbyPanel']!==value);}
  buttons.forEach((button,index)=>{button.addEventListener('click',()=>activate(button.dataset[key]));button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%buttons.length;else if(event.key==='ArrowLeft')next=(index-1+buttons.length)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;event.preventDefault();activate(buttons[next].dataset[key],true);});});
  activate(buttons[0]?.dataset[key]);return activate;
 }
 const home=tabs('[data-home-page]','[data-home-panel]','homePage'),lobby=tabs('[data-lobby-page]','[data-lobby-panel]','lobbyPage');
 document.querySelector('.ui12-brand-home')?.addEventListener('click',event=>{event.preventDefault();home('accueil');});
 const put=(id,value)=>{const node=$(id);if(node&&node.textContent!==String(value))node.textContent=String(value);};
 function presentLobby(){
  // state is the existing app.js owner, read directly without caching or modifying it.
  if(typeof state==='undefined')return;
  const connected=Boolean(state.roomCode&&state.peerId&&state.authToken),creating=state.mode==='create';
  const title=document.querySelector('.ui12-lobby-header h2');
  if(title)title.textContent=connected?'Votre salon de jeu':creating?'Créer une partie':'Rejoindre une partie';
  put('leaveLobby',connected?'Quitter':'Retour');
  if($('siteCreateOptions'))$('siteCreateOptions').hidden=connected||!creating;
  if($('generateReportLobby'))$('generateReportLobby').hidden=!connected;
  if(!connected)put('setupContinue',creating?'Créer la partie':'Rejoindre la partie');
  const heading=document.querySelector('.ui12-session-heading h3'),description=document.querySelector('.ui12-session-heading p');
  if(heading)heading.textContent=connected?'Une session à votre image.':creating?'Choisissez votre table.':'Retrouvez votre adversaire.';
  if(description)description.textContent=connected?'Les réglages sont partagés. L’hôte les ajuste ; chaque joueur prépare son installation.':creating?'Choisissez le jeu et les options, puis créez votre salon privé.':'Saisissez le code reçu et le nom que verra votre adversaire.';
  const gigField=$('siteCreateGigField');if(gigField)gigField.hidden=$('gameSelect').value!=='cyberpunk';
  const snapshot=state.roomSnapshot,me=snapshot?.peers?.find(peer=>peer.id===state.peerId),other=snapshot?.peers?.find(peer=>peer.id!==state.peerId),host=snapshot?.peers?.find(peer=>peer.role==='host');
  put('ui12HostName',host?.name||'En attente…');put('ui12RoomState',snapshot?.phase==='game'?'Partie lancée':state.roomCode?'Salon ouvert · préparation':'Connexion au salon…');
  put('ui12VisionStatus',state.game==='cyberpunk'?'Activée pour Cyberpunk':'Pas de Vision spécifique');
  put('ui12LocalRole',state.role==='host'?'Host':state.role==='guest'?'Guest':'—');put('ui12RemoteRole',state.role==='host'?'Guest':state.role==='guest'?'Host':'—');
  put('ui12LocalPresence',me?.connected?'Connecté':state.roomCode?'Connexion…':'Hors salon');put('ui12RemotePresence',!other?'Absent':other.connected?'Connecté':'Reconnexion…');
  put('ui12LocalReady',state.ownReady?'Prêt':'Non prêt');put('ui12RemoteReady',other?.ready?'Prêt':'Non prêt');
  const live=state.localStream?.getVideoTracks?.().some(track=>track.readyState==='live');put('ui12LocalMedia',live&&state.cameraEnabled?'Caméra opérationnelle':'Caméra à préparer');
 }
 let scheduled=false;
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;presentLobby();});}
 for(const id of ['lobbyPlayerName','lobbyOpponentName','lobbyOwnStatus','opponentWaitingText','networkStatus','lobbyGameLabel','mediaStatus']){const node=$(id);if(node)new MutationObserver(schedule).observe(node,{childList:true,subtree:true,characterData:true});}
 let visible=$('screenLobby').classList.contains('active');new MutationObserver(()=>{const next=$('screenLobby').classList.contains('active');if(next&&!visible)lobby('session');visible=next;schedule();}).observe($('screenLobby'),{attributes:true,attributeFilter:['class']});
 presentLobby();
 let setupPending=false;
 function feedback(message=''){
  const node=$('siteSetupFeedback');if(node){node.textContent=message;node.hidden=!message;}
 }
 function resetCreateOptions(){
  $('siteCreateTimer').checked=true;$('siteCreateMinutes').value='50';$('siteCreateMinutes').disabled=false;$('siteCreateGig').checked=true;
  feedback();presentLobby();
 }
 async function submitSetup(event){
  event?.preventDefault();if(setupPending)return;
  const creating=state.mode==='create',minutes=$('siteCreateMinutes');
  if(creating&&!['cyberpunk','no-game'].includes($('gameSelect').value)){feedback('Choisissez un jeu disponible.');$('gameSelect').focus();return;}
  if(creating&&$('siteCreateTimer').checked&&!minutes.checkValidity()){feedback('Choisissez une durée de 1 à 180 minutes.');minutes.reportValidity();minutes.focus();return;}
  const options=creating?{timer:{enabled:$('siteCreateTimer').checked,durationMinutes:$('siteCreateTimer').checked?minutes.valueAsNumber:50},gigDiceEnabled:$('gameSelect').value==='cyberpunk'&&$('siteCreateGig').checked}:null;
  setupPending=true;feedback();
  try{
   await enterLobby();
   if(!state.roomCode||!state.peerId||!state.authToken){feedback($('toast')?.textContent||'Impossible d’ouvrir ce salon. Réessayez.');return;}
   if(options){
    // Reuse the qualified host settings command; no new Room fields or timer/dice rules.
    await updateHubMetadata(options);
    if(state.roomSnapshot?.timer?.enabled!==options.timer.enabled||state.roomSnapshot?.timer?.durationSeconds!==options.timer.durationMinutes*60||state.roomSnapshot?.gigDiceEnabled!==options.gigDiceEnabled)feedback('Salon créé. Vérifiez vos options dans Session.');
   }
   presentLobby();$('ui12-lobby-tab-installation')?.focus();
  }finally{setupPending=false;}
 }
 $('siteCreateTimer')?.addEventListener('change',()=>{$('siteCreateMinutes').disabled=!$('siteCreateTimer').checked;feedback();});
 $('gameSelect').addEventListener('change',()=>{if($('gameSelect').value!=='cyberpunk')$('siteCreateGig').checked=false;feedback();presentLobby();});
 for(const id of ['goCreate','goJoin'])$(id).addEventListener('click',()=>{feedback();lobby('session');presentLobby();});
 $('playerName').addEventListener('keydown',event=>{if(event.key==='Enter'&&!state.roomCode)submitSetup(event);});
 $('roomCodeInput').addEventListener('keydown',event=>{if(event.key==='Enter'&&!state.roomCode){event.stopImmediatePropagation();submitSetup(event);}},true);
 let returnFocus=null;
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('screenLobby').classList.contains('active')&&!state.roomCode&&!setupPending){event.preventDefault();returnFocus=state.mode==='create'?'goCreate':'goJoin';$('leaveLobby').click();}
 });
 $('leaveLobby').addEventListener('click',()=>{if(!state.roomCode)returnFocus=state.mode==='create'?'goCreate':'goJoin';});
 new MutationObserver(()=>{if(returnFocus&&$('screenHome').classList.contains('active')){$(returnFocus).focus();returnFocus=null;}}).observe($('screenHome'),{attributes:true,attributeFilter:['class']});
 // Reserve the actual fixed-footer height so the final field stays scrollable.
 if(typeof ResizeObserver==='function')new ResizeObserver(()=>{
  $('screenLobby').style.setProperty('--site-ready-height',Math.ceil($('ui12LobbyReady').getBoundingClientRect().height)+'px');
 }).observe($('ui12LobbyReady'));
 window.TCGateUi12=Object.freeze({home,lobby,presentLobby});
 window.TCGateSiteUi20=Object.freeze({home,lobby,presentLobby,submitSetup,resetCreateOptions});
})();
