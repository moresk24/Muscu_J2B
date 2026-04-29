// Tests pour decideSuggestion, decideValidation, detectInterruption, decideNiveauSup, calculateSeuils
// Exécuter : node tests.js
// Zéro dépendance — pas inclus dans le runtime de l'app.

// ─── Copie des fonctions pures (synchronisée avec index.html) ─────────────────

function detectInterruption(serieLocale) {
  const n = serieLocale.length;
  if (n < 2) return { interrompu: false };
  const last = serieLocale[n - 1];
  const prev = serieLocale[n - 2];
  if (!last || !prev) return { interrompu: false };
  if (last.ressenti === 'F' && prev.ressenti === 'F') return { interrompu: true, raison: 'sous-evalue' };
  if (last.ressenti === 'E' && prev.ressenti === 'E') return { interrompu: true, raison: 'sur-evalue' };
  return { interrompu: false };
}

function decideSuggestion(serie, projet, historique) {
  const {ressenti, charge, reps, intensite} = serie;
  const ints = projet.intensites;
  const idxCurrent = ints.indexOf(intensite);
  const atMaxIntensite = idxCurrent >= ints.length - 1;
  const atMinIntensite = idxCurrent <= 0;

  if (ressenti === 'TD') {
    return {type: 'td-parfait', params: {charge, reps, intensite}};
  }

  if (ressenti === 'E') {
    if (atMinIntensite) {
      const newReps = Math.max(projet.repsMin, Math.ceil(reps * 0.85));
      return {type: 'e-min-intensite', params: {newReps, charge, intensite}};
    }
    return {type: 'e-choix', params: {charge, reps, intensite}};
  }

  // F ou D — F isolé après S1 → avertissement doux
  const avertissementDoux = ressenti === 'F' && historique.length > 1;

  if (atMaxIntensite) {
    const mult = ressenti === 'F' ? 1.30 : 1.15;
    const newReps = Math.min(Math.ceil(reps * mult), projet.repsMax);
    return {type: 'fd-max-intensite', params: {newReps, charge, intensite}, avertissementDoux};
  }

  const atMaxReps = reps >= projet.repsMax;
  if (atMaxReps) {
    const newIdx = ressenti === 'F'
      ? Math.min(idxCurrent + 2, ints.length - 1)
      : Math.min(idxCurrent + 1, ints.length - 1);
    const newIntensite = ints[newIdx];
    return {type: 'fd-force-charge', params: {newIntensite, reps}, avertissementDoux};
  }

  return {type: 'fd-choix', params: {charge, reps, intensite}, avertissementDoux};
}

function decideValidation(serieLocale) {
  const allTD = serieLocale.slice(0, 4).every(s => s && s.ressenti === 'TD');
  if (allTD) return { type: 'exceptionnel' };
  const s3td = serieLocale[2] && serieLocale[2].ressenti === 'TD';
  const s4td = serieLocale[3] && serieLocale[3].ressenti === 'TD';
  if (s3td && s4td) return { type: 'valide-bien' };
  return { type: 'valide-progres' };
}

function decideNiveauSup(nomAtelier, nbOk, niveauActuel) {
  if (nomAtelier === 'Gainage sol' && nbOk === 4 && niveauActuel < 4) {
    return {proposer: true, niveauSuivant: niveauActuel + 1};
  }
  return {proposer: false, niveauSuivant: null};
}

function calculateSeuils(nbDispo) {
  const bronze = Math.max(3, Math.ceil(4 / 16 * nbDispo));
  const argent = Math.max(4, Math.ceil(5 / 16 * nbDispo));
  const or     = Math.max(5, Math.ceil(6 / 16 * nbDispo));
  return { bronze, argent, or };
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

const P2  = {intensites: [65, 70, 75, 80], repsMin: 10, repsMax: 20}; // ESTHÉTIQUE
const P1  = {intensites: [80, 85, 90],     repsMin: 4,  repsMax: 8};  // SPORTIF
const P3A = {intensites: [40, 45, 50],     repsMin: 25, repsMax: 35}; // SANTÉ Endurance

// ─── Tests detectInterruption ────────────────────────────────────────────────

suite('2 F consécutifs en S1+S2 → sous-évalué', () => {
  const res = detectInterruption([{ressenti:'F'}, {ressenti:'F'}]);
  assert(res.interrompu === true,        'interrompu = true');
  assert(res.raison === 'sous-evalue',   'raison = sous-evalue');
});

suite('2 F consécutifs en S2+S3 → sous-évalué', () => {
  const res = detectInterruption([{ressenti:'TD'}, {ressenti:'F'}, {ressenti:'F'}]);
  assert(res.interrompu === true,        'interrompu = true');
  assert(res.raison === 'sous-evalue',   'raison = sous-evalue');
});

suite('2 E consécutifs → sur-évalué', () => {
  const res = detectInterruption([{ressenti:'TD'}, {ressenti:'E'}, {ressenti:'E'}]);
  assert(res.interrompu === true,       'interrompu = true');
  assert(res.raison === 'sur-evalue',   'raison = sur-evalue');
});

suite('F en S1 seul → pas d'interruption', () => {
  const res = detectInterruption([{ressenti:'F'}]);
  assert(res.interrompu === false, 'interrompu = false (1 seule série)');
});

suite('F en S1 puis D en S2 → pas d'interruption', () => {
  const res = detectInterruption([{ressenti:'F'}, {ressenti:'D'}]);
  assert(res.interrompu === false, 'interrompu = false (F puis D)');
});

suite('E puis F → pas d'interruption', () => {
  const res = detectInterruption([{ressenti:'E'}, {ressenti:'F'}]);
  assert(res.interrompu === false, 'interrompu = false (E puis F)');
});

// ─── Tests decideSuggestion ──────────────────────────────────────────────────

suite('TD → maintenir mêmes paramètres', () => {
  const res = decideSuggestion(
    {ressenti: 'TD', charge: 60, reps: 12, intensite: 70},
    P2, [{ressenti: 'TD', charge: 60, reps: 12}]
  );
  assert(res.type === 'td-parfait',      'type = td-parfait');
  assert(res.params.charge === 60,       'charge conservée');
  assert(res.params.reps === 12,         'reps conservées');
  assert(res.params.intensite === 70,    'intensité conservée');
});

suite('E à intensité min → suggérer reps réduites', () => {
  const res = decideSuggestion(
    {ressenti: 'E', charge: 40, reps: 12, intensite: 40},
    P3A, [{ressenti: 'E', charge: 40, reps: 12}]
  );
  assert(res.type === 'e-min-intensite', 'type = e-min-intensite');
  assert(res.params.newReps < 12,        'newReps réduits');
  assert(res.params.newReps >= P3A.repsMin, 'newReps ≥ repsMin');
});

suite('E à intensité intermédiaire → e-choix', () => {
  const res = decideSuggestion(
    {ressenti: 'E', charge: 50, reps: 15, intensite: 70},
    P2, [{ressenti: 'E', charge: 50, reps: 15}]
  );
  assert(res.type === 'e-choix', 'type = e-choix');
});

suite('F en S1 → pas d'avertissement doux', () => {
  const res = decideSuggestion(
    {ressenti: 'F', charge: 52, reps: 14, intensite: 70},
    P2, [{ressenti: 'F', charge: 52, reps: 14}]
  );
  assert(!res.avertissementDoux, 'avertissementDoux = false en S1');
});

suite('F isolé en S2 (S1 non-F) → avertissement doux', () => {
  const res = decideSuggestion(
    {ressenti: 'F', charge: 52, reps: 14, intensite: 70},
    P2, [{ressenti: 'TD', charge: 52, reps: 14}, {ressenti: 'F', charge: 52, reps: 14}]
  );
  assert(res.avertissementDoux === true, 'avertissementDoux = true pour F isolé après S1');
});

suite('D → pas d'avertissement doux', () => {
  const res = decideSuggestion(
    {ressenti: 'D', charge: 52, reps: 14, intensite: 70},
    P2, [{ressenti: 'TD'}, {ressenti: 'D', charge: 52, reps: 14}]
  );
  assert(!res.avertissementDoux, 'avertissementDoux = false pour D');
});

suite('F + intensité max + reps non max → fd-max-intensite', () => {
  const res = decideSuggestion(
    {ressenti: 'F', charge: 72, reps: 5, intensite: 90},
    P1, [{ressenti: 'F', charge: 72, reps: 5}]
  );
  assert(res.type === 'fd-max-intensite', 'type = fd-max-intensite');
  assert(res.params.newReps > 5,          'newReps augmentés');
  assert(res.params.newReps <= P1.repsMax,'newReps ≤ repsMax');
});

suite('D + intensité max + reps non max → fd-max-intensite (mult 1.15)', () => {
  const res = decideSuggestion(
    {ressenti: 'D', charge: 72, reps: 6, intensite: 90},
    P1, [{ressenti: 'D', charge: 72, reps: 6}]
  );
  assert(res.type === 'fd-max-intensite', 'type = fd-max-intensite');
  assert(res.params.newReps === Math.min(Math.ceil(6 * 1.15), P1.repsMax), 'mult 1.15 pour D');
});

suite('F à intensité intermédiaire, reps au max → fd-force-charge (+2 crans)', () => {
  const res = decideSuggestion(
    {ressenti: 'F', charge: 52, reps: 20, intensite: 70},
    P2, [{ressenti: 'F', charge: 52, reps: 20}]
  );
  assert(res.type === 'fd-force-charge',   'type = fd-force-charge');
  assert(res.params.newIntensite === 80,   'F → +2 crans : 70 → 80');
});

suite('D à intensité intermédiaire, reps au max → fd-force-charge (+1 cran)', () => {
  const res = decideSuggestion(
    {ressenti: 'D', charge: 52, reps: 20, intensite: 70},
    P2, [{ressenti: 'D', charge: 52, reps: 20}]
  );
  assert(res.type === 'fd-force-charge',   'type = fd-force-charge');
  assert(res.params.newIntensite === 75,   'D → +1 cran : 70 → 75');
});

suite('F à intensité intermédiaire, reps pas au max → fd-choix', () => {
  const res = decideSuggestion(
    {ressenti: 'F', charge: 52, reps: 14, intensite: 70},
    P2, [{ressenti: 'F', charge: 52, reps: 14}]
  );
  assert(res.type === 'fd-choix', 'type = fd-choix');
});

// ─── Tests decideValidation ──────────────────────────────────────────────────

suite('4 × TD → exceptionnel', () => {
  const series = [{ressenti:'TD'},{ressenti:'TD'},{ressenti:'TD'},{ressenti:'TD'}];
  assert(decideValidation(series).type === 'exceptionnel', 'type = exceptionnel');
});

suite('TD en S1, D en S2, TD en S3, TD en S4 → valide-bien', () => {
  const series = [{ressenti:'TD'},{ressenti:'D'},{ressenti:'TD'},{ressenti:'TD'}];
  assert(decideValidation(series).type === 'valide-bien', 'type = valide-bien');
});

suite('TD uniquement en S4 → valide-progres', () => {
  const series = [{ressenti:'D'},{ressenti:'D'},{ressenti:'D'},{ressenti:'TD'}];
  assert(decideValidation(series).type === 'valide-progres', 'type = valide-progres');
});

suite('D en S3, TD en S4 → valide-progres (S3 pas TD)', () => {
  const series = [{ressenti:'TD'},{ressenti:'TD'},{ressenti:'D'},{ressenti:'TD'}];
  assert(decideValidation(series).type === 'valide-progres', 'type = valide-progres');
});

suite('4 × D → valide-progres', () => {
  const series = [{ressenti:'D'},{ressenti:'D'},{ressenti:'D'},{ressenti:'D'}];
  assert(decideValidation(series).type === 'valide-progres', 'type = valide-progres');
});

// ─── Tests decideNiveauSup ───────────────────────────────────────────────────

suite('Gainage sol + 4×ok + niveau < 4 → proposition niveau sup', () => {
  const res = decideNiveauSup('Gainage sol', 4, 2);
  assert(res.proposer === true,     'proposer = true');
  assert(res.niveauSuivant === 3,   'niveauSuivant = 3');
});

suite('Gainage sol + 4×ok + niveau = 4 → pas de proposition', () => {
  assert(decideNiveauSup('Gainage sol', 4, 4).proposer === false, 'pas de proposition au niveau max');
});

suite('Autre atelier + 4×ok → pas de proposition', () => {
  assert(decideNiveauSup('Développé Couché', 4, 2).proposer === false, 'pas de proposition pour atelier standard');
});

// ─── Tests calculateSeuils ────────────────────────────────────────────────────

suite('calculateSeuils(16) → seuils standard', () => {
  const s = calculateSeuils(16);
  assert(s.bronze === 4, 'bronze = 4');
  assert(s.argent === 5, 'argent = 5');
  assert(s.or === 6,     'or = 6');
});

suite('calculateSeuils(12) → seuils réduits', () => {
  const s = calculateSeuils(12);
  assert(s.bronze === 3, 'bronze = 3');
  assert(s.argent === 4, 'argent = 4');
  assert(s.or === 5,     'or = 5');
});

suite('calculateSeuils(8) → seuils plancher', () => {
  const s = calculateSeuils(8);
  assert(s.bronze === 3, 'bronze = 3');
  assert(s.argent === 4, 'argent = 4');
  assert(s.or === 5,     'or = 5');
});

// ─── Tests isMaxiValid avec 'B' ───────────────────────────────────────────────

function isMaxiValid_test(nomAtelier, val) {
  if (val === 'B') return true;
  if (val === '' || val === undefined || val === null) return false;
  const type = nomAtelier === 'Banc à Lombaires' || nomAtelier === 'Abdo Sol' ? 'lombaires'
             : nomAtelier === 'Gainage sol' ? 'gainage' : 'standard';
  if (type === 'standard') return parseFloat(val) > 0;
  return true;
}

suite('isMaxiValid avec valeur "B" → true', () => {
  assert(isMaxiValid_test('Développé Couché', 'B') === true,  'standard + B → true');
  assert(isMaxiValid_test('Gainage sol',      'B') === true,  'gainage + B → true');
  assert(isMaxiValid_test('Banc à Lombaires', 'B') === true,  'lombaires + B → true');
  assert(isMaxiValid_test('Développé Couché', '')  === false, 'vide → false');
  assert(isMaxiValid_test('Développé Couché', '0') === false, 'zéro standard → false');
});

// ─── Résumé ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} tests — ${passed} ✓  ${failed} ✗`);
if (failed > 0) process.exit(1);
