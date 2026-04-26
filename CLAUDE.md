# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Conventions de l'interface

- L'application **vouvoie** l'utilisateur dans tous les textes visibles (boutons, messages, toasts, labels)
- Langue française uniquement
- Pas d'argot ni de familiarités

## Contrainte matérielle importante

L'application est utilisée par des lycéens en cours de musculation. **Tous les appareils ne sont pas récents** — certains élèves utilisent de vieux iPhones ou Android d'entrée de gamme. Privilégier :
- CSS simple et performant (éviter les effets lourds, les `backdrop-filter` excessifs, les animations complexes)
- JavaScript vanilla sans dépendances
- Pas de fonctionnalités nécessitant des APIs récentes du navigateur
- Tester mentalement le rendu sur petits écrans (320px de large minimum)

## Architecture

This is a **vanilla HTML/CSS/JS PWA** (Progressive Web App) with **no build step, no bundler, no npm**. The entire frontend lives in a single file: `index.html`.

The backend is a **Google Apps Script Web App** (`Code.gs`) deployed as a Google Sheets extension. All API calls are HTTP GET requests (POST is redirected to GET) to avoid CORS issues with Google Apps Script.

### Two-part system

| Part | File | Runtime |
|------|------|---------|
| Frontend PWA | `index.html` | Browser (static HTML, served directly) |
| Backend API | `Code.gs` | Google Apps Script (bound to a Google Sheet) |

The frontend communicates with the backend via a hardcoded `WEBAPP` URL constant near the top of the `<script>` block in `index.html`, pointing to the deployed Apps Script endpoint.

### Frontend structure (`index.html`)

The file is organized as: CSS styles → HTML markup → JavaScript, all inline.

**Screen system:** Two top-level screens (`screen-login`, `screen-app`) toggled by adding/removing the `active` CSS class.

**Page system (within `screen-app`):** Five pages toggled by `showPage(name)`. Navigation via `.nav-btn[data-page]` buttons in the bottom nav.

| Page id | Rôle | Nav button |
|---------|------|------------|
| `page-maxis` | Liste des ateliers avec maxis en lecture seule | Maxis |
| `page-maxi-calc` | Calculer ou saisir le maxi d'un atelier | _(pas de bouton, accès via clic atelier)_ |
| `page-projet` | Choix du projet personnel | Les Projets |
| `page-fiche` | Fiche récap du projet choisi | Mon projet |
| `page-seance` | Déroulement de la séance | Séance |

**Verrouillage du footer :** Les boutons "Les Projets", "Mon projet" et "Séance" sont `disabled` tant que tous les maxis ne sont pas renseignés. `updateNavLock()` gère cet état ; il est appelé à chaque `buildMaxis()`.

**State:** A single `state` object holds all runtime data (user identity, maxis, series, session info, `currentCalcAtelier`). `localStorage` is used only for persisting login credentials and `compteurSeance`.

**API calls:** All requests go through the `api(params)` helper which builds a GET URL to `WEBAPP`. The `apiPost(body)` helper does the same (not a real POST).

### Page Maxis — logique

- Les cartes d'ateliers sont cliquables → `goToMaxiCalc(idx)` → `page-maxi-calc`
- Le maxi s'affiche en lecture seule via `formatMaxiDisplay(a, val)`
- `isMaxiValid(a, val)` : pour les ateliers standard, 0 n'est pas valide ; pour Banc à Lombaires / Abdo Sol / Gainage sol, 0 ou niveau 1 sont valides
- `maxisAllFilled()` utilise `isMaxiValid`

### Page Calculer mon maxi — logique

Trois types d'ateliers gérés par `getAtelierType(nom)` :

| Type | Ateliers | Calcul |
|------|----------|--------|
| `standard` | 13 ateliers (tout sauf les 3 ci-dessous) | Formule Brzycki : `1RM = poids / (1.0278 − 0.0278 × reps)` |
| `lombaires` | Banc à Lombaires, Abdo Sol | 30 reps en 1' + poids additionnel (0/2/5/10 kg) |
| `gainage` | Gainage sol | Niveau 1 à 4 |

Deux modes (onglets) : *Calculer mon maxi* et *Saisie directe*. Après validation → `saveSingleMaxi()` → retour `page-maxis`.

### Backend structure (`Code.gs`)

`doGet(e)` is the entry point — it dispatches on `e.parameter.action` to handlers:

- `getClasses` — returns sheet tab names (excluding "Config")
- `getConfig` — reads the "Config" tab to determine if a session is active and which session number it is
- `getEleves` — lists students for a class tab
- `loadEleve` — loads a student's maxis, series counts, projet, password hash
- `setPassword` / `saveMaxis` / `saveProjet` / `incrementSerie` — write operations

**Google Sheet layout:** Each class is one tab. Columns 0–5 are fixed (nom, prénom, mdp, projet, compteur global, dernière connexion). From column 6 onward, ateliers are stored as pairs: `[maxi, séries_faites]` repeated for each of the 16 `ATELIERS`.

### Access control

- `isActive`: set by `getConfig` based on whether today's date matches a scheduled session AND the current time is within the class's time slot (read from the "Config" tab).
- `isAdmin`: client-side check — user's password matches the admin password from the "Config" tab.
- When neither is true, the app runs in **read-only mode** (`isEditable()` returns false, write operations are blocked with a toast warning).

## Development workflow

There is no local dev server or build process. To test frontend changes:
- Open `index.html` directly in a browser, or serve with any static server: `python3 -m http.server`
- The WEBAPP URL is hardcoded and calls the live deployed Apps Script — there is no local backend mock.

To deploy backend changes (`Code.gs`):
- Paste the updated code into the Google Apps Script editor for the bound spreadsheet
- Deploy a new version as a Web App (or update the existing deployment)
- The WEBAPP URL in `index.html` must match the deployed endpoint

## PWA / Service Worker

`sw.js` caches static assets for offline use. Cache key is `muscu-j2b-v1` — bump this string when assets change to force cache invalidation.
