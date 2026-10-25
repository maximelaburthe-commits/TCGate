'use strict';
// UI 1.2 owns only navigation and read-only presentation. Existing controllers own all actions.
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
 window.TCGateUi12=Object.freeze({home,lobby,presentLobby});
})();
