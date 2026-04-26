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

## 🔜 À venir — idées en attente

_(Ajoute ici tes prochains briefs)_
