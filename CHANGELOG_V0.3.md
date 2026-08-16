# UI V0.3 — Caméra et micro locaux

Ajouts :
- activation réelle caméra + micro via `getUserMedia`;
- demande de permissions dans le lobby;
- aperçu caméra réel avant la partie;
- sélection de la caméra et du microphone après autorisation;
- changement de périphérique;
- conservation du même MediaStream dans l'écran de partie;
- boutons caméra/micro réellement connectés aux MediaStreamTracks;
- état visuel si caméra/micro indisponibles;
- fallback caméra seule ou micro seul si l'accès complet échoue;
- arrêt des tracks lors de la sortie du salon/de la partie.

Toujours volontairement absent :
- aucun réseau réel;
- aucun WebRTC distant;
- aucune détection Vision;
- aucune analyse du flux local;
- aucun compte.
