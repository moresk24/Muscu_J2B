# Sitemap — Muscu à J2B

## Diagramme de navigation

```mermaid
flowchart TD
    LOGIN["🔐 Connexion\n―――――――――――\nClasse + Prénom + Mot de passe"]

    LOGIN -->|"élève dispensé"| DISPENSED["🩹 Dispensé·e\n―――――――――――\nMessage + Déconnexion"]
    LOGIN -->|"maxis non remplis"| MAXIS
    LOGIN -->|"maxis OK · pas de projet"| PROJET
    LOGIN -->|"maxis + projet OK"| SEANCE

    DISPENSED -->|"Se déconnecter"| LOGIN

    subgraph APP["📱 Application principale"]

        subgraph NAV1["💪 Maxis  ·  toujours accessible"]
            MAXIS["page-maxis\n―――――――――――\nListe des 16 ateliers\nMaxis en lecture seule\nStatut : rempli / manquant"]
            MAXI_CALC["page-maxi-calc\n―――――――――――\nOnglet Calculer (formule Brzycki)\nOnglet Saisie directe\nTypes : standard / lombaires / gainage"]
            MAXIS -->|"clic sur un atelier"| MAXI_CALC
            MAXI_CALC -->|"← Retour / Valider"| MAXIS
        end

        subgraph NAV2["🎯 Les Projets  ·  débloqué si maxis complets"]
            PROJET["page-projet\n―――――――――――\nChoix du projet personnel\n(6 projets disponibles)"]
            PROJET_DETAIL["page-projet-detail\n―――――――――――\nDescription · Sensations\nProfils · Gains\nBouton Choisir ce projet"]
            PROJET -->|"clic sur un projet"| PROJET_DETAIL
            PROJET_DETAIL -->|"← Retour aux projets"| PROJET
            PROJET_DETAIL -->|"Confirmer le projet"| PROJET
        end

        subgraph NAV3["🏋️ Séances  ·  débloqué si maxis complets"]
            SEANCE["page-seance\n―――――――――――\nListe des ateliers de la séance\nPré-remplissage S1 depuis historique\nChronomètre de récupération"]
            ATELIER["page-atelier-detail\n―――――――――――\nRoulette charge / reps\nBoutons ↑↓\nHistorique coloré par ressenti\nValidation série par série"]
            BILAN["page-bilan-badge\n―――――――――――\nRessenti 4 séries\nMeilleure charge vs séance précédente\nBadge obtenu\nAteliers spéciaux : score /4"]
            SEANCE -->|"clic sur un atelier"| ATELIER
            ATELIER -->|"retour footer"| SEANCE
            SEANCE -->|"fin de séance"| BILAN
            BILAN -->|"← Retour aux Séances"| SEANCE
        end

        subgraph NAV4["🏅 Badges  ·  débloqué si maxis complets"]
            BADGES["page-mes-badges\n―――――――――――\nHistorique des badges obtenus\npar séance"]
        end

    end

    APP -->|"Se déconnecter"| LOGIN
```

## Règles de déverrouillage

| Page | Condition d'accès |
|------|-------------------|
| 💪 Maxis | Toujours accessible après connexion |
| 🎯 Les Projets | Tous les maxis renseignés |
| 🏋️ Séances | Tous les maxis renseignés |
| 🏅 Badges | Tous les maxis renseignés |

## Logique de redirection à la connexion (`showPageAfterLogin`)

```
Connexion réussie
    ↓
Élève dispensé ?  →  screen-dispensed
    ↓ non
Maxis non remplis ?  →  page-maxis
    ↓ non
Projet non choisi ?  →  page-projet
    ↓ non
→  page-seance
```

## Pages sans bouton footer direct

| Page | Accès depuis |
|------|-------------|
| `page-maxi-calc` | Clic sur atelier dans page-maxis |
| `page-projet-detail` | Clic sur un projet dans page-projet |
| `page-atelier-detail` | Clic sur atelier dans page-seance |
| `page-bilan-badge` | Fin de séance (validation dernier atelier) |
