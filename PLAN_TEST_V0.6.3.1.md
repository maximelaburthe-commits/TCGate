# Plan de test V0.6.3.1 Recovery

Test court de 5 à 10 minutes.

1. Une carte seule : détection + identification normales.
2. Deux cartes parfaitement alignées : la carte du dessus DOIT rester détectée. Le test est en échec si toute détection disparaît.
3. Deux cartes décalées : vérifier que le comportement est au moins équivalent à V0.6.2.
4. Crop important : noter le pourcentage approximatif visible et si la carte du dessous est détectée/identifiée.
5. Reflet : reproduire une carte correctement reconnue avec indice visuel 100/100. Si la marge est décisive, elle doit désormais être validée malgré `glare-high`.
6. Provoquer aussi un reflet ambigu : le garde reflet doit continuer à rejeter les correspondances proches.

Cette version ne prétend pas encore résoudre le chevauchement. Elle sert à confirmer la restauration du socle stable avant la prochaine implémentation non destructive.
