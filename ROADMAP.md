# ROADMAP — Muscu à J2B

Ce fichier trace les évolutions prévues et réalisées de l'application.
À chaque nouvelle session de développement, ajoute ton brief ici avant de demander l'implémentation.

---

## ✅ Session du 26/04/2025 — Saisie des maxis & navigation

- Refonte page Maxis : cartes cliquables, maxi en lecture seule, bannière félicitations
- Footer : verrouillage automatique tant que maxis incomplets
- Nouvelle page "Calculer mon maxi" : formule Brzycki, saisie directe, ateliers spéciaux
- Passage complet au vouvoiement
- Corrections polish UI (reps 5–15, labels blancs, arrondi Math.ceil, etc.)
- Page Séance : % du maxi affiché, compteur séries, intensité sur 3 lignes
- Ateliers spéciaux (Banc à Lombaires, Abdo Sol, Gainage sol) : interface Ok/Échec

---

## ✅ Session du 27/04/2025 — Système de validation des ateliers

### Règle fondamentale
Un atelier est validé si et seulement si 4 séries sont effectuées.
Si l'élève change d'atelier avant 4 séries → séries annulées, rien enregistré dans le GS.

### Ce qui a été fait

**Nouveau système d'enregistrement**
- `onRessenti()` et `onSerieSpeciale()` : plus d'appel immédiat à `incrementSerie`
- Nouvelle fonction `validateAtelier(nomAtelier)` : enregistre dans le GS uniquement à la 4ème série
- `clearAtelierIncomplet(nomAtelier)` : efface le localStorage si changement d'atelier avant 4 séries
- `toggleAtelier()` : efface les séries incomplètes de l'atelier précédent à l'ouverture d'un nouveau
- `Code.gs` : nouveau handler `handleValidateAtelier()` → incrémente compteur global + séries atelier

**Refonte du comptage**
- GS stocke : nombre de validations (+1 par validation, pas +4)
- App affiche : validations × 4 = nombre de séries au total
- Barre de progression : X / 5 ateliers validés (au lieu de X / 20 séries)
- Messages `progressMsg()` adaptés aux ateliers
- Atelier vert (✓) dès 1 validation (au lieu de 4 séries)

**Gestion "Maxi à revoir"**
- Détection automatique : si F ou D à intensité max + reps max sur n'importe quelle des 4 séries
- Warning dans la suggestion box + bouton "Continuer quand même" (débloque la série 4)
- Après validation : bravo-box affiche un rappel ⚠️ "Il faut corriger de suite votre maxi à cet atelier !"
- `clearMaxiForAtelier()` : efface le maxi dans le GS et localement → `updateNavLock()` verrouille immédiatement Projets / Mon Projet / Séances
- L'élève doit recalculer son maxi avant de pouvoir continuer sa séance
- Bouton "📊 Recalculer mon maxi" → redirige vers la page Maxis

**Textes**
- Bravo-box : "Bravo ! Atelier Validé !" (au lieu de "Atelier terminé")
- Barre de progression : message spécial si > 5 ateliers ("Vous dépassez même nos attentes !")

**Bug fix**
- `sw.js` : cache bumped `muscu-j2b-v1` → `muscu-j2b-v2` pour forcer la mise à jour du service worker

---

## 🔜 À tester — Verrouillage après maxi à revoir

Après commit/push du 27/04 et mise à jour du service worker :
- Vérifier que le maxi est bien effacé dans le GS après la bravo-box
- Vérifier que la navigation est bien verrouillée (Projets / Mon Projet / Séances)
- Tester en mode élève normal (pas admin)

---

## 🔜 À optimiser — Performance réseau

**Bravo-box en attente de l'API**
Actuellement la bravo-box n'apparaît qu'après le retour de l'appel `validateAtelier` (GS).
Sur réseau lent, l'élève attend plusieurs secondes avant de voir le message de validation.

Idée : afficher la bravo-box immédiatement, puis envoyer l'appel API en arrière-plan (fire & forget).
Risque à évaluer : si l'appel échoue silencieusement, la validation n'est pas enregistrée dans le GS.

---

## 🔜 À réfléchir — Validation atelier avec maxi sous-évalué

Quand le maxi est détecté comme sous-évalué (warning "Maxi à revoir"), faut-il comptabiliser
la validation de l'atelier ou l'annuler ? Les 4 séries ont été faites avec une charge trop faible
pour être vraiment valides pédagogiquement. Décision en attente.
