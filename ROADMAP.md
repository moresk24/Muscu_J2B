# ROADMAP — Muscu à J2B

Ce fichier trace les évolutions prévues et réalisées de l'application.
À chaque nouvelle session de développement, ajoute ton brief ici avant de demander l'implémentation.

---

## ✅ Session du 26/04/2025 — Saisie des maxis & navigation

### Ce qui a été fait

**Page Maxis — refonte**
- Suppression de l'input maxi inline sur chaque carte d'atelier
- Le maxi s'affiche désormais en lecture seule à droite de la carte
- Suppression du compteur de séries par atelier (info déplacée sur la page Séance)
- Les cartes d'ateliers sont cliquables → navigation vers la page "Calculer mon maxi"
- Bannière de félicitations affichée quand tous les maxis sont remplis
- Message d'invitation à remplir les maxis quand incomplets

**Footer / navigation**
- Boutons "Les Projets", "Mon projet", "Séance" désactivés (disabled) tant que tous les maxis ne sont pas renseignés
- Bouton "Projet" renommé "Les Projets"
- Déverrouillage automatique une fois tous les maxis validés

**Nouvelle page "Calculer mon maxi"**
- Accessible depuis la page Maxis en cliquant sur n'importe quel atelier
- Deux modes : *Calculer mon maxi* (par défaut) et *Saisie directe*
- **Ateliers standard (13)** : saisie charge + reps → formule Brzycki (1RM = poids / (1.0278 − 0.0278 × reps)) → affichage du résultat → bouton "Valider ce maxi"
- **Banc à Lombaires / Abdo Sol** : sélecteur poids additionnel (0 / 2 / 5 / 10 kg), résultat affiché "30 reps en 1' + X kg"
- **Gainage sol** : sélecteur niveau 1 à 4
- Bouton "← Retour" pour revenir à la page Maxis
- Après validation : sauvegarde dans le Google Sheet via l'action `saveMaxis`, retour automatique à la page Maxis

---

---

## ✅ Session du 26/04/2025 (suite) — Corrections & polish UI

- Fix validation reps fourchette 5–15 (était 6–15)
- Fix affichage résultat calcul : "Atelier : votre maxi théorique est X kg"
- Fix footer nav verrouillé au login quand maxis déjà remplis (`updateNavLock` déplacé dans `showPage`)
- Bannière félicitations masquée si projet déjà choisi
- Textes sous-titres projets agrandis (.78rem → .88rem / .8rem → .9rem)
- Page Projets : affichage projet actuel avec données complètes, projet choisi masqué de la liste
- Page Séance : titre intensité avec nom projet et fourchette, texte guide "1ère série"
- Page Calcul maxi : labels en blanc, encadré pédagogique formule Brzycki
- Titre page Maxis : "Vos Maxis (1RM)"
- Passage complet au vouvoiement dans tous les textes de l'app

---

---

## ✅ Session du 26/04/2025 (suite 2) — Séance & polish

- Page Séance : % du maxi affiché après la charge dans chaque série
- Footer : "Séance" → "Séances"
- Calcul maxi : arrondi à l'entier supérieur (Math.ceil)
- Encadré Brzycki : reformulation pédagogique
- Page Séance : compteur "Nbr de série(s) cette séance / 20"
- Page Séance : intensité sur 3 lignes (nom projet / fourchette / guide)
- Page Mon projet : description complète affichée
- Ateliers spéciaux (Banc à Lombaires, Abdo Sol, Gainage sol) : interface Ok/Échec sans charge/reps/ressenti

---



~~📋 MODIFICATIONS PAGE SÉANCE — ATELIERS SPÉCIAUX~~ ✅ Implémenté
🎯 CONTEXTE
Trois ateliers ont une logique de séance différente : Banc à Lombaires, Abdo Sol et Gainage sol.
Au lieu du système standard (charge/reps variable avec ressenti F/D/TD/E), ces ateliers doivent simplement répéter 4 fois le maxi avec un bouton "Ok" ou "Échec" par série.

📋 LOGIQUE POUR CES 3 ATELIERS
Affichage

Titre atelier + icône (comme les autres)
Maxi affiché :

Banc à Lombaires/Abdo Sol : "30 reps en 1' + X kg"
Gainage : "Niveau X"


Message : "Réalise cette série 4 fois"

4 Séries
Chaque série affiche :

Numéro (1, 2, 3, 4)
Le maxi à atteindre
Deux boutons :

"✓ Ok" → série réussie
"✗ Échec" → série échouée



Après validation d'une série

Série marquée comme "faite" (grisée)
Prochaine série apparaît (ou bravo si 4ème terminée)
Pas de suggestion de progression, pas de ressenti

Après 4 séries validées

🎉 Bravo ! Atelier terminé !


🔧 IMPLÉMENTATION

Détecter si atelier ∈ ["Banc à Lombaires", "Abdo Sol", "Gainage sol"]
Si oui → afficher interface spéciale (pas d'intensité, pas de charge/reps variables)
Si non → garder la logique standard existante


📋 SYSTÈME DE VALIDATION DES ATELIERS — REFONTE
🎯 RÈGLE FONDAMENTALE
Un atelier est validé si et seulement si 4 séries y sont effectuées.
Si l'élève effectue 1, 2 ou 3 séries sur un atelier puis change d'atelier, les séries sont annulées et rien n'est enregistré.

📊 MODIFICATION GOOGLE SHEET
Changement de colonne (déjà fait manuellement) :

Ancienne intitulé : "Séries effectuées (cycle)"
Nouvel intitulé : "Ateliers validés (cycle)"
Cette colonne compte maintenant le nombre d'ateliers complétés (avec 4 séries), pas le nombre total de séries



💾 NOUVEAU SYSTÈME D'ENREGISTREMENT
Phase 1 : Pendant la séance (localStorage)

Les séries sont stockées uniquement en localStorage dans state.serieLocale[nomAtelier]
Pas d'enregistrement immédiat dans le GS
Si l'élève change d'atelier avant 4 séries → les données localStorage sont effacées

Phase 2 : À la 4ème série validée
Dès que l'élève valide sa 4ème série :

Afficher 🎉 Bravo ! Atelier validé !
Enregistrer dans le GS :

Appel API pour enregistrer les 4 séries de cet atelier
Incrémenter "Ateliers validés (cycle)" de 1
Mettre à jour la colonne "Séries faites" pour cet atelier (+4)


Effacer les données localStorage pour cet atelier
Élève peut passer à un autre atelier


🔄 FLUX D'UN ATELIER
Atelier ouvert
  ↓
Série 1 : Ok → stockée en localStorage
  ↓
Série 2 : Ok → stockée en localStorage
  ↓
Série 3 : Ok → stockée en localStorage
  ↓
Série 4 : Ok → 🎉 VALIDATION !
  ├─ Enregistrement massif dans GS
  ├─ Incrémentation "Ateliers validés (cycle)"
  └─ Effacement localStorage
  ↓
Élève peut passer à autre atelier
OU (si abandon) :
Atelier A ouvert
  ↓
Série 1 : Ok → stockée en localStorage
Série 2 : Ok → stockée en localStorage
Série 3 : Ok → stockée en localStorage
  ↓
Élève change d'atelier (clique autre atelier ou autre page)
  ↓
❌ Données localStorage de A effacées
❌ Rien enregistré dans le GS

🔧 MODIFICATIONS TECHNIQUES
Code à modifier

onRessenti() : ne doit plus appeler incrementSerie immédiatement
Créer une nouvelle fonction validateAtelier() qui :

Vérifie que 4 séries sont présentes
Enregistre tout dans le GS en une seule requête
Efface les données localStorage


buildSeance() : afficher bravo dès la 4ème série validée
Gestion du changement d'atelier : effacer les données incomplètes

API à adapter ou créer

Possibilité de créer une nouvelle action validateAtelier qui enregistre les 4 séries + incrémente compteur
Ou adapter incrementSerie pour enregistrer les 4 séries à la fois


✅ CHECKLIST

 Modifier onRessenti() → ne pas enregistrer immédiatement
 Créer validateAtelier() → enregistrement massif à 4 séries
 Afficher bravo 🎉 automatiquement à la 4ème série
 Effacer localStorage si changement d'atelier avant 4 séries
 Tester : abandon d'un atelier à 3 séries → rien n'est enregistré
 Tester : 4 séries validées → tout enregistré, compteur incrémenté
 Adapter Code.gs pour gérer l'API de validation


------

À implémenter :


📋 SYSTÈME DE COMPTAGE ATELIERS VALIDÉS — REFONTE AFFICHAGE
🎯 CONTEXTE
Simplifier le système de comptage en passant des "séries faites" aux "validations d'ateliers". L'affichage reste cohérent pour l'élève en multipliant par 4.

📊 MODIFICATIONS GOOGLE SHEET (déjà faites manuellement)
Changement de colonne pour chaque atelier :

Ancienne intitulé : "Nom Atelier — Séries faites"
Nouvel intitulé : "Nom Atelier — Validations"
Cette colonne compte : nombre de fois où l'atelier a été validé (1, 2, 3, 4... validations)

Exemple :

L'élève valide Butterfly 3 fois → colonne affiche "3"
L'élève n'a pas validé Développé Couché → colonne affiche "0" ou vide


💾 NOUVELLE LOGIQUE D'ENREGISTREMENT
Quand l'élève valide un atelier (4ème série) :

Incrémenter la colonne "Nom Atelier — Validations" de +1
✅ C'est tout ! (au lieu d'incrémenter de +4 avant)

Affichage dans la page Séance :

Sous le nom de l'atelier : "Maxi : 20 kg · X séries au total"
Où X = (nombre de validations) × 4
Exemple : 3 validations → 3 × 4 = 12 séries au total


🔧 MODIFICATIONS TECHNIQUES
Fonction handleValidateAtelier() dans Code.gs

Au lieu d'incrémenter la colonne de +4
Incrémenter de +1 (une validation = une fois qu'on a complété 4 séries)

Affichage page Séance — en-tête atelier

Récupérer le nombre de validations depuis le GS
Calculer : validations × 4
Afficher : "Maxi : X kg · ${validations * 4} séries au total"

Exemple de code
javascript// Dans buildSeance() ou buildSeriesHTML()
const validations = parseInt(state.series[atelier.nom]) || 0;
const totalSeries = validations * 4;
const display = `Maxi : ${maxi} ${unite} · ${totalSeries} séries au total`;

📊 BARRE DE PROGRESSION SÉANCE (déjà modifiée)

Affiche : "X / 5 ateliers validés" (inchangé)
Basée sur compteurAteliersSeance (inchangé)


✅ CHECKLIST POUR CC

 Modifier handleValidateAtelier() dans Code.gs → incrémenter de +1 au lieu de +4
 Adapter affichage atelier en séance → calculer validations × 4
 Vérifier que state.series[atelier.nom] contient bien le nombre de validations
 Tester : 1 validation → affiche "4 séries", 3 validations → affiche "12 séries"
 Tester : nouvel atelier → affiche "0 séries" jusqu'à première validation


🎯 RÉSUMÉ

GS stocke : nombre de validations (1, 2, 3...)
App affiche : nombre de validations × 4 = nombre de séries
Avantage : logique plus simple, données cohérentes, affichage naturel pour l'élève

---

## 🔜 À optimiser — Performance réseau

**Bravo-box en attente de l'API**
Actuellement la bravo-box n'apparaît qu'après le retour de l'appel `validateAtelier` (GS).
Sur réseau lent, l'élève attend plusieurs secondes avant de voir le message de validation.

Idée : afficher la bravo-box immédiatement, puis envoyer l'appel API en arrière-plan (fire & forget).
Risque à évaluer : si l'appel échoue silencieusement, la validation n'est pas enregistrée dans le GS.