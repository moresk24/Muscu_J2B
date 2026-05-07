# Guide enseignant — Muscu J2B

Ce document décrit la structure du Google Sheet et les conventions à respecter pour que l'application fonctionne correctement.

---

## Onglet `Config`

C'est l'onglet de configuration globale. Il contient les paramètres de l'admin et le planning de chaque classe.

### Ligne 1 — Mot de passe admin

| Col A | Col B |
|-------|-------|
| ADMIN | mot_de_passe_admin |

Le mot de passe admin permet de se connecter en tant qu'enseignant depuis n'importe quel compte élève. Il donne accès à toutes les pages sans restriction, et bypass le verrou des maxis.

### Lignes suivantes — Une classe = deux lignes

Chaque classe occupe **deux lignes consécutives** :

**Ligne 1 (paramètres de la classe) :**

| Col A | Col B | Col C | Col D | Col E | Col F | Col G | … |
|-------|-------|-------|-------|-------|-------|-------|---|
| Nom de la classe | Accès Appli ✓/☐ | Horaire début | Horaire fin | Date séance 1 | Date séance 2 | Date séance 3 | … |

**Ligne 2 (statut des séances) :**

| Col A | Col B | Col C | Col D | Col E | Col F | Col G | … |
|-------|-------|-------|-------|-------|-------|-------|---|
| (label libre, ex: ton nom) | _(vide)_ | _(vide)_ | _(vide)_ | ok / vide | ok / vide | ok / vide | … |

### Règles importantes

- **Accès Appli** : case à cocher Google Sheets. Cochée (TRUE) = accès autorisé. Décochée (FALSE) = app bloquée pour tous les élèves (mode évaluation théorique). L'admin garde toujours l'accès.
- **Horaires** : format `10h05` ou `10:05`. Définissent la plage horaire pendant laquelle une séance est active.
- **Dates** : format `jj/mm/aa`. L'ordre n'a pas d'importance, mais elles doivent être dans la même ligne que la classe.
- **Statut "ok"** : écrire exactement `ok` (minuscules) sous une date pour que l'app la reconnaisse comme une séance valide. Sans "ok", même si la date et l'heure correspondent, la séance n'est pas active et les élèves sont en mode consultation (lecture seule).
- **Séance active** = date du jour + statut "ok" + heure actuelle dans la plage horaire.
- **Numéro de séance** = nombre de dates avec statut "ok" passées ou en cours (séances S1, S2, S3…). S1 et S2 sont des séances de recherche de maxi (non comptabilisées dans le graphique de progression).

### Exemple

```
Ligne 1 :  ADMIN  |  1234

Ligne 3 :  2BPRO  |  ✓  |  10h05  |  11h40  |  10/03/26  |  17/03/26  |  24/03/26  |  31/03/26
Ligne 4 :  Cuvelier  |     |         |         |  ok        |  ok        |  ok        |
```

Dans cet exemple, 3 séances validées (S1, S2, S3). La séance S4 du 31/03/26 n'a pas encore de "ok" → elle sera active uniquement si tu écris "ok" et que l'heure correspond.

---

## Onglets de classe (ex : `2BPRO`)

Un onglet par classe. Chaque ligne = un élève.

### Structure des colonnes

| Index | Colonne | Contenu |
|-------|---------|---------|
| 0 | A | Nom |
| 1 | B | Prénom |
| 2 | C | Classe |
| 3 | D | Mot de passe (hashé SHA-256) |
| 4 | E | Guidage ✓/☐ — case à cocher : cochée = mode guidé (app propose), décochée = mode autonome (élève choisit) |
| 5 | F | Statut : vide = normal, `D` = dispensé, `B` = blessé |
| 6 | G | Numéro de projet (1, 2, 3A, 3B) |
| 7 | H | Compteur global d'ateliers validés (cycle entier) |
| 8 | I | Date de dernière connexion |
| 9 | J | Dernier badge obtenu (`Bronze` / `Argent` / `Or`) |
| 10 | K | Nb badges Carton |
| 11 | L | Nb badges Bronze |
| 12 | M | Nb badges Argent |
| 13 | N | Nb badges Or |
| 14–45 | O–AS | Maxis et séries des 16 ateliers (paires : maxi + nb séries validées) |
| 46 | AT | JSON historique de la dernière séance validée |

### Les 16 ateliers (colonnes O à AS, paires maxi/séries)

Les ateliers sont stockés dans l'ordre suivant, chacun sur deux colonnes consécutives `[maxi, séries_faites]` :

1. Développé Couché
2. Développé Incliné
3. Pull-Down Nuque
4. Pull-Down Poitrine
5. Butterfly
6. Banc Tirage Biceps
7. Machine Biceps
8. Deltoïdes (haltères)
9. Banc à Lombaires
10. Gainage sol
11. Abdo Sol
12. Banc Ischio Jambiers
13. Chaise à ADDucteurs
14. Chaise à ABDucteurs
15. Chaise à Quadriceps
16. Presse Inclinée

### Valeurs spéciales dans la colonne maxi

- `B` : atelier **bloqué** — n'apparaît pas dans la page Maxis ni en Séances (utile si une machine est en panne ou indisponible)
- `0` : valide uniquement pour Banc à Lombaires, Abdo Sol et Gainage sol (correspond au niveau minimal)
- Vide ou absent : maxi non renseigné → l'atelier n'apparaît pas en page Séances

### Guidage (colonne E)

- ✓ (TRUE) = **mode guidé** : l'app impose les charges et répétitions selon le projet, et force le recalcul du maxi si nécessaire
- ☐ (FALSE) = **mode autonome** : l'élève choisit librement ses paramètres, l'app affiche des alertes mais ne bloque pas

---

## Onglets `[Classe]_Historique` (ex : `2BPRO_Historique`)

Un onglet par classe, créé automatiquement. Stocke l'historique de toutes les séances pour le graphique de progression.

### Structure

- **Ligne 1** : en-têtes (S1 JSON, S1 moy, S2 JSON, S2 moy, …)
- **Lignes suivantes** : une ligne par élève

### Colonnes par élève

| Index | Contenu |
|-------|---------|
| 0 | Nom |
| 1 | Prénom |
| 2 | (réservé) |
| 3 | S1 JSON |
| 4 | S1 moyenne ressentis |
| 5 | S2 JSON |
| 6 | S2 moyenne ressentis |
| … | S{n} JSON à l'index `3 + (n-1)*2`, moyenne à l'index suivant |

### Valeurs spéciales dans les colonnes JSON

- JSON de séance : données de la séance (ateliers, séries, ressentis)
- `A` : élève **absent** ce jour-là → affiché comme absence dans le graphique
- `D` : élève **dispensé** ce jour-là → affiché comme dispense dans le graphique
- Vide : séance non effectuée (non comptée)

### Moyenne des ressentis

Calculée automatiquement à chaque validation de séance :
- F = 1, D = 2, TD = 3 (E ignoré)
- Les ateliers spéciaux (Banc à Lombaires, Abdo Sol, Gainage sol) sont exclus du calcul
- Le graphique de progression commence à S3 (S1 et S2 = recherche de maxi)

---

## Projets disponibles

| Numéro | Nom | Intensité | Objectif |
|--------|-----|-----------|---------|
| 1 | SPORTIF | 80–90 % du maxi | Force et puissance |
| 2 | ESTHÉTIQUE | 65–80 % du maxi | Hypertrophie |
| 3A | SANTÉ Endurance | 40–50 % du maxi | Endurance musculaire |
| 3B | SANTÉ Tonification | 50–65 % du maxi | Tonification |

---

## Badges

| Badge | Condition |
|-------|-----------|
| Bronze | Moins de 5 ateliers validés en une séance |
| Argent | Exactement 5 ateliers validés |
| Or | 6 ateliers ou plus validés |

Un atelier est validé quand l'élève complète ses **4 séries**. Le badge est attribué automatiquement à la fin de la séance (bouton "Terminer ma séance") ou silencieusement si l'élève se déconnecte sans valider.

---

## Checklist — Ajouter une nouvelle classe

1. Créer un onglet dans le GSheet avec le nom exact de la classe (ex : `2BPRO`)
2. Ajouter la ligne d'en-tête des colonnes (voir structure ci-dessus)
3. Saisir les élèves (nom, prénom, classe) — le mot de passe sera défini par l'élève à la première connexion
4. Créer l'onglet `2BPRO_Historique` avec la même liste d'élèves (colonnes A et B)
5. Dans l'onglet Config, ajouter les deux lignes de la classe (paramètres + statuts)
6. Cocher "Accès Appli" pour autoriser l'accès
7. Ajouter les dates des séances et écrire "ok" au fur et à mesure

---

## Checklist — Démarrer une séance

1. Dans l'onglet Config, écrire `ok` sous la date du jour dans la ligne de statut de la classe
2. Vérifier que les horaires (début/fin) correspondent bien au créneau
3. Vérifier que "Accès Appli" est coché
4. Les élèves peuvent se connecter — l'app passe automatiquement en mode édition dans le créneau horaire

## Checklist — Période d'évaluation théorique

1. Dans l'onglet Config, **décocher** la case "Accès Appli" pour la classe concernée
2. Les élèves voient un écran "Application indisponible pendant la période d'évaluation théorique"
3. L'admin (toi) garde l'accès normalement
4. Recocher la case quand la période d'évaluation est terminée
