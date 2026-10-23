(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.TCGWorkspaceCameraStatus=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function availability(secure,media){if(!secure)return 'Contexte non sécurisé : ouvrir le Workspace en HTTPS ou sur localhost.';if(typeof media?.getUserMedia!=='function')return 'getUserMedia non disponible : vérifier le navigateur et les permissions caméra.';return null;}
  function error(message){
    const value=String(message||'');
    if(/NotAllowedError|PermissionDeniedError/.test(value))return 'Permission caméra refusée : autoriser la caméra dans les paramètres du site puis réessayer.';
    if(/NotFoundError|DevicesNotFoundError/.test(value))return 'Aucune caméra disponible : brancher ou activer une caméra puis réessayer.';
    if(/NotReadableError|TrackStartError/.test(value))return 'Caméra déjà utilisée ou inaccessible : fermer les autres applications caméra puis réessayer.';
    if(/OverconstrainedError/.test(value))return 'Caméra ou résolution indisponible : sélectionner la caméra par défaut ou une autre résolution.';
    if(/SecurityError/.test(value))return 'Accès caméra bloqué par le navigateur ou sa politique de sécurité.';
    return value?'Erreur navigateur caméra : '+value:null;
  }
  return Object.freeze({availability,error});
});
