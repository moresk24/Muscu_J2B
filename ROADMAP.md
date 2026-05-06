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

## ✅ Session du 28/04/2026 (soir) — Système de badges & fin de séance

### Système de badges

**Hiérarchie des badges**
- `calculateBadge(nbAteliers)` : Bronze (< 5), Argent (5), Or (≥ 6)
- Images présentes en big (200 px) et small (96 px) : Bronze, Argent, Or
- Images Carton et Papier ajoutées en fichiers mais **non intégrées dans le code** (préparées pour une hiérarchie étendue future)

**Flux fin de séance**
- Bouton "✅ Terminer ma séance" visible dès 4 ateliers validés dans la page Séance
- `saveBadge()` : incrémente les compteurs locaux, appel API `saveBadge`, remet `compteurAteliersSeance` à 0, redirige vers `page-bilan-badge`
- `saveBadgeQuietly()` : save silencieuse déclenchée si l'élève se déconnecte sans avoir utilisé "Fin de Séance" (toast avertissement)

**Nouvelles pages**
- `page-bilan-badge` : badge obtenu en grand format, nombre d'ateliers validés, récap des badges passés
- `page-mes-badges` : dernier badge + historique complet Bronze / Argent / Or

**Navigation**
- Bouton 🏅 "Badges" ajouté dans le footer (verrouillé tant que maxis non renseignés, via `updateNavLock()`)

### Code.gs — nouvelles colonnes

5 colonnes ajoutées, `COL_ATELIERS_START` décalé à 11 :

| Constante | Colonne | Contenu |
|---|---|---|
| `COL_DERNIER_BADGE` | 7 | `"Bronze"` \| `"Argent"` \| `"Or"` \| `""` |
| `COL_COMPTEUR_BRONZE` | 8 | nb de badges Bronze |
| `COL_COMPTEUR_ARGENT` | 9 | nb de badges Argent |
| `COL_COMPTEUR_OR` | 10 | nb de badges Or |

Nouveau handler `handleSaveBadge()` ; `loadEleve` renvoie maintenant `dernierBadge`, `comptBronze`, `comptArgent`, `comptOr`.

### Fix barre de progression instantanée

- `validateAtelier()` : mise à jour UI optimiste (barre + message) **avant** l'appel API
- Avant ce fix, la barre ne bougeait qu'après la réponse réseau → latence perceptible

### Contenu pédagogique

- `DESCRIPTIONS_PROJETS.md` créé : descriptions détaillées des 4 projets
- `PDF-Projets/` : PDFs des 4 projets déplacés dans leur dossier dédié
- Texte fiche projet : "En pratique (4 séries par atelier)" → "En pratique : 4 séries par atelier durant les séances d'EPS"

---

## ✅ Session du 29/04/2026 — UX page projet + corrections logique séance

### Page projet — détail (buildProjetDetail)

- Retours à la ligne après chaque point dans les textes "En résumé" et "Ce que vous allez ressentir"
- Bouton "Choisir ce projet" remonté en haut de la page (avant la fiche)
- Tous les paramètres affichés dans la grille 2 colonnes : ajout Durée d'une série, Vitesse, Contractions (ce dernier sur toute la largeur)
- Bouton téléchargement PDF : rendu en vert, texte complet avec nom du projet "Télécharger la fiche complète de ce projet [Nom] au format PDF"

### Page projets (buildProjet)

- Le projet choisi par l'élève remonte automatiquement en premier dans la liste

### Page Séances

- Nom du projet mis en valeur inline (Bebas Neue, couleur accent) dans la ligne d'intensité
- Rappel de la proposition de l'application dans le panneau "Modifier les paramètres"
- Nouveau bouton "= Ne rien changer" dans le panneau "Diminuer l'effort" → repropose la même série
- Fix : après recalcul du maxi (suite à interruption), la série 1 affichait "? × ? kg" au lieu des vraies valeurs → `state.suggestionEnCours[nomAtelier]` n'était pas remis à `false` lors de l'interruption
- Nouveau cas bravo `valide-s4` : S3=TD mais S4 pas TD → message "Cherchez à réussir cette 4ème série la prochaine fois !"

### Ateliers spéciaux (Gainage sol, Banc à Lombaires, Abdo Sol)

- Interruption sur 2 Échecs cumulés (consécutifs ou non) : même logique que les ateliers standard → maxi effacé, message d'erreur, redirection vers calcul du maxi
- L'atelier n'est pas validé en cas d'interruption
- Timeout de redirection : 6 s → 10 s, avec mention "Vous allez être redirigé(e) automatiquement."
- Page calcul du maxi : suppression des onglets "Calculer" / "Saisie directe" pour les 3 ateliers spéciaux (inutiles)
- Page calcul du maxi lombaires : nouveau texte explicatif en 4 lignes + avertissement 10 kg en jaune
- Suppression de l'encadré `calc-result` vide pour les ateliers spéciaux
- Fix : listeners `tab-calc` / `tab-direct` et `calc-result` plantaient pour les ateliers spéciaux → bouton "Valider ce maxi" inopérant → corrigé


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

## 🔜 Évolution — Multi-profs (même établissement)

### Vision
Permettre à des collègues EPS du même lycée d'utiliser l'app avec leurs propres élèves, chacun ayant son propre Google Sheet / Apps Script backend.

### Flux UX
1. Écran de sélection du professeur (avant le login)
2. L'élève choisit son prof → l'app pointe vers le bon backend (`WEBAPP` dynamique)
3. Login classique ensuite (classe, nom, prénom, mdp)
4. Le choix du prof est sauvegardé en `localStorage` pour ne pas le ressaisir à chaque fois

### Architecture retenue
- Un objet `PROFS` hardcodé dans `app.js` : `{ "Cuvelier": "https://...", "Dupont": "https://..." }`
- Chaque collègue a son propre GSheet (copie du template) + son propre Apps Script déployé
- Un seul frontend hébergé sur GitHub Pages (commun à tous)
- Ajouter un prof = 1 ligne dans `PROFS` + commit

### À faire côté Code.gs
- Exclure les onglets `_Appel` de `getClasses` (ajouter `!n.endsWith('_Appel')` dans le filter)

### Décision
À implémenter quand un collègue est prêt à tester. Commencer par créer un GSheet "template" propre.

---

## 🔜 Migration — Compte Google EPS du lycée

### Contexte
Le GSheet et l'Apps Script sont actuellement sur le compte Google perso de Stève. L'objectif est de migrer sur le compte Google EPS du lycée (compte normal, sans restrictions) pour que les collègues y aient accès sans partage manuel.

### Étapes
1. Copier le GSheet sur le Drive du compte EPS (Fichier → Faire une copie)
2. Ouvrir l'Apps Script depuis ce nouveau fichier (Extensions → Apps Script)
3. Remplacer le code par `Code.gs` actuel
4. Déployer en Web App (accès : "Tout le monde") depuis le compte EPS — accepter les permissions
5. Copier la nouvelle URL → remplacer `WEBAPP` dans `app.js`
6. Tester en navigation privée

### Note
Ne pas transférer la propriété du fichier original — faire une copie propre sur le compte EPS.

### Décision
À faire avant d'impliquer des collègues. Prérequis à la fonctionnalité multi-profs.

---

## ✅ Session du 06/05/2026 — Robustesse PWA + alertes mode autonome

### Robustesse réseau / PWA

- `fetchWithTimeout(url, 12000)` : timeout 12s via `AbortController` sur tous les appels `api()` et `apiPost()`
- Bouton "Réessayer" dans l'overlay de chargement (spinner masqué, message affiché en cas d'erreur réseau)
- SW : ne plus intercepter les requêtes cross-origin (Google Apps Script) → elles vont directement au réseau
- SW : `skipWaiting()` + `clients.claim()` → mise à jour immédiate sans fermer/rouvrir l'app
- SW : `activate` nettoie les anciens caches (v1 à v9) → cache bumped `v9` → `v10`
- `visibilitychange` listener : si le spinner est visible quand l'app revient au premier plan → relance `initLogin()` (corrige le spinner figé Samsung)
- `_initLoginRunning` flag : empêche deux appels simultanés à `initLogin()`
- **Comportement connu** : fermeture brutale de la PWA sur Samsung peut encore bloquer → les élèves doivent utiliser la Déconnexion ☰. Si bloqué : vider le cache Chrome.

### Alertes mode autonome (`state.guidage = false`)

- **2 F consécutifs** : ne forcent plus la redirection vers le maxi (fix `detectInterruption`) — l'élève reste libre
- **2 F cumulés (mid-atelier)** : warning jaune au-dessus des roulettes "Attention, choisissez mieux vos couples Charge/Reps pour atteindre TD"
- **Charge max + reps max + F (mid-atelier)** : warning bleu "Votre maxi semble sous-évalué, pensez à faire une nouvelle recherche de maxi" — prioritaire sur le warning 2F
- **Fin atelier sans TD** : warning jaune sous la bravo-box
- **Fin atelier 4 F** : warning rouge sous la bravo-box (message plus fort)
- Les alertes utilisent `innerHTML` → balises `<strong>`, `<br>` acceptées dans les messages
