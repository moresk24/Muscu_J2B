// ═══════════════════════════════════════════════════
//  ÉTAT GLOBAL
// ═══════════════════════════════════════════════════
let state = {
  classe:"", nom:"", prenom:"",
  mdp:"", isFirstLogin:false,
  projet:"",
  maxis:{},    // {nomAtelier: valeur}
  series:{},   // {nomAtelier: nb séries faites (GS)}
  // Séance locale
  intensite:null,
  serieLocale:{}, // {nomAtelier: [{ressenti, charge, reps}]}
  compteurAteliersSeance: parseInt(localStorage.getItem('compteurAteliersSeance')||'0'),
  sessionId: localStorage.getItem('sessionId')||'',
  // Config
  isAdmin: false,
  isActive: false,
  sessionNumber: 0,
  // Calc maxi
  currentCalcAtelier: 0,
  // Badges
  dernierBadge: "",
  comptCarton: 0,
  comptBronze: 0,
  comptArgent: 0,
  comptOr: 0,
  badgeCourant: "",
  badgeCourantNbAteliers: 0,
  statut: "",
  ateliersSeanceEnCours: [],
  maxisForces: [],
  currentAtelierDetail: ""
};

// ═══════════════════════════════════════════════════
//  PERSISTANCE SÉRIE LOCALE
// ═══════════════════════════════════════════════════
function saveSerieLocale() {
  localStorage.setItem('muscu_serieLocale', JSON.stringify(state.serieLocale));
}

function rebuildAteliersSeanceEnCours() {
  state.ateliersSeanceEnCours = Object.keys(state.serieLocale).filter(
    nom => Array.isArray(state.serieLocale[nom]) && state.serieLocale[nom].length >= 4
  );
}

function loadSerieLocale() {
  const raw = localStorage.getItem('muscu_serieLocale');
  if (raw) { try { state.serieLocale = JSON.parse(raw); } catch(e) {} }
  rebuildAteliersSeanceEnCours();
}

// ═══════════════════════════════════════════════════
//  VÉRIFICATION PÉRIODIQUE DE LA SESSION
// ═══════════════════════════════════════════════════
let sessionCheckInterval = null;

function startSessionCheck() {
  stopSessionCheck();
  sessionCheckInterval = setInterval(async () => {
    if (!state.classe || state.isAdmin) return;
    try {
      const d = await api({action:'getConfig', classe: state.classe});
      if (d.acces === false) { showAccesBloque(); return; }
      const wasActive = state.isActive;
      state.isActive = d.isActive;
      if (wasActive && !state.isActive && state.compteurAteliersSeance > 0) {
        saveBadgeQuietly();
        toast('⏰ La séance est terminée.<br/>Votre badge a été enregistré automatiquement.', 'warn');
      }
    } catch(e) { console.error('sessionCheck error', e); }
  }, 10 * 60 * 1000);
}

function stopSessionCheck() {
  if (sessionCheckInterval) { clearInterval(sessionCheckInterval); sessionCheckInterval = null; }
}

// ═══════════════════════════════════════════════════
//  CONFIG & MODE LECTURE SEULE
// ═══════════════════════════════════════════════════
async function loadConfig() {
  try {
    const d = await api({action:'getConfig', classe:state.classe});
    state.isActive    = d.isActive    || false;
    state.sessionNumber = d.sessionNumber || 0;
    state.isAdmin     = d.adminMdp && state.mdp === d.adminMdp.toString().trim();
    if (d.acces === false && !state.isAdmin) { showAccesBloque(); return; }
  } catch(e) { console.error('Config error', e); }
  updateTopbarSeance();
}

function isEditable() { return state.isAdmin || state.isActive; }

function updateTopbarSeance() {
  const el = $('tb-seance');
  if (!el) return;
  if (state.sessionNumber > 0) {
    el.textContent = 'S' + state.sessionNumber;
  } else {
    el.textContent = '';
  }
  // Indicateur lecture seule
  const lock = $('tb-lock');
  if (lock) lock.style.display = isEditable() ? 'none' : 'inline';
}

// ═══════════════════════════════════════════════════
//  UTILITAIRES
// ═══════════════════════════════════════════════════
const $ = id => document.getElementById(id);
let toastTimer;
function toast(msg, type='ok') {
  const t = $('toast');
  t.innerHTML = msg;
  t.className = 'toast' + (type==='error'?' error':type==='warn'?' warn':'');
  clearTimeout(toastTimer);
  setTimeout(()=>t.classList.add('show'),10);
  toastTimer = setTimeout(()=>t.classList.remove('show'), type==='warn' ? 8000 : 3000);
}
function showAccesBloque() {
  stopSessionCheck();
  loading(false);
  $('acces-bloque').classList.remove('hidden');
}

function loading(show, msg) {
  $('loading').classList.toggle('hidden', !show);
  const m = $('loading-msg');
  if (msg) { m.innerHTML = msg; m.style.display = 'block'; }
  else { m.style.display = 'none'; m.innerHTML = ''; }
}

function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function api(params) {
  const url = WEBAPP + '?' + new URLSearchParams(params);
  const r = await fetchWithTimeout(url, 12000);
  return r.json();
}
async function apiPost(body) {
  // Tout en GET pour éviter CORS avec Google Apps Script
  const params = {};
  for (const [k, v] of Object.entries(body)) {
    params[k] = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  }
  const url = WEBAPP + '?' + new URLSearchParams(params);
  const r = await fetchWithTimeout(url, 12000);
  return r.json();
}

function validateMdp(v) { return /^[a-z]{6,10}$/.test(v); }

// ═══════════════════════════════════════════════════
//  INIT CONNEXION
// ═══════════════════════════════════════════════════
let _initLoginRunning = false;
async function initLogin() {
  if (_initLoginRunning) return;
  _initLoginRunning = true;
  $('loading-retry').style.display = 'none';
  $('loading-spinner').style.display = '';
  loading(true);
  try {
    const d = await api({action:'getClasses'});
    const sel = $('sel-classe');
    sel.innerHTML = '<option value="">-- Choisir --</option>';
    (d.classes||[]).forEach(c => {
      const o = document.createElement('option');
      o.value = o.textContent = c;
      sel.appendChild(o);
    });

    // Auto-connexion si identifiants sauvegardés
    const saved = getSavedLogin();
    const classes = d.classes||[];
    if (saved) {
      loading(false);
      const connected = await autoConnect(saved, classes);
      if (!connected) await prefillForm(getPrefill(), classes);
      _initLoginRunning = false;
      return;
    }
    // Pas de login complet → pré-remplir classe et nom si connu
    await prefillForm(getPrefill(), classes);
  } catch(e) {
    loading(true, 'Impossible de joindre le serveur.<br>Vérifiez votre connexion.');
    $('loading-spinner').style.display = 'none';
    $('loading-retry').style.display = '';
    _initLoginRunning = false;
    return;
  }
  _initLoginRunning = false;
  loading(false);
}

function getSavedLogin() {
  try {
    const s = localStorage.getItem('muscu_login');
    return s ? JSON.parse(s) : null;
  } catch(e) { return null; }
}

async function autoConnect(saved, classes) {
  // Vérifier que la classe existe toujours
  if (!classes.includes(saved.classe)) return false;
  loading(true);
  try {
    const d = await api({action:'loadEleve', classe:saved.classe, nom:saved.nom, prenom:saved.prenom});
    if (d.error || d.mdp !== saved.mdp) {
      localStorage.removeItem('muscu_login');
      loading(false);
      return false;
    }
    // Connecter directement
    state.classe              = saved.classe;
    state.nom                 = saved.nom;
    state.prenom              = saved.prenom;
    state.mdp                 = saved.mdp;
    state.guidage             = d.guidage !== false;
    state.statut              = d.statut  || '';
    state.projet              = d.projet || '';
    state.maxis               = d.maxis  || {};
    state.series              = d.series || {};
    state.historiqueAteliers        = d.historique || {};
    state.historiqueAteLiersInitial = JSON.parse(JSON.stringify(d.historique || {}));
    state.dernierBadge        = d.dernierBadge || '';
    state.compteur            = parseInt(d.compteur) || 0;
    state.comptCarton         = d.comptCarton  || 0;
    state.comptBronze         = d.comptBronze  || 0;
    state.comptArgent         = d.comptArgent  || 0;
    state.comptOr             = d.comptOr      || 0;
    const newSession = saved.classe + saved.nom + saved.prenom + new Date().toDateString();
    state.seanceDejaEnregistree = localStorage.getItem('muscu_seance_enregistree') === newSession;
    if (localStorage.getItem('sessionId') !== newSession) {
      localStorage.setItem('sessionId', newSession);
      localStorage.setItem('compteurAteliersSeance', '0');
      localStorage.removeItem('muscu_serieLocale');
      state.compteurAteliersSeance = 0;
      state.serieLocale = {};
      state.ateliersSeanceEnCours = [];
    } else {
      loadSerieLocale();
    }
    $('tb-prenom').textContent = saved.prenom;
    updateHeaderProjet();
    await loadConfig();
    loading(false);
    $('screen-login').classList.remove('active');
    $('screen-app').classList.add('active');
    startSessionCheck();
    updateHmenuFinSeance();
    showPageAfterLogin();
    showRappelFinSeance();
    return true;
  } catch(e) { console.error(e); }
  loading(false);
  return false;
}

function getPrefill() {
  try { return JSON.parse(localStorage.getItem('muscu_prefill')); } catch(e) { return null; }
}

async function prefillForm(data, classes) {
  if (!data || !classes.includes(data.classe)) return;
  $('sel-classe').value = data.classe;
  loading(true);
  try {
    const d = await api({action:'getEleves', classe:data.classe});
    const selE = $('sel-eleve');
    selE.innerHTML = '<option value="">— Choisir —</option>';
    selE.disabled = false;
    (d.eleves||[]).forEach(e => {
      const o = document.createElement('option');
      o.value = JSON.stringify(e);
      o.textContent = e.nom + ' ' + e.prenom;
      selE.appendChild(o);
    });
    for (const opt of selE.options) {
      if (!opt.value) continue;
      const e = JSON.parse(opt.value);
      if (e.nom === data.nom && e.prenom === data.prenom) {
        selE.value = opt.value;
        $('zone-mdp').style.display = 'block';
        $('inp-mdp').value = '';
        $('err-mdp').style.display = 'none';
        $('mdp-label').textContent = 'Mon mot de passe';
        $('mdp-rules').style.display = 'none';
        $('zone-mdp2').style.display = 'none';
        $('btn-login').disabled = false;
        setTimeout(() => $('inp-mdp').focus(), 100);
        break;
      }
    }
  } catch(e) {}
  loading(false);
}

$('sel-classe').addEventListener('change', async function() {
  const cls = this.value;
  const selE = $('sel-eleve');
  selE.innerHTML = '<option value="">— Choisir —</option>';
  selE.disabled = !cls;
  $('zone-mdp').style.display = 'none';
  $('btn-login').disabled = true;
  if (!cls) return;
  loading(true);
  try {
    const d = await api({action:'getEleves', classe:cls});
    (d.eleves||[]).forEach(e => {
      const o = document.createElement('option');
      o.value = JSON.stringify(e);
      o.textContent = e.nom + ' ' + e.prenom;
      selE.appendChild(o);
    });
  } catch(e) { toast('Erreur chargement élèves','error'); }
  loading(false);
});

$('sel-eleve').addEventListener('change', function() {
  if (!this.value) { $('zone-mdp').style.display='none'; $('btn-login').disabled=true; return; }
  const e = JSON.parse(this.value);
  $('zone-mdp').style.display = 'block';
  $('inp-mdp').value = '';
  $('inp-mdp2').value = '';
  $('err-mdp').style.display = 'none';
  $('err-mdp2').style.display = 'none';
  if (e.hasMdp) {
    $('mdp-label').textContent = 'Mon mot de passe';
    $('mdp-rules').style.display = 'none';
    $('zone-mdp2').style.display = 'none';
  } else {
    $('mdp-label').textContent = 'Créez votre mot de passe';
    $('mdp-rules').style.display = 'block';
    $('zone-mdp2').style.display = 'block';
  }
  $('btn-login').disabled = false;
});

$('btn-login').addEventListener('click', async () => {
  const cls  = $('sel-classe').value;
  const raw  = $('sel-eleve').value;
  if (!cls || !raw) return;
  const eInfo = JSON.parse(raw);
  const mdp   = $('inp-mdp').value.trim();
  const mdp2  = $('inp-mdp2').value.trim();

  // Validation
  if (!eInfo.hasMdp) {
    if (!validateMdp(mdp)) { $('err-mdp').textContent='6 à 10 lettres minuscules, sans accent ni caractère spécial.'; $('err-mdp').style.display='block'; return; }
    if (mdp !== mdp2) { $('err-mdp2').style.display='block'; return; }
  }

  loading(true);
  try {
    // Charger données élève
    const d = await api({action:'loadEleve', classe:cls, nom:eInfo.nom, prenom:eInfo.prenom});
    if (d.error) { toast(d.error,'error'); loading(false); return; }

    // Vérifier mot de passe si existant
    if (eInfo.hasMdp && d.mdp !== mdp) {
      $('err-mdp').textContent = 'Mot de passe incorrect.';
      $('err-mdp').style.display = 'block';
      loading(false); return;
    }

    // Enregistrer mdp si première fois
    if (!eInfo.hasMdp) {
      await apiPost({action:'setPassword', classe:cls, nom:eInfo.nom, prenom:eInfo.prenom, mdp});
    }

    // Remplir state
    state.classe              = cls;
    state.nom                 = eInfo.nom;
    state.prenom              = eInfo.prenom;
    state.mdp                 = mdp;
    state.guidage             = d.guidage !== false;
    state.statut              = d.statut  || '';
    state.projet              = d.projet || '';
    state.maxis               = d.maxis  || {};
    state.series              = d.series || {};
    state.historiqueAteliers        = d.historique || {};
    state.historiqueAteLiersInitial = JSON.parse(JSON.stringify(d.historique || {}));
    state.isFirstLogin        = !eInfo.hasMdp;
    state.dernierBadge        = d.dernierBadge || '';
    state.compteur            = parseInt(d.compteur) || 0;
    state.comptCarton         = d.comptCarton  || 0;
    state.comptBronze         = d.comptBronze  || 0;
    state.comptArgent         = d.comptArgent  || 0;
    state.comptOr             = d.comptOr      || 0;

    // Nouvelle session → reset compteur local
    const newSession = cls + eInfo.nom + eInfo.prenom + new Date().toDateString();
    state.seanceDejaEnregistree = localStorage.getItem('muscu_seance_enregistree') === newSession;
    if (localStorage.getItem('sessionId') !== newSession) {
      localStorage.setItem('sessionId', newSession);
      localStorage.setItem('compteurAteliersSeance', '0');
      localStorage.removeItem('muscu_serieLocale');
      state.compteurAteliersSeance = 0;
      state.serieLocale = {};
      state.ateliersSeanceEnCours = [];
    } else {
      loadSerieLocale();
    }

    // Sauvegarder identifiants en localStorage
    localStorage.setItem('muscu_login', JSON.stringify({classe:cls, nom:eInfo.nom, prenom:eInfo.prenom, mdp}));
    localStorage.setItem('muscu_prefill', JSON.stringify({classe:cls, nom:eInfo.nom, prenom:eInfo.prenom}));

    // Afficher app
    $('tb-prenom').textContent = eInfo.prenom;
    updateHeaderProjet();
    await loadConfig();
    $('screen-login').classList.remove('active');
    $('screen-app').classList.add('active');
    startSessionCheck();
    updateHmenuFinSeance();
    showPageAfterLogin();
    showRappelFinSeance();

  } catch(e) { toast('Erreur réseau','error'); console.error(e); }
  loading(false);
});

// ═══════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════
const PAGES = ['maxis','maxi-calc','projet','projet-detail','fiche','seance','atelier-detail','bilan-badge','mes-badges','lexique','anatomie','tuto'];
let _previousPage = 'seance';
let _currentPage  = 'seance';
function showPage(name) {
  // Rediriger fiche vers projet-detail si un projet est sélectionné
  if (name === 'fiche' && state.projet) {
    currentProjetDetail = state.projet;
    name = 'projet-detail';
  }
  _previousPage = _currentPage;
  _currentPage  = name;
  PAGES.forEach(p => {
    const el = $('page-'+p);
    el.style.display = p===name ? 'block' : 'none';
    if (p===name) el.scrollTop = 0;
  });
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active',
      b.dataset.page === name ||
      (name==='projet-detail'  && b.dataset.page==='projet') ||
      (name==='atelier-detail' && b.dataset.page==='seance')
    );
  });
  updateNavLock();
  if (name==='maxis')          buildMaxis();
  if (name==='maxi-calc')      buildMaxiCalc();
  if (name==='projet')         buildProjet();
  if (name==='projet-detail')  buildProjetDetail();
  if (name==='fiche')          buildFiche();
  if (name==='seance')         buildSeance();
  if (name==='atelier-detail') buildAtelierDetail();
  if (name==='bilan-badge')    buildBilanBadge();
  if (name==='mes-badges')     buildMesBadges();
  if (name==='lexique')        buildLexique();
  if (name==='anatomie')       buildAnatomie();
  if (name==='tuto')           buildTuto();
}
document.querySelectorAll('.nav-btn').forEach(b => {
  b.addEventListener('click', ()=>showPage(b.dataset.page));
});
$('btn-logout').addEventListener('click', () => doLogout());
$('btn-logout-dispensed').addEventListener('click', () => doLogout());

// ═══════════════════════════════════════════════════
//  PAGE MAXIS
// ═══════════════════════════════════════════════════
function getAtelierType(nom) {
  if (nom === 'Gainage sol') return 'gainage';
  if (nom === 'Banc à Lombaires' || nom === 'Abdo Sol') return 'lombaires';
  return 'standard';
}

function isMaxiValid(a, val) {
  if (val === 'B') return true; // atelier exclu pour blessure = considéré renseigné
  if (val === '' || val === undefined || val === null) return false;
  if (getAtelierType(a.nom) === 'standard') return parseFloat(val) > 0;
  return true; // 0 kg additionnel et niveau 1 sont valides
}

function formatMaxiDisplay(a, val) {
  const type = getAtelierType(a.nom);
  if (type === 'gainage') return `<span class="maxi-unit">niv.</span> ${val}`;
  return `${val} <span class="maxi-unit">kg</span>`;
}

function showPageAfterLogin() {
  if (state.statut === 'D') {
    $('screen-login').classList.remove('active');
    $('screen-app').classList.remove('active');
    $('screen-dispensed').classList.add('active');
    return;
  }
  if (!maxisAllFilled()) showPage('maxis');
  else if (!state.projet)  showPage('projet');
  else                     showPage('seance');
}

function showRappelFinSeance() {
  if (!state.isActive) return;
  const key = 'muscu_rappel_' + (state.sessionId || 'session');
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  const el = $('rappel-fin-seance');
  if (el) el.style.display = 'flex';
}

function dismissRappelFinSeance() {
  const el = $('rappel-fin-seance');
  if (el) el.style.display = 'none';
}

function doLogout() {
  stopSessionCheck();
  if (state.compteurAteliersSeance > 0 && isEditable()) {
    saveBadgeQuietly();
    toast('⚠️ Votre travail a été enregistré sans attribution de badge.<br>Utilisez "Fin de Séance" pour valider votre bilan.', 'warn');
  }
  localStorage.removeItem('muscu_login');
  localStorage.removeItem('muscu_serieLocale');
  $('screen-app').classList.remove('active');
  $('screen-dispensed').classList.remove('active');
  $('screen-login').classList.add('active');
  state = {classe:'',nom:'',prenom:'',mdp:'',isFirstLogin:false,statut:'',projet:'',maxis:{},series:{},intensite:null,serieLocale:{},compteurAteliersSeance:0,sessionId:'',isAdmin:false,isActive:false,sessionNumber:0,currentCalcAtelier:0,dernierBadge:'',comptCarton:0,comptBronze:0,comptArgent:0,comptOr:0,badgeCourant:'',badgeCourantNbAteliers:0,ateliersSeanceEnCours:[],currentAtelierDetail:'',seanceDejaEnregistree:false};
  localStorage.setItem('compteurAteliersSeance', '0');
  $('sel-classe').value=''; $('sel-eleve').innerHTML='<option>— Choisir ma classe d\'abord —</option>'; $('sel-eleve').disabled=true;
  $('zone-mdp').style.display='none'; $('btn-login').disabled=true;
}

function updateHeaderProjet() {
  const el = $('tb-projet-header');
  if (!el) return;
  el.textContent = state.projet ? ` (${state.projet})` : '';
}

function updateNavLock() {
  const locked = !maxisAllFilled();
  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.dataset.page !== 'maxis') b.disabled = locked;
  });
}

function buildMaxis() {
  const pg = $('page-maxis');

  // Supprimer l'ancienne save-bar si elle existe
  const oldSaveBar = document.querySelector('.save-bar');
  if (oldSaveBar) oldSaveBar.remove();

  const nbDispo = ATELIERS.filter(a => state.maxis[a.nom] !== 'B').length;
  const maxisFilled = ATELIERS.filter(a => isMaxiValid(a, state.maxis[a.nom]) && state.maxis[a.nom] !== 'B').length;
  const allFilled = maxisAllFilled();
  const maxisReallyFilled = ATELIERS.every(a => isMaxiValid(a, state.maxis[a.nom]));

  let html = `<div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:.05em;margin-bottom:.5rem">💪 Mes Maxis <span style="color:var(--accent)">(1RM)</span></div>
  <div style="font-size:.78rem;color:var(--muted);line-height:1.55;margin-bottom:.9rem"><strong style="color:var(--text)">MAXI :</strong> c'est le poids maximum que vous pouvez soulever <strong style="color:var(--text)">une seule fois</strong> (1RM) sur un atelier, dans une exécution correcte.<br>C'est votre référence personnelle pour calculer ensuite vos charges de travail en fonction de votre projet.</div>
  <div style="margin-bottom:.75rem">
    <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--muted);margin-bottom:.35rem">
      <span>Maxis renseignés</span><span style="color:var(--text);font-weight:700">${maxisFilled} / ${nbDispo}</span>
    </div>
    <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${nbDispo > 0 ? (maxisFilled/nbDispo*100).toFixed(0) : 0}%"></div></div>
  </div>`;

  if (maxisReallyFilled && !state.projet) {
    html += `<div class="congrats-banner">
      <div class="congrats-banner-emoji">🎉</div>
      <div class="congrats-banner-title">Bravo ! Tous vos maxis sont renseignés !</div>
      <div class="congrats-banner-sub">Vous pouvez maintenant choisir votre projet personnel de travail pour les prochaines séances.</div>
    </div>`;
  }

  let lastGroupe = null;
  ATELIERS.forEach((a, i) => {
    if (a.groupe !== lastGroupe) {
      lastGroupe = a.groupe;
      html += `<div class="section-title">${a.groupe==='haut'?'🏋️ Haut du corps':'🦵 Bas du corps'}</div>`;
    }
    const val = state.maxis[a.nom];
    const isBless = val === 'B';
    const hasMaxi = isMaxiValid(a, val);

    if (isBless) {
      html += `<div class="atelier-card" style="opacity:.45;cursor:default" data-idx="${i}">
        <div class="atelier-icon ${a.groupe==='haut'?'icon-haut':'icon-bas'}" style="filter:grayscale(1)">${a.icon}</div>
        <div class="atelier-info">
          <div class="atelier-name">${a.nom}</div>
          <div class="atelier-muscles">${a.muscles}</div>
        </div>
        <div class="maxi-ro" style="color:var(--muted)">🚫</div>
      </div>`;
    } else {
      const maxiHtml = hasMaxi
        ? `<div class="maxi-ro">${formatMaxiDisplay(a, val)}</div>`
        : `<div class="maxi-ro-empty">+ maxi</div>`;

      html += `<div class="atelier-card ${hasMaxi?'validated':''} clickable" data-idx="${i}">
        <div class="atelier-icon ${a.groupe==='haut'?'icon-haut':'icon-bas'}">${a.icon}</div>
        <div class="atelier-info">
          <div class="atelier-name">${a.nom}</div>
          <div class="atelier-muscles">${a.muscles}${a.note?` · <em>${a.note}</em>`:''}</div>
        </div>
        ${maxiHtml}
      </div>`;
    }
  });

  pg.innerHTML = html + '<div style="height:2rem"></div>';

  pg.querySelectorAll('.atelier-card.clickable').forEach(card => {
    card.addEventListener('click', () => goToMaxiCalc(parseInt(card.dataset.idx)));
  });

  updateNavLock();
}

async function saveMaxis() {
  if (!isEditable()) { toast('Mode consultation — modifications non autorisées', 'warn'); return; }
  loading(true);
  try {
    const d = await apiPost({action:'saveMaxis', classe:state.classe, nom:state.nom, prenom:state.prenom, maxis:state.maxis});
    if (d.error) throw new Error(d.error);
    const allFilled = maxisAllFilled();
    if (allFilled) {
      toast('Tous les maxis enregistrés ! 🎉 Choisissez votre projet !');
      showPage('projet');
    } else {
      toast('Maxis enregistrés ✓');
      buildMaxis();
    }
  } catch(e) { toast('Erreur enregistrement','error'); }
  loading(false);
}

// ── Helper : tous les maxis sont-ils remplis ? ─────────────
function maxisAllFilled() {
  if (state.isAdmin) return true;
  return ATELIERS.every(a => isMaxiValid(a, state.maxis[a.nom]));
}

// ── Navigation vers la page calcul maxi ────────────────────
let _calcMode = 1;
let _calcDrum = { charge: 40, reps: 10 };
let _forcedRecalc = false;
function goToMaxiCalc(idx, forced = false) {
  state.currentCalcAtelier = idx;
  _calcMode = 1;
  _forcedRecalc = forced;
  showPage('maxi-calc');
}

// ═══════════════════════════════════════════════════
//  PAGE CALCULER MON MAXI
// ═══════════════════════════════════════════════════
function buildMaxiCalc() {
  const idx = state.currentCalcAtelier || 0;
  const a = ATELIERS[idx];
  const type = getAtelierType(a.nom);
  const pg = $('page-maxi-calc');

  const chargeValsCalc = [
    ...Array.from({length: 28}, (_, i) => Math.round((0.5 + i * 0.5) * 10) / 10), // 0.5 → 14.5 par 0.5
    ...Array.from({length: 86}, (_, i) => 15 + i),                                  // 15 → 100 par 1
    ...Array.from({length: 20}, (_, i) => 102.5 + i * 2.5)                          // 102.5 → 150 par 2.5
  ];
  const repsValsCalc   = Array.from({length: 12},  (_, i) => i + 4);

  function render() {
    let formHtml = '';

    if (_calcMode === 1) {
      // ── Mode Calcul ──
      if (type === 'standard') {
        formHtml = `
          <div class="drum-picker-wrap">
            <div class="drum-picker-col">
              <div class="field-label" style="margin-bottom:.3rem">Charge (kg)</div>
              <div class="drum-picker" id="drum-calc-charge">
                <div class="drum-highlight"></div>
                <div class="drum-track"></div>
              </div>
            </div>
            <div class="drum-picker-col">
              <div class="field-label" style="margin-bottom:.3rem">Répétitions (4–15)</div>
              <div class="drum-picker" id="drum-calc-reps">
                <div class="drum-highlight"></div>
                <div class="drum-track"></div>
              </div>
            </div>
          </div>
          <button class="btn" id="btn-calc">Calculer mon maxi théorique</button>
          <div class="calc-result" id="calc-result"></div>
          <button class="btn" id="btn-valid-calc" style="display:none;margin-top:.5rem">Valider ce maxi</button>
          <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:.9rem 1rem;margin-top:1.25rem">
            <div style="font-size:.82rem;color:var(--text);margin-bottom:.5rem">📐 Nous utilisons ici la formule de <strong>Brzycki</strong></div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;color:var(--accent);margin-bottom:.5rem">Maxi (1RM) = Poids ÷ (1,0278 − 0,0278 × Reps)</div>
            <div style="font-size:.78rem;color:var(--muted);line-height:1.5">
              <strong style="color:var(--text)">1RM</strong> = charge maximale que tu peux soulever en une seule répétition.<br>
              <strong style="color:var(--text)">Poids</strong> = charge soulevée lors du test (kg).<br>
              <strong style="color:var(--text)">Reps</strong> = nombre de répétitions réalisées (4 à 15).
            </div>
          </div>`;
      } else if (type === 'lombaires') {
        formHtml = `
          <p style="font-size:.82rem;color:var(--muted);margin-bottom:1rem;line-height:1.5">
            À cet atelier vous devez faire <strong style="color:var(--text)">30 répétitions en 1 mn</strong>.<br>
            Indiquez ici quel poids vous devez rajouter pour que l'exercice soit difficile à faire.<br>
            Si vous ne rajoutez rien, indiquez 0.<br>
            <strong style="color:var(--yellow)">Attention vous ne pouvez pas ajouter + de 10 kg.</strong>
          </p>
          <div class="field">
            <label class="field-label">Poids additionnel</label>
            <select id="calc-poids-add">
              <option value="0">0 kg (sans lest)</option>
              <option value="2">2 kg</option>
              <option value="5">5 kg</option>
              <option value="10">10 kg</option>
            </select>
          </div>
          <button class="btn" id="btn-valid-calc" style="margin-top:.5rem">Valider ce maxi</button>`;
      } else {
        formHtml = `
          <p style="font-size:.82rem;color:var(--muted);margin-bottom:1rem;line-height:1.5">
            Le maxi au Gainage sol correspond au <strong style="color:var(--text)">niveau d'exécution</strong> que vous êtes capable de maintenir.
          </p>
          <div class="field">
            <label class="field-label">Niveau atteint</label>
            <select id="calc-niveau">
              <option value="1">Niveau 1</option>
              <option value="2">Niveau 2</option>
              <option value="3">Niveau 3</option>
              <option value="4">Niveau 4</option>
            </select>
          </div>
          <button class="btn" id="btn-valid-calc" style="margin-top:.5rem">Valider ce maxi</button>`;
      }
    } else {
      // ── Mode Saisie directe ──
      if (type === 'standard') {
        formHtml = `
          <p style="font-size:.82rem;color:var(--muted);margin-bottom:1rem;line-height:1.5">
            Entrez directement la valeur de votre maxi si vous la connaissez déjà.
          </p>
          <div class="field">
            <label class="field-label">Mon maxi (kg)</label>
            <input type="number" id="direct-val" inputmode="decimal" step="0.5" min="0" placeholder="ex : 62.5">
          </div>
          <button class="btn" id="btn-valid-direct">Valider ce maxi</button>`;
      } else if (type === 'lombaires') {
        formHtml = `
          <div class="field">
            <label class="field-label">Poids additionnel (kg)</label>
            <input type="number" id="direct-val" inputmode="numeric" step="1" min="0" max="30" placeholder="ex : 5">
          </div>
          <button class="btn" id="btn-valid-direct">Valider ce maxi</button>`;
      } else {
        formHtml = `
          <div class="field">
            <label class="field-label">Niveau (1 à 4)</label>
            <input type="number" id="direct-val" inputmode="numeric" step="1" min="1" max="4" placeholder="ex : 2">
          </div>
          <button class="btn" id="btn-valid-direct">Valider ce maxi</button>`;
      }
    }

    const ac = ATELIERS_CONTENT[a.nom];
    let pedagHtml = '';
    if (ac) {
      const execItems = (ac.exec||[]).map(s=>`<div class="atelier-detail-item">${s}</div>`).join('');
      const secuItems = (ac.secu||[]).map(s=>`<div class="atelier-detail-item${s.startsWith('⚠️')?' atelier-detail-warn':''}">${s}</div>`).join('');
      if (execItems) pedagHtml += `<div class="atelier-bloc-title" style="margin-top:1.25rem">📋 Consignes d'exécution</div>${execItems}`;
      if (secuItems) pedagHtml += `<div class="atelier-bloc-title">🛡️ Règles de sécurité</div>${secuItems}`;
    }

    const maxiActuel = state.maxis[a.nom];
    const maxiDisplay = maxiActuel ? formatMaxiDisplay(a, maxiActuel) : null;

    const forcedBanner = _forcedRecalc ? `
      <div style="background:var(--red);color:#fff;border-radius:12px;padding:.85rem 1rem;margin-bottom:1rem;font-size:.88rem;line-height:1.5">
        ⚠️ <strong>Votre maxi n'est pas adapté à votre niveau actuel.</strong><br>
        Vous devez effectuer une nouvelle recherche pour cet atelier avant de reprendre la séance.
      </div>` : '';

    pg.innerHTML = `
      <div class="calc-header">
        <div class="calc-atelier-title">${a.icon} ${a.nom}</div>
        ${maxiDisplay ? `<div style="font-size:.95rem;color:var(--accent);font-weight:700;margin-top:.25rem">Maxi actuel : ${maxiDisplay}</div>` : ''}
      </div>
      ${forcedBanner}
      ${type === 'standard' ? `<div class="calc-mode-tabs">
        <button class="calc-mode-tab ${_calcMode===1?'active':''}" id="tab-calc">Calculer mon maxi</button>
        <button class="calc-mode-tab ${_calcMode===2?'active':''}" id="tab-direct">Saisie manuelle</button>
      </div>` : ''}
      ${formHtml}
      ${pedagHtml}
      <div style="height:2rem"></div>`;

    attachListeners();
  }

  function attachListeners() {
    if ($('tab-calc'))   $('tab-calc').addEventListener('click',   () => { _calcMode = 1; render(); });
    if ($('tab-direct')) $('tab-direct').addEventListener('click', () => { _calcMode = 2; render(); });

    if (_calcMode === 1) {
      if (type === 'standard') {
        initDrumPicker('drum-calc-charge', chargeValsCalc, _calcDrum.charge, v => _calcDrum.charge = v);
        initDrumPicker('drum-calc-reps',   repsValsCalc,   _calcDrum.reps,   v => _calcDrum.reps   = v);
        const btnCalc  = $('btn-calc');
        const btnValid = $('btn-valid-calc');
        const result   = $('calc-result');
        btnCalc.addEventListener('click', () => {
          const charge = _calcDrum.charge;
          const reps   = _calcDrum.reps;
          const rm = Math.ceil(charge / (1.0278 - 0.0278 * reps));
          result.innerHTML = `${a.nom} :<br><span class="calc-result-value">${rm} kg</span>`;
          result.classList.add('visible');
          btnValid.style.display = 'block';
          btnValid.dataset.value = rm;
        });
        btnValid.addEventListener('click', () => {
          const v = btnValid.dataset.value;
          if (v) saveSingleMaxi(a.nom, v);
        });

      } else if (type === 'lombaires') {
        const sel = $('calc-poids-add');
        const maxiActuelLomb = state.maxis[a.nom];
        if (maxiActuelLomb !== undefined) sel.value = String(maxiActuelLomb);
        $('btn-valid-calc').addEventListener('click', () => saveSingleMaxi(a.nom, sel.value));

      } else {
        const sel = $('calc-niveau');
        const maxiActuelGain = state.maxis[a.nom];
        if (maxiActuelGain !== undefined) sel.value = String(maxiActuelGain);
        $('btn-valid-calc').addEventListener('click', () => saveSingleMaxi(a.nom, sel.value));
      }

    } else {
      $('btn-valid-direct').addEventListener('click', () => {
        const v = $('direct-val').value;
        if (v === '' || v === undefined) { toast('Saisissez une valeur', 'warn'); return; }
        if (type === 'standard' && parseFloat(v) <= 0) { toast('La valeur doit être supérieure à 0', 'warn'); return; }
        if (type === 'gainage' && (parseInt(v) < 1 || parseInt(v) > 4)) { toast('Le niveau doit être entre 1 et 4', 'warn'); return; }
        saveSingleMaxi(a.nom, v);
      });
    }
  }

  render();
}

async function saveSingleMaxi(atelierNom, value) {
  if (!isEditable()) { toast('Mode consultation — modifications non autorisées', 'warn'); return; }
  loading(true);
  try {
    state.maxis[atelierNom] = value;
    const d = await apiPost({action:'saveMaxis', classe:state.classe, nom:state.nom, prenom:state.prenom, maxis:state.maxis});
    if (d.error) throw new Error(d.error);
    toast('Maxi enregistré ✓');
    showPage('maxis');
  } catch(e) { toast('Erreur enregistrement', 'error'); }
  loading(false);
}

// ═══════════════════════════════════════════════════
//  PAGE PROJET — CHOIX
// ═══════════════════════════════════════════════════
function buildProjet() {
  const pg = $('page-projet');
  const allFilled = maxisAllFilled();

  let html = `<div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:.05em;margin-bottom:.75rem">🎯 Les Projets</div>`;
  if (!allFilled) {
    html += `<div class="lock-msg">🔒 Renseignez tous vos maxis pour débloquer le choix du projet !</div>`;
  }

  if (!state.projet && allFilled) {
    html += `<div style="background:rgba(255,149,0,.08);border:1px solid rgba(255,149,0,.3);border-radius:14px;padding:1rem 1.1rem;margin-bottom:1.25rem;text-align:center">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:.05em;color:var(--accent)">Choisissez votre projet de travail</div>
      <div style="font-size:.85rem;color:var(--muted);margin-top:.35rem">Consultez chaque projet, puis sélectionnez celui qui vous correspond</div>
    </div>`;
  }

  if (state.projet) {
    html += `<div style="font-size:.75rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem">Cliquez sur un projet pour en voir le détail</div>`;
  }

  const _projetStr = String(state.projet);
  const projetsOrdonnes = Object.values(PROJETS).sort((a,b) => a.num===_projetStr ? -1 : b.num===_projetStr ? 1 : 0);
  projetsOrdonnes.forEach(p => {
    const isCurrent = _projetStr === p.num;
    const c = PROJETS_CONTENT[p.num];
    const cardLocked = !allFilled;
    html += `<div class="projet-card ${cardLocked?'locked':''} ${isCurrent?'selected':''}" data-projet="${p.num}" style="position:relative">
      ${isCurrent ? `<div style="position:absolute;top:.6rem;right:.6rem;font-size:.7rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.06em">✓ Votre projet</div>` : ''}
      <div class="projet-num">${c ? c.badge : p.num}</div>
      <div class="projet-name">${c ? `${c.icon} ${c.titre}` : p.nom}</div>
      <div class="projet-desc">${c ? c.sousTitre : p.desc}</div>
      <div class="projet-tags">
        <span class="tag">💪 ${p.intensites[0]}–${p.intensites[p.intensites.length-1]}% maxi</span>
        <span class="tag">📊 ${p.repsMin}–${p.repsMax} reps</span>
        <span class="tag">🔁 ${p.seriesMin}–${p.seriesMax} séries</span>
      </div>
      <div style="text-align:right;margin-top:.5rem;font-size:.8rem;color:var(--accent)">Voir le détail →</div>
    </div>`;
  });

  pg.innerHTML = html;

  pg.querySelectorAll('.projet-card:not(.locked)').forEach(card => {
    card.addEventListener('click', () => goToProjetDetail(card.dataset.projet));
  });
}

let currentProjetDetail = null;
function goToProjetDetail(num) {
  currentProjetDetail = num;
  showPage('projet-detail');
}

function getProjetGradient(num) {
  const map = {
    "1":  "linear-gradient(135deg,#ff6b2b,#ffb347)",
    "2":  "linear-gradient(135deg,#3d8bff,#1a6ee0)",
    "3A": "linear-gradient(135deg,#2ecc71,#1fa055)",
    "3B": "linear-gradient(135deg,#ffb347,#e8922a)"
  };
  return map[num] || map["1"];
}

function buildProjetDetail() {
  const pg = $('page-projet-detail');
  const num = currentProjetDetail;
  if (!num) { showPage('projet'); return; }

  const c = PROJETS_CONTENT[num];
  const p = PROJETS[num];
  if (!c || !p) { showPage('projet'); return; }

  const isCurrent = String(state.projet) === num;
  const canChoose = maxisAllFilled() && isEditable();

  let chooseBtn = '';
  if (!isCurrent && canChoose) {
    chooseBtn = `<button class="btn" style="width:100%" onclick="selectProjetFromDetail('${num}')">Choisir ce projet</button>`;
  }

  const pageTitle = isCurrent
    ? `<div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:.05em;margin-bottom:.75rem">🎯 Votre projet de travail</div>`
    : '';

  pg.innerHTML = `
    ${pageTitle}
    ${chooseBtn ? `<div style="margin-bottom:.75rem">${chooseBtn}</div>` : ''}
    <div class="projet-fiche">
      <div class="fiche-header" style="background:${getProjetGradient(num)}">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.75);margin-bottom:.3rem">${c.badge}</div>
        <h2>${c.icon} ${c.titre}</h2>
        <p>${c.sousTitre}</p>
      </div>
      <div style="padding:.9rem 1.25rem;border-bottom:1px solid var(--border)">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .4rem">En résumé</div>
        <div style="font-size:.88rem;color:var(--text);line-height:1.55">${c.resume.replace(/\. /g,'.<br>')}</div>
      </div>
      <div style="padding:.9rem 1.25rem;border-bottom:1px solid var(--border)">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .4rem">Ce que vous allez ressentir</div>
        <div style="font-size:.88rem;color:var(--text);line-height:1.55">${c.sensations.replace(/\. /g,'.<br>')}</div>
      </div>
      <div style="padding:.9rem 1.25rem;border-bottom:1px solid var(--border)">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .5rem">Ce projet est fait pour vous si…</div>
        ${c.profils.map(s=>`<div style="font-size:.87rem;color:var(--text);padding:.25rem 0 .25rem .8rem;border-left:2px solid var(--accent);margin-bottom:.35rem">→ ${s}</div>`).join('')}
      </div>
      <div style="padding:.9rem 1.25rem;border-bottom:1px solid var(--border)">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .5rem">Ce que vous allez gagner</div>
        ${c.gains.map(s=>`<div style="font-size:.87rem;color:var(--text);padding:.25rem 0 .25rem .8rem;border-left:2px solid var(--green);margin-bottom:.35rem">✓ ${s}</div>`).join('')}
      </div>
      <div style="padding:.9rem 1.25rem">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .6rem">Paramètres de travail</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Intensité</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${c.parametres.intensite}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Répétitions</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${c.parametres.repetitions}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Séries</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${c.parametres.series}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Récupération</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${c.parametres.recuperation}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Durée d'une série</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${p.dureeSerie}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Vitesse</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${p.vitesse}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem;grid-column:span 2">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Contractions</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${p.contractions}</div>
          </div>
        </div>
      </div>
    </div>
    <button onclick="window.open('${c.pdf}','_blank')" style="width:100%;background:none;border:1px solid var(--green);border-radius:12px;padding:.75rem;color:var(--green);font-size:.88rem;cursor:pointer;margin-bottom:.75rem">📄 Télécharger la fiche complète de ce projet ${c.titre} au format PDF</button>
    <div style="height:1rem"></div>
  `;
}

let pendingProjet = null;
function selectProjet(num) {
  if (state.projet && state.projet !== num) {
    pendingProjet = num;
    $('modal-bg').classList.remove('hidden');
  } else {
    confirmProjet(num);
  }
}
function selectProjetFromDetail(num) {
  selectProjet(num);
}
$('modal-cancel').onclick = () => { $('modal-bg').classList.add('hidden'); pendingProjet=null; };
$('modal-confirm').onclick = () => { $('modal-bg').classList.add('hidden'); if(pendingProjet) confirmProjet(pendingProjet); };

function updateHmenuFinSeance() {
  const btn = $('hmenu-fin-seance');
  if (!btn) return;
  if (state.seanceDejaEnregistree) {
    btn.textContent = '✅ Séance déjà enregistrée';
    btn.disabled = true;
    btn.style.opacity = '0.45';
  } else {
    btn.textContent = '✅ Enregistrer ma séance';
    btn.disabled = false;
    btn.style.opacity = '';
  }
}

function confirmerFinSeance() {
  if (state.seanceDejaEnregistree) {
    toast('Votre séance a déjà été enregistrée pour cette séance.', 'warn');
    return;
  }
  const nb = state.compteurAteliersSeance;
  const msg = $('modal-fin-msg');
  if (nb < 4) {
    msg.innerHTML = `⚠️ <strong>Attention, vous avez fait seulement ${nb} atelier${nb > 1 ? 's' : ''}.</strong><br>Êtes-vous sûr(e) de vouloir enregistrer votre séance ?<br>Vous ne pourrez plus valider d'atelier à la suite de l'enregistrement.`;
  } else {
    msg.innerHTML = 'Êtes-vous sûr(e) ?<br>Vous ne pourrez plus valider d\'atelier pour cette séance.';
  }
  $('modal-fin-seance-bg').classList.remove('hidden');
}
$('modal-fin-cancel').onclick = () => { $('modal-fin-seance-bg').classList.add('hidden'); };
$('modal-fin-confirm').onclick = () => { $('modal-fin-seance-bg').classList.add('hidden'); saveBadge(); };

async function confirmProjet(num) {
  if (!isEditable()) { toast('Mode consultation — modifications non autorisées', 'warn'); return; }
  loading(true);
  try {
    const d = await apiPost({action:'saveProjet', classe:state.classe, nom:state.nom, prenom:state.prenom, projet:num});
    if (d.error) throw new Error(d.error);
    state.projet = num;
    updateHeaderProjet();
    toast(`Projet ${PROJETS[num].nom} enregistré ✓`);
    showPage('projet');
  } catch(e) { toast('Erreur','error'); }
  loading(false);
}

// ═══════════════════════════════════════════════════
//  PAGE FICHE PROJET
// ═══════════════════════════════════════════════════
function buildFiche() {
  const pg = $('page-fiche');
  if (!state.projet) {
    pg.innerHTML = `<div class="lock-msg" style="margin-top:2rem">🎯 Choisissez d'abord votre projet pour voir votre fiche !</div>`;
    return;
  }
  const c = PROJETS_CONTENT[state.projet];
  const p = PROJETS[state.projet];

  pg.innerHTML = `
    <div class="projet-fiche">
      <div class="fiche-header" style="background:${getProjetGradient(state.projet)}">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.75);margin-bottom:.3rem">${c.badge}</div>
        <h2>${c.icon} ${c.titre}</h2>
        <p>${c.sousTitre}</p>
      </div>
      <div style="padding:.9rem 1.25rem;border-bottom:1px solid var(--border)">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .4rem">En résumé</div>
        <div style="font-size:.88rem;color:var(--text);line-height:1.55">${c.resume}</div>
      </div>
      <div style="padding:.9rem 1.25rem;border-bottom:1px solid var(--border)">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .4rem">Ce que vous allez ressentir</div>
        <div style="font-size:.88rem;color:var(--text);line-height:1.55">${c.sensations}</div>
      </div>
      <div style="padding:.9rem 1.25rem;border-bottom:1px solid var(--border)">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .5rem">Ce projet est fait pour vous si…</div>
        ${c.profils.map(s=>`<div style="font-size:.87rem;color:var(--text);padding:.25rem 0 .25rem .8rem;border-left:2px solid var(--accent);margin-bottom:.35rem">→ ${s}</div>`).join('')}
      </div>
      <div style="padding:.9rem 1.25rem;border-bottom:1px solid var(--border)">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .5rem">Ce que vous allez gagner</div>
        ${c.gains.map(s=>`<div style="font-size:.87rem;color:var(--text);padding:.25rem 0 .25rem .8rem;border-left:2px solid var(--green);margin-bottom:.35rem">✓ ${s}</div>`).join('')}
      </div>
      <div style="padding:.9rem 1.25rem">
        <div class="atelier-bloc-title" style="margin:.3rem 0 .6rem">Paramètres de travail</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Intensité</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${c.parametres.intensite}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Répétitions</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${c.parametres.repetitions}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Séries</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${c.parametres.series}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem">
            <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Récupération</div>
            <div style="font-size:.88rem;font-weight:700;color:var(--accent)">${c.parametres.recuperation}</div>
          </div>
        </div>
      </div>
    </div>
    <button onclick="window.open('${c.pdf}','_blank')" style="width:100%;background:none;border:1px solid var(--border);border-radius:12px;padding:.75rem;color:var(--muted);font-size:.88rem;cursor:pointer;margin-bottom:1rem">📄 Télécharger la fiche complète</button>
    <div style="height:.5rem"></div>
  `;
}

// ═══════════════════════════════════════════════════
//  SYSTÈME DE BADGES
// ═══════════════════════════════════════════════════

function calculateSeuils(nbDispo) {
  const bronze = Math.max(3, Math.ceil(4 / 16 * nbDispo));
  const argent = Math.max(4, Math.ceil(5 / 16 * nbDispo));
  const or     = Math.max(5, Math.ceil(6 / 16 * nbDispo));
  return { bronze, argent, or };
}

function getNbDispo() {
  return ATELIERS.filter(a => state.maxis[a.nom] !== 'B').length;
}

function calculateBadge(nbAteliers, nbDispo) {
  const n = nbDispo !== undefined ? nbDispo : ATELIERS.length;
  const s = calculateSeuils(n);
  if (nbAteliers >= s.or)     return 'Or';
  if (nbAteliers >= s.argent) return 'Argent';
  if (nbAteliers >= s.bronze) return 'Bronze';
  return 'Carton';
}

async function saveBadge() {
  const nbAteliers = state.compteurAteliersSeance;
  const badge = calculateBadge(nbAteliers, getNbDispo());
  if (badge === 'Carton') state.comptCarton++;
  else if (badge === 'Bronze') state.comptBronze++;
  else if (badge === 'Argent') state.comptArgent++;
  else state.comptOr++;
  state.dernierBadge = badge;
  state.badgeCourant = badge;
  state.badgeCourantNbAteliers = nbAteliers;

  // Construire le JSON historique avant de vider serieLocale
  const histDetail = state.ateliersSeanceEnCours.map(n => {
    const local = state.serieLocale[n] || [];
    const isSpecial = local.length && local[0] && local[0].special;
    if (isSpecial) return { nom: n, special: true, series: local.map(s => ({resultat: s.resultat})) };
    return { nom: n, series: local.slice(0,4).map(s => ({charge: s.charge, reps: s.reps, ressenti: s.ressenti})) };
  });
  const histJson = JSON.stringify({
    date: new Date().toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'}),
    seance: state.sessionNumber,
    badge,
    ateliers: nbAteliers,
    detail: histDetail
  });

  loading(true, 'Patientez pendant l\'enregistrement<br>de votre séance');
  try {
    const reqs = [
      apiPost({ action:'saveBadge', classe:state.classe, nom:state.nom, prenom:state.prenom,
                badge, comptCarton:state.comptCarton, comptBronze:state.comptBronze,
                comptArgent:state.comptArgent, comptOr:state.comptOr })
    ];
    const seanceHist = state.sessionNumber > 0 ? state.sessionNumber : (state.isAdmin ? 1 : 0);
    if (seanceHist > 0) {
      reqs.push(apiPost({ action:'saveHistorique', classe:state.classe, nom:state.nom,
                          prenom:state.prenom, seance:seanceHist, data:histJson }));
    }
    await Promise.all(reqs);
  } catch(e) { console.error('saveBadge error', e); }
  loading(false);

  state.bilanSeance = {
    ateliers:    state.ateliersSeanceEnCours.slice(),
    serieLocale: JSON.parse(JSON.stringify(state.serieLocale)),
    historique:  state.historiqueAteLiersInitial || {},
    maxisForces: state.maxisForces.slice()
  };

  state.compteurAteliersSeance = 0;
  localStorage.setItem('compteurAteliersSeance', '0');
  state.serieLocale = {};
  state.ateliersSeanceEnCours = [];
  localStorage.removeItem('muscu_serieLocale');

  state.seanceDejaEnregistree = true;
  localStorage.setItem('muscu_seance_enregistree', localStorage.getItem('sessionId') || '');
  updateHmenuFinSeance();

  showPage('bilan-badge');
}

function saveBadgeQuietly() {
  const badge = calculateBadge(state.compteurAteliersSeance, getNbDispo());
  if (badge === 'Carton') state.comptCarton++;
  else if (badge === 'Bronze') state.comptBronze++;
  else if (badge === 'Argent') state.comptArgent++;
  else state.comptOr++;
  state.dernierBadge = badge;

  apiPost({
    action: 'saveBadge',
    classe: state.classe,
    nom: state.nom,
    prenom: state.prenom,
    badge,
    comptCarton: state.comptCarton,
    comptBronze: state.comptBronze,
    comptArgent: state.comptArgent,
    comptOr: state.comptOr
  }).catch(e => console.error('saveBadgeQuietly error', e));
}

function openBadgeZoom(nom) {
  $('badge-zoom-img').src = badgeImgBig(nom);
  $('badge-zoom-img').alt = nom;
  $('badge-zoom-label').textContent = nom;
  $('badge-zoom').classList.remove('hidden');
}
function closeBadgeZoom() {
  $('badge-zoom').classList.add('hidden');
}

function badgeImgBig(badge) {
  const map = {Carton:'images/badge-carton-big.png', Bronze:'images/badge-bronze-big.png', Argent:'images/badge-argent-big.png', Or:'images/badge-or-big.png'};
  return map[badge] || '';
}

function badgeImgSmall(badge) {
  const map = {Carton:'images/badge-carton-small.png', Bronze:'images/badge-bronze-small.png', Argent:'images/badge-argent-small.png', Or:'images/badge-or-small.png'};
  return map[badge] || '';
}

function buildBilanBadge() {
  const pg = $('page-bilan-badge');
  const badge = state.badgeCourant || state.dernierBadge;
  const today = new Date().toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'});
  const total = state.comptCarton + state.comptBronze + state.comptArgent + state.comptOr;

  const badgesOrder = [
    {nom:'Carton', compt: state.comptCarton},
    {nom:'Bronze', compt: state.comptBronze},
    {nom:'Argent', compt: state.comptArgent},
    {nom:'Or',     compt: state.comptOr}
  ].filter(b => b.compt > 0);

  const historiqueHTML = badgesOrder.map(b => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:.3rem;min-width:80px">
      <img src="${badgeImgSmall(b.nom)}" alt="${b.nom}" width="96" height="96" style="width:96px;height:96px;object-fit:contain">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.05em">${b.nom}</span>
      <span style="color:var(--muted);font-size:.85rem">(${b.compt})</span>
    </div>`).join('');

  pg.innerHTML = `
    <div style="padding:1rem">
      <div style="text-align:center;margin:1.5rem 0 1rem">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;letter-spacing:.06em;color:var(--accent)">${badge === 'Carton' ? 'Séance enregistrée.' : 'Bravo ! Séance validée !'}</div>
        ${badge === 'Carton' ? `<div style="font-size:.95rem;color:var(--muted);margin-top:.3rem">Il faudra faire mieux à la prochaine séance !</div>` : ''}
      </div>

      <div style="text-align:center;margin-bottom:1rem;line-height:1.7">
        <div style="color:var(--muted);font-size:.9rem">Séance du ${today}</div>
        <div style="font-size:1rem">${state.badgeCourantNbAteliers} atelier${state.badgeCourantNbAteliers > 1 ? 's' : ''} validé${state.badgeCourantNbAteliers > 1 ? 's' : ''} ✓</div>
        <div style="font-size:1rem;font-weight:600">Badge obtenu : <span style="color:var(--accent)">${badge}</span></div>
      </div>

      <div style="text-align:center;padding:.5rem 0 1rem">
        <img src="${badgeImgBig(badge)}" alt="${badge}" width="200" height="200" style="width:200px;height:200px;object-fit:contain">
      </div>

      ${(()=>{
        const bilan = state.bilanSeance || {};
        const ateliersB = bilan.ateliers || [];
        const maxisF = bilan.maxisForces || [];
        const rColors = {F:'#2980b9',D:'#27ae60',TD:'#f39c12',E:'#c0392b'};
        if (!ateliersB.length && !maxisF.length) return '';

        const rows = ateliersB.map(nom => {
          const ai = ATELIERS.find(x => x.nom === nom);
          const icon = ai ? ai.icon : '🏋️';
          const local = (bilan.serieLocale || {})[nom] || [];
          const isSpecial = local.length && local[0] && local[0].special;
          const maxiForcé = maxisF.includes(nom);

          if (isSpecial) {
            const nbOk = local.filter(s => s.resultat === 'ok').length;
            return `<div style="padding:.4rem 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem">
                <span>${icon}</span>
                <span style="flex:1;color:var(--text)">${nom}</span>
                <span style="color:var(--green);font-weight:600">${nbOk}/4 ✓</span>
              </div>
            </div>`;
          }

          // Ligne ressentis S1→S4 : petits carrés colorés
          const ressentiLine = local.slice(0,4).map(s => {
            const bg = rColors[s.ressenti] || '#444';
            return `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:1.6rem;height:1.4rem;border-radius:3px;background:${bg};color:#fff;font-size:.6rem;font-weight:700;padding:0 .2rem">${s.ressenti||'—'}</span>`;
          }).join('');

          // Meilleure charge : TD (max) prioritaire, sinon D (max)
          const tdT = local.filter(s => s.ressenti === 'TD');
          const dT  = local.filter(s => s.ressenti === 'D');
          let refToday = null;
          if (tdT.length > 0)     refToday = tdT.reduce((b,s) => s.charge > b.charge ? s : b);
          else if (dT.length > 0) refToday = dT.reduce((b,s) => s.charge > b.charge ? s : b);

          // Comparaison historique initial
          let histCharge = null;
          const rawH = (bilan.historique || {})[nom];
          if (rawH && !Array.isArray(rawH) && rawH.projet === state.projet) {
            const hs = rawH.series || [];
            const dH  = hs.filter(s => s.c && !s.special && s.s === 'D');
            const tdH = hs.filter(s => s.c && !s.special && s.s === 'TD');
            if (tdH.length > 0)      histCharge = tdH.reduce((b,s) => s.c > b.c ? s : b).c;
            else if (dH.length > 0)  histCharge = dH.reduce((b,s) => s.c > b.c ? s : b).c;
          }
          let arrow = '', arrowColor = 'var(--muted)';
          if (refToday && histCharge !== null) {
            if (refToday.charge > histCharge)      { arrow = '↑'; arrowColor = 'var(--green)'; }
            else if (refToday.charge < histCharge) { arrow = '↓'; arrowColor = 'var(--red,#e74c3c)'; }
            else                                   { arrow = '='; arrowColor = 'var(--muted)'; }
          }
          const chargeText = refToday
            ? `${refToday.reps} × ${refToday.charge} kg ${arrow ? `<span style="color:${arrowColor};font-weight:700">${arrow}</span>` : ''}`
            : '—';

          return `<div style="padding:.4rem 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;margin-bottom:.2rem">
              <span>${icon}</span>
              <span style="flex:1;color:var(--text)">${nom}${maxiForcé ? ' <span style="font-size:.65rem;color:var(--yellow)">🔄 nouveau maxi</span>' : ''}</span>
              <span>${chargeText}</span>
            </div>
            <div style="display:flex;gap:.3rem;padding-left:1.6rem">${ressentiLine}</div>
          </div>`;
        });

        // Ateliers avec maxi forcé mais non revalidés
        maxisF.filter(nom => !ateliersB.includes(nom)).forEach(nom => {
          const ai = ATELIERS.find(x => x.nom === nom);
          const icon = ai ? ai.icon : '🏋️';
          rows.push(`<div style="padding:.4rem 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem">
              <span>${icon}</span>
              <span style="flex:1;color:var(--muted)">${nom}</span>
              <span style="font-size:.72rem;color:var(--yellow)">🔄 nouveau maxi calculé</span>
            </div>
          </div>`);
        });

        return `<div style="border-top:1px solid var(--border);padding-top:1rem;margin-bottom:1rem">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;margin-bottom:.15rem">Bilan de la séance</div>
          <div style="font-size:.7rem;color:var(--muted);margin-bottom:.6rem;font-style:italic">Meilleure série TD ou D · ↑↓= vs séance précédente</div>
          ${rows.join('')}
        </div>`;
      })()}

    </div>`;
}

async function buildMesBadges() {
  const pg = $('page-mes-badges');
  const badge = state.dernierBadge;
  const total = state.comptCarton + state.comptBronze + state.comptArgent + state.comptOr;
  const totalSeances = total;

  pg.innerHTML = `
    <div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:.06em;margin-bottom:1.2rem">🏅 Mes Badges</div>

      ${badge ? `
      <div style="text-align:center;margin-bottom:1.5rem">
        <div style="color:var(--muted);font-size:.85rem;margin-bottom:.5rem">Dernier badge obtenu :</div>
        <img src="${badgeImgBig(badge)}" alt="${badge}" width="200" height="200" style="width:200px;height:200px;object-fit:contain">
        <div style="margin-top:.5rem;font-size:1rem;font-weight:600"><span style="color:var(--accent)">${badge}</span> <span style="font-size:.78rem;font-weight:400;color:var(--muted)">(Séance ${totalSeances})</span></div>
      </div>` : `
      <div style="text-align:center;margin-bottom:1.5rem;color:var(--muted)">Aucun badge obtenu pour l'instant.<br>Validez votre séance (au moins 4 ateliers) pour gagner votre premier badge !</div>`}

      <div style="border-top:1px solid var(--border);padding-top:1rem;margin-bottom:1rem">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;margin-bottom:.75rem">Récapitulatif du cycle</div>
        <div style="background:var(--s1);border:1px solid var(--border);border-radius:12px;padding:.85rem 1rem;display:flex;align-items:center;gap:.85rem;margin-bottom:1rem">
          <div style="font-size:2rem;line-height:1">🏋️</div>
          <div>
            <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:.15rem">Ateliers validés depuis le début du cycle</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;letter-spacing:.04em;color:var(--accent)">${state.compteur || 0}</div>
          </div>
        </div>
      </div>

      <div id="section-progression" style="border-top:1px solid var(--border);padding-top:1rem;margin-bottom:1rem">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;margin-bottom:.75rem">Ma progression</div>
        <div style="color:var(--muted);font-size:.85rem;text-align:center;padding:.75rem 0">Chargement…</div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:1rem">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;margin-bottom:1rem">Badges obtenus</div>
        ${[{nom:'Carton',compt:state.comptCarton},{nom:'Bronze',compt:state.comptBronze},{nom:'Argent',compt:state.comptArgent},{nom:'Or',compt:state.comptOr}].map((b,idx,arr) => `
        <div style="padding:.8rem 0;${idx < arr.length-1 ? 'border-bottom:1px solid var(--border);' : ''}">
          <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.4rem">
            ${b.compt === 0
              ? `<img src="${badgeImgSmall(b.nom)}" alt="${b.nom}" width="64" height="64" style="width:64px;height:64px;object-fit:contain;filter:grayscale(100%) opacity(0.35)">`
              : Array.from({length: b.compt}).map(() => `<img src="${badgeImgSmall(b.nom)}" alt="${b.nom}" width="64" height="64" style="width:64px;height:64px;object-fit:contain;cursor:pointer" onclick="openBadgeZoom('${b.nom}')">`).join('')
            }
          </div>
          ${b.compt === 0 ? `<div style="font-weight:600;margin-bottom:.1rem;color:var(--muted)">${b.nom}</div><div style="color:var(--muted);font-size:.85rem">0 obtenu</div>` : ''}
        </div>`).join('')}
      </div>
    </div>`;

  try {
    const d = await api({action:'getProgression', classe:state.classe, nom:state.nom, prenom:state.prenom});
    const el = $('section-progression');
    if (el) {
      el.innerHTML = `
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;margin-bottom:.75rem">Ma progression</div>
        ${buildGraphiqueProgression(d.success ? (d.moyennes || []) : [])}`;
    }
  } catch(e) {
    const el = $('section-progression');
    if (el) el.innerHTML = '';
  }
}

function buildGraphiqueProgression(moyennes) {
  // S1 = maxi pur, pas affiché. S2 = placeholder vide (espace visuel à gauche). S3+ = données réelles.
  const DEBUT = 1; // on affiche à partir de S2 (null) pour décaler visuellement
  moyennes = [null, ...moyennes.slice(2)]; // S2 vide + S3, S4...
  const N = moyennes.length;
  if (N <= 1) {
    return `<div style="color:var(--muted);font-size:.85rem;text-align:center;padding:.75rem 0;line-height:1.6">Votre progression apparaîtra<br>à partir de la séance 3.</div>`;
  }

  const W = 300, H = 130;
  const padL = 6, padR = 16, padT = 18, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const yPos = v => padT + (3.0 - v) / 2.0 * chartH;
  const xPos = i => N === 1 ? padL + chartW / 2 : padL + i * chartW / (N - 1);
  const dotColor = v => v < 1.67 ? '#2980b9' : v < 2.33 ? '#f39c12' : '#27ae60';

  const x0 = xPos(0).toFixed(1); // position colonne S2 (vide)
  const refs = [
    {v:3, label:'TD', color:'#27ae60'},
    {v:2, label:'D',  color:'#f39c12'},
    {v:1, label:'F',  color:'#2980b9'}
  ].map(({v, label, color}) => {
    const y = yPos(v).toFixed(1);
    return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${color}" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.5"/>
            <text x="${x0}" y="${(parseFloat(y)-3).toFixed(1)}" text-anchor="middle" font-size="8" fill="${color}" font-family="DM Sans,sans-serif" font-weight="700">${label}</text>`;
  }).join('');

  // Construire les segments de ligne : plein entre points consécutifs, pointillé à travers une absence
  let solidPath = '', dashedPath = '';
  let lastValidX = null, lastValidY = null, lastValidIdx = null;
  let currentSolid = '';

  moyennes.forEach((m, i) => {
    if (typeof m !== 'number') {
      // Absence (A/D) ou null : ferme le segment solide en cours
      if (currentSolid) { solidPath += currentSolid; currentSolid = ''; }
      return;
    }
    const x = xPos(i).toFixed(1), y = yPos(m).toFixed(1);
    if (lastValidIdx === null) {
      currentSolid = `M${x},${y}`;
    } else if (i === lastValidIdx + 1) {
      currentSolid += `L${x},${y}`;
    } else {
      // Points non consécutifs : ligne pointillée puis nouveau segment solide
      if (currentSolid) { solidPath += currentSolid; }
      dashedPath += `M${lastValidX},${lastValidY}L${x},${y}`;
      currentSolid = `M${x},${y}`;
    }
    lastValidIdx = i; lastValidX = x; lastValidY = y;
  });
  if (currentSolid) solidPath += currentSolid;

  const elements = moyennes.map((m, i) => {
    const x = xPos(i).toFixed(1);
    // Label X : S1, S2... + marqueur absence en dessous si A ou D
    const sLabel = i === 0 ? '' : `<text x="${x}" y="${H-13}" text-anchor="middle" font-size="8" fill="var(--muted)" font-family="DM Sans,sans-serif">S${i+2}</text>`;
    const absLabel = (m === 'A' || m === 'D')
      ? `<text x="${x}" y="${H-3}" text-anchor="middle" font-size="8" fill="#e67e22" font-family="DM Sans,sans-serif" font-style="italic">${m === 'A' ? 'Abs' : 'Disp'}</text>`
      : `<text x="${x}" y="${H-3}" text-anchor="middle" font-size="8" fill="transparent" font-family="DM Sans,sans-serif">·</text>`;
    if (typeof m !== 'number') return sLabel + absLabel;
    const y = yPos(m).toFixed(1);
    const color = dotColor(m);
    return sLabel + absLabel
      + `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="var(--bg)" stroke-width="1.5"/>`
      + `<text x="${x}" y="${(parseFloat(y)-8).toFixed(1)}" text-anchor="middle" font-size="8" fill="${color}" font-family="DM Sans,sans-serif" font-weight="600">${m.toFixed(1)}</text>`;
  }).join('');

  const note = N === 1
    ? `<div style="color:var(--muted);font-size:.78rem;text-align:center;margin-top:.3rem">Revenez après la prochaine séance pour voir votre courbe !</div>`
    : '';

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:hidden">
    ${refs}
    ${solidPath  ? `<path d="${solidPath}"  fill="none" stroke="var(--border)" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
    ${dashedPath ? `<path d="${dashedPath}" fill="none" stroke="var(--muted)"  stroke-width="1.5" stroke-dasharray="4,3" stroke-linejoin="round"/>` : ''}
    ${elements}
  </svg>${note}`;
}

// ═══════════════════════════════════════════════════
//  PAGES RESSOURCES
// ═══════════════════════════════════════════════════
function buildLexique() {
  const pg = $('page-lexique');
  pg.innerHTML = `
    <div style="padding:1rem">
      <div class="ressource-header">
        <button class="ressource-back" onclick="showPage(_previousPage)">←</button>
        <div class="ressource-title">📖 Lexique</div>
      </div>
      <div class="lexique-search-wrap">
        <input class="lexique-search" id="lex-search" type="text" placeholder="🔍  Rechercher un terme…" oninput="lexiqueFiltrer(this.value)">
        <button class="lex-clear" id="lex-clear" onclick="lexiqueEffacer()" title="Effacer">✕</button>
      </div>
      <div class="lex-pills" id="lex-pills">
        <button class="lex-pill" onclick="lexiqueGoTo('lex-s1')">🦴 Anatomie</button>
        <button class="lex-pill" onclick="lexiqueGoTo('lex-s2')">💪 Travail musculaire</button>
        <button class="lex-pill" onclick="lexiqueGoTo('lex-s3')">🔄 Les mouvements</button>
        <button class="lex-pill" onclick="lexiqueGoTo('lex-s4')">🏋️ L'entraînement</button>
        <button class="lex-pill" onclick="lexiqueGoTo('lex-s5')">🩹 Les traumatismes</button>
        <button class="lex-pill" onclick="lexiqueGoTo('lex-s6')">🥗 Alimentation</button>
      </div>
      <div class="lexique-noresult" id="lex-noresult">Aucun terme ne correspond.</div>

      <div class="ressource-section" id="lex-s1" data-section>
        <div class="ressource-section-title">🦴 1 — Anatomie</div>
        <div class="terme-card" data-terme="Articulation"><div class="terme-card-nom">Articulation</div><div class="terme-card-def">Lieu de réunion de deux ou plusieurs os.</div></div>
        <div class="terme-card" data-terme="Muscle"><div class="terme-card-nom">Muscle</div><div class="terme-card-def">Organe chargé de convertir l'énergie chimique en énergie mécanique. Les séances de musculation sollicitent les muscles striés squelettiques.</div></div>
        <div class="terme-card" data-terme="Tissu conjonctif"><div class="terme-card-nom">Tissu conjonctif</div><div class="terme-card-def">Ensemble de cellules de même constitution. Constitué de fibres de collagène (résistance) et de fibres élastiques.</div></div>
        <div class="terme-card" data-terme="Cartilage"><div class="terme-card-nom">Cartilage</div><div class="terme-card-def">Tissu conjonctif élastique recouvrant les surfaces osseuses. Rôle important d'amortissement.</div></div>
        <div class="terme-card" data-terme="Tendon"><div class="terme-card-nom">Tendon</div><div class="terme-card-def">Tissu conjonctif très solide et peu élastique à l'extrémité du muscle, qui attache le muscle à l'os.</div></div>
        <div class="terme-card" data-terme="Ligament"><div class="terme-card-nom">Ligament</div><div class="terme-card-def">Tissu conjonctif qui relie les os entre eux dans une articulation.</div></div>
        <div class="terme-card" data-terme="Insertion"><div class="terme-card-nom">Insertion</div><div class="terme-card-def">Point d'attache du tendon sur l'os.</div></div>
        <div class="terme-card" data-terme="Ceinture Scapulaire"><div class="terme-card-nom">Ceinture Scapulaire</div><div class="terme-card-def">Ensemble des os formant les épaules : sternum, clavicule, omoplate et os coracoïde.</div></div>
        <div class="terme-card" data-terme="Ceinture Pelvienne"><div class="terme-card-nom">Ceinture Pelvienne</div><div class="terme-card-def">Ensemble des os du bassin.</div></div>
      </div>

      <div class="ressource-section" id="lex-s2" data-section>
        <div class="ressource-section-title">💪 2 — Travail musculaire</div>
        <div class="terme-card" data-terme="Contraction"><div class="terme-card-nom">Contraction</div><div class="terme-card-def">En musculation, désigne le travail musculaire. Ne pas réduire à la seule contraction concentrique.</div></div>
        <div class="terme-card" data-terme="Contraction Concentrique"><div class="terme-card-nom">Contraction Concentrique</div><div class="terme-card-def">Contraction d'un muscle entraînant un mouvement lié à son <strong>raccourcissement</strong>.</div></div>
        <div class="terme-card" data-terme="Contraction Excentrique"><div class="terme-card-nom">Contraction Excentrique</div><div class="terme-card-def">Travail d'un muscle accompagné de son <strong>allongement</strong> au lieu du raccourcissement normal.</div></div>
        <div class="terme-card" data-terme="Contraction Isométrique"><div class="terme-card-nom">Contraction Isométrique</div><div class="terme-card-def">Contraction musculaire <strong>sans mouvement</strong>. Travail en statique. <em>Exemple : le gainage.</em></div></div>
        <div class="terme-card" data-terme="Pliométrie"><div class="terme-card-nom">Pliométrie</div><div class="terme-card-def">Enchaînement d'une contraction excentrique et d'une contraction concentrique pour produire un mouvement plus puissant.</div></div>
        <div class="terme-card" data-terme="Relâchement"><div class="terme-card-nom">Relâchement</div><div class="terme-card-def">Fin de la contraction et de la congestion du muscle.</div></div>
        <div class="terme-card" data-terme="Étirement"><div class="terme-card-nom">Étirement</div><div class="terme-card-def">Action d'étirer un muscle au-delà de sa position de repos, en vue de détente et de régénération.</div></div>
      </div>

      <div class="ressource-section" id="lex-s3" data-section>
        <div class="ressource-section-title">🔄 3 — Les mouvements</div>
        <div class="terme-card" data-terme="Expiration"><div class="terme-card-nom">Expiration</div><div class="terme-card-def">Faire sortir l'air des poumons. Se place au moment de l'effort principal (contraction concentrique).</div></div>
        <div class="terme-card" data-terme="Inspiration"><div class="terme-card-nom">Inspiration</div><div class="terme-card-def">Faire entrer de l'air dans les poumons.</div></div>
        <div class="terme-card" data-terme="Extension"><div class="terme-card-nom">Extension</div><div class="terme-card-def">Mouvement qui <strong>éloigne</strong> un segment du corps par rapport à l'autre. Opposé de la flexion.</div></div>
        <div class="terme-card" data-terme="Flexion"><div class="terme-card-nom">Flexion</div><div class="terme-card-def">Mouvement qui <strong>rapproche</strong> un segment du corps sur un autre. Opposé de l'extension.</div></div>
        <div class="terme-card" data-terme="Adduction"><div class="terme-card-nom">Adduction</div><div class="terme-card-def">Mouvement qui <strong>rapproche</strong> un membre de l'axe du corps.</div></div>
        <div class="terme-card" data-terme="Abduction"><div class="terme-card-nom">Abduction</div><div class="terme-card-def">Mouvement qui <strong>écarte</strong> un membre de l'axe du corps.</div></div>
        <div class="terme-card" data-terme="Pronation"><div class="terme-card-nom">Pronation</div><div class="terme-card-def">Position de la paume des mains <strong>vers le bas</strong>.</div></div>
        <div class="terme-card" data-terme="Supination"><div class="terme-card-nom">Supination</div><div class="terme-card-def">Position de la paume des mains <strong>vers le haut</strong>.</div></div>
        <div class="terme-card" data-terme="Muscle Agoniste"><div class="terme-card-nom">Muscle Agoniste</div><div class="terme-card-def">Muscle qui <strong>exécute</strong> le mouvement considéré.</div></div>
        <div class="terme-card" data-terme="Muscle Antagoniste"><div class="terme-card-nom">Muscle Antagoniste</div><div class="terme-card-def">Muscle qui exécute le mouvement <strong>opposé</strong> au mouvement considéré.</div></div>
      </div>

      <div class="ressource-section" id="lex-s4" data-section>
        <div class="ressource-section-title">🏋️ 4 — L'entraînement</div>
        <div class="terme-card" data-terme="Charge Maxi CM"><div class="terme-card-nom">Charge Maxi (CM)</div><div class="terme-card-def">Charge maximale que vous pouvez soulever, tirer ou pousser en <strong>1 seule répétition</strong>.</div></div>
        <div class="terme-card" data-terme="Répétition"><div class="terme-card-nom">Répétition</div><div class="terme-card-def">Un mouvement complet : une flexion et une extension.</div></div>
        <div class="terme-card" data-terme="Série"><div class="terme-card-nom">Série</div><div class="terme-card-def">Un nombre précis de répétitions sans temps de repos. Une série se définit par : une charge, un nombre de répétitions, une vitesse d'exécution, un temps de repos et un type de repos.</div></div>
        <div class="terme-card" data-terme="Brûlure musculaire"><div class="terme-card-nom">Brûlure musculaire</div><div class="terme-card-def">Sensation de brûlure après avoir poussé le muscle jusqu'à sa limite. Causée par l'accumulation de déchets et le manque d'oxygène. Disparaît très rapidement à l'arrêt de l'exercice.</div></div>
        <div class="terme-card" data-terme="Acide Lactique"><div class="terme-card-nom">Acide Lactique</div><div class="terme-card-def">Acide organique provenant de la dégradation anaérobie du glucose (effort long : au-delà d'une minute). Son accumulation dans le muscle provoque une sensation de brûlure.</div></div>
        <div class="terme-card" data-terme="Récupération Active repos actif"><div class="terme-card-nom">Récupération Active <em>(repos actif)</em></div><div class="terme-card-def">Récupération réalisée avec une activité modérée pour accélérer les mécanismes de récupération. Permet de continuer l'exercice plus efficacement sur la série suivante.</div></div>
        <div class="terme-card" data-terme="Repos Passif"><div class="terme-card-nom">Repos Passif</div><div class="terme-card-def">Temps de pause complet entre les séries. Permet aux muscles de se recharger en oxygène et en créatine phosphate.</div></div>
        <div class="terme-card" data-terme="Charge d'entraînement"><div class="terme-card-nom">Charge d'entraînement</div><div class="terme-card-def">Pourcentage de votre maxi utilisé pour un exercice. Par exemple, si votre maxi au développé est 40 kg et vous travaillez à 70 %, vous utilisez 28 kg. Chaque projet impose une fourchette : Sportif 80–90 %, Esthétique 65–80 %, Santé Endurance 40–50 %, Santé Tonification 50–65 %.</div></div>
        <div class="terme-card" data-terme="Filière énergétique ATP-PCr"><div class="terme-card-nom">Filière ATP-PCr <em>(anaérobie alactique)</em></div><div class="terme-card-def">Système énergétique ultra-rapide utilisé sur les efforts très brefs (moins de 10 secondes) et très intenses. Utilisé principalement au projet Sportif. Les réserves se reconstituent en 3 à 6 minutes de repos.</div></div>
        <div class="terme-card" data-terme="Filière glycolytique"><div class="terme-card-nom">Filière glycolytique <em>(anaérobie lactique)</em></div><div class="terme-card-def">Système énergétique pour les efforts modérés à intenses (20 secondes à 2 minutes). Produit de l'acide lactique. Utilisé aux projets Esthétique et Santé Endurance.</div></div>
        <div class="terme-card" data-terme="Filière oxydative"><div class="terme-card-nom">Filière oxydative <em>(aérobie)</em></div><div class="terme-card-def">Système énergétique pour les efforts longs et modérés (plus de 2 minutes). Utilise les glucides et les lipides comme source d'énergie. Dominante aux projets Santé Endurance et Santé Tonification.</div></div>
        <div class="terme-card" data-terme="RM Répétition Maximale"><div class="terme-card-nom">RM — Répétition Maximale</div><div class="terme-card-def">Nombre de répétitions maximales possibles avec une charge donnée. 1RM = votre maxi (1 répétition max), 10RM = 10 répétitions max avec une charge donnée, etc.</div></div>
        <div class="terme-card" data-terme="Surcompensation"><div class="terme-card-nom">Surcompensation</div><div class="terme-card-def"><em>Phase 1</em> — Réalisation d’un effort important entraînant une baisse temporaire des capacités.<br><em>Phase 2</em> — Récupération : l’organisme répare et reconstitue ses ressources.<br><em>Phase 3</em> — L’organisme dépasse son niveau initial : c’est la phase de surcompensation. C’est à ce moment qu’il faut planifier la prochaine séance.</div></div>
        </div>

      <div class="ressource-section" id="lex-s5" data-section>
        <div class="ressource-section-title">🩹 5 — Les traumatismes</div>
        <div class="terme-card" data-terme="Courbature"><div class="terme-card-nom">Courbature</div><div class="terme-card-def">Fines mais douloureuses micro-lésions des fibres musculaires. Souvent (à tort) imputées aux acides lactiques.</div></div>
        <div class="terme-card" data-terme="Crampe"><div class="terme-card-nom">Crampe</div><div class="terme-card-def">Contraction involontaire, brutale, intense et douloureuse d'un muscle.</div></div>
        <div class="terme-card" data-terme="Contracture"><div class="terme-card-nom">Contracture</div><div class="terme-card-def">Contraction involontaire, spontanée, <strong>durable</strong> et douloureuse d'un muscle.</div></div>
        <div class="terme-card" data-terme="Élongation"><div class="terme-card-nom">Élongation</div><div class="terme-card-def">Étirement ou déchirure d'un muscle ou d'un tendon.</div></div>
        <div class="terme-card" data-terme="Déchirure claquage"><div class="terme-card-nom">Déchirure <em>(ou claquage)</em></div><div class="terme-card-def">Rupture de continuité des fibres musculaires. Survient lors d'une sollicitation trop importante et brusque. Provoque une douleur intense, une immobilisation, et parfois un hématome.</div></div>
        <div class="terme-card" data-terme="Tendinite"><div class="terme-card-nom">Tendinite</div><div class="terme-card-def">Inflammation d'un tendon, souvent causée par des mouvements répétitifs ou une surcharge progressive insuffisante. Provoque une douleur lors du mouvement, pire le matin. Demande du repos et une reprise progressive.</div></div>
        <div class="terme-card" data-terme="Entorse"><div class="terme-card-nom">Entorse</div><div class="terme-card-def">Lésion des ligaments (qui relient deux os). Différente d'une déchirure musculaire. Provoque une douleur immédiate, un gonflement et une perte de mobilité.</div></div>
        <div class="terme-card" data-terme="Prévention des blessures"><div class="terme-card-nom">Prévention — Échauffement et progressivité</div><div class="terme-card-def">Deux éléments fondamentaux : (1) échauffement de 5 à 10 minutes avant la séance pour préparer muscles, tendons et articulations ; (2) augmentation progressive des charges — ne jamais augmenter de plus de 5 à 10 % d'une séance à l'autre.</div></div>
      </div>

      <div class="ressource-section" id="lex-s6" data-section>
        <div class="ressource-section-title">🥗 6 — Alimentation et énergie</div>
        <div class="terme-card" data-terme="IMC Indice de Masse Corporelle"><div class="terme-card-nom">IMC — Indice de Masse Corporelle</div><div class="terme-card-def">Poids (kg) ÷ Taille² (m²).</div></div>
        <div class="terme-card" data-terme="Protéine"><div class="terme-card-nom">Protéine</div><div class="terme-card-def">Molécule composée d'une chaîne d'acides aminés. D'origine animale (viande, poisson, œufs) ou végétale (fruits, légumes, céréales). La myosine est une protéine jouant un rôle fondamental dans la contraction musculaire.</div></div>
        <div class="terme-card" data-terme="Lipide"><div class="terme-card-nom">Lipide</div><div class="terme-card-def">Matière grasse des êtres vivants. Lors d'efforts modérés de plus de 30 minutes, les lipides constituent la principale source d'énergie.</div></div>
        <div class="terme-card" data-terme="Glucide hydrate de carbone"><div class="terme-card-nom">Glucide <em>(hydrate de carbone)</em></div><div class="terme-card-def">Source d'énergie pour l'organisme. Le glucose est utilisé par toutes les cellules pour produire de l'ATP (Adénosine TriPhosphate), intermédiaire énergétique essentiel, notamment pour les cellules nerveuses.</div></div>
        <div class="terme-card" data-terme="Hydratation"><div class="terme-card-nom">Hydratation</div><div class="terme-card-def">Boire régulièrement pendant l'effort et après : au minimum 1,5 à 2 litres par jour, plus les jours d'entraînement. La déshydratation réduit la force, la concentration et augmente le risque de crampes et de blessure.</div></div>
        <div class="terme-card" data-terme="Récupération nutritionnelle fenêtre anabolique"><div class="terme-card-nom">Récupération nutritionnelle — Fenêtre anabolique</div><div class="terme-card-def">Les 30 à 60 minutes suivant la séance sont critiques : le corps est prêt à synthétiser des protéines pour réparer les fibres musculaires. Idéal : ingérer des protéines et des glucides rapides (œuf, yaourt, fruit, riz).</div></div>
        <div class="terme-card" data-terme="Créatine"><div class="terme-card-nom">Créatine</div><div class="terme-card-def">Supplément légalement autorisé qui augmente les stocks énergétiques dans le muscle. Efficace pour les efforts courts et intenses (projet Sportif). Demande une hydratation accrue.</div></div>
        <div class="terme-card" data-terme="Whey protein"><div class="terme-card-nom">Whey protein</div><div class="terme-card-def">Poudre de protéine de lactosérum, pratique pour atteindre les objectifs protéinés (1,6 à 2 g par kilo de poids corporel). Aucun supplément ne remplace une alimentation équilibrée.</div></div>
        <div class="terme-card" data-terme="Bilan énergétique surplus déficit calorique"><div class="terme-card-nom">Bilan énergétique — Surplus et déficit calorique</div><div class="terme-card-def">Pour prendre du muscle (projet Esthétique) : apport calorique > dépense = surplus calorique.<br>Pour perdre du gras (projet Santé Endurance) : apport calorique < dépense = déficit calorique.</div></div>
      </div>
      <div style="height:1rem"></div>
    </div>`;

  const input = pg.querySelector('#lex-search');
  if (input) input.addEventListener('input', () => lexiqueFiltrer(input.value));
}

function lexiqueGoTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

function lexiqueEffacer() {
  const input = document.getElementById('lex-search');
  if (input) { input.value = ''; input.focus(); }
  lexiqueFiltrer('');
}

function lexiqueFiltrer(q) {
  q = q.trim().toLowerCase();
  const pg = $('page-lexique');
  const cartes = pg.querySelectorAll('.terme-card');
  const sections = pg.querySelectorAll('[data-section]');
  const pills = pg.querySelector('#lex-pills');
  const btn = pg.querySelector('#lex-clear');
  let total = 0;
  cartes.forEach(c => {
    const match = !q || (c.dataset.terme||'').toLowerCase().includes(q) || c.textContent.toLowerCase().includes(q);
    c.style.display = match ? '' : 'none';
    if (match) total++;
  });
  sections.forEach(s => {
    const visible = [...s.querySelectorAll('.terme-card')].some(c => c.style.display !== 'none');
    s.style.display = visible ? '' : 'none';
  });
  if (pills) pills.style.display = q ? 'none' : '';
  if (btn) btn.style.display = q ? 'block' : 'none';
  const nr = pg.querySelector('#lex-noresult');
  if (nr) nr.style.display = total === 0 ? 'block' : 'none';
}

function buildAnatomie() {
  const pg = $('page-anatomie');
  pg.innerHTML = `
    <div style="padding:1rem">
      <div class="ressource-header">
        <button class="ressource-back" onclick="showPage(_previousPage)">←</button>
        <div class="ressource-title">🦴 Anatomie</div>
      </div>
      <div class="ressource-intro">
        <strong>Les muscles moteurs du corps</strong> sont responsables de tous vos mouvements. Comprendre où ils se situent et leur fonction vous aide à mieux ressentir votre travail et à progresser plus efficacement.
      </div>
      <img src="images/anatomie-muscles.png" alt="Anatomie musculaire" class="ressource-img">

      <div class="ressource-section">
        <div class="ressource-section-title">🔴 Haut du corps</div>
        <div class="muscle-card"><div class="muscle-card-nom">Pectoraux</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Grand Pectoral, Petit Pectoral</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Rapprochent les bras vers la poitrine (adduction, rotation interne).<br><strong>Ateliers :</strong> Développé Couché, Développé Incliné, Butterfly.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Dorsaux</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Grand Dorsal, Petit Dorsal, Grand Rond</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Tirent les bras vers le bas et l'arrière, permettent la traction.<br><strong>Ateliers :</strong> Pull-Down Nuque, Pull-Down Poitrine, Banc Tirage.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Biceps</div><div class="muscle-card-muscles"><strong>Muscle :</strong> Biceps Brachial</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Fléchit l'avant-bras vers le bras.<br><strong>Ateliers :</strong> Pull-Down Nuque, Pull-Down Poitrine, Machine Biceps, Banc Tirage.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Triceps</div><div class="muscle-card-muscles"><strong>Muscle :</strong> Triceps Brachial</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Étend l'avant-bras, repousse les charges.<br><strong>Ateliers :</strong> Développé Couché, Développé Incliné.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Deltoïdes</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Deltoïde Antérieur, Latéral, Postérieur</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Élèvent et font pivoter les bras dans toutes les directions.<br><strong>Ateliers :</strong> Développé Couché, Développé Incliné, Butterfly, Deltoïdes (haltères), Banc Tirage.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Trapèzes</div><div class="muscle-card-muscles"><strong>Muscle :</strong> Trapèze (3 portions)</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Élèvent les épaules, rapprochent les omoplates, stabilisent la ceinture scapulaire.<br><strong>Ateliers :</strong> Pull-Down Nuque, Pull-Down Poitrine, Banc Tirage, Deltoïdes (haltères).</div></div>
      </div>

      <div class="ressource-section">
        <div class="ressource-section-title">🟡 Tronc et sangle abdominale</div>
        <div class="muscle-card"><div class="muscle-card-nom">Abdominaux</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Grand Droit, Transverses, Obliques</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Fléchissent le buste, permettent la rotation du tronc, stabilisent l'ensemble.<br><strong>Atelier :</strong> Abdo Sol.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Lombaires</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Érecteurs du rachis, muscles paravertébraux</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Étendent le buste vers l'arrière, stabilisent la colonne vertébrale.<br><strong>Atelier :</strong> Banc à Lombaires.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Gainage</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Grand Droit, Transverses, Lombaires, Fessiers</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Stabilisent le tronc, maintiennent la posture, protègent la colonne.<br><strong>Atelier :</strong> Gainage Sol.</div></div>
      </div>

      <div class="ressource-section">
        <div class="ressource-section-title">🔵 Bas du corps et jambes</div>
        <div class="muscle-card"><div class="muscle-card-nom">Quadriceps</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Vaste Latéral, Vaste Médial, Vaste Intermédiaire, Droit Fémoral</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Étendent la jambe (redressent le genou). Parmi les plus puissants du corps.<br><strong>Ateliers :</strong> Chaise à Quadriceps, Presse Inclinée.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Ischio-jambiers</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Biceps Fémoral, Semi-membraneux, Semi-tendineux</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Fléchissent la jambe, étendent la hanche. Antagonistes du quadriceps.<br><strong>Atelier :</strong> Banc Ischio-Jambiers.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Fessiers</div><div class="muscle-card-muscles"><strong>Muscle :</strong> Grand Fessier</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Étendent et font pivoter la hanche, essentiels pour la puissance des jambes.<br><strong>Ateliers :</strong> Presse Inclinée, Chaise à Abducteurs.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Adducteurs</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Grand, Long et Court Adducteur</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Rapprochent les jambes, stabilisent le bassin.<br><strong>Atelier :</strong> Chaise à Adducteurs.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Abducteurs</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Moyen et Petit Fessier, Tenseur du Fascia Lata</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Écartent les jambes, stabilisent la hanche.<br><strong>Atelier :</strong> Chaise à Abducteurs.</div></div>
        <div class="muscle-card"><div class="muscle-card-nom">Jumeaux (Mollets)</div><div class="muscle-card-muscles"><strong>Muscles :</strong> Gastrocnémien, Soléaire</div><div class="muscle-card-fonction"><strong>Fonction :</strong> Pointent les pieds vers le bas, permettent de marcher et de sauter.</div></div>
      </div>
      <div style="height:1rem"></div>
    </div>`;
}

function buildTuto() {
  const pg = $('page-tuto');
  pg.innerHTML = `
    <div style="padding:1rem 1rem 5rem">
      <div class="ressource-header">
        <button class="ressource-back" onclick="showPage(_previousPage)">←</button>
        <div class="ressource-title">❓ Guide d'utilisation</div>
      </div>

      <!-- Vue d'ensemble -->
      <div class="ressource-section">
        <div class="ressource-section-title">🗺️ Comment fonctionne l'application ?</div>
        <div class="card" style="margin-bottom:.5rem">
          <p style="font-size:.87rem;color:var(--muted);line-height:1.5">L'application vous accompagne à chaque étape du cycle de musculation. Le déroulement est toujours le même :</p>
        </div>
        <ol class="tuto-steps">
          <li><div class="tuto-num">1</div><div class="tuto-content"><strong>Connexion</strong> — Choisissez votre classe, votre nom et entrez votre mot de passe.</div></li>
          <li><div class="tuto-num">2</div><div class="tuto-content"><strong>Maxis (1RM)</strong> — Renseignez votre charge maximale sur chaque atelier.</div></li>
          <li><div class="tuto-num">3</div><div class="tuto-content"><strong>Choix du projet</strong> — Choisissez votre objectif de travail pour le cycle.</div></li>
          <li><div class="tuto-num">4</div><div class="tuto-content"><strong>Séances</strong> — L'application vous guide atelier par atelier pendant le cours.</div></li>
          <li><div class="tuto-num">5</div><div class="tuto-content"><strong>Badge</strong> — À chaque séance, obtenez un badge selon votre nombre d'ateliers validés.</div></li>
        </ol>
      </div>

      <!-- Menu hamburger -->
      <div class="ressource-section">
        <div class="ressource-section-title">☰ Le menu de l'application</div>
        <div class="card">
          <div class="tuto-card-title">☰ Menu (en haut à droite)</div>
          <p style="font-size:.87rem;color:var(--muted);margin-bottom:.5rem">En appuyant sur <strong>☰</strong> en haut à droite, un menu s'affiche :</p>
          <ol class="tuto-steps">
            <li><div class="tuto-num">🌙</div><div class="tuto-content"><strong>Thème sombre / clair</strong> — Basculez l'affichage. Ce choix est mémorisé.</div></li>
            <li><div class="tuto-num">📖</div><div class="tuto-content"><strong>Lexique</strong> — Vocabulaire de la musculation avec barre de recherche.</div></li>
            <li><div class="tuto-num">🦴</div><div class="tuto-content"><strong>Anatomie</strong> — Schéma musculaire et fiches par groupe.</div></li>
            <li><div class="tuto-num">❓</div><div class="tuto-content"><strong>Guide d'utilisation</strong> — Ce document.</div></li>
            <li><div class="tuto-num">↩</div><div class="tuto-content"><strong>Se déconnecter</strong> — Revient à l'écran de connexion.</div></li>
          </ol>
        </div>
      </div>

      <!-- Connexion -->
      <div class="ressource-section">
        <div class="ressource-section-title"><span style="background:linear-gradient(135deg,var(--accent),var(--accent2));color:#000;font-size:.8rem;font-weight:700;width:1.5rem;height:1.5rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center">1</span> Connexion</div>
        <ol class="tuto-steps">
          <li><div class="tuto-num">1</div><div class="tuto-content">Sélectionnez votre <strong>classe</strong> dans le menu déroulant.</div></li>
          <li><div class="tuto-num">2</div><div class="tuto-content">Sélectionnez votre <strong>nom</strong> dans la liste.</div></li>
          <li><div class="tuto-num">3</div><div class="tuto-content">Saisissez votre <strong>mot de passe</strong> (6 à 10 lettres minuscules, sans accent). <em>Lors de votre première connexion, vous créez votre mot de passe — retenez-le.</em></div></li>
          <li><div class="tuto-num">4</div><div class="tuto-content">Appuyez sur <strong>Entrer</strong>.</div></li>
        </ol>
        <div class="tuto-alert blue"><strong>ℹ️ En-tête :</strong> Une fois connecté(e), votre prénom apparaît en haut de l'écran avec le numéro de votre projet — ex. <strong>LÉA (2)</strong>.</div>
        <div class="tuto-alert yellow"><strong>⚠️ Mot de passe oublié ?</strong> Votre enseignant peut le réinitialiser.</div>
        <div class="tuto-alert"><strong>⚠️ À retenir :</strong> Utilisez toujours le bouton "Enregistrer ma séance" avant de vous déconnecter. Sans cette étape, votre badge ne sera pas enregistré.</div>
      </div>

      <!-- Maxis -->
      <div class="ressource-section">
        <div class="ressource-section-title"><span style="background:linear-gradient(135deg,var(--accent),var(--accent2));color:#000;font-size:.8rem;font-weight:700;width:1.5rem;height:1.5rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center">2</span> 💪 Mes Maxis (1RM)</div>
        <div class="card">
          <div class="tuto-card-title">Qu'est-ce que le Maxi (1RM) ?</div>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.5">Le <strong>1RM</strong> est le poids maximum que vous pouvez soulever <strong>une seule fois</strong> correctement. C'est votre référence personnelle pour calculer les charges adaptées.</p>
        </div>
        <div class="card">
          <div class="tuto-card-title">⚡ Calculer mon maxi (recommandé)</div>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.5">Utilisez les <strong>roulettes</strong> pour indiquer le poids soulevé et le nombre de répétitions. L'application calcule votre 1RM via la formule de Brzycki. Si vous aviez déjà un maxi, il est rappelé sous le nom de l'atelier.</p>
        </div>
        <div class="card">
          <div class="tuto-card-title">✏️ Saisie directe</div>
          <p style="font-size:.85rem;color:var(--muted)">Si vous connaissez déjà votre maxi, basculez sur l'onglet <strong>Saisie directe</strong>.</p>
        </div>
        <div class="card">
          <div class="tuto-card-title">🧍 Ateliers spéciaux</div>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.5"><strong>Banc à Lombaires / Abdo Sol</strong> — Poids additionnel (0, 2, 5 ou 10 kg) pour 30 reps en 1 minute.<br><strong>Gainage sol</strong> — Sélectionnez votre niveau de 1 à 4.</p>
        </div>
        <div class="tuto-alert green"><strong>✅ Tous les maxis renseignés ?</strong> Le reste de l'application se déverrouille.</div>
      </div>

      <!-- Projets -->
      <div class="ressource-section">
        <div class="ressource-section-title"><span style="background:linear-gradient(135deg,var(--accent),var(--accent2));color:#000;font-size:.8rem;font-weight:700;width:1.5rem;height:1.5rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center">3</span> 🎯 Les Projets</div>
        <p style="font-size:.87rem;color:var(--muted);margin-bottom:.6rem">Choisissez <strong>un seul projet</strong> pour tout le cycle. Il détermine l'intensité, les répétitions et la récupération proposées.</p>
        <div class="card"><div class="tuto-card-title">⚡ Projet 1 — SPORTIF</div><p style="font-size:.85rem;color:var(--muted)">Puissance et explosivité. Séries courtes (4–8 reps) à haute intensité (80–90%). Récupération : 3 à 6 min.</p></div>
        <div class="card"><div class="tuto-card-title">🏛️ Projet 2 — ESTHÉTIQUE</div><p style="font-size:.85rem;color:var(--muted)">Volume musculaire. Séries longues (10–20 reps) à intensité modérée (65–80%). Récupération : 1'30 à 2'30.</p></div>
        <div class="card"><div class="tuto-card-title">🫀 Projet 3A — SANTÉ Endurance</div><p style="font-size:.85rem;color:var(--muted)">Dépense d'énergie. Séries très longues (25–35 reps) à faible intensité (40–50%). Récupération : 30s à 1 min.</p></div>
        <div class="card"><div class="tuto-card-title">⚖️ Projet 3B — SANTÉ Tonification</div><p style="font-size:.85rem;color:var(--muted)">Raffermissement. Séries moyennes (15–25 reps) à intensité modérée (50–65%). Récupération : 30s à 1'30.</p></div>
      </div>

      <!-- Séances -->
      <div class="ressource-section">
        <div class="ressource-section-title"><span style="background:linear-gradient(135deg,var(--accent),var(--accent2));color:#000;font-size:.8rem;font-weight:700;width:1.5rem;height:1.5rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center">4</span> 🏋️ Ma Séance</div>
        <div class="card">
          <div class="tuto-card-title">Déroulement général</div>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.5">La page Séance liste tous les ateliers. Appuyez sur un atelier pour ouvrir sa page dédiée. Effectuez vos <strong>4 séries</strong> et indiquez votre ressenti après chacune. Validez au moins 5 ateliers pour obtenir un badge.</p>
        </div>
        <div class="card">
          <div class="tuto-card-title">📄 Page détail d'un atelier</div>
          <ol class="tuto-steps" style="margin-top:.4rem">
            <li><div class="tuto-num">1</div><div class="tuto-content">Nom de l'atelier + muscles sollicités</div></li>
            <li><div class="tuto-num">2</div><div class="tuto-content">Votre <strong>maxi (1RM)</strong> et nombre de validations</div></li>
            <li><div class="tuto-num">3</div><div class="tuto-content"><strong>Dernière validation</strong> à cet atelier — vos 4 séries précédentes</div></li>
            <li><div class="tuto-num">4</div><div class="tuto-content"><strong>Chronomètre de récupération</strong> + grille de vos séries du jour</div></li>
            <li><div class="tuto-num">5</div><div class="tuto-content"><strong>Consignes d'exécution</strong> et <strong>règles de sécurité</strong></div></li>
            <li><div class="tuto-num">6</div><div class="tuto-content">Lien vers la <strong>vidéo de démonstration</strong> (si disponible)</div></li>
          </ol>
        </div>
        <div class="card">
          <div class="tuto-card-title">📋 Dernière validation à cet atelier</div>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.5;margin-bottom:.5rem">Si vous avez déjà travaillé cet atelier avec le <strong>même projet</strong>, vos 4 séries précédentes s'affichent :</p>
          <div class="tuto-color-item"><div class="tuto-color-dot" style="background:#2980b9"></div><strong>F</strong> — Facile</div>
          <div class="tuto-color-item"><div class="tuto-color-dot" style="background:#27ae60"></div><strong>D</strong> — Difficile</div>
          <div class="tuto-color-item"><div class="tuto-color-dot" style="background:#f39c12"></div><strong>TD</strong> — Très Difficile</div>
          <div class="tuto-color-item"><div class="tuto-color-dot" style="background:#c0392b"></div><strong>E</strong> — Échec</div>
          <p style="font-size:.82rem;color:var(--muted);margin-top:.5rem;line-height:1.4">La série en <strong style="color:#c0392b">rouge</strong> sert de référence pour votre première série du jour.</p>
        </div>
        <div class="card">
          <div class="tuto-card-title">⏱ Chronomètre de récupération</div>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.5;margin-bottom:.4rem">Se déclenche après S1, S2 et S3 selon votre projet :</p>
          <p style="font-size:.84rem;line-height:1.6">Projet 1 : <strong>3 min</strong> · Projet 2 : <strong>1 min 30</strong> · Projet 3A : <strong>45 s</strong> · Projet 3B : <strong>1 min</strong></p>
          <p style="font-size:.82rem;color:var(--muted);margin-top:.4rem;line-height:1.4">Passe au <strong style="color:var(--green)">vert</strong> dans les 5 dernières secondes, puis en <strong style="color:#e74c3c">rouge négatif</strong> si dépassé. Appuyez sur <strong>Passer →</strong> pour ignorer.</p>
        </div>
        <div class="card">
          <div class="tuto-card-title">Faire une série</div>
          <ol class="tuto-steps" style="margin-top:.4rem">
            <li><div class="tuto-num">1</div><div class="tuto-content">L'application affiche une <strong>💡 Proposition</strong> : charge et répétitions calculées selon votre projet et votre maxi.</div></li>
            <li><div class="tuto-num">2</div><div class="tuto-content">Si besoin, modifiez via <strong>✏️ Modifier</strong>. La roulette affiche le <strong>% du maxi</strong> pour chaque charge.</div></li>
            <li><div class="tuto-num">3</div><div class="tuto-content">Réalisez la série, puis indiquez votre <strong>ressenti</strong>.</div></li>
            <li><div class="tuto-num">4</div><div class="tuto-content">La suggestion pour la série suivante apparaît. Les boutons <strong>↑↓ Charge / Reps</strong> appliquent directement la modification.</div></li>
            <li><div class="tuto-num">5</div><div class="tuto-content">Le chronomètre de récupération se lance (S1, S2 et S3 uniquement).</div></li>
          </ol>
        </div>
        <div class="card">
          <div class="tuto-card-title">Les 4 boutons de ressenti</div>
          <div class="tuto-ressenti-grid">
            <div class="tuto-ressenti-badge td"><div class="tuto-rlabel">TD — Très Difficile</div><p>À la limite. La charge est parfaitement adaptée.</p></div>
            <div class="tuto-ressenti-badge f"><div class="tuto-rlabel">F — Facile</div><p>Vous auriez pu faire bien plus. La charge va augmenter.</p></div>
            <div class="tuto-ressenti-badge d"><div class="tuto-rlabel">D — Difficile</div><p>Dur mais réussi. Légère adaptation.</p></div>
            <div class="tuto-ressenti-badge e"><div class="tuto-rlabel">E — Échec</div><p>Série non terminée. Charge et/ou reps réduits.</p></div>
          </div>
        </div>
        <div class="card">
          <div class="tuto-card-title">🧍 Ateliers spéciaux</div>
          <p style="font-size:.85rem;color:var(--muted)">Lombaires, Abdo Sol, Gainage sol — pas de charge à régler. Indiquez simplement <strong>Ok</strong> ou <strong>Échec</strong>.</p>
        </div>
        <div class="card">
          <div class="tuto-card-title">Couleur des ateliers sur la page Séances</div>
          <div class="tuto-color-item" style="margin-top:.4rem"><div class="tuto-color-dot" style="background:var(--muted)"></div>Non encore travaillé</div>
          <div class="tuto-color-item"><div class="tuto-color-dot" style="background:var(--green)"></div>Validé lors d'une séance précédente</div>
          <div class="tuto-color-item"><div class="tuto-color-dot" style="background:var(--blue)"></div>Validé lors de la séance en cours</div>
        </div>
        <div class="tuto-alert">
          <strong>⚠️ Recalcul de maxi obligatoire</strong> — L'application peut vous rediriger vers le calcul du maxi dans ces cas :
          <ul style="margin:.4rem 0 .2rem 1rem;font-size:.83rem">
            <li>2 fois Facile d'affilée — maxi probablement sous-évalué</li>
            <li>2 fois Échec d'affilée — maxi probablement surévalué</li>
            <li>Plafond absolu atteint avec ressenti F</li>
            <li>Plancher absolu atteint avec ressenti E</li>
          </ul>
          Le chrono ne s'affiche pas dans ces cas. L'ancien maxi reste visible en référence.
        </div>
        <div class="tuto-alert yellow"><strong>⚠️ Avertissement plafond</strong> — Charge max + reps max + ressenti <strong>D</strong> : l'application vous avertit et repropose la même série.</div>
      </div>

      <!-- Fin de séance -->
      <div class="ressource-section">
        <div class="ressource-section-title"><span style="background:linear-gradient(135deg,var(--accent),var(--accent2));color:#000;font-size:.8rem;font-weight:700;width:1.5rem;height:1.5rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center">5</span> 🏅 Fin de séance &amp; Badges</div>
        <div class="card">
          <div class="tuto-card-title">Terminer la séance</div>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.5">Dès que vous avez validé <strong>4 ateliers ou plus</strong>, le bouton <strong>"✅ Enregistrer ma séance"</strong> apparaît dans le menu ☰. Appuyez dessus, puis confirmez.</p>
        </div>
        <div class="card">
          <div class="tuto-card-title">📊 Bilan de la séance</div>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.5;margin-bottom:.4rem">Après confirmation, un bilan détaillé s'affiche. Pour chaque atelier :</p>
          <ul style="margin:.3rem 0 .3rem 1rem;font-size:.84rem;color:var(--muted)">
            <li>Les <strong style="color:var(--text)">4 carrés de ressenti</strong> dans l'ordre des séries</li>
            <li>La <strong style="color:var(--text)">meilleure série TD ou D</strong> avec charge et répétitions</li>
            <li><strong style="color:var(--green)">↑</strong> progression · <strong style="color:#c0392b">↓</strong> régression · <strong style="color:var(--muted)">=</strong> stable vs séance précédente</li>
            <li>🔄 si un recalcul de maxi a été effectué</li>
          </ul>
        </div>
        <div class="card">
          <div class="tuto-card-title">Les badges</div>
          <div class="tuto-color-item" style="margin-top:.4rem"><img src="images/badge-carton-small.png" style="width:32px;height:32px;object-fit:contain"><strong style="color:#e74c3c">Carton Rouge</strong> — Moins de 4 ateliers</div>
          <div class="tuto-color-item"><img src="images/badge-bronze-small.png" style="width:32px;height:32px;object-fit:contain"><strong>Bronze</strong> — 4 ateliers validés</div>
          <div class="tuto-color-item"><img src="images/badge-argent-small.png" style="width:32px;height:32px;object-fit:contain"><strong>Argent</strong> — 5 ateliers validés</div>
          <div class="tuto-color-item"><img src="images/badge-or-small.png"    style="width:32px;height:32px;object-fit:contain"><strong>Or</strong> — 6 ateliers ou plus</div>
        </div>
        <div class="tuto-alert"><strong>⚠️ Important :</strong> Utilisez toujours "Enregistrer ma séance" avant de vous déconnecter, sinon votre badge ne sera pas enregistré.</div>
        <div class="card">
          <div class="tuto-card-title">🏅 Page Mes Badges</div>
          <p style="font-size:.85rem;color:var(--muted)">Consultez votre dernier badge et l'historique complet depuis le bouton <strong>Badges</strong> dans le menu du bas.</p>
        </div>
      </div>

      <div style="height:1rem"></div>
    </div>`;
}

// ═══════════════════════════════════════════════════
//  PAGE SÉANCE
// ═══════════════════════════════════════════════════
function buildSeance() {
  const pg = $('page-seance');
  if (!state.projet) {
    pg.innerHTML = `<div class="lock-msg" style="margin-top:2rem">🎯 Choisissez votre projet avant de commencer une séance !</div>`;
    return;
  }
  const p = PROJETS[state.projet];
  if (!state.intensite || !p.intensites.includes(state.intensite)) state.intensite = p.intensites[0];
  if (!state.suggestionEnAttente) state.suggestionEnAttente = {};

  const count = state.compteurAteliersSeance;
  const nbDispo = getNbDispo();
  const objectif = calculateSeuils(nbDispo).argent;
  const pct = Math.min((count/objectif)*100,100).toFixed(0);
  const readonlyBanner = !isEditable() ? `<div class="lock-msg" style="margin-bottom:1rem">🔒 Mode consultation — enregistrement disponible uniquement pendant le cours</div>` : '';

  const _now = new Date();
  const _dateStr = _now.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const _dateCap = _dateStr.charAt(0).toUpperCase() + _dateStr.slice(1);

  let html = `<div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:.05em;margin-bottom:.75rem">🏋️ Votre séance du <span style="color:var(--accent)">${_dateCap}</span></div>
  ${readonlyBanner}
    <!-- Barre de progression séance -->
    <div class="progress-bar-wrap">
      <div class="progress-bar-label"><span>Ateliers validés cette séance</span><span id="seance-count">${count} / ${objectif}</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" id="seance-bar" style="width:${pct}%"></div></div>
      <div class="progress-msg" id="seance-msg">${progressMsg(count)}</div>
    </div>

    <!-- Choix intensité -->
    <div class="seance-header">
      <div class="field-label">Intensité du travail du projet <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1em;letter-spacing:.05em;color:var(--accent)">${p.nom}</span> :</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;color:var(--accent);margin:.3rem 0">${p.intensites[0]}–${p.intensites[p.intensites.length-1]}% du MAXI</div>
      <div style="font-size:.82rem;color:var(--text);margin-bottom:.25rem">Choisissez l'intensité de votre première série :</div>
      <div class="intensite-row">
        <select id="sel-intensite">
          ${p.intensites.map(i=>`<option value="${i}" ${i===state.intensite?'selected':''}>${i}% du maxi</option>`).join('')}
        </select>
        <div class="intensite-badge" id="badge-reps">${calcReps(state.projet,state.intensite)} reps</div>
      </div>
    </div>
  `;

  // Ateliers — cartes simples cliquables (détail sur page dédiée)
  let lastGroupe = null;
  ATELIERS.filter(a => state.maxis[a.nom] !== 'B' && isMaxiValid(a, state.maxis[a.nom])).forEach(a => {
    if (a.groupe !== lastGroupe) {
      lastGroupe = a.groupe;
      html += `<div class="section-title">${a.groupe==='haut'?'🏋️ Haut du corps':'🦵 Bas du corps'}</div>`;
    }
    const validations = parseInt(state.series[a.nom]||0);
    const validated = validations >= 1;
    const seanceEnCours = state.ateliersSeanceEnCours.includes(a.nom);
    const key = a.nom.replace(/[^a-zA-Z]/g,'_');
    const maxiStr = getAtelierType(a.nom)!=='standard' ? formatMaxiSeance(a) : `${parseFloat(state.maxis[a.nom])||'—'} ${a.unite}`;
    const nomEsc = a.nom.replace(/'/g,"\\'");

    html += `<div class="seance-atelier-card ${seanceEnCours?'seance-en-cours':validated?'validated-atelier':''}" id="sa-${key}" onclick="goToAtelierDetail('${nomEsc}')">
      <div class="atelier-icon ${a.groupe==='haut'?'icon-haut':'icon-bas'}">${a.icon}</div>
      <div style="flex:1;min-width:0">
        <div class="atelier-name">${a.nom}${validated?' ✓':''}</div>
        <div class="atelier-muscles">${a.muscles}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:2px">Maxi : ${maxiStr} · ${validations} validation${validations>1?'s':''}</div>
      </div>
      <div style="color:var(--muted);font-size:1.3rem;flex-shrink:0">›</div>
    </div>`;
  });

  pg.innerHTML = html + '<div style="height:1rem"></div>';

  pg.querySelector('#sel-intensite').addEventListener('change', function() {
    state.intensite = parseInt(this.value);
    pg.querySelector('#badge-reps').textContent = calcReps(state.projet, state.intensite) + ' reps';
    buildSeance();
  });
}

function formatMaxiSeance(a) {
  const val = state.maxis[a.nom];
  const type = getAtelierType(a.nom);
  if (type === 'gainage')   return `Niveau ${val}`;
  if (type === 'lombaires') return `30 reps en 1' + ${val} kg`;
  return `${parseFloat(val)||0} ${a.unite}`;
}

function buildSeriesSpecialHTML(a, localSeries) {
  const key = a.nom.replace(/[^a-zA-Z]/g,'_');
  const doneSeries = localSeries.length;
  const maxiLabel = formatMaxiSeance(a);
  let html = `<div style="font-size:.82rem;color:var(--text);margin-bottom:.75rem">Réalisez cette série 4 fois :</div>`;

  for (let s = 0; s < doneSeries; s++) {
    const local = localSeries[s];
    const isOk = local.resultat === 'ok';
    html += `<div class="serie-row done" id="sr-${key}-${s}">
      <div class="serie-num">${s+1}</div>
      <div class="serie-info"><div class="serie-charge">${maxiLabel}</div></div>
      <div style="font-size:.85rem;font-weight:700;color:${isOk?'var(--green)':'var(--red)'}">${isOk?'✓ Ok':'✗ Échec'}</div>
    </div>`;
  }

  if (doneSeries < 4) {
    const s = doneSeries;
    const disabled = !isEditable() ? 'disabled' : '';
    const nomEsc = a.nom.replace(/'/g,"\\'");
    if (getAtelierType(a.nom) === 'gainage') {
      html += `<div class="serie-row active-serie" id="sr-${key}-${s}">
        <div class="serie-num">${s+1}</div>
        <div style="flex:1">
          <div style="font-size:.78rem;color:var(--muted);margin-bottom:.4rem">${maxiLabel}</div>
          <button style="background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:.85rem;padding:.45rem 1rem;cursor:pointer"
            ${isEditable()?`onclick="startGainageTimer('${nomEsc}',${s})"`:disabled}>▶ Démarrer</button>
        </div>
      </div>`;
    } else {
      html += `<div class="serie-row active-serie" id="sr-${key}-${s}">
        <div class="serie-num">${s+1}</div>
        <div class="serie-info"><div class="serie-charge">${maxiLabel}</div></div>
        <div style="display:flex;gap:.5rem;flex-shrink:0">
          <button style="background:rgba(46,204,113,.15);border:1px solid var(--green);border-radius:8px;color:var(--green);font-weight:700;font-size:.8rem;padding:.4rem .7rem;cursor:pointer"
            ${isEditable()?`onclick="onSerieSpeciale('${nomEsc}',${s},'ok')"`:disabled}>✓ Ok</button>
          <button style="background:rgba(231,76,60,.1);border:1px solid var(--red,#e74c3c);border-radius:8px;color:var(--red,#e74c3c);font-weight:700;font-size:.8rem;padding:.4rem .7rem;cursor:pointer"
            ${isEditable()?`onclick="onSerieSpeciale('${nomEsc}',${s},'echec')"`:disabled}>✗ Échec</button>
        </div>
      </div>`;
    }
  }

  return html;
}

async function onSerieSpeciale(nomAtelier, serieIndex, resultat) {
  const key = nomAtelier.replace(/[^a-zA-Z]/g,'_');
  if (!state.serieLocale[nomAtelier]) state.serieLocale[nomAtelier] = [];
  state.serieLocale[nomAtelier][serieIndex] = {resultat, special: true};
  saveSerieLocale();

  const a = ATELIERS.find(x => x.nom === nomAtelier);
  const sgEl = document.getElementById('sg-'+key);
  if (sgEl && a) sgEl.innerHTML = buildSeriesSpecialHTML(a, state.serieLocale[nomAtelier]);

  // Interruption si 2 échecs cumulés (consécutifs ou non)
  const nbEchecs = state.serieLocale[nomAtelier].filter(s => s && s.resultat === 'echec').length;
  if (nbEchecs >= 2) {
    delete state.serieLocale[nomAtelier];
    saveSerieLocale();
    clearMaxiForAtelier(nomAtelier);
    if (sgEl && a) sgEl.innerHTML = buildSeriesSpecialHTML(a, []);
    const bravo = document.getElementById('bravo-'+key);
    if (bravo) {
      bravo.classList.add('visible');
      const bravoEmoji = bravo.querySelector('.bravo-emoji');
      const bravoText  = bravo.querySelector('.bravo-text');
      const bravoSub   = bravo.querySelector('.bravo-sub');
      if (bravoEmoji) bravoEmoji.textContent = '⬇️';
      if (bravoText)  { bravoText.textContent = '2 Échecs !'; bravoText.style.color = 'var(--red)'; }
      if (bravoSub)   bravoSub.innerHTML = 'Votre maxi est probablement surévalué. Vous devez refaire votre recherche de maxi pour cet atelier avant de continuer.<br><em>Vous allez être redirigé(e) automatiquement.</em>';
    }
    setTimeout(() => allerAuxMaxis(nomAtelier), 10000);
    return;
  }

  if (state.serieLocale[nomAtelier].length >= 4) {
    // Décider du niveau sup avant le fire & forget (besoin des données locales)
    const localAvantFire = state.serieLocale[nomAtelier] || [];
    const nbOkFire = localAvantFire.filter(s => s && s.resultat === 'ok').length;
    const niveauActuelFire = parseInt(state.maxis[nomAtelier]) || 1;
    const niveauDecisionFire = decideNiveauSup(nomAtelier, nbOkFire, niveauActuelFire);
    if (niveauDecisionFire.proposer) {
      state.propositionNiveauSup = {atelier: nomAtelier, niveauActuel: niveauActuelFire, niveauSuivant: niveauDecisionFire.niveauSuivant};
    }

    const bravo = document.getElementById('bravo-'+key);
    if (bravo) bravo.classList.add('visible');
    stopRecupTimer(key);
    validateAtelier(nomAtelier); // fire & forget
    if (state.propositionNiveauSup && state.propositionNiveauSup.atelier === nomAtelier) {
      const prop = state.propositionNiveauSup;
      const bloc = document.getElementById('bravo-niveau-'+key);
      const text = document.getElementById('bravo-niveau-text-'+key);
      if (bloc && text) {
        text.textContent = `Vous avez parfaitement géré le niveau ${prop.niveauActuel} ! Vous vous sentez prêt(e) à tenter le niveau ${prop.niveauSuivant} la prochaine fois ?`;
        bloc.style.display = 'block';
      }
    }
  } else {
    startRecupTimer(key, nomAtelier);
  }
}

function buildSeriesHTML(atelier, maxi, localSeries) {
  if (getAtelierType(atelier.nom) !== 'standard') {
    return buildSeriesSpecialHTML(atelier, localSeries);
  }
  const intensite = state.intensite || PROJETS[state.projet].intensites[0];
  const charge = maxi ? Math.round(maxi * intensite / 100 * 2) / 2 : null;
  const reps = calcReps(state.projet, intensite);
  const a = atelier;
  const key = a.nom.replace(/[^a-zA-Z]/g,'_');
  const doneSeries = localSeries.length;

  let html = '';

  const showPct = maxi && getAtelierType(a.nom) === 'standard';

  // Séries déjà faites
  for (let s = 0; s < doneSeries; s++) {
    const local = localSeries[s];
    const pctDone = showPct ? ` <span style="font-size:.65rem;color:var(--muted);font-weight:400">(${Math.round(local.charge / maxi * 100)}%)</span>` : '';
    const isLastDone = (s === doneSeries - 1) && (doneSeries < 4) && isEditable();
    const nomEsc = a.nom.replace(/'/g,"\\'");
    html += `<div class="serie-row done" id="sr-${key}-${s}">
      <div class="serie-num">${s+1}</div>
      <div class="serie-info">
        <div class="serie-charge">${local.reps} <span style="color:var(--blue);font-weight:400">×</span> ${local.charge} ${a.unite}${pctDone}</div>
      </div>
      <div class="serie-ressenti" id="res-${key}-${s}">
        ${['F','D','TD','E'].map(r=>`
          <button class="ressenti-btn ${local.ressenti===r?'selected-'+r:''}" disabled>${r}</button>
        `).join('')}
      </div>
      ${isLastDone ? `<button class="btn-corriger-ressenti" onclick="activerCorrectionRessenti('${nomEsc}','${key}',${s})" title="Corriger le ressenti">✏️</button>` : ''}
    </div>`;
  }

  // Série active (la prochaine à faire) — seulement si < 4
  if (doneSeries < 4) {
    const s = doneSeries;
    // Paramètres suggérés stockés ou défaut
    const suggested = state.suggestionEnAttente && state.suggestionEnAttente[a.nom];
    const enAttente = (state.suggestionEnCours && state.suggestionEnCours[a.nom])
                   || (!state.guidage && !suggested);
    const serieCharge = suggested ? suggested.charge : (charge ? charge : 0);
    const serieReps   = suggested ? suggested.reps   : reps;
    const serieInt    = suggested ? suggested.intensite : intensite;

    const pctActive = (showPct && !enAttente && serieCharge) ? ` <span style="font-size:.65rem;color:var(--muted);font-weight:400">(${Math.round(serieCharge / maxi * 100)}%)</span>` : '';
    const affichageParams = enAttente
      ? `<span style="color:var(--muted)">? <span style="color:var(--blue);font-weight:400">×</span> ? ${a.unite}</span>`
      : `${serieReps} <span style="color:var(--blue);font-weight:400">×</span> ${serieCharge} ${a.unite}${pctActive}`;

    html += `<div class="serie-row active-serie" id="sr-${key}-${s}">
      <div class="serie-num">${s+1}</div>
      <div class="serie-info">
        <div class="serie-charge" id="sc-${key}-${s}">${affichageParams}</div>
      </div>
      <div class="serie-ressenti">
        ${['F','D','TD','E'].map(r=>`
          <button class="ressenti-btn" ${!enAttente && isEditable() ? `onclick="onRessenti('${a.nom}','${a.unite}',${s},'${r}',${serieCharge},${serieReps},${serieInt})"` : 'disabled'}>
            ${r}
          </button>`).join('')}
      </div>
    </div>`;
  }

  return html;
}

async function clearMaxiForAtelier(nomAtelier) {
  state.maxis[nomAtelier] = '';
  updateNavLock();
  try {
    const m = {};
    m[nomAtelier] = '';
    await apiPost({action:'saveMaxis', classe:state.classe, nom:state.nom, prenom:state.prenom, maxis: JSON.stringify(m)});
  } catch(e) { console.error(e); }
}

async function validateAtelier(nomAtelier) {
  // Mise à jour UI immédiate (optimiste)
  state.series[nomAtelier] = (parseInt(state.series[nomAtelier]||0) + 1);
  // serieLocale conservé intentionnellement pour l'historique et le blocage re-validation
  saveSerieLocale();
  if (!state.ateliersSeanceEnCours.includes(nomAtelier)) {
    state.ateliersSeanceEnCours.push(nomAtelier);
    const cardEl = document.getElementById('sa-' + nomAtelier.replace(/[^a-zA-Z]/g,'_'));
    if (cardEl) { cardEl.classList.remove('validated-atelier'); cardEl.classList.add('seance-en-cours'); }
  }
  state.compteurAteliersSeance++;
  localStorage.setItem('compteurAteliersSeance', state.compteurAteliersSeance);
  const _objectif = calculateSeuils(getNbDispo()).argent;
  const pct = Math.min((state.compteurAteliersSeance/_objectif)*100,100).toFixed(0);
  const bar = $('seance-bar'), msg = $('seance-msg'), cnt = $('seance-count');
  if (bar) bar.style.width = pct+'%';
  if (msg) msg.textContent = progressMsg(state.compteurAteliersSeance);
  if (cnt) cnt.textContent = state.compteurAteliersSeance + ' / ' + _objectif;

  // Sauvegarder les 4 séries dans l'historique local
  const seriesDuJour = (state.serieLocale[nomAtelier] || []).slice(0,4).map(s =>
    s.special ? {special:true, resultat:s.resultat} : {c:s.charge, r:s.reps, s:s.ressenti}
  );
  const histEntry = {series:seriesDuJour, projet:state.projet, seance:state.sessionNumber};
  state.historiqueAteliers[nomAtelier] = histEntry;

  try {
    const res = await apiPost({action:'validateAtelier', classe:state.classe, nom:state.nom, prenom:state.prenom, atelier:nomAtelier, historique:JSON.stringify(histEntry)});
    if (res && res.newCompteur !== undefined) state.compteur = res.newCompteur;
  } catch(e) { console.error(e); }
}

let _recupTimerInterval = null;
let _gainageTimerInterval = null;
let _gainageTimerState = null;

function _gainageStepDuration(nomAtelier) {
  const n = parseInt(state.maxis[nomAtelier]||1);
  return (n === 2 || n === 4) ? 30 : 15;
}

function _gainageStepTexts(nomAtelier) {
  const c = ATELIERS_CONTENT[nomAtelier];
  if (!c || !c.levels) return [];
  const n = parseInt(state.maxis[nomAtelier]||1);
  const idx = Math.min(Math.max(n-1,0), c.levels.length-1);
  return c.levels[idx].steps.map(s => s.replace(/\s*—\s*tenir\s*\d+\s*s$/,''));
}

function startGainageTimer(nomAtelier, serieIndex) {
  if (!isEditable()) return;
  if (_gainageTimerInterval) { clearInterval(_gainageTimerInterval); _gainageTimerInterval = null; }
  const key = nomAtelier.replace(/[^a-zA-Z]/g,'_');
  stopRecupTimer(key);
  const steps = _gainageStepTexts(nomAtelier);
  const dur = _gainageStepDuration(nomAtelier);
  const total = dur * 4;
  _gainageTimerState = {nomAtelier, serieIndex, key, phaseIndex:0, elapsed:0, total, dur, steps};
  const row = document.getElementById('sr-'+key+'-'+serieIndex);
  if (!row) return;
  const nomEsc = nomAtelier.replace(/'/g,"\\'");
  row.innerHTML = `
    <div class="serie-num">${serieIndex+1}</div>
    <div style="flex:1;min-width:0">
      <div id="gt-step-${key}" style="font-size:.8rem;font-weight:600;margin-bottom:.35rem;color:var(--text)">${steps[0]}</div>
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem">
        <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
          <div id="gt-bar-${key}" style="height:100%;background:var(--accent);border-radius:4px;width:100%"></div>
        </div>
        <span id="gt-count-${key}" style="font-size:1rem;font-weight:700;min-width:2.5rem;text-align:right;color:var(--text)">${dur}s</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span id="gt-phase-${key}" style="font-size:.88rem;font-weight:700;color:var(--accent)">Phase 1 / 4</span>
        <button onclick="stopGainageTimer('${nomEsc}',${serieIndex})" style="background:rgba(231,76,60,.1);border:1px solid var(--red,#e74c3c);border-radius:6px;color:var(--red,#e74c3c);font-size:.75rem;font-weight:600;padding:.25rem .6rem;cursor:pointer">Arrêter</button>
      </div>
    </div>`;
  _gainageRunPhase();
}

function _gainageRunPhase() {
  if (!_gainageTimerState) return;
  const st = _gainageTimerState;
  const {key, dur} = st;
  let timeLeft = dur;
  _gainageUpdateBar(key, timeLeft, dur);
  if (_gainageTimerInterval) clearInterval(_gainageTimerInterval);
  _gainageTimerInterval = setInterval(() => {
    if (!_gainageTimerState) { clearInterval(_gainageTimerInterval); _gainageTimerInterval = null; return; }
    timeLeft--;
    st.elapsed++;
    if (timeLeft >= 0) _gainageUpdateBar(key, timeLeft, dur);
    if (timeLeft <= 0) {
      clearInterval(_gainageTimerInterval);
      _gainageTimerInterval = null;
      st.phaseIndex++;
      if (st.phaseIndex >= 4) {
        _gainageTimerState = null;
        showGainageRessentis(st.nomAtelier, st.serieIndex, null, st.total);
      } else {
        _gainagePause(st);
      }
    }
  }, 1000);
}

function _gainageUpdateBar(key, timeLeft, dur) {
  const bar = document.getElementById('gt-bar-'+key);
  const cnt = document.getElementById('gt-count-'+key);
  if (bar) bar.style.width = (timeLeft/dur*100)+'%';
  if (cnt) cnt.textContent = timeLeft+'s';
}

function _gainagePause(st) {
  const {key} = st;
  const stepEl  = document.getElementById('gt-step-'+key);
  const barEl   = document.getElementById('gt-bar-'+key);
  const cntEl   = document.getElementById('gt-count-'+key);
  const phaseEl = document.getElementById('gt-phase-'+key);
  if (stepEl)  { stepEl.textContent = 'Changez !'; stepEl.style.color = 'var(--accent)'; stepEl.style.fontWeight = '700'; }
  if (barEl)   { barEl.style.background = 'var(--border)'; barEl.style.width = '100%'; }
  if (cntEl)   cntEl.textContent = '';
  if (phaseEl) { phaseEl.textContent = 'Phase '+(st.phaseIndex+1)+' / 4'; phaseEl.style.color = 'var(--accent)'; }
  setTimeout(() => {
    if (!_gainageTimerState) return;
    const step = st.steps[st.phaseIndex];
    if (stepEl)  { stepEl.textContent = step; stepEl.style.color = 'var(--text)'; stepEl.style.fontWeight = '600'; }
    if (barEl)   { barEl.style.background = 'var(--accent)'; barEl.style.width = '100%'; }
    _gainageRunPhase();
  }, 2000);
}

function stopGainageTimer(nomAtelier, serieIndex) {
  if (_gainageTimerInterval) { clearInterval(_gainageTimerInterval); _gainageTimerInterval = null; }
  const elapsed = _gainageTimerState ? _gainageTimerState.elapsed : 0;
  const total   = _gainageTimerState ? _gainageTimerState.total   : 0;
  _gainageTimerState = null;
  showGainageRessentis(nomAtelier, serieIndex, elapsed, total);
}

function showGainageRessentis(nomAtelier, serieIndex, elapsed, total) {
  const key = nomAtelier.replace(/[^a-zA-Z]/g,'_');
  const row = document.getElementById('sr-'+key+'-'+serieIndex);
  if (!row) return;
  const nomEsc = nomAtelier.replace(/'/g,"\\'");
  const fmt = s => s >= 60 ? Math.floor(s/60)+'m'+(s%60<10?'0':'')+s%60 : s+'s';
  const stoppedMsg = (elapsed !== null && elapsed < total)
    ? `<div style="font-size:.72rem;color:var(--muted);margin-bottom:.4rem">Arrêté à ${fmt(elapsed)} / ${fmt(total)}</div>`
    : '';
  const disabled = !isEditable() ? 'disabled' : '';
  row.innerHTML = `
    <div class="serie-num">${serieIndex+1}</div>
    <div style="flex:1">
      ${stoppedMsg}
      <div style="font-size:.8rem;color:var(--muted);margin-bottom:.4rem">Résultat :</div>
      <div style="display:flex;gap:.5rem">
        <button style="background:rgba(46,204,113,.15);border:1px solid var(--green);border-radius:8px;color:var(--green);font-weight:700;font-size:.8rem;padding:.4rem .7rem;cursor:pointer"
          ${isEditable()?`onclick="onSerieSpeciale('${nomEsc}',${serieIndex},'ok')"`:disabled}>✓ Ok</button>
        <button style="background:rgba(231,76,60,.1);border:1px solid var(--red,#e74c3c);border-radius:8px;color:var(--red,#e74c3c);font-weight:700;font-size:.8rem;padding:.4rem .7rem;cursor:pointer"
          ${isEditable()?`onclick="onSerieSpeciale('${nomEsc}',${serieIndex},'echec')"`:disabled}>✗ Échec</button>
      </div>
    </div>`;
}

function getRecupSeconds(nomAtelier) {
  const type = getAtelierType(nomAtelier||'');
  if (type === 'lombaires') return 60;
  if (type === 'gainage') {
    const niveau = parseInt(state.maxis[nomAtelier]||1);
    return (niveau === 2 || niveau === 4) ? 120 : 60;
  }
  const map = {"1":180,"2":90,"3A":45,"3B":60};
  return map[state.projet] || 60;
}

function startRecupTimer(key, nomAtelier) {
  stopRecupTimer(key);
  const el = document.getElementById('rt-'+key);
  const count = document.getElementById('rt-count-'+key);
  if (!el || !count) return;
  let secs = getRecupSeconds(nomAtelier);
  function fmt(s) { return Math.floor(s/60)+':'+(s%60<10?'0':'')+s%60; }
  count.textContent = fmt(secs);
  count.style.color = '';
  el.classList.add('active');
  _recupTimerInterval = setInterval(()=>{
    secs--;
    if (secs > 0) {
      count.textContent = fmt(secs);
      if (secs <= 5) count.style.color = 'var(--green)';
    } else {
count.textContent = '-'+fmt(Math.abs(secs));
      count.style.color = 'var(--red,#e74c3c)';
    }
  }, 1000);
}

function stopRecupTimer(key) {
  if (_recupTimerInterval) { clearInterval(_recupTimerInterval); _recupTimerInterval = null; }
  const el = document.getElementById('rt-'+key);
  if (el) el.classList.remove('active');
}

function clearAtelierIncomplet(nomAtelier) {
  const key = nomAtelier.replace(/[^a-zA-Z]/g,'_');
  const local = state.serieLocale[nomAtelier] || [];
  if (local.length > 0 && local.length < 4) {
    delete state.serieLocale[nomAtelier];
    const a = ATELIERS.find(x => x.nom === nomAtelier);
    const sgEl = document.getElementById('sg-'+key);
    if (sgEl && a) {
      const maxi = parseFloat(state.maxis[nomAtelier]) || 0;
      sgEl.innerHTML = buildSeriesHTML(a, maxi, []);
    }
  }
}

function toggleAtelier(key) {
  const el = document.getElementById('sa-'+key);
  const isOpening = !el.classList.contains('open');

  if (isOpening) {
    // Effacer les séries incomplètes des autres ateliers ouverts
    document.querySelectorAll('.seance-atelier.open').forEach(other => {
      const otherKey = other.id.replace('sa-','');
      const otherNom = ATELIERS.find(a => a.nom.replace(/[^a-zA-Z]/g,'_') === otherKey)?.nom;
      if (otherNom) clearAtelierIncomplet(otherNom);
      other.classList.remove('open');
    });
  }

  el.classList.toggle('open');
}

async function onRessenti(nomAtelier, unite, serieIndex, ressenti, charge, reps, serieIntensite) {
  const key = nomAtelier.replace(/[^a-zA-Z]/g,'_');

  // 1. Enregistrer localement
  if (!state.serieLocale[nomAtelier]) state.serieLocale[nomAtelier] = [];
  state.serieLocale[nomAtelier][serieIndex] = {ressenti, charge, reps, unite, intensite: serieIntensite || state.intensite};
  saveSerieLocale();

  const localSeries = state.serieLocale[nomAtelier];
  const seriesCount = localSeries.length;

  // 2. Reconstruire la grille de séries
  const a = ATELIERS.find(x => x.nom === nomAtelier);
  const maxi = parseFloat(state.maxis[nomAtelier]) || 0;
  if (!state.suggestionEnCours) state.suggestionEnCours = {};
  state.suggestionEnCours[nomAtelier] = (ressenti !== 'TD');
  const sgEl = document.getElementById('sg-' + key);
  if (sgEl && a) sgEl.innerHTML = buildSeriesHTML(a, maxi, localSeries);

  // 3. Règle 1 — Interruption immédiate (priorité absolue)
  // En mode autonome : 2F consécutifs ne forcent pas la redirection (l'élève choisit librement)
  const interruption = detectInterruption(localSeries);
  if (interruption.interrompu && !(interruption.raison === 'sous-evalue' && !state.guidage)) {
    delete state.serieLocale[nomAtelier];
    saveSerieLocale();
    if (!state.maxisForces.includes(nomAtelier)) state.maxisForces.push(nomAtelier);
    if (state.suggestionEnAttente) delete state.suggestionEnAttente[nomAtelier];
    if (state.suggestionEnCours) state.suggestionEnCours[nomAtelier] = false;
    const seriesSec = document.getElementById('series-section-' + key);
    if (seriesSec) seriesSec.style.display = 'none';

    const sugBox = document.getElementById('sug-' + key);
    if (sugBox) {
      sugBox.classList.add('visible');
      if (interruption.raison === 'sous-evalue') {
        sugBox.innerHTML = `
          <div class="suggestion-title" style="color:var(--yellow)">⬆️ 2 fois Facile d'affilée !</div>
          <div class="suggestion-text" style="margin-bottom:.6rem">
            Votre maxi est probablement <strong>sous-évalué</strong>. Vous devez refaire votre recherche de maxi pour cet atelier avant de continuer.<br><em>Vous allez être redirigé(e) automatiquement.</em>
          </div>
          <div class="suggestion-actions">
            <button class="btn" style="background:linear-gradient(135deg,var(--yellow),#e67e22);color:#000"
              onclick="allerAuxMaxis('${nomAtelier}')">💪 Refaire mon maxi</button>
          </div>`;
      } else {
        sugBox.innerHTML = `
          <div class="suggestion-title" style="color:var(--red)">⬇️ 2 fois Échec d'affilée !</div>
          <div class="suggestion-text" style="margin-bottom:.6rem">
            Votre maxi est probablement <strong>surévalué</strong>. Vous devez refaire votre recherche de maxi pour cet atelier avant de continuer.<br><em>Vous allez être redirigé(e) automatiquement.</em>
          </div>
          <div class="suggestion-actions">
            <button class="btn" style="background:linear-gradient(135deg,var(--red),#c0392b);color:#fff"
              onclick="allerAuxMaxis('${nomAtelier}')">💪 Refaire mon maxi</button>
          </div>`;
      }
    }
    setTimeout(() => allerAuxMaxis(nomAtelier), 10000);
    return;
  }

  // 4. Règle 2 — Validation à la S4
  if (seriesCount >= 4) {
    const validation = decideValidation(localSeries);

    const bravo = document.getElementById('bravo-' + key);
    const sug   = document.getElementById('sug-' + key);
    if (sug) sug.classList.remove('visible');
    stopRecupTimer(key);
    if (bravo) {
      bravo.classList.add('visible');
      const bravoText = bravo.querySelector('.bravo-text');
      const bravoSub  = bravo.querySelector('.bravo-sub');
      if (validation.type === 'exceptionnel') {
        if (bravoText) bravoText.textContent = '🔥 Exceptionnel !';
        if (bravoSub)  bravoSub.textContent  = '4 séries parfaites — vous maîtrisez cet atelier !';
      } else if (validation.type === 'valide-bien') {
        if (bravoText) bravoText.textContent = '💪 Très bien !';
        if (bravoSub)  bravoSub.textContent  = 'TD en S3 et S4 — continuez comme ça !';
      } else if (validation.type === 'valide-s4') {
        if (bravoText) bravoText.textContent = '👍 Bien joué !';
        if (bravoSub)  bravoSub.textContent  = 'Cherchez à réussir cette 4ème série la prochaine fois !';
      } else {
        if (bravoText) bravoText.textContent = '👍 Bien joué !';
        if (bravoSub)  bravoSub.textContent  = 'Cherchez le TD dès la S3 la prochaine fois pour progresser.';
      }

      // Mode autonome — alertes effort insuffisant (ajoutées sous le message bravo)
      if (!state.guidage && state.projet && bravoSub) {
        const nbF  = localSeries.filter(s => s && s.ressenti === 'F').length;
        const nbTD = localSeries.filter(s => s && s.ressenti === 'TD').length;
        let alertMsg = '';
        let alertColor = 'var(--yellow)';
        if (nbF >= 4) {
          alertMsg = 'Toutes vos séries étaient <strong>Facile</strong>. Augmentez significativement la charge ou les répétitions à la prochaine séance pour progresser.';
          alertColor = 'var(--red)';
        } else if (nbTD === 0) {
          alertMsg = 'Vous n\'avez pas atteint le <strong>Très Difficile</strong> sur cet atelier.<br>Choisissez mieux vos couples Charge/Reps pour atteindre l\'effort maximum -> TD.';
        }
        if (alertMsg) {
          bravoSub.innerHTML = bravoSub.textContent +
            `<div style="margin-top:.6rem;padding:.5rem .7rem;background:rgba(243,156,18,.1);border-left:3px solid ${alertColor};border-radius:4px;font-size:.82rem;color:var(--text);text-align:left">⚠️ ${alertMsg}</div>`;
        }
      }
    }

    validateAtelier(nomAtelier);
    return;
  }

  // 5. Suggestion série suivante + timer récupération
  const suggType = showSuggestion(nomAtelier, key, unite, ressenti, serieIndex + 1, charge, reps, serieIntensite || state.intensite);
  const pasDeTimer = suggType === 'fd-plafond-f' || suggType === 'e-plafond-bas';
  if (!pasDeTimer) startRecupTimer(key, nomAtelier);

  // Mode autonome — alertes mid-atelier (ajoutées au-dessus des roulettes)
  if (!state.guidage && state.projet) {
    const nbF  = localSeries.filter(s => s && s.ressenti === 'F').length;
    const p    = PROJETS[state.projet];
    const maxi = parseFloat(state.maxis[nomAtelier]) || 0;
    const sugBox = document.getElementById('sug-' + key);
    if (sugBox) {
      let warnHtml = '';
      // Alert charge max + reps max + F → maxi sous-évalué (prioritaire)
      if (ressenti === 'F' && maxi > 0 && reps >= p.repsMax && charge >= maxi) {
        warnHtml = `<div style="margin-bottom:.6rem;padding:.5rem .7rem;background:rgba(52,152,219,.1);border-left:3px solid var(--blue);border-radius:4px;font-size:.82rem;color:var(--text)">💡 Votre maxi semble sous-évalué, pensez à faire une nouvelle recherche de maxi.</div>`;
      // Alert 2 F cumulés
      } else if (nbF >= 2) {
        warnHtml = `<div style="margin-bottom:.6rem;padding:.5rem .7rem;background:rgba(243,156,18,.1);border-left:3px solid var(--yellow);border-radius:4px;font-size:.82rem;color:var(--text)">⚠️ Attention, vous devez mieux choisir vos couples Charge/Reps pour atteindre l'effort maximum (TD).</div>`;
      }
      if (warnHtml) sugBox.insertAdjacentHTML('afterbegin', warnHtml);
    }
  }
}

function activerCorrectionRessenti(nomAtelier, key, serieIndex) {
  const local = state.serieLocale[nomAtelier]?.[serieIndex];
  if (!local) return;
  const resEl = document.getElementById('res-' + key + '-' + serieIndex);
  if (!resEl) return;
  const nomEsc = nomAtelier.replace(/'/g,"\\'");
  resEl.innerHTML = ['F','D','TD','E'].map(r => `
    <button class="ressenti-btn ${local.ressenti===r?'selected-'+r:''}"
      onclick="onRessenti('${nomEsc}','${local.unite}',${serieIndex},'${r}',${local.charge},${local.reps},${local.intensite})">
      ${r}
    </button>
  `).join('');
  const row = document.getElementById('sr-' + key + '-' + serieIndex);
  if (row) { const btn = row.querySelector('.btn-corriger-ressenti'); if (btn) btn.style.display = 'none'; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions pures de décision (sans DOM, sans state — testables via node tests.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * decideSuggestion — décide quoi suggérer après une série (S1–S3 uniquement).
 * Les cas 2F/2E consécutifs sont traités en amont par detectInterruption.
 *
 * @param {{ressenti:string, charge:number, reps:number, intensite:number}} serie
 * @param {{intensites:number[], repsMin:number, repsMax:number}} projet
 * @param {Array<{ressenti:string}>} historique  toutes les séries de l'atelier (y.c. la courante)
 * @returns {{type:string, params:Object, avertissementDoux?:boolean}}
 */
function decideSuggestion(serie, projet, historique) {
  const {ressenti, charge, reps, intensite} = serie;
  const ints = projet.intensites;
  let idxCurrent = ints.indexOf(intensite);
  if (idxCurrent === -1) idxCurrent = ints.reduce((best, val, idx) =>
    Math.abs(val - intensite) < Math.abs(ints[best] - intensite) ? idx : best, 0);
  const atMaxIntensite = idxCurrent >= ints.length - 1;
  const atMinIntensite = idxCurrent <= 0;
  const atMaxReps = reps >= projet.repsMax;
  const atMinReps = reps <= projet.repsMin;

  if (ressenti === 'TD') {
    return {type: 'td-parfait', params: {charge, reps, intensite}};
  }

  if (ressenti === 'E') {
    if (atMinIntensite) {
      // Cas 2 : plancher absolu atteint → maxi surévalué, recalcul obligatoire
      if (atMinReps) return {type: 'e-plafond-bas', params: {charge, reps, intensite}};
      const newReps = Math.max(projet.repsMin, Math.ceil(reps * 0.85));
      return {type: 'e-min-intensite', params: {newReps, charge, intensite}};
    }
    return {type: 'e-choix', params: {charge, reps, intensite}};
  }

  // F ou D — F isolé après S1 → avertissement doux
  const avertissementDoux = ressenti === 'F' && historique.length > 1;

  // Cas 1 : plafond absolu atteint → maxi sous-évalué
  if (atMaxIntensite && atMaxReps) {
    if (ressenti === 'F') return {type: 'fd-plafond-f', params: {charge, reps, intensite}};
    return {type: 'fd-plafond-d', params: {charge, reps, intensite}};
  }

  if (atMaxIntensite) {
    const mult = ressenti === 'F' ? 1.30 : 1.15;
    const newReps = Math.min(Math.ceil(reps * mult), projet.repsMax);
    return {type: 'fd-max-intensite', params: {newReps, charge, intensite}, avertissementDoux};
  }

  if (atMaxReps) {
    const newIdx = ressenti === 'F'
      ? Math.min(idxCurrent + 2, ints.length - 1)
      : Math.min(idxCurrent + 1, ints.length - 1);
    const newIntensite = ints[newIdx];
    return {type: 'fd-force-charge', params: {newIntensite, reps}, avertissementDoux};
  }

  return {type: 'fd-choix', params: {charge, reps, intensite}, avertissementDoux};
}

/**
 * decideValidation — évalue la qualité de l'atelier à la 4e série.
 * Ne s'exécute que si detectInterruption n'a pas déclenché l'arrêt.
 *
 * @param {Array<{ressenti:string}>} serieLocale  les 4 séries complètes
 * @returns {{type:'exceptionnel'|'valide-bien'|'valide-progres'}}
 */
function decideValidation(serieLocale) {
  const allTD = serieLocale.slice(0, 4).every(s => s && s.ressenti === 'TD');
  if (allTD) return { type: 'exceptionnel' };
  const s3td = serieLocale[2] && serieLocale[2].ressenti === 'TD';
  const s4td = serieLocale[3] && serieLocale[3].ressenti === 'TD';
  if (s3td && s4td) return { type: 'valide-bien' };
  if (s3td && !s4td) return { type: 'valide-s4' };
  return { type: 'valide-progres' };
}

/**
 * decideNiveauSup — propose le niveau suivant pour le Gainage sol.
 *
 * @param {string} nomAtelier
 * @param {number} nbOk  nombre de séries 'ok' sur les 4
 * @param {number} niveauActuel
 * @returns {{proposer:boolean, niveauSuivant:number|null}}
 */
function decideNiveauSup(nomAtelier, nbOk, niveauActuel) {
  if (nomAtelier === 'Gainage sol' && nbOk === 4 && niveauActuel < 4) {
    return {proposer: true, niveauSuivant: niveauActuel + 1};
  }
  return {proposer: false, niveauSuivant: null};
}

/**
 * detectInterruption — 2 ressentis consécutifs identiques (F ou E) → arrêt immédiat.
 * Priorité absolue sur toute autre règle.
 */
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

// ─────────────────────────────────────────────────────────────────────────────

function showSuggestion(nomAtelier, key, unite, ressenti, nextSerie, currentCharge, currentReps, currentIntensite) {
  const p = PROJETS[state.projet];
  const maxi = parseFloat(state.maxis[nomAtelier]) || 0;
  const intensiteRef = currentIntensite || state.intensite;
  const historique = state.serieLocale[nomAtelier] || [];
  const serie = {ressenti, charge: currentCharge, reps: currentReps, intensite: intensiteRef};
  const {type, params, avertissementDoux} = decideSuggestion(serie, p, historique);

  const sugBox = document.getElementById('sug-' + key);
  if (!sugBox) return;
  sugBox.classList.add('visible');

  // Mode autonome : l'élève choisit lui-même
  if (!state.guidage) {
    const prev = historique.length > 0 ? historique[historique.length - 1] : null;
    const startCharge = prev ? prev.charge : (maxi ? Math.round(maxi * p.intensites[0] / 100 * 2) / 2 : 0);
    const startReps   = prev ? prev.reps   : p.repsMin;
    drumState[key] = { reps: startReps, charge: startCharge };
    savedSuggestions[key] = '';
    const chargeVals = genChargeValues(maxi, state.projet);
    const repsVals = [];
    for (let i = p.repsMin; i <= p.repsMax; i++) repsVals.push(i);
    const chargeLabelFn = maxi > 0
      ? v => `${v} <span style="font-size:.62rem;color:var(--muted)">(${Math.round(v/maxi*100)}%)</span>`
      : null;
    sugBox.innerHTML = `
      <div class="suggestion-title">Série ${nextSerie} — à toi de choisir</div>
      <div class="drum-picker-wrap">
        <div class="drum-picker-col">
          <div class="field-label" style="margin-bottom:.3rem">Reps</div>
          <div class="drum-picker" id="drum-reps-${key}">
            <div class="drum-highlight"></div><div class="drum-track"></div>
          </div>
        </div>
        <div class="drum-picker-col">
          <div class="field-label" style="margin-bottom:.3rem">Charge (${unite})</div>
          <div class="drum-picker" id="drum-charge-${key}">
            <div class="drum-highlight"></div><div class="drum-track"></div>
          </div>
        </div>
      </div>
      <div class="suggestion-actions">
        <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="validerModification('${nomAtelier}','${key}','${unite}',${intensiteRef})">✓ Valider</button>
      </div>`;
    initDrumPicker('drum-reps-'   + key, repsVals,   startReps,   v => drumState[key].reps   = v);
    initDrumPicker('drum-charge-' + key, chargeVals, startCharge, v => drumState[key].charge = v, chargeLabelFn);
    return 'autonome';
  }

  switch (type) {
    case 'td-parfait':
      sugBox.innerHTML = `
        <div class="suggestion-title" style="color:var(--green)">🔥 Parfait !</div>
        <div class="suggestion-text">C'est exactement l'objectif ! Continuez comme ça.<br>
          Série conseillée : <strong>${params.reps} reps <span style="color:var(--blue)">×</span> ${params.charge} ${unite}</strong>
        </div>
        <div class="suggestion-actions">
          <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="applySuggestion('${nomAtelier}',${params.intensite},${params.charge},${params.reps})">✓ On y va !</button>
          <button class="btn btn-outline" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="modifierSuggestion('${nomAtelier}','${key}','${unite}',${params.charge},${params.reps},${params.intensite})">✏️ Modifier</button>
        </div>`;
      break;

    case 'e-min-intensite':
      sugBox.innerHTML = `
        <div class="suggestion-title">⚠️ Série ${nextSerie + 1}</div>
        <div class="suggestion-text">Intensité déjà au minimum — réduisez les répétitions.<br>
          Série conseillée : <strong>${params.newReps} reps <span style="color:var(--blue)">×</span> ${params.charge} ${unite}</strong>
        </div>
        <div class="suggestion-actions">
          <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="applySuggestion('${nomAtelier}',${params.intensite},${params.charge},${params.newReps})">✓ Accepter</button>
          <button class="btn btn-outline" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="modifierSuggestion('${nomAtelier}','${key}','${unite}',${params.charge},${params.newReps},${params.intensite})">✏️ Modifier</button>
        </div>`;
      break;

    case 'e-choix': {
      const repsDejaMin = currentReps <= p.repsMin;
      sugBox.innerHTML = `
        <div class="suggestion-title">⚠️ Série ${nextSerie + 1} — Diminuer l'effort</div>
        <div class="suggestion-text">Comment souhaitez-vous ajuster ?</div>
        <div class="suggestion-actions" style="margin-top:.6rem">
          <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="appliquerChoixCharge('${nomAtelier}','${key}','${unite}','${ressenti}',${params.charge},${params.reps},${params.intensite})">↓ La charge</button>
          ${repsDejaMin ? '' : `<button class="btn btn-outline" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="appliquerChoixReps('${nomAtelier}','${key}','${unite}','${ressenti}',${params.charge},${params.reps},${params.intensite})">↓ Les reps</button>`}
        </div>
        <div style="margin-top:.4rem">
          <button class="btn btn-outline" style="width:100%" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="applySuggestion('${nomAtelier}',${params.intensite},${params.charge},${params.reps})">= Ne rien changer</button>
        </div>`;
      break;
    }

    case 'fd-plafond-f':
      sugBox.innerHTML = `
        <div class="suggestion-title" style="color:var(--red)">🚨 Maxi à recalculer</div>
        <div class="suggestion-text">Vous êtes au maximum de votre projet en charge <strong>et</strong> en répétitions, et cela vous semble facile.<br>Votre maxi est sous-évalué — vous devez le recalculer avant de continuer.</div>
        <div class="suggestion-actions">
          <button class="btn" style="background:var(--red)" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="resetEtRecalculerMaxi('${nomAtelier}')">📏 Recalculer mon maxi</button>
        </div>`;
      break;

    case 'fd-plafond-d':
      sugBox.innerHTML = `
        <div class="suggestion-title" style="color:var(--yellow)">⚠️ Plafond du projet atteint</div>
        <div class="suggestion-text">Vous êtes au maximum de ce que permet votre projet en charge et en répétitions.<br>Votre maxi est sans doute sous-évalué — pensez à faire une nouvelle recherche de maxi pour cet atelier.<br><br>
          Série conseillée : <strong>${params.reps} reps <span style="color:var(--blue)">×</span> ${params.charge} ${unite}</strong>
        </div>
        <div class="suggestion-actions">
          <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="applySuggestion('${nomAtelier}',${params.intensite},${params.charge},${params.reps})">✓ Reconduire la série</button>
          <button class="btn btn-outline" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="resetEtRecalculerMaxi('${nomAtelier}')">📏 Recalculer mon maxi</button>
        </div>`;
      break;

    case 'e-plafond-bas':
      sugBox.innerHTML = `
        <div class="suggestion-title" style="color:var(--red)">🚨 Maxi à recalculer</div>
        <div class="suggestion-text">Vous êtes au minimum de votre projet en charge <strong>et</strong> en répétitions, et cela vous semble épuisant.<br>Votre maxi est surévalué — vous devez le recalculer avant de continuer.</div>
        <div class="suggestion-actions">
          <button class="btn" style="background:var(--red)" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="resetEtRecalculerMaxi('${nomAtelier}')">📏 Recalculer mon maxi</button>
        </div>`;
      break;

    case 'fd-max-intensite':
      sugBox.innerHTML = `
        <div class="suggestion-title">💡 Proposition pour Série ${nextSerie + 1}</div>
        <div class="suggestion-text">Intensité au maximum — augmentez les répétitions.<br>
          Série conseillée : <strong>${params.newReps} reps <span style="color:var(--blue)">×</span> ${params.charge} ${unite}</strong>
        </div>
        <div class="suggestion-actions">
          <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="applySuggestion('${nomAtelier}',${params.intensite},${params.charge},${params.newReps})">✓ Accepter</button>
          <button class="btn btn-outline" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="modifierSuggestion('${nomAtelier}','${key}','${unite}',${params.charge},${params.newReps},${params.intensite})">✏️ Modifier</button>
        </div>`;
      break;

    case 'fd-force-charge': {
      const newCharge = maxi ? Math.round(maxi * params.newIntensite / 100 * 2) / 2 : currentCharge;
      sugBox.innerHTML = `
        <div class="suggestion-title">💡 Charge modifiée</div>
        <div class="suggestion-text">↑ Intensité : ${intensiteRef}% → ${params.newIntensite}%<br>
          Série conseillée : <strong>${params.reps} reps <span style="color:var(--blue)">×</span> ${newCharge} ${unite}</strong>
        </div>
        <div class="suggestion-actions">
          <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="applySuggestion('${nomAtelier}',${params.newIntensite},${newCharge},${params.reps})">✓ Accepter</button>
          <button class="btn btn-outline" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="modifierSuggestion('${nomAtelier}','${key}','${unite}',${newCharge},${params.reps},${params.newIntensite})">✏️ Modifier</button>
        </div>`;
      break;
    }

    case 'fd-choix':
      sugBox.innerHTML = `
        <div class="suggestion-title">💡 Proposition pour Série ${nextSerie + 1} — Augmenter l'effort</div>
        <div class="suggestion-text">Vous souhaitez augmenter l'effort en faisant varier :</div>
        <div class="suggestion-actions" style="margin-top:.6rem">
          <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="appliquerChoixCharge('${nomAtelier}','${key}','${unite}','${ressenti}',${params.charge},${params.reps},${params.intensite})">↑ La charge</button>
          <button class="btn btn-outline" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="appliquerChoixReps('${nomAtelier}','${key}','${unite}','${ressenti}',${params.charge},${params.reps},${params.intensite})">↑ Les reps</button>
        </div>`;
      break;
  }

  if (avertissementDoux) {
    sugBox.innerHTML = `<div style="font-size:.75rem;color:var(--yellow);margin-bottom:.5rem">⚠️ Votre maxi semble peut-être sous-évalué</div>` + sugBox.innerHTML;
  }
  return type;
}

function appliquerChoixCharge(nomAtelier, key, unite, ressenti, currentCharge, currentReps, currentIntensite) {
  const p = PROJETS[state.projet];
  const ints = p.intensites;
  const intensiteRef = currentIntensite || state.intensite;
  let idxCurrent = ints.indexOf(intensiteRef);
  if (idxCurrent === -1) idxCurrent = ints.reduce((best, val, idx) =>
    Math.abs(val - intensiteRef) < Math.abs(ints[best] - intensiteRef) ? idx : best, 0);
  const maxi = parseFloat(state.maxis[nomAtelier]) || 0;

  let newIdx;
  if (ressenti === 'F')      newIdx = Math.min(idxCurrent + 2, ints.length - 1);
  else if (ressenti === 'D') newIdx = Math.min(idxCurrent + 1, ints.length - 1);
  else                       newIdx = Math.max(idxCurrent - 1, 0);

  const newIntensite = ints[newIdx];
  const newCharge = maxi ? Math.round(maxi * newIntensite / 100 * 2) / 2 : currentCharge;

  applySuggestion(nomAtelier, newIntensite, newCharge, currentReps);
}

function appliquerChoixReps(nomAtelier, key, unite, ressenti, currentCharge, currentReps, currentIntensite) {
  const p = PROJETS[state.projet];
  const intensiteRef = currentIntensite || state.intensite;
  let newReps;
  if (ressenti === 'F')      newReps = Math.min(Math.ceil(currentReps * 1.30), p.repsMax);
  else if (ressenti === 'D') newReps = Math.min(Math.ceil(currentReps * 1.15), p.repsMax);
  else                       newReps = Math.max(Math.ceil(currentReps * 0.85), p.repsMin);

  applySuggestion(nomAtelier, intensiteRef, currentCharge, newReps);
}

function allerAuxMaxis(nomAtelier) {
  const idx = ATELIERS.findIndex(a => a.nom === nomAtelier);
  if (idx !== -1) {
    goToMaxiCalc(idx, true);
  } else {
    showPage('maxis');
  }
}

function resetEtRecalculerMaxi(nomAtelier) {
  delete state.serieLocale[nomAtelier];
  saveSerieLocale();
  allerAuxMaxis(nomAtelier);
}

async function accepterNiveauSup(nomAtelier) {
  const prop = state.propositionNiveauSup;
  if (!prop) return;
  const newMaxi = prop.niveauSuivant;
  state.maxis[nomAtelier] = String(newMaxi);
  delete state.propositionNiveauSup;
  const key = nomAtelier.replace(/[^a-zA-Z]/g,'_');
  const bloc = document.getElementById('bravo-niveau-'+key);
  if (bloc) bloc.style.display = 'none';
  try {
    const m = {};
    m[nomAtelier] = String(newMaxi);
    await apiPost({action:'saveMaxis', classe:state.classe, nom:state.nom, prenom:state.prenom, maxis: JSON.stringify(m)});
    toast('Nouveau maxi enregistré : Niveau ' + newMaxi + ' ! 💪');
  } catch(e) { toast('Erreur lors de l\'enregistrement', 'error'); }
}

function refuserNiveauSup(nomAtelier) {
  delete state.propositionNiveauSup;
  const key = nomAtelier.replace(/[^a-zA-Z]/g,'_');
  const bloc = document.getElementById('bravo-niveau-'+key);
  if (bloc) bloc.style.display = 'none';
}

function applySuggestion(nomAtelier, newIntensite, newCharge, newReps) {
  const key = nomAtelier.replace(/[^a-zA-Z]/g,'_');
  const local = state.serieLocale[nomAtelier]||[];
  const nextIdx = local.length;
  const a = ATELIERS.find(x=>x.nom===nomAtelier);

  // Stocker la suggestion en attente et lever le flag
  if (!state.suggestionEnAttente) state.suggestionEnAttente = {};
  state.suggestionEnAttente[nomAtelier] = {charge:newCharge, reps:newReps, intensite:newIntensite};
  if (state.suggestionEnCours) state.suggestionEnCours[nomAtelier] = false;
  state.intensite = newIntensite;

  // Cacher la suggestion
  document.getElementById('sug-'+key).classList.remove('visible');

  // Reconstruire la grille des séries pour cet atelier
  const sgEl = document.getElementById('sg-'+key);
  if (sgEl) {
    const maxi = parseFloat(state.maxis[nomAtelier])||0;
    sgEl.innerHTML = buildSeriesHTML(a, maxi, local);
  }
}

const drumState = {};

function genChargeValues(maxi, projet) {
  const ints = PROJETS[projet].intensites;
  const step = v => v < 10 ? 0.5 : v < 50 ? 1 : 2.5;
  const round = (v, s) => Math.round(v / s) * s;

  let min = maxi ? round(maxi * ints[0] / 100, step(maxi * ints[0] / 100)) : 0;
  let max = maxi ? round(maxi * ints[ints.length-1] / 100, step(maxi * ints[ints.length-1] / 100)) : 100;
  if (min < 0) min = 0;
  if (max <= min) max = min + 10;

  const values = [];
  let v = min;
  while (v <= max + 0.01) {
    values.push(Math.round(v * 10) / 10);
    v += step(v);
  }
  return values;
}

function initDrumPicker(containerId, values, initialValue, onChange, labelFn) {
  const ITEM_H = 32, PAD = 2;
  const container = document.getElementById(containerId);
  if (!container) return;
  const track = container.querySelector('.drum-track');

  let idx = values.findIndex(v => String(v) === String(initialValue));
  if (idx < 0) idx = 0;

  function render() {
    const rows = [];
    for (let i = 0; i < PAD; i++) rows.push('<div class="drum-item"></div>');
    values.forEach((v, i) => rows.push(`<div class="drum-item${i===idx?' selected':''}">${labelFn ? labelFn(v) : v}</div>`));
    for (let i = 0; i < PAD; i++) rows.push('<div class="drum-item"></div>');
    track.innerHTML = rows.join('');
  }

  function goTo(newIdx, animate) {
    idx = Math.max(0, Math.min(values.length - 1, newIdx));
    track.style.transition = animate ? 'transform .15s ease' : 'none';
    track.style.transform = `translateY(${-idx * ITEM_H}px)`;
    track.querySelectorAll('.drum-item').forEach((el, i) =>
      el.classList.toggle('selected', i === idx + PAD));
    onChange(values[idx]);
  }

  render();
  goTo(idx, false);

  let startY = 0, startIdx = 0, dragging = false;

  container.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY; startIdx = idx; dragging = true;
  }, {passive: true});
  container.addEventListener('touchmove', e => {
    if (!dragging) return;
    goTo(Math.round(startIdx + (startY - e.touches[0].clientY) / ITEM_H), false);
  }, {passive: true});
  container.addEventListener('touchend', () => { dragging = false; goTo(idx, true); });

  container.addEventListener('mousedown', e => {
    startY = e.clientY; startIdx = idx; dragging = true; e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    goTo(Math.round(startIdx + (startY - e.clientY) / ITEM_H), false);
  });
  document.addEventListener('mouseup', () => { if (dragging) { dragging = false; goTo(idx, true); } });
}

const savedSuggestions = {};

function modifierSuggestion(nomAtelier, key, unite, newCharge, newReps, newIntensite) {
  const p = PROJETS[state.projet];
  const maxi = parseFloat(state.maxis[nomAtelier]) || 100;
  const chargeVals = genChargeValues(maxi, state.projet);
  const repsVals = [];
  for (let i = p.repsMin; i <= p.repsMax; i++) repsVals.push(i);

  drumState[key] = { reps: newReps, charge: newCharge };

  const sugBox = document.getElementById('sug-'+key);
  savedSuggestions[key] = sugBox.innerHTML;

  sugBox.innerHTML = `
    <div class="suggestion-title">✏️ Modifier les paramètres</div>
    <div style="font-size:.78rem;color:var(--muted);text-align:center;margin-bottom:.5rem">Proposition de l'application : <span style="color:var(--text);font-weight:600">${newReps} reps × ${newCharge} ${unite}</span></div>
    <div class="drum-picker-wrap">
      <div class="drum-picker-col">
        <div class="field-label" style="margin-bottom:.3rem">Reps</div>
        <div class="drum-picker" id="drum-reps-${key}">
          <div class="drum-highlight"></div>
          <div class="drum-track"></div>
        </div>
      </div>
      <div class="drum-picker-col">
        <div class="field-label" style="margin-bottom:.3rem">Charge (${unite})</div>
        <div class="drum-picker" id="drum-charge-${key}">
          <div class="drum-highlight"></div>
          <div class="drum-track"></div>
        </div>
      </div>
    </div>
    <div class="suggestion-actions">
      <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="validerModification('${nomAtelier}','${key}','${unite}',${newIntensite})">✓ Valider</button>
      <button class="btn btn-outline" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="annulerModification('${key}')">Annuler</button>
    </div>`;

  const chargeLabelFn = maxi > 0
    ? v => `${v} <span style="font-size:.62rem;color:var(--muted)"> (${Math.round(v/maxi*100)}%)</span>`
    : null;
  initDrumPicker('drum-reps-'+key,    repsVals,   newReps,   v => drumState[key].reps   = v);
  initDrumPicker('drum-charge-'+key,  chargeVals, newCharge, v => drumState[key].charge = v, chargeLabelFn);
}

function annulerModification(key) {
  const sugBox = document.getElementById('sug-'+key);
  if (savedSuggestions[key]) sugBox.innerHTML = savedSuggestions[key];
}

function validerModification(nomAtelier, key, unite, newIntensite) {
  const s = drumState[key];
  applySuggestion(nomAtelier, newIntensite, s.charge, s.reps);
}

// ═══════════════════════════════════════════════════
//  PAGE ATELIER DÉTAIL
// ═══════════════════════════════════════════════════
function goToAtelierDetail(nom) {
  state.currentAtelierDetail = nom;
  showPage('atelier-detail');
}

function buildAtelierDetail() {
  if (_gainageTimerInterval) { clearInterval(_gainageTimerInterval); _gainageTimerInterval = null; }
  _gainageTimerState = null;
  const pg = $('page-atelier-detail');
  const nom = state.currentAtelierDetail;
  const a = ATELIERS.find(x => x.nom === nom);
  const c = ATELIERS_CONTENT[nom];
  if (!a || !c) { showPage('seance'); return; }

  const type = getAtelierType(nom);
  const key = nom.replace(/[^a-zA-Z]/g,'_');
  const nomEsc = nom.replace(/'/g,"\\'");
  const maxi = parseFloat(state.maxis[nom])||0;
  const validations = parseInt(state.series[nom]||0);
  const localSeries = state.serieLocale[nom] || [];

  // Contenu pédagogique exécution
  let execHtml = '';
  if (type === 'gainage' && c.levels) {
    const lvlIdx = Math.min(Math.max((parseInt(state.maxis[nom])||1)-1, 0), c.levels.length-1);
    const lvl = c.levels[lvlIdx];
    execHtml = `<div style="font-size:.78rem;font-weight:700;color:var(--blue);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.06em">${lvl.label}</div>`;
    execHtml += lvl.steps.map(s=>`<div class="atelier-detail-item">${s}</div>`).join('');
  } else {
    execHtml = (c.exec||[]).map(s=>`<div class="atelier-detail-item">${s}</div>`).join('');
  }
  const secuHtml = (c.secu||[]).map(s=>`<div class="atelier-detail-item${s.startsWith('⚠️')?' atelier-detail-warn':''}">${s}</div>`).join('');

  pg.innerHTML = `
    <div style="text-align:center;margin-bottom:.6rem">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:.05em">${a.icon} ${a.nom}</span>
      ${type === 'standard' ? `<span style="font-size:.85rem;color:var(--muted);margin-left:.5rem">— Maxi : <span style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:var(--accent)">${formatMaxiSeance(a)}</span></span>` : ''}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.85rem;justify-content:center">
      ${a.muscles.split(' · ').map(m=>`<span style="display:inline-block;background:rgba(255,107,43,.12);border:1px solid rgba(255,107,43,.3);color:var(--accent2);font-size:.72rem;font-weight:600;border-radius:20px;padding:.15rem .6rem">${m}</span>`).join('')}
    </div>

    ${(()=>{
      const raw = state.historiqueAteliers[nom];
      if (!raw) return '';
      // Compatibilité ancien format (tableau simple) et nouveau format (objet)
      const hist = Array.isArray(raw) ? {series:raw, projet:'', seance:-1} : raw;
      const series = hist.series || [];
      if (!series.length) return '';
      // Masquer si projet différent ou si validé durant la séance actuelle
      if (hist.projet && hist.projet !== state.projet) return '';
      if (hist.seance === state.sessionNumber && state.sessionNumber > 0) return '';
      const colors = {F:'#2980b9',D:'#27ae60',TD:'#f39c12',E:'#c0392b'};
      // Série de référence pour le pré-remplissage S1
      const _dRef  = series.filter(s => s.c && !s.special && s.s === 'D');
      const _tdRef = series.filter(s => s.c && !s.special && s.s === 'TD');
      let _ref = null;
      if (_dRef.length > 0)       _ref = _dRef.reduce((b,s) => s.c > b.c ? s : b);
      else if (_tdRef.length > 0) _ref = _tdRef.reduce((b,s) => s.c < b.c ? s : b);
      const refIdx = _ref ? series.indexOf(_ref) : -1;
      const rows = series.map((s,i)=>{
        const border = i < series.length - 1 ? 'border-bottom:1px solid var(--border)' : '';
        if (s.special) {
          const ok = s.resultat === 'ok';
          return `<div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;padding:.2rem 0;${border}">
            <span style="color:var(--muted);min-width:1.5rem">S${i+1}</span>
            <span style="flex:1;font-weight:700;color:${ok?'var(--green)':'var(--red,#e74c3c)'}">${ok?'OK':'Échec'}</span>
          </div>`;
        }
        const chargeColor = i === refIdx ? 'var(--red,#e74c3c)' : 'var(--text)';
        const bg = colors[s.s] || '#444';
        return `<div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;padding:.2rem 0;${border}">
          <span style="color:var(--muted);min-width:1.5rem">S${i+1}</span>
          <span style="flex:1;color:${chargeColor};font-weight:${i===refIdx?'700':'400'}">${s.r} × ${s.c} kg</span>
          <span style="display:inline-flex;align-items:center;justify-content:center;min-width:1.6rem;height:1.4rem;border-radius:3px;background:${bg};color:#fff;font-size:.6rem;font-weight:700;padding:0 .2rem">${s.s||'—'}</span>
        </div>`;
      }).join('');
      const projetLabel = hist.projet ? ` — Projet ${hist.projet}` : '';
      return `<div style="background:var(--s1);border:1px solid var(--border);border-radius:10px;padding:.65rem .85rem;margin-bottom:.5rem">
        <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:.4rem">📋 Dernière validation à cet atelier${projetLabel}</div>
        ${rows}
      </div>`;
    })()}
    <div id="series-section-${key}">
      <div class="atelier-bloc-title">${state.historiqueAteliers[nom] && !Array.isArray(state.historiqueAteliers[nom]) && (state.historiqueAteliers[nom].seance !== state.sessionNumber || state.sessionNumber === 0) ? '🏋️ Aujourd\'hui :' : '🏋️ Vos séries à cet atelier'}</div>
      <div class="recup-timer" id="rt-${key}">
        <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:.3rem">⏱ Récupération</div>
        <div style="display:flex;justify-content:center">
          <div style="display:flex;align-items:center;gap:.5rem">
            <div class="recup-timer-count" id="rt-count-${key}">—</div>
            <button class="btn" style="width:auto;padding:.4rem .8rem;font-size:.78rem;background:var(--blue)" onclick="stopRecupTimer('${key}')">Passer →</button>
          </div>
        </div>
      </div>
      <div class="series-grid" id="sg-${key}">${buildSeriesHTML(a, maxi, localSeries)}</div>
    </div>
    ${type==='standard'?`<div class="suggestion-box" id="sug-${key}"></div>`:''}
    <div class="bravo-box" id="bravo-${key}" onclick="showPage('seance')" style="cursor:pointer">
      <div class="bravo-emoji">🎉</div>
      <div class="bravo-text">Bravo ! Atelier Validé !</div>
      <div class="bravo-sub">4 séries effectuées sur cet atelier</div>
      <div style="font-size:.72rem;color:var(--green);margin-top:.4rem;opacity:.7">Appuyez pour revenir aux ateliers →</div>
      <div id="bravo-maxi-${key}" style="display:none;margin-top:.75rem;padding:.6rem .8rem;background:rgba(230,126,34,.12);border:1px solid var(--yellow);border-radius:8px;text-align:left" onclick="event.stopPropagation()">
        <div style="font-size:.78rem;font-weight:700;color:var(--yellow);margin-bottom:.3rem">⚠️ Il faut corriger votre maxi à cet atelier !</div>
        <div style="font-size:.75rem;color:var(--text);margin-bottom:.5rem">Vous devez le recalculer avant de continuer.</div>
        <button class="btn" style="background:linear-gradient(135deg,var(--yellow),#e67e22);color:#000;font-size:.78rem;padding:.4rem .8rem" onclick="event.stopPropagation();allerAuxMaxis('${nomEsc}')">💪 Recalculer mon maxi</button>
      </div>
      ${nom==='Gainage sol'?`
      <div id="bravo-niveau-${key}" style="display:none;margin-top:.75rem;padding:.75rem;background:rgba(46,204,113,.08);border:1px solid var(--green);border-radius:10px;text-align:left" onclick="event.stopPropagation()">
        <div style="font-size:.85rem;font-weight:700;color:var(--green);margin-bottom:.5rem">💪 Excellent travail !</div>
        <div id="bravo-niveau-text-${key}" style="font-size:.8rem;color:var(--text);margin-bottom:.6rem"></div>
        <div style="display:flex;gap:.5rem">
          <button class="btn" style="flex:1;font-size:.8rem;padding:.5rem" onclick="event.stopPropagation();accepterNiveauSup('${nomEsc}')">✓ Oui</button>
          <button class="btn btn-outline" style="flex:1;font-size:.8rem;padding:.5rem" onclick="event.stopPropagation();refuserNiveauSup('${nomEsc}')">✗ Non</button>
        </div>
      </div>`:''}
    </div>

    <hr class="atelier-bloc-sep">

    <div class="atelier-bloc-title">📋 Consignes d'exécution</div>
    ${execHtml}

    <div class="atelier-bloc-title">🛡️ Règles de sécurité</div>
    ${secuHtml}

    ${(c.videos || (c.video && !c.video.includes('PLACEHOLDER'))) ? `
    <div class="atelier-detail-video" style="margin-top:1rem">
      <div style="font-size:1.4rem">🎬</div>
      <div style="flex:1">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:.35rem">Vidéo${c.videos?'s':''} de démonstration</div>
        ${c.videos
          ? c.videos.map(v=>`<div style="margin-bottom:.25rem"><a href="${v.url}" target="_blank" style="font-size:.85rem;color:var(--accent);text-decoration:none">${v.label} →</a></div>`).join('')
          : `<a href="${c.video}" target="_blank" style="font-size:.85rem;color:var(--accent);text-decoration:none">Voir la vidéo →</a>`
        }
      </div>
    </div>` : ''}

    <div style="height:1rem"></div>`;

  if (localSeries.length >= 4) {
    const bravo = $('bravo-'+key);
    if (bravo) bravo.classList.add('visible');
  }

  // Mode guidé : pré-remplir S1 depuis l'historique (meilleur D, ou TD le plus bas)
  if (type === 'standard' && localSeries.length === 0 && state.guidage) {
    const raw = state.historiqueAteliers[nom];
    if (raw && !Array.isArray(raw) && raw.series &&
        (!raw.projet || raw.projet === state.projet) &&
        (raw.seance !== state.sessionNumber || state.sessionNumber === 0)) {
      const dSeries  = raw.series.filter(s => s.c && !s.special && s.s === 'D');
      const tdSeries = raw.series.filter(s => s.c && !s.special && s.s === 'TD');
      let bestSerie = null;
      if (dSeries.length > 0)       bestSerie = dSeries.reduce((best, s) => s.c > best.c ? s : best);
      else if (tdSeries.length > 0) bestSerie = tdSeries.reduce((best, s) => s.c < best.c ? s : best);
      if (bestSerie && maxi > 0) {
        const histIntensite = Math.round(bestSerie.c / maxi * 100);
        applySuggestion(nom, histIntensite, bestSerie.c, bestSerie.r);
      }
    }
  }

  // Mode guidé : restaurer la boîte de suggestion si l'élève a quitté la page avant d'avoir accepté la proposition
  if (state.guidage && type === 'standard' && localSeries.length > 0 && localSeries.length < 4 &&
      state.suggestionEnCours && state.suggestionEnCours[nom]) {
    const lastSerie = localSeries[localSeries.length - 1];
    showSuggestion(nom, key, a.unite, lastSerie.ressenti, localSeries.length + 1,
      lastSerie.charge, lastSerie.reps, lastSerie.intensite || state.intensite);
  }

  // Mode autonome : ouvrir les roulettes pour la série suivante (au retour sur la page ou à l'arrivée)
  if (!state.guidage && type === 'standard' && localSeries.length < 4) {
    const sugBox = document.getElementById('sug-' + key);
    if (sugBox && !sugBox.classList.contains('visible')) {
      const p = PROJETS[state.projet];
      const prev = localSeries.length > 0 ? localSeries[localSeries.length - 1] : null;
      const startCharge = prev ? prev.charge : (maxi ? Math.round(maxi * p.intensites[0] / 100 * 2) / 2 : 0);
      const startReps   = prev ? prev.reps   : p.repsMin;
      const startInt    = prev ? (prev.intensite || p.intensites[0]) : p.intensites[0];
      const nextSerie   = localSeries.length + 1;
      drumState[key] = { reps: startReps, charge: startCharge };
      savedSuggestions[key] = '';
      const chargeVals = genChargeValues(maxi, state.projet);
      const repsVals = [];
      for (let i = p.repsMin; i <= p.repsMax; i++) repsVals.push(i);
      const chargeLabelFn = maxi > 0
        ? v => `${v} <span style="font-size:.62rem;color:var(--muted)">(${Math.round(v/maxi*100)}%)</span>`
        : null;
      sugBox.innerHTML = `
        <div class="suggestion-title">Série ${nextSerie} — à toi de choisir</div>
        <div class="drum-picker-wrap">
          <div class="drum-picker-col">
            <div class="field-label" style="margin-bottom:.3rem">Reps</div>
            <div class="drum-picker" id="drum-reps-${key}">
              <div class="drum-highlight"></div><div class="drum-track"></div>
            </div>
          </div>
          <div class="drum-picker-col">
            <div class="field-label" style="margin-bottom:.3rem">Charge (${a.unite})</div>
            <div class="drum-picker" id="drum-charge-${key}">
              <div class="drum-highlight"></div><div class="drum-track"></div>
            </div>
          </div>
        </div>
        <div class="suggestion-actions">
          <button class="btn" onmouseenter="onSugBtnIn(this)" onmouseleave="onSugBtnOut(this)" onclick="validerModification('${nom}','${key}','${a.unite}',${startInt})">✓ Valider</button>
        </div>`;
      sugBox.classList.add('visible');
      initDrumPicker('drum-reps-'   + key, repsVals,   startReps,   v => drumState[key].reps   = v);
      initDrumPicker('drum-charge-' + key, chargeVals, startCharge, v => drumState[key].charge = v, chargeLabelFn);
    }
  }
}

// ═══════════════════════════════════════════════════
//  DÉMARRAGE
// ═══════════════════════════════════════════════════
initLogin();

// Reprise d'app (swipe recents Samsung, backgrounding)
// → si le spinner est visible quand l'app revient au premier plan, relancer initLogin
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !$('loading').classList.contains('hidden')) {
    _initLoginRunning = false;
    initLogin();
  }
});

// Restauration BFCache Safari (refresh ou navigation arrière)
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    _initLoginRunning = false;
    initLogin();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

function onSugBtnIn(el) {
  const all = [...el.closest('.suggestion-actions').querySelectorAll('.btn')];
  all.filter(b => b !== el).forEach(b => {
    b.style.background = 'var(--s2)';
    b.style.color = 'var(--muted)';
    b.style.transform = 'none';
    b.style.opacity = '1';
  });
  if (el.classList.contains('btn-outline')) {
    el.style.background = 'linear-gradient(135deg,var(--accent),#ffaa00)';
    el.style.color = '#fff';
    el.style.borderColor = 'transparent';
  }
}
function onSugBtnOut(el) {
  el.closest('.suggestion-actions').querySelectorAll('.btn').forEach(b => {
    b.style.background = '';
    b.style.color = '';
    b.style.transform = '';
    b.style.opacity = '';
    b.style.borderColor = '';
  });
}
