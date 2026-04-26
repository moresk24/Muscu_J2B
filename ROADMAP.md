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

## 🔜 À venir — idées en attente

📋 MODIFICATIONS PAGE SÉANCE — ATELIERS SPÉCIAUX
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
