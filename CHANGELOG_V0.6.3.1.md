# V0.6.3.1 — Recovery

Cette version invalide la logique active d’occlusion de V0.6.3 et repart de la stabilité V0.6.2.

- moteur de détection/tracking restauré strictement à V0.6.2 ;
- aucun track d’occlusion ne peut concurrencer ou masquer une détection normale ;
- suppression de la naissance partielle active et de la conservation géométrique V0.6.3 ;
- garde reflet conservée, avec une exception strictement encadrée : une identification déjà acceptée par le matcher avec score >= 0.55 (indice visuel saturé à 100/100) et marge >= 0.24 peut traverser un `glare-high` ;
- les cas glare-high ambigus restent rejetés ;
- compteur `decisiveHighOverrides` ajouté au rapport d’identification.

Objectif : retrouver exactement la détection V0.6.2 avant de reconstruire l’occlusion comme couche secondaire non destructive.
