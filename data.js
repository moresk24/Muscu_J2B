// ═══════════════════════════════════════════════════
//  THÈME CLAIR / SOMBRE
// ═══════════════════════════════════════════════════
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isLight = theme === 'light';
  const icon = isLight ? '☀️' : '🌙';
  const label = isLight ? 'Passer au thème sombre' : 'Passer au thème clair';
  const i = document.getElementById('hmenu-theme-icon');
  const lb = document.getElementById('hmenu-theme-label');
  const l = document.getElementById('btn-theme-login');
  if (i) i.textContent = icon;
  if (lb) lb.textContent = label;
  if (l) l.textContent = icon;
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('muscu_theme', next);
  applyTheme(next);
}
function toggleHamburger() {
  document.getElementById('hamburger-menu').classList.toggle('open');
}
function closeHamburger() {
  document.getElementById('hamburger-menu').classList.remove('open');
}
document.addEventListener('click', function(e) {
  const menu = document.getElementById('hamburger-menu');
  const btn = document.getElementById('btn-hamburger');
  if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
    menu.classList.remove('open');
  }
});
(function() {
  const saved = localStorage.getItem('muscu_theme') || 'light';
  applyTheme(saved);
})();

// ═══════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════
const WEBAPP = "https://script.google.com/macros/s/AKfycbyOOP30LcvyHaQvdIHYGNwnPsC8vsZUKLborLopVdV8zJl4EtRonbHli_MH2y-hNWoq/exec";

// ═══════════════════════════════════════════════════
//  DONNÉES STATIQUES
// ═══════════════════════════════════════════════════
const ATELIERS = [
  {nom:"Développé Couché",      muscles:"Grands Pectoraux · Triceps · Deltoïde ANT.", icon:"🏋️", groupe:"haut", unite:"kg"},
  {nom:"Développé Incliné",     muscles:"Petits Pectoraux · Triceps · Deltoïde ANT.", icon:"↗️", groupe:"haut", unite:"kg"},
  {nom:"Pull-Down Nuque",       muscles:"Grand Rond · Grand Dorsal · Trapèze · Biceps", icon:"⬇️", groupe:"haut", unite:"kg"},
  {nom:"Pull-Down Poitrine",    muscles:"Grand Rond · Grand Dorsal · Trapèze · Biceps", icon:"⬇️", groupe:"haut", unite:"kg"},
  {nom:"Butterfly",             muscles:"Pectoraux · Deltoïdes ANT.", icon:"🦋", groupe:"haut", unite:"kg"},
  {nom:"Banc Tirage Biceps",    muscles:"Trapèzes · Deltoïdes POST. · Biceps", icon:"💪", groupe:"haut", unite:"kg"},
  {nom:"Machine Biceps",        muscles:"Biceps", icon:"🔩", groupe:"haut", unite:"kg"},
  {nom:"Deltoïdes (haltères)",  muscles:"Deltoïde Latéral", icon:"🏅", groupe:"haut", unite:"kg"},
  {nom:"Banc à Lombaires",      muscles:"Lombaire", icon:"🔄", groupe:"haut", unite:"kg", note:"30 rép. sur 1'"},
  {nom:"Gainage sol",           muscles:"Lombaires · Abdominaux · Fessiers", icon:"🧱", groupe:"haut", unite:"niv."},
  {nom:"Abdo Sol",              muscles:"Grand Droit · Transverses · Obliques", icon:"🔥", groupe:"haut", unite:"rép.", note:"30 rép. sur 1'"},
  {nom:"Banc Ischio Jambiers",  muscles:"Ischio-Jambiers", icon:"🦵", groupe:"bas", unite:"kg"},
  {nom:"Chaise à ADDucteurs",   muscles:"Adducteurs", icon:"↔️", groupe:"bas", unite:"kg"},
  {nom:"Chaise à ABDucteurs",   muscles:"Fessiers · Tenseur du fascia lata", icon:"↔️", groupe:"bas", unite:"kg"},
  {nom:"Chaise à Quadriceps",   muscles:"Quadriceps", icon:"🦿", groupe:"bas", unite:"kg"},
  {nom:"Presse Inclinée",       muscles:"Quadriceps · Fessiers", icon:"📐", groupe:"bas", unite:"kg"},
];

const PROJETS = {
  "1": {
    num:"1", nom:"SPORTIF",
    mobile:"Puissance · Explosivité",
    desc:"Accompagner un projet sportif, gain de puissance et/ou explosivité",
    intensites:[80,85,90], seriesMin:2, seriesMax:6,
    repsMin:4, repsMax:8,
    dureeSerie:"< 10 secondes",
    vitesse:"Rapide / Explosive en phase concentrique",
    recup:"Semi-active · 3 à 6 mn",
    contractions:"Concentrique · Excentrique · Pliométrique · Isométrique"
  },
  "2": {
    num:"2", nom:"ESTHÉTIQUE",
    mobile:"Volume musculaire",
    desc:"Développer sa musculature en recherchant un gain de volume musculaire",
    intensites:[65,70,75,80], seriesMin:6, seriesMax:12,
    repsMin:10, repsMax:20,
    dureeSerie:"10 à 30 secondes",
    vitesse:"Lente",
    recup:"Passive · 1'30 à 2'30",
    contractions:"Concentrique"
  },
  "3A": {
    num:"3A", nom:"SANTÉ Endurance",
    mobile:"Affinement silhouette",
    desc:"Développer sa musculature en recherchant l'affinement de la silhouette",
    intensites:[40,45,50], seriesMin:3, seriesMax:6,
    repsMin:25, repsMax:35,
    dureeSerie:"20 secondes à 1 mn",
    vitesse:"Rapide",
    recup:"Active · 30'' à 1'",
    contractions:"Concentrique"
  },
  "3B": {
    num:"3B", nom:"SANTÉ Tonification",
    mobile:"Entretien · Raffermissement",
    desc:"Entretenir sa forme ou se protéger des accidents par la tonification musculaire",
    intensites:[50,55,60,65], seriesMin:3, seriesMax:6,
    repsMin:15, repsMax:25,
    dureeSerie:"15 à 30 secondes",
    vitesse:"Soutenue",
    recup:"Active · 30'' à 1'30",
    contractions:"Concentrique · Excentrique"
  }
};

const PROJETS_CONTENT = {
  "1": {
    badge: "Projet 1", icon: "⚡",
    titre: "Sportif",
    sousTitre: "Puissance — Explosivité",
    resume: "Développer la puissance musculaire : produire une force maximale dans un temps très court. La qualité physique qui fait la différence dans un sprint, un saut, un tir ou un changement de direction rapide.",
    sensations: "Séries courtes et intenses, exécutées avec intention maximale. Récupération longue et semi-active — indispensable pour reconstituer les réserves nerveuses avant la série suivante. Concentration et engagement maximal.",
    profils: [
      "Football, rugby, handball, basketball",
      "Athlétisme (sprint, sauts, lancers)",
      "Arts martiaux, tennis, volleyball",
      "Tout sport où l'explosivité fait la différence"
    ],
    gains: [
      "Augmentation de la force maximale",
      "Meilleure réactivité musculaire",
      "Capacité à enchaîner des actions explosives",
      "Bénéfices ressentis après 4 à 6 semaines"
    ],
    parametres: {
      intensite: "80 à 90 % du maxi",
      repetitions: "4 à 8",
      series: "2 à 6",
      recuperation: "3 à 6 minutes"
    },
    pdf: "PDF-Projets/projet1-sportif.pdf"
  },
  "2": {
    badge: "Projet 2", icon: "🏛️",
    titre: "Esthétique",
    sousTitre: "Volume musculaire — Hypertrophie",
    resume: "Développer le volume musculaire visible et durable. Une masse musculaire bien développée améliore la posture, protège les articulations et augmente le métabolisme de base.",
    sensations: "Séries lentes et contrôlées. Une brûlure musculaire en fin de série est bon signe. Récupération passive et relativement courte pour maintenir un niveau de fatigue métabolique suffisant entre les séries.",
    profils: [
      "Élèves qui souhaitent transformer leur physique",
      "Débutants voulant poser des bases solides",
      "Sports où la corpulence ou la puissance de contact est un avantage"
    ],
    gains: [
      "Silhouette plus musclée et plus dessinée",
      "Meilleure posture",
      "Augmentation de la force générale",
      "Premiers résultats visibles après 6 à 8 semaines"
    ],
    parametres: {
      intensite: "65 à 80 % du maxi",
      repetitions: "10 à 20",
      series: "6 à 12",
      recuperation: "1min30 à 2min30"
    },
    pdf: "PDF-Projets/projet2-esthetique.pdf"
  },
  "3A": {
    badge: "Projet 3A", icon: "🫀",
    titre: "Santé Endurance",
    sousTitre: "Affinement de la silhouette — Dépense énergétique",
    resume: "Utiliser la musculation comme outil de dépense énergétique. À faible charge et haute cadence, c'est l'une des méthodes les plus efficaces pour mobiliser les graisses tout en renforçant les muscles.",
    sensations: "Rythme rapide et soutenu. Élévation nette du rythme cardiaque très rapidement. Fatigue musculaire diffuse sur toute la séance. Récupération courte et active — la fréquence cardiaque ne doit pas trop redescendre.",
    profils: [
      "Élèves souhaitant perdre du gras en tonifiant",
      "Pratiquants de sports d'endurance (course, cyclisme, natation, triathlon)",
      "Ceux qui veulent un renforcement sans prise de masse"
    ],
    gains: [
      "Silhouette affinée et plus tonique",
      "Meilleure endurance musculaire",
      "Capacité cardio-vasculaire améliorée",
      "Effets visibles après 4 à 6 semaines"
    ],
    parametres: {
      intensite: "40 à 50 % du maxi",
      repetitions: "25 à 35",
      series: "3 à 6",
      recuperation: "30s à 1 minute"
    },
    pdf: "PDF-Projets/projet3a-sante-endurance.pdf"
  },
  "3B": {
    badge: "Projet 3B", icon: "⚖️",
    titre: "Santé Tonification",
    sousTitre: "Entretien musculaire — Raffermissement — Prévention",
    resume: "Le projet de l'équilibre et de la prévention. Maintenir les muscles fermes, réactifs et protecteurs pour les articulations — sans chercher à les faire grossir ni les épuiser.",
    sensations: "Effort soutenu mais contrôlé, vitesse régulière. Récupération courte et active — rester en mouvement entre les séries sans atteindre l'épuisement.",
    profils: [
      "Reprise du sport après une période d'inactivité",
      "Convalescence après une blessure légère",
      "Sports techniques (danse, raquette, glisse, sports collectifs)",
      "Entretien de la forme sans objectif de performance"
    ],
    gains: [
      "Corps plus ferme et mieux équilibré",
      "Meilleure stabilité articulaire (genoux, épaules, dos)",
      "Réduction du risque de blessure",
      "Meilleure posture et moins de douleurs dorsales"
    ],
    parametres: {
      intensite: "50 à 65 % du maxi",
      repetitions: "15 à 25",
      series: "3 à 6",
      recuperation: "30s à 1min30"
    },
    pdf: "PDF-Projets/projet3b-sante-tonification.pdf"
  }
};

// ═══════════════════════════════════════════════════
//  CONTENU PÉDAGOGIQUE PAR ATELIER
// ═══════════════════════════════════════════════════
const ATELIERS_CONTENT = {
  "Développé Couché":{
    exec:["La barre fait 10 kg à vide — repérez-vous sur les anneaux gravés pour la prise","Prise en pronation, largeur légèrement supérieure aux épaules","Descendre la barre jusqu'à toucher la poitrine","Pousser en expirant, bras presque tendus — ne pas verrouiller les coudes"],
    secu:["⚠️ Ne jamais travailler seul sans parade sur des charges lourdes","Ne pas rebondir la barre sur la poitrine","Poignets dans l'axe, ne pas les casser vers l'arrière"],
    video:"https://www.youtube.com/watch?v=6BTdsptL1BQ"
  },
  "Développé Incliné":{
    exec:["La barre fait 10 kg à vide — repérez-vous sur les anneaux gravés pour la prise","Prise en pronation, largeur légèrement supérieure aux épaules","Dossier incliné à environ 30–45°, descendre la barre vers le haut de la poitrine (clavicules)","Mouvement contrôlé, pas de rebond, expirer à la poussée"],
    secu:["Vérifier le verrouillage du dossier avant de commencer","Ne pas cambrer excessivement le dos","La charge est inférieure au développé couché — c'est normal"],
    video:"https://www.youtube.com/watch?v=4u_cmy1ijDA"
  },
  "Pull-Down Nuque":{
    exec:["Prise large en pronation","Tirer la barre derrière la tête jusqu'à la nuque","Coudes qui descendent vers le bas et l'arrière","Remonter lentement et de façon contrôlée, expirer à la traction"],
    secu:["⚠️ Déconseillé en cas de problème cervical","Ne pas incliner excessivement la tête vers l'avant","Ne pas lâcher la barre brutalement à la remontée"],
    video:"https://www.youtube.com/watch?v=uq8OXMuU4_o"
  },
  "Pull-Down Poitrine":{
    exec:["Prise large en pronation","Tirer la barre devant, jusqu'au haut de la poitrine","Se pencher légèrement en arrière, poitrine sortie","Remonter lentement en contrôlant, expirer à la traction"],
    secu:["Ne pas tirer avec les bras seuls — initier avec les dorsaux","Ne pas laisser les épaules monter vers les oreilles en haut du mouvement","Cuisse bien calée sous les appuis"],
    video:"https://www.youtube.com/watch?v=dOukQ7QBSQs"
  },
  "Butterfly":{
    exec:["Dos bien appuyé contre le dossier — régler l'assise en hauteur avant de commencer","Bras légèrement fléchis tout au long du mouvement","Fermer lentement devant la poitrine, ouvrir en résistant, expirer à la fermeture","Amplitude maximale sans douleur à l'épaule"],
    secu:["⚠️ Déconseillé en cas de problème d'épaule","Ne pas ouvrir au-delà de la ligne des épaules","Éviter les mouvements brusques en ouverture"],
    video:"https://www.youtube.com/watch?v=vy4N60MrPWA"
  },
  "Banc Tirage Biceps":{
    exec:["Assis sur le banc, pieds posés sur la planche en aluminium, jambes presque tendues","Tirer les poignées vers les hanches en serrant les omoplates, coudes proches du corps","Repère : vous devez pouvoir toucher vos côtes avec vos pouces","Relâcher en tendant les bras de façon contrôlée, expirer à la traction"],
    secu:["Ne pas décoller la poitrine du banc pendant le tirage","Ne pas hausser les épaules — garder les trapèzes relâchés au départ","Amplitude complète — ne pas couper le mouvement"],
    video:"https://www.youtube.com/watch?v=w2Q7LbkhtLI"
  },
  "Machine Biceps":{
    exec:["Coudes bien calés sur l'appui, immobiles pendant tout le mouvement","Fléchir jusqu'à avoir les avant-bras à la verticale","Étendre presque complètement, mouvement lent et contrôlé dans les deux sens","Expirer à la flexion"],
    secu:["Ne pas balancer le haut du corps pour aider","Ne pas verrouiller les coudes en bas du mouvement","⚠️ Charges modérées — articulation fragile"],
    video:"https://www.youtube.com/watch?v=Ds-d-hmgIPE"
  },
  "Deltoïdes (haltères)":{
    exec:["Debout ou assis, dos droit","Lever les bras latéralement jusqu'à l'horizontale, légère flexion des coudes, pouces légèrement vers le bas","Redescendre lentement en résistant, expirer à la montée"],
    secu:["⚠️ Déconseillé en cas de problème d'épaule","Ne pas monter au-dessus de l'horizontale","⚠️ Charges très légères — muscles petits et fragiles"],
    video:"https://www.youtube.com/watch?v=PLACEHOLDER"
  },
  "Banc à Lombaires":{
    exec:["Allongé face vers le bas sur le banc, chevilles calées sous les appuis","Tenir l'épaule gauche avec la main droite et l'épaule droite avec la main gauche","Garder le dos rond durant toute l'exécution du geste","Descendre le buste vers le bas, remonter jusqu'à l'horizontale (30 répétitions en 1 minute), expirer à la remontée","Si l'exercice est trop facile : tenir un disque de 2, 5 ou 10 kg contre la poitrine"],
    secu:["⚠️ Ne surtout pas cambrer à la remontée","Mouvement fluide, pas d'à-coups","⚠️ Déconseillé en cas de problème lombaire"],
    video:"https://www.youtube.com/watch?v=PLACEHOLDER"
  },
  "Gainage sol":{
    levels:[
      {label:"Niveau 1 — 1 mn d'effort",steps:["Planche face au sol — appui sur les coudes et les orteils — tenir 15s","Côté droit — appui sur le coude droit et le bord du pied droit — tenir 15s","Planche face au sol — appui sur les coudes et les orteils — tenir 15s","Côté gauche — appui sur le coude gauche et le bord du pied gauche — tenir 15s"]},
      {label:"Niveau 2 — 2 mn d'effort",steps:["Planche face au sol — appui sur les coudes et les orteils — tenir 30s","Côté droit — appui sur le coude droit et le bord du pied droit — tenir 30s","Planche face au sol — appui sur les coudes et les orteils — tenir 30s","Côté gauche — appui sur le coude gauche et le bord du pied gauche — tenir 30s"]},
      {label:"Niveau 3 — 1 mn d'effort + jambe levée",steps:["Planche face au sol, jambe gauche levée — tenir 15s","Côté droit, jambe gauche levée — tenir 15s","Planche face au sol, jambe droite levée — tenir 15s","Côté gauche, jambe droite levée — tenir 15s"]},
      {label:"Niveau 4 — 2 mn d'effort + jambe levée",steps:["Planche face au sol, jambe gauche levée — tenir 30s","Côté droit, jambe gauche levée — tenir 30s","Planche face au sol, jambe droite levée — tenir 30s","Côté gauche, jambe droite levée — tenir 30s"]}
    ],
    secu:["Garder le corps bien aligné, ne pas laisser les hanches s'affaisser","Ne pas retenir sa respiration","⚠️ Déconseillé en cas de problème lombaire ou d'épaule"],
    video:"https://www.youtube.com/watch?v=auaPX7B2rV4"
  },
  "Abdo Sol":{
    exec:["Allongé sur le dos, genoux fléchis, pieds au sol","Mains croisées sur la poitrine ou derrière les tempes (pas derrière la nuque)","Monter les épaules vers les genoux, ne pas toucher le sol avec le haut du dos à la redescente","30 répétitions en 1 minute, expirer à la montée","Si l'exercice est trop facile : tenir un disque contre la poitrine"],
    secu:["Ne pas tirer sur la nuque avec les mains","Le bas du dos reste en contact avec le sol","Ne pas bloquer la respiration"],
    videos:[
      {label:"Foot 2 foot crunch",url:"https://www.youtube.com/watch?v=8FSPprNrqx4"},
      {label:"Alternés",url:"https://www.youtube.com/watch?v=UuQNxjMPIfw"},
      {label:"Élévation des jambes (4 temps)",url:"https://www.youtube.com/watch?v=FCcSgVWhmIE"},
      {label:"Crunch bras croisés",url:"https://www.youtube.com/watch?v=iT5EjBwZLRM"},
      {label:"Crunch genou/poitrine",url:"https://www.youtube.com/watch?v=gPJ_lSfgROM"}
    ]
  },
  "Banc Ischio Jambiers":{
    exec:["Allongé face vers le bas sur le banc, chevilles calées sous les rouleaux","Fléchir les jambes jusqu'à avoir les mollets à la verticale","Redescendre lentement en contrôlant","Expirer à la flexion"],
    secu:["Régler l'atelier pour ne pas avoir les jambes en hyperextension au départ","Ne pas laisser les hanches se décoller du banc","Mouvement lent et contrôlé — pas d'à-coups","⚠️ Déconseillé en cas de problème aux genoux"],
    video:"https://www.youtube.com/watch?v=gnOg-r7T6TY"
  },
  "Chaise à ADDucteurs":{
    exec:["Assis, dos bien appuyé contre le dossier, chevilles calées sur les appuis extérieurs","Fermer les jambes en résistant jusqu'au bout","Relâcher lentement en contrôlant l'ouverture","Expirer à la fermeture"],
    secu:["Régler l'écartement initial selon sa souplesse — pas de douleur à l'ouverture","Dos bien plaqué contre le dossier pendant tout le mouvement","⚠️ Déconseillé en cas de problème à l'aine ou aux genoux"],
    video:"https://www.youtube.com/watch?v=Rm8kKSrSNgI"
  },
  "Chaise à ABDucteurs":{
    exec:["Assis, dos bien appuyé contre le dossier, chevilles calées sur les appuis intérieurs","Ouvrir les jambes vers l'extérieur jusqu'au maximum","Revenir lentement en contrôlant","Expirer à l'ouverture"],
    secu:["Régler l'écartement initial confortablement","Dos bien plaqué contre le dossier pendant tout le mouvement","⚠️ Déconseillé en cas de problème aux hanches ou aux genoux"],
    video:"https://www.youtube.com/watch?v=Rm8kKSrSNgI"
  },
  "Chaise à Quadriceps":{
    exec:["Assis, dos bien appuyé contre le dossier, chevilles calées sous les rouleaux","Régler le dossier en profondeur pour que le creux poplité épouse la mousse de l'assise","Étendre les jambes jusqu'à l'horizontale","Redescendre lentement en contrôlant, expirer à l'extension"],
    secu:["Ne pas verrouiller les genoux en extension","Mouvement lent et contrôlé — pas de balancier","⚠️ Déconseillé en cas de problème aux genoux"],
    video:"https://www.youtube.com/watch?v=FvWTjrAOG3k"
  },
  "Presse Inclinée":{
    exec:["Assis dans la machine, dos bien plaqué contre le dossier incliné","Pieds à plat sur la plateforme, largeur des épaules","Fléchir les jambes jusqu'à 90° puis pousser jusqu'à presque tendre","Toujours vérifier les sécurités de la machine avant de commencer","Expirer à la poussée"],
    secu:["⚠️ Ne jamais verrouiller les genoux en extension","Ne pas décoller le bas du dos du dossier","⚠️ Déconseillé en cas de problème aux genoux ou au dos"],
    video:"https://www.youtube.com/watch?v=cij6M0YkHQ0"
  }
};

// Calcul des reps selon intensité (linéaire dans la fourchette)
function calcReps(projet, intensite) {
  const p = PROJETS[projet];
  if (!p) return 0;
  const ints = p.intensites;
  const min = Math.min(...ints), max = Math.max(...ints);
  if (min === max) return Math.round((p.repsMin + p.repsMax) / 2);
  // Plus l'intensité est haute, moins de reps
  const ratio = (max - intensite) / (max - min);
  return Math.round(p.repsMin + ratio * (p.repsMax - p.repsMin));
}

// Messages progression séance
function progressMsg(count) {
  if (count === 0) return "";
  if (count === 1) return "C'est parti ! 💥";
  if (count === 2) return "Bon rythme, continuez ! 🔥";
  if (count === 3) return "À mi-chemin ! ⚡";
  if (count === 4) return "Plus qu'un atelier ! 💪";
  if (count === 5) return "Objectif atteint, bravo ! 🏆";
  if (count > 5)  return `Bravo, ${count} ateliers validés ! Vous dépassez même nos attentes ! 🥇`;
  return "";
}
