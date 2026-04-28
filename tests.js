// Tests pour decideSuggestion, decideValidation, decideNiveauSup
// Exécuter : node tests.js
// Zéro dépendance — pas inclus dans le runtime de l'app.

// ─── Copie des fonctions pures (synchronisée avec index.html) ─────────────────

function decideSuggestion(serie, projet, historique, maxiARevoir) {
  const {ressenti, charge, reps, intensite} = serie;
  const ints = projet.intensites;
  const idxCurrent = ints.indexOf(intensite);
  const atMaxIntensite = idxCurrent >= ints.length - 1;
  const atMinIntensite = idxCurrent <= 0;

  if (ressenti === 'TD') {
    return {type: 'td-parfait', params: {charge, reps, intensite}};
  }

  if (ressenti === 'E') {
    let consecutiveE = 0;
    for (let i = historique.length - 1; i >= 0; i--) {
      if (historique[i] && historique[i].ressenti === 'E') consecutiveE++;
      else break;
    }
    const contReps = Math.max(projet.repsMin, Math.ceil(reps * 0.85));
    if (consecutiveE >= 3) return {type: 'warning-3-echecs', params: {contReps, charge, intensite}};
    if (consecutiveE >= 2) return {type: 'warning-2-echecs', params: {contReps, charge, intensite}};
    if (atMinIntensite) {
      const newReps = Math.max(projet.repsMin, Math.ceil(reps * 0.85));
      return {type: 'e-min-intensite', params: {newReps, charge, intensite}};
    }
    return {type: 'e-choix', params: {charge, reps, intensite}};
  }

  // F ou D
  if (atMaxIntensite) {
    if (maxiARevoir) return {type: 'maxi-sous-eval', params: {charge, reps, intensite}};
    const mult = ressenti === 'F' ? 1.30 : 1.15;
    const newReps = Math.min(Math.ceil(reps * mult), projet.repsMax);
    return {type: 'fd-max-intensite', params: {newReps, charge, intensite}};
  }

  const atMaxReps = reps >= projet.repsMax;
  if (atMaxReps) {
    const newIdx = ressenti === 'F'
      ? Math.min(idxCurrent + 2, ints.length - 1)
      : Math.min(idxCurrent + 1, ints.length - 1);
    const newIntensite = ints[newIdx];
    return {type: 'fd-force-charge', params: {newIntensite, reps}};
  }

  return {type: 'fd-choix', params: {charge, reps, intensite}};
}

function decideValidation(serieLocale, maxiSousEvalue) {
  const totalEchecs = serieLocale.filter(s => s && s.ressenti === 'E').length;
  const isSurEvalue = totalEchecs >= 2 && !maxiSousEvalue;
  return {
    maxiARevoir: isSurEvalue || maxiSousEvalue,
    isSurEvalue,
    isSousEvalue: maxiSousEvalue
  };
}

function decideNiveauSup(nomAtelier, nbOk, niveauActuel) {
  if (nomAtelier === 'Gainage sol' && nbOk === 4 && niveauActuel < 4) {
    return {proposer: true, niveauSuivant: niveauActuel + 1};
  }
  return {proposer: false, niveauSuivant: null};
}

// ─── Framework de test minimaliste ───────────────────────────────────────────

let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log('  ✓', label);
    passed++;
  } else {
    console.error('  ✗', label);
    failed++;
  }
}

function suite(name, fn) {
  console.log('\n' + name);
  fn();
}

// ─── Données de référence ────────────────────────────────────────────────────

const P2 = {intensites: [65, 70, 75, 80], repsMin: 10, repsMax: 20}; // Projet ESTHÉTIQUE
const P1 = {intensites: [80, 85, 90],      repsMin: 4,  repsMax: 8};  // Projet SPORTIF
const P3A = {intensites: [40, 45, 50],     repsMin: 25, repsMax: 35}; // Projet SANTÉ Endurance

// ─── Tests decideSuggestion ──────────────────────────────────────────────────

suite('TD → maintenir mêmes paramètres', () => {
  const res = decideSuggestion(
    {ressenti: 'TD', charge: 60, reps: 12, intensite: 70},
    P2, [{ressenti: 'TD', charge: 60, reps: 12}], false
  );
  assert(res.type === 'td-parfait', 'type = td-parfait');
  assert(res.params.charge === 60, 'charge conservée');
  assert(res.params.reps === 12,   'reps conservées');
  assert(res.params.intensite === 70, 'intensité conservée');
});

suite('E à intensité min → suggérer reps réduites', () => {
  const res = decideSuggestion(
    {ressenti: 'E', charge: 40, reps: 12, intensite: 40},  // 40 = min de P3A
    P3A, [{ressenti: 'E', charge: 40, reps: 12}], false
  );
  assert(res.type === 'e-min-intensite', 'type = e-min-intensite');
  assert(res.params.newReps < 12, 'newReps réduits');
  assert(res.params.newReps >= P3A.repsMin, 'newReps ≥ repsMin');
});

suite('E à intensité intermédiaire → choix charge ou reps', () => {
  const res = decideSuggestion(
    {ressenti: 'E', charge: 50, reps: 15, intensite: 70},  // 70 = pas le min de P2
    P2, [{ressenti: 'E', charge: 50, reps: 15}], false
  );
  assert(res.type === 'e-choix', 'type = e-choix');
});

suite('2 E consécutifs → warning-2-echecs', () => {
  const historique = [
    {ressenti: 'TD', charge: 60, reps: 12},
    {ressenti: 'E',  charge: 56, reps: 10},
    {ressenti: 'E',  charge: 56, reps: 10},
  ];
  const res = decideSuggestion(
    {ressenti: 'E', charge: 56, reps: 10, intensite: 70},
    P2, historique, false
  );
  assert(res.type === 'warning-2-echecs', 'type = warning-2-echecs');
  assert(res.params.contReps <= 10, 'contReps réduits');
});

suite('3 E consécutifs → warning-3-echecs', () => {
  const historique = [
    {ressenti: 'E', charge: 56, reps: 10},
    {ressenti: 'E', charge: 56, reps: 10},
    {ressenti: 'E', charge: 56, reps: 10},
  ];
  const res = decideSuggestion(
    {ressenti: 'E', charge: 56, reps: 10, intensite: 70},
    P2, historique, false
  );
  assert(res.type === 'warning-3-echecs', 'type = warning-3-echecs');
});

suite('E non consécutif ne déclenche pas le warning', () => {
  const historique = [
    {ressenti: 'E',  charge: 56, reps: 10},
    {ressenti: 'TD', charge: 56, reps: 10},
    {ressenti: 'E',  charge: 56, reps: 10},
  ];
  const res = decideSuggestion(
    {ressenti: 'E', charge: 56, reps: 10, intensite: 70},
    P2, historique, false
  );
  assert(res.type !== 'warning-2-echecs', 'pas de warning-2 si E non consécutifs');
  assert(res.type !== 'warning-3-echecs', 'pas de warning-3 si E non consécutifs');
});

suite('F + intensité max + reps max → maxi-sous-eval', () => {
  // maxiARevoir doit être positionné en amont (détection dans onRessenti)
  const res = decideSuggestion(
    {ressenti: 'F', charge: 72, reps: 8, intensite: 90},  // 90 = max de P1, reps=8=repsMax
    P1, [{ressenti: 'F', charge: 72, reps: 8}], true       // maxiARevoir=true
  );
  assert(res.type === 'maxi-sous-eval', 'type = maxi-sous-eval');
});

suite('F + intensité max + reps non max → augmenter les reps (fd-max-intensite)', () => {
  const res = decideSuggestion(
    {ressenti: 'F', charge: 72, reps: 5, intensite: 90},  // 90 = max de P1
    P1, [{ressenti: 'F', charge: 72, reps: 5}], false
  );
  assert(res.type === 'fd-max-intensite', 'type = fd-max-intensite');
  assert(res.params.newReps > 5, 'newReps augmentés');
  assert(res.params.newReps <= P1.repsMax, 'newReps ≤ repsMax');
});

suite('D + intensité max + reps non max → fd-max-intensite (mult 1.15)', () => {
  const res = decideSuggestion(
    {ressenti: 'D', charge: 72, reps: 6, intensite: 90},
    P1, [{ressenti: 'D', charge: 72, reps: 6}], false
  );
  assert(res.type === 'fd-max-intensite', 'type = fd-max-intensite');
  assert(res.params.newReps === Math.min(Math.ceil(6 * 1.15), P1.repsMax), 'mult 1.15 pour D');
});

suite('F à intensité intermédiaire, reps pas au max → choix charge/reps (fd-choix)', () => {
  const res = decideSuggestion(
    {ressenti: 'F', charge: 52, reps: 14, intensite: 70},  // 70 = intermédiaire de P2
    P2, [{ressenti: 'F', charge: 52, reps: 14}], false
  );
  assert(res.type === 'fd-choix', 'type = fd-choix');
});

suite('F à intensité intermédiaire, reps au max → forcer hausse de charge (fd-force-charge)', () => {
  const res = decideSuggestion(
    {ressenti: 'F', charge: 52, reps: 20, intensite: 70},  // repsMax=20
    P2, [{ressenti: 'F', charge: 52, reps: 20}], false
  );
  assert(res.type === 'fd-force-charge', 'type = fd-force-charge');
  assert(res.params.newIntensite > 70, 'intensité augmentée');
  assert(res.params.newIntensite === 80, 'F → +2 crans d\'index : idx 1 + 2 = idx 3 → 80%');
});

suite('D à intensité intermédiaire, reps au max → fd-force-charge (+1 cran)', () => {
  const res = decideSuggestion(
    {ressenti: 'D', charge: 52, reps: 20, intensite: 70},
    P2, [{ressenti: 'D', charge: 52, reps: 20}], false
  );
  assert(res.type === 'fd-force-charge', 'type = fd-force-charge');
  assert(res.params.newIntensite === 75, 'D → +1 cran : 70→75');
});

suite('fd-force-charge ne dépasse pas l\'intensité max', () => {
  const res = decideSuggestion(
    {ressenti: 'F', charge: 60, reps: 8, intensite: 85},  // 85 = avant-dernier de P1
    P1, [{ressenti: 'F', charge: 60, reps: 8}], false
  );
  assert(res.type === 'fd-force-charge', 'type = fd-force-charge');
  assert(res.params.newIntensite <= 90, 'newIntensite ≤ max (90)');
  assert(res.params.newIntensite === 90, 'F +2 crans de 85 → bloqué à 90');
});

// ─── Tests decideValidation ──────────────────────────────────────────────────

suite('4 E sur 4 séries → maxi-sur-eval à la validation', () => {
  const series = [
    {ressenti: 'E'}, {ressenti: 'E'}, {ressenti: 'E'}, {ressenti: 'E'}
  ];
  const res = decideValidation(series, false);
  assert(res.isSurEvalue === true,   'isSurEvalue = true');
  assert(res.maxiARevoir === true,   'maxiARevoir = true');
  assert(res.isSousEvalue === false, 'isSousEvalue = false');
});

suite('2 E sur 4 séries → maxi-sur-eval', () => {
  const series = [
    {ressenti: 'TD'}, {ressenti: 'E'}, {ressenti: 'TD'}, {ressenti: 'E'}
  ];
  const res = decideValidation(series, false);
  assert(res.isSurEvalue === true, 'isSurEvalue = true pour 2+ E');
});

suite('1 E sur 4 séries → pas de maxi à revoir', () => {
  const series = [
    {ressenti: 'TD'}, {ressenti: 'TD'}, {ressenti: 'E'}, {ressenti: 'TD'}
  ];
  const res = decideValidation(series, false);
  assert(res.isSurEvalue === false, 'isSurEvalue = false pour 1 E');
  assert(res.maxiARevoir === false, 'maxiARevoir = false');
});

suite('sous-évalué déjà flagué + 2 E → surEvalue=false, maxiARevoir=true', () => {
  const series = [
    {ressenti: 'F'}, {ressenti: 'E'}, {ressenti: 'F'}, {ressenti: 'E'}
  ];
  const res = decideValidation(series, true); // maxiSousEvalue=true
  assert(res.isSurEvalue === false, 'pas surEvalue si déjà sous-évalué');
  assert(res.maxiARevoir === true,  'maxiARevoir reste true');
  assert(res.isSousEvalue === true, 'isSousEvalue = true');
});

// ─── Tests decideNiveauSup ───────────────────────────────────────────────────

suite('Gainage sol + 4×ok + niveau < 4 → proposition niveau sup', () => {
  const res = decideNiveauSup('Gainage sol', 4, 2);
  assert(res.proposer === true,        'proposer = true');
  assert(res.niveauSuivant === 3,      'niveauSuivant = 3');
});

suite('Gainage sol + 4×ok + niveau = 4 → pas de proposition', () => {
  const res = decideNiveauSup('Gainage sol', 4, 4);
  assert(res.proposer === false, 'pas de proposition au niveau max');
});

suite('Gainage sol + < 4 ok → pas de proposition', () => {
  const res = decideNiveauSup('Gainage sol', 3, 2);
  assert(res.proposer === false, 'pas de proposition si nbOk < 4');
});

suite('Autre atelier + 4×ok → pas de proposition', () => {
  const res = decideNiveauSup('Développé Couché', 4, 2);
  assert(res.proposer === false, 'pas de proposition pour un atelier standard');
});

// ─── Résumé ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} tests — ${passed} ✓  ${failed} ✗`);
if (failed > 0) process.exit(1);
