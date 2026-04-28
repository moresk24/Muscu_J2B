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

## ✅ Session du 27/04/2026 — Corrections et nouvelles détections

### Correctifs

**Colonne "Classe" dans le Google Sheet**
- Ajout de `COL_CLASSE = 2` dans `Code.gs`, décalage de toutes les constantes `COL_*` de +1

**Admin : bypass du verrou de navigation**
- `maxisAllFilled()` retourne `true` si `state.isAdmin`, évitant le blocage sur page Maxis

**Détection maxi sous-évalué (refonte)**
- Ancienne détection dans `showSuggestion()` sur les reps suggérées → bug : ne se déclenchait pas correctement
- Nouvelle détection dans `onRessenti()` juste après enregistrement, sur les valeurs réelles de `state.serieLocale[nomAtelier][serieIndex]`
- Garde ajoutée contre `state.projet` vide (admin sans projet) qui causait un freeze après série 4

**Redirect forcé après invalidation du maxi**
- `clearMaxiForAtelier()` appelle `showPage('maxis')` avec un délai de 2,5s pour forcer le retour à la page Maxis même si l'élève n'interagit pas avec le warning

**Bouton "Recalculer mon maxi" → page de calcul directe**
- `allerAuxMaxis(nomAtelier)` appelle désormais `goToMaxiCalc(idx)` → atterrit sur `page-maxi-calc` pré-chargée pour l'atelier concerné, au lieu de `page-maxis`

### Nouvelle fonctionnalité — Détection maxi surévalué

**Pendant la séance (warnings intermédiaires)**
- 2 E consécutifs → warning jaune ⚠️ "Maxi peut-être surévalué" + "Continuer quand même" / "Recalculer mon maxi"
- 3 E consécutifs → warning rouge 🚨, ton plus insistant

**À la validation (4 séries)**
- ≥ 2 E sur les 4 séries → `state.maxiARevoir[nomAtelier] = true`
- Bravo-box : message spécifique "surévalué" (distinct du message "sous-évalué")
- Maxi effacé dans le GS → navigation verrouillée jusqu'à recalcul

### Assets

- Nouveaux favicons (6 fichiers) remplacent les anciens
- `sw.js` : ASSETS mis à jour, cache bumped `muscu-j2b-v2` → `muscu-j2b-v3`

---

## ✅ Session du 28/04/2026 — Refactor decideSuggestion + corrections

### Refactor — Centralisation de la logique de suggestion

**Trois fonctions pures extraites** (sans DOM, sans state, testables via `node tests.js`) :

| Fonction | Rôle |
|---|---|
| `decideSuggestion(serie, projet, historique, maxiARevoir)` | Décide quoi suggérer après une série → `{type, params}` |
| `decideValidation(serieLocale, maxiSousEvalue)` | Décide du résultat à la 4e série (surévalué / sous-évalué) |
| `decideNiveauSup(nomAtelier, nbOk, niveauActuel)` | Propose le niveau suivant pour le Gainage sol |

**Types retournés par `decideSuggestion`** : `td-parfait`, `warning-2-echecs`, `warning-3-echecs`, `maxi-sous-eval`, `e-min-intensite`, `e-choix`, `fd-max-intensite`, `fd-force-charge`, `fd-choix`

**`showSuggestion`** réduit à un `switch(type)` pur — aucune logique métier.

**`onRessenti`** et **`validateAtelier`** simplifiés pour utiliser ces décideurs.

**Fichier `tests.js`** créé à la racine : 19 tests couvrant tous les cas métier. Exécutable via `node tests.js` (Node.js à installer si besoin : `brew install node`).

### Corrections

**Bravo-box figée (réseau lent)**
- `validateAtelier` est maintenant appelé en fire & forget dans `onRessenti` et `onSerieSpeciale`
- La bravo-box s'affiche **immédiatement** sans attendre la réponse de l'API GS
- `clearMaxiForAtelier` est appelé directement par les appelants (indépendant du succès/échec de l'API)

**Maxi non effacé après 3 E + 1 TD**
- `clearMaxiForAtelier` était dans `validateAtelier` (donc pas appelé si l'API échouait)
- Désormais appelé dans `onRessenti` avant le fire & forget → effacement garanti

**Timer bravo-box** : 2 500 ms → 5 000 ms (plus de temps pour lire le message)

**Vouvoiement** : corrigé "Continue comme ça" → "Continuez", "Tu veux" → "Vous souhaitez", "augmente" → "augmentez"

### 3 E consécutifs → abandon forcé

- Plus de bouton "Continuer quand même" : un seul bouton "📊 Rechercher mon maxi"
- Texte mis à jour : "Vous devez faire une nouvelle recherche de maxi pour cet atelier !"
- Maxi effacé immédiatement dans le GS et le state
- Séries en cours annulées (atelier non validé)
- Grille réinitialisée à "? × ?" avec boutons bloqués

**Boutons désactivés** : `.ressenti-btn[disabled]` → opacité 30%, curseur `default`

---

## 🔜 À réfléchir — Validation atelier avec maxi sous-évalué

Quand le maxi est détecté comme sous-évalué (warning "Maxi à revoir"), faut-il comptabiliser
la validation de l'atelier ou l'annuler ? Les 4 séries ont été faites avec une charge trop faible
pour être vraiment valides pédagogiquement. Décision en attente.

---

## 🔜 Évolution — Page dédiée par atelier (amélioration UX + contenu pédagogique)

### Vision
Actuellement, tous les ateliers sont affichés en accordéons sur une seule page "Séances".
L'idée est de créer **une page dédiée pour chaque atelier** quand l'élève clique dessus.

### Avantages
- **Plus d'espace** pour afficher des informations pédagogiques riches
- **Meilleure lisibilité** (focus sur un atelier à la fois)
- **Moins de scroll** sur la page Séances
- **Évolutif** : possibilité d'ajouter des schémas anatomiques, vidéos, consignes de sécurité

### Workflow proposé

**Page Séances (simplifiée) :**
- Liste cliquable des ateliers (plus d'accordéons)
- Chaque carte affiche : nom, maxi, nombre de séries au total
- Clic sur une carte → ouvre la page dédiée de l'atelier

**Page Atelier Detail (nouvelle) :**
┌─────────────────────────────────────┐
│ ← Retour     [Nom Atelier]    🏋️   │
├─────────────────────────────────────┤
│ 📊 Maxi : 75 kg · 12 séries totales │
├─────────────────────────────────────┤
│ 🎯 Muscles ciblés                   │
│ [Schéma anatomique - optionnel]    │
├─────────────────────────────────────┤
│ ⚠️ Consignes de sécurité            │
│ • Point 1                           │
│ • Point 2                           │
├─────────────────────────────────────┤
│ [Grille des 4 séries]               │
│ [Suggestion box]                    │
│ [Bravo box]                         │
└─────────────────────────────────────┘

### Implémentation par phases

**Phase 1 : Structure de base (prioritaire)**
- Créer la page `page-atelier-detail`
- Fonction `buildAtelierDetail(atelierNom)`
- Modifier `buildSeance()` pour rendre les cartes cliquables
- Navigation retour vers Séances
- **Effort estimé :** ~200 lignes de code

**Phase 2 : Contenu pédagogique basique**
- Ajouter des consignes de sécurité en texte (par atelier)
- Ajouter les muscles ciblés en détail
- **Effort estimé :** ~50 lignes par atelier (16 ateliers = ~800 lignes de contenu)

**Phase 3 : Schémas anatomiques (optionnel)**
- Ajouter des schémas montrant l'exécution du mouvement
- Ajouter des schémas anatomiques (muscles sollicités)
- Sources possibles :
  - Images libres de droits (Wikimedia Commons, Unsplash)
  - Génération IA (DALL-E, Midjourney)
  - Création custom (Canva, Figma)
- **Effort estimé :** Temps de recherche/création d'images (variable)

### Données à ajouter dans ATELIERS

```javascript
const ATELIERS = [
  {
    nom: "Développé Couché",
    muscles: "Grands Pectoraux · Triceps · Deltoïde ANT.",
    icon: "🏋️",
    groupe: "haut",
    unite: "kg",
    
    // Phase 2
    consignes: [
      "Garder les pieds au sol",
      "Descendre la barre jusqu'aux pectoraux",
      "Ne pas bloquer la respiration"
    ],
    securite: [
      "Utiliser un pareur si charge lourde",
      "Ne jamais verrouiller les coudes en position haute"
    ],
    
    // Phase 3
    schema: "url_ou_base64_image.jpg"
  },
  // ...
]
```

### Décision
À implémenter **après** les bugs majeurs actuels (détection maxi sous/surévalué).
Commencer par **Phase 1** pour améliorer l'UX, puis ajouter le contenu pédagogique progressivement.

---
