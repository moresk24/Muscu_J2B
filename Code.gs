// ============================================================
//  MUSCU À J2B — Apps Script (Web App)
//  Google Sheet : Muscu_J2B_25-26_T3
//  Onglets : T_ABC | 1_ST2S
// ============================================================

// ── Ateliers (ordre fixe = ordre des colonnes dans le GS) ───
const ATELIERS = [
  "Développé Couché",
  "Développé Incliné",
  "Pull-Down Nuque",
  "Pull-Down Poitrine",
  "Butterfly",
  "Banc Tirage Biceps",
  "Machine Biceps",
  "Deltoïdes (haltères)",
  "Banc à Lombaires",
  "Gainage sol",
  "Abdo Sol",
  "Banc Ischio Jambiers",
  "Chaise à ADDucteurs",
  "Chaise à ABDucteurs",
  "Chaise à Quadriceps",
  "Presse Inclinée"
];

// ── Colonnes fixes (avant les ateliers) ─────────────────────
const COL_NOM              = 0;
const COL_PRENOM           = 1;
const COL_CLASSE           = 2;  // classe de l'élève
const COL_MDP              = 3;
const COL_PROJET           = 4;
const COL_COMPTEUR         = 5;  // compteur global d'ateliers validés (cycle entier)
const COL_LAST_CO          = 6;  // dernière connexion
const COL_DERNIER_BADGE    = 7;  // "Carton" | "Bronze" | "Argent" | "Or" | ""
const COL_COMPTEUR_CARTON  = 8;
const COL_COMPTEUR_BRONZE  = 9;
const COL_COMPTEUR_ARGENT  = 10;
const COL_COMPTEUR_OR      = 11;
const COL_ATELIERS_START   = 12; // à partir de là : maxi + séries faites (par paires)

// ════════════════════════════════════════════════════════════
//  WEB APP — TOUT EN GET (évite les problèmes CORS)
// ════════════════════════════════════════════════════════════
function doGet(e) {
  const p      = e.parameter;
  const action = p.action;

  try {
    if (action === "getClasses")     return jsonResponse(handleGetClasses());
    if (action === "getConfig")      return jsonResponse(handleGetConfig(p.classe));
    if (action === "getEleves")      return jsonResponse(handleGetEleves(p.classe));
    if (action === "loadEleve")      return jsonResponse(handleLoadEleve(p.classe, p.nom, p.prenom));
    if (action === "setPassword")    return jsonResponse(handleSetPassword(p));
    if (action === "saveMaxis")      return jsonResponse(handleSaveMaxis(p));
    if (action === "saveProjet")     return jsonResponse(handleSaveProjet(p));
    if (action === "incrementSerie")  return jsonResponse(handleIncrementSerie(p));
    if (action === "validateAtelier") return jsonResponse(handleValidateAtelier(p));
    if (action === "saveBadge")       return jsonResponse(handleSaveBadge(p));
    return jsonResponse({ error: "Action inconnue : " + action });
  } catch(err) {
    return jsonResponse({ error: err.toString() });
  }
}

// doPost redirige vers doGet
function doPost(e) {
  return doGet(e);
}

// ════════════════════════════════════════════════════════════
//  HANDLERS
// ════════════════════════════════════════════════════════════

// ── Liste des classes (= noms des onglets, sauf Config) ─────
function handleGetClasses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const classes = ss.getSheets().map(s => s.getName()).filter(n => n !== "Config");
  return { success: true, classes };
}

// ── Liste des élèves d'une classe ───────────────────────────
function handleGetEleves(classe) {
  const sheet = getSheet(classe);
  if (!sheet) return { error: "Classe introuvable : " + classe };

  const data = sheet.getDataRange().getValues();
  const eleves = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_NOM]) {
      eleves.push({
        nom:    data[i][COL_NOM],
        prenom: data[i][COL_PRENOM],
        hasMdp: data[i][COL_MDP] !== "" && data[i][COL_MDP] !== null
      });
    }
  }
  return { success: true, eleves };
}

// ── Charger les données d'un élève ──────────────────────────
function handleLoadEleve(classe, nom, prenom) {
  const { sheet, rowIndex, data } = findEleve(classe, nom, prenom);
  if (!sheet) return { error: "Élève introuvable." };

  const row = data[rowIndex];

  const maxis  = {};
  const series = {};
  ATELIERS.forEach((atelier, i) => {
    const colMaxi   = COL_ATELIERS_START + i * 2;
    const colSeries = COL_ATELIERS_START + i * 2 + 1;
    maxis[atelier]  = row[colMaxi]   || "";
    series[atelier] = row[colSeries] || 0;
  });

  return {
    success:       true,
    mdp:           row[COL_MDP]             || "",
    projet:        row[COL_PROJET]          || "",
    compteur:      row[COL_COMPTEUR]        || 0,
    lastCo:        row[COL_LAST_CO]         || "",
    dernierBadge:  row[COL_DERNIER_BADGE]   || "",
    comptCarton:   parseInt(row[COL_COMPTEUR_CARTON]) || 0,
    comptBronze:   parseInt(row[COL_COMPTEUR_BRONZE]) || 0,
    comptArgent:   parseInt(row[COL_COMPTEUR_ARGENT]) || 0,
    comptOr:       parseInt(row[COL_COMPTEUR_OR])     || 0,
    maxis,
    series
  };
}

// ── Créer le mot de passe (1ère connexion) ──────────────────
function handleSetPassword(p) {
  const { sheet, rowIndex } = findEleve(p.classe, p.nom, p.prenom);
  if (!sheet) return { error: "Élève introuvable." };

  sheet.getRange(rowIndex + 1, COL_MDP + 1).setValue(p.mdp);
  updateLastCo(sheet, rowIndex);
  return { success: true };
}

// ── Sauvegarder les maxis ────────────────────────────────────
function handleSaveMaxis(p) {
  const { sheet, rowIndex } = findEleve(p.classe, p.nom, p.prenom);
  if (!sheet) return { error: "Élève introuvable." };

  const maxis = JSON.parse(p.maxis || '{}');

  ATELIERS.forEach((atelier, i) => {
    const colMaxi = COL_ATELIERS_START + i * 2 + 1; // base 1
    if (maxis[atelier] !== undefined) {
      sheet.getRange(rowIndex + 1, colMaxi).setValue(maxis[atelier]);
    }
  });

  updateLastCo(sheet, rowIndex);
  return { success: true };
}

// ── Sauvegarder le projet choisi ────────────────────────────
function handleSaveProjet(p) {
  const { sheet, rowIndex } = findEleve(p.classe, p.nom, p.prenom);
  if (!sheet) return { error: "Élève introuvable." };

  sheet.getRange(rowIndex + 1, COL_PROJET + 1).setValue(p.projet);
  updateLastCo(sheet, rowIndex);
  return { success: true };
}

// ── Incrémenter le compteur de séries + séries de l'atelier ─
function handleIncrementSerie(p) {
  const { sheet, rowIndex, data } = findEleve(p.classe, p.nom, p.prenom);
  if (!sheet) return { error: "Élève introuvable." };

  const row = data[rowIndex];

  // Compteur global
  const newCompteur = (parseInt(row[COL_COMPTEUR]) || 0) + 1;
  sheet.getRange(rowIndex + 1, COL_COMPTEUR + 1).setValue(newCompteur);

  // Séries de l'atelier
  const atelierIndex = ATELIERS.indexOf(p.atelier);
  if (atelierIndex >= 0) {
    const colSeries = COL_ATELIERS_START + atelierIndex * 2 + 1 + 1; // base 1 + col séries
    const newSeries = (parseInt(row[COL_ATELIERS_START + atelierIndex * 2 + 1]) || 0) + 1;
    sheet.getRange(rowIndex + 1, colSeries).setValue(newSeries);
  }

  updateLastCo(sheet, rowIndex);
  return { success: true, newCompteur };
}

// ── Lire l'onglet Config ────────────────────────────────────
function handleGetConfig(classe) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName("Config");
  if (!configSheet) return { error: "Onglet Config introuvable" };

  const data = configSheet.getDataRange().getValues();

  // Ligne 1 : ADMIN | mot de passe
  const adminMdp = (data[0][1] || '').toString().trim();

  // Trouver la ligne de la classe (col A = nom de la classe)
  let classRowIdx = -1;
  for (let i = 0; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() === (classe || '').trim()) {
      classRowIdx = i;
      break;
    }
  }
  if (classRowIdx === -1) return { adminMdp, isActive: false, sessionNumber: 0 };

  const classRow  = data[classRowIdx];
  const statusRow = data[classRowIdx + 1] || [];

  // Convertir "10h05" en minutes depuis minuit
  function parseMinutes(str) {
    if (!str) return null;
    const s = str.toString().replace(/[hH]/, ':');
    const parts = s.split(':');
    return parseInt(parts[0]) * 60 + (parseInt(parts[1]) || 0);
  }

  function memeJour(d1, d2) {
    return d1.getDate()===d2.getDate() && d1.getMonth()===d2.getMonth() && d1.getFullYear()===d2.getFullYear();
  }

  const debutMin = parseMinutes(classRow[1]);
  const finMin   = parseMinutes(classRow[2]);
  const now      = new Date();
  const nowMin   = now.getHours() * 60 + now.getMinutes();

  let sessionNumber = 0;
  let isActive = false;

  // Les dates commencent à la colonne D (index 3)
  for (let col = 3; col < classRow.length; col++) {
    const dateVal = classRow[col];
    if (!dateVal) continue;
    const date   = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    if (isNaN(date.getTime())) continue;

    const status = (statusRow[col] || '').toString().trim().toLowerCase();
    const isOk   = status === 'ok';

    // Compter les séances ok passées ou aujourd'hui
    if (isOk && date <= now) sessionNumber++;

    // Vérifier si c'est aujourd'hui et si on est dans le créneau
    if (memeJour(date, now) && isOk) {
      isActive = debutMin !== null && finMin !== null && nowMin >= debutMin && nowMin <= finMin;
    }
  }

  return { adminMdp, isActive, sessionNumber };
}

// ════════════════════════════════════════════════════════════
//  UTILITAIRES
// ════════════════════════════════════════════════════════════

function getSheet(classe) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(classe);
}

function findEleve(classe, nom, prenom) {
  const sheet = getSheet(classe);
  if (!sheet) return { sheet: null };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_NOM] === nom && data[i][COL_PRENOM] === prenom) {
      return { sheet, rowIndex: i, data };
    }
  }
  return { sheet: null };
}

// ── Valider un atelier (4 séries complètes) ─────────────────
function handleValidateAtelier(p) {
  const { sheet, rowIndex, data } = findEleve(p.classe, p.nom, p.prenom);
  if (!sheet) return { error: "Élève introuvable." };

  const row = data[rowIndex];

  // Incrémenter le compteur d'ateliers validés
  const newCompteur = (parseInt(row[COL_COMPTEUR]) || 0) + 1;
  sheet.getRange(rowIndex + 1, COL_COMPTEUR + 1).setValue(newCompteur);

  // Ajouter 4 aux séries de l'atelier
  const atelierIndex = ATELIERS.indexOf(p.atelier);
  if (atelierIndex >= 0) {
    const colSeries = COL_ATELIERS_START + atelierIndex * 2 + 1 + 1;
    const newSeries = (parseInt(row[COL_ATELIERS_START + atelierIndex * 2 + 1]) || 0) + 1;
    sheet.getRange(rowIndex + 1, colSeries).setValue(newSeries);
  }

  updateLastCo(sheet, rowIndex);
  return { success: true, newCompteur };
}

// ── Enregistrer le badge de fin de séance ───────────────────
function handleSaveBadge(p) {
  const { sheet, rowIndex } = findEleve(p.classe, p.nom, p.prenom);
  if (!sheet) return { error: "Élève introuvable." };

  sheet.getRange(rowIndex + 1, COL_DERNIER_BADGE    + 1).setValue(p.badge        || "");
  sheet.getRange(rowIndex + 1, COL_COMPTEUR_CARTON  + 1).setValue(parseInt(p.comptCarton) || 0);
  sheet.getRange(rowIndex + 1, COL_COMPTEUR_BRONZE  + 1).setValue(parseInt(p.comptBronze) || 0);
  sheet.getRange(rowIndex + 1, COL_COMPTEUR_ARGENT  + 1).setValue(parseInt(p.comptArgent) || 0);
  sheet.getRange(rowIndex + 1, COL_COMPTEUR_OR      + 1).setValue(parseInt(p.comptOr)     || 0);

  updateLastCo(sheet, rowIndex);
  return {
    success:      true,
    dernierBadge: p.badge,
    comptCarton:  parseInt(p.comptCarton) || 0,
    comptBronze:  parseInt(p.comptBronze) || 0,
    comptArgent:  parseInt(p.comptArgent) || 0,
    comptOr:      parseInt(p.comptOr)     || 0
  };
}

function updateLastCo(sheet, rowIndex) {
  const now = new Date().toLocaleString("fr-FR");
  sheet.getRange(rowIndex + 1, COL_LAST_CO + 1).setValue(now);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
