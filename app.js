const STORAGE_KEY = "delf-b2-vocab-progress";
const IMPORT_KEY = "delf-b2-vocab-import";
const LOOKUP_CACHE_KEY = "delf-b2-vocab-lookup-cache";
const EUDIC_CACHE_KEY = "delf-b2-vocab-eudic-cache-v2";
const LOOKUP_API_URL = window.B2_LOOKUP_API || "/api/lookup";
const EUDIC_API_URL = window.B2_EUDIC_API || "/api/eudic";

let baseWords = [...window.B2_VOCAB];
const imported = localStorage.getItem(IMPORT_KEY);
if (imported) {
  try {
    baseWords = JSON.parse(imported);
  } catch {
    localStorage.removeItem(IMPORT_KEY);
  }
}
let eudicCache = loadEudicCache();
let words = mergeWordSources(baseWords, eudicCache.words);

let state = {
  view: "browse",
  query: "",
  category: "all",
  tag: "all",
  quizMode: "fr-zh",
  current: null,
  detailWordKey: "",
  progress: loadProgress()
};

const els = {
  totalCount: document.querySelector("#totalCount"),
  knownCount: document.querySelector("#knownCount"),
  accuracy: document.querySelector("#accuracy"),
  tabs: document.querySelectorAll(".tab"),
  panels: {
    browse: document.querySelector("#browseView"),
    quiz: document.querySelector("#quizView"),
    manage: document.querySelector("#manageView")
  },
  search: document.querySelector("#searchInput"),
  category: document.querySelector("#categorySelect"),
  chips: document.querySelectorAll(".chip"),
  list: document.querySelector("#wordList"),
  quizDirection: document.querySelector("#quizDirection"),
  quizCategory: document.querySelector("#quizCategory"),
  quizPrompt: document.querySelector("#quizPrompt"),
  answer: document.querySelector("#answerInput"),
  feedback: document.querySelector("#feedback"),
  check: document.querySelector("#checkAnswer"),
  next: document.querySelector("#nextCard"),
  switchQuiz: document.querySelector("#switchQuiz"),
  install: document.querySelector("#installBtn"),
  importFile: document.querySelector("#importFile"),
  syncEudic: document.querySelector("#syncEudic"),
  eudicStatus: document.querySelector("#eudicStatus"),
  exportProgress: document.querySelector("#exportProgress"),
  resetProgress: document.querySelector("#resetProgress"),
  detailDialog: document.querySelector("#detailDialog"),
  detailCategory: document.querySelector("#detailCategory"),
  detailTitle: document.querySelector("#detailTitle"),
  detailTranslation: document.querySelector("#detailTranslation"),
  detailBody: document.querySelector("#detailBody"),
  closeDetail: document.querySelector("#closeDetail")
};

let deferredInstall = null;
let lookupCache = loadLookupCache();

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstall = event;
  els.install.hidden = false;
});

els.install.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { known: {}, right: 0, total: 0 };
  } catch {
    return { known: {}, right: 0, total: 0 };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function loadLookupCache() {
  try {
    return JSON.parse(localStorage.getItem(LOOKUP_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLookupCache() {
  localStorage.setItem(LOOKUP_CACHE_KEY, JSON.stringify(lookupCache));
}

function loadEudicCache() {
  try {
    return JSON.parse(localStorage.getItem(EUDIC_CACHE_KEY)) || { words: [], syncedAt: "" };
  } catch {
    return { words: [], syncedAt: "" };
  }
}

function saveEudicCache() {
  localStorage.setItem(EUDIC_CACHE_KEY, JSON.stringify(eudicCache));
}

function mergeWordSources(primaryWords, eudicWords = []) {
  const merged = [...primaryWords];
  const existing = new Set(merged.map(word => normalize(stripArticle(word.fr) || word.fr)));
  for (const word of eudicWords) {
    const key = normalize(stripArticle(word.fr) || word.fr);
    if (!key) continue;
    if (existing.has(key)) {
      merged.push({ ...word, fr: word.fr, category: "法语助手生词本" });
    } else {
      merged.push(word);
      existing.add(key);
    }
  }
  return merged;
}

function refreshWordsFromSources() {
  words = enhanceWords(mergeWordSources(baseWords, eudicCache.words));
  setupCategories();
  renderStats();
  renderWords();
  if (state.view === "quiz") pickQuizWord();
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[，。！？；,.!?;'"«»]/g, "")
    .trim();
}

const VERB_PATTERNS = [
  "remettre en question", "mettre en place", "mettre en évidence", "prendre en compte",
  "faire face à", "avoir recours à", "sensibiliser à", "lutter contre", "s'adapter à",
  "analyser", "aborder", "améliorer", "renforcer", "réduire", "favoriser", "prévenir",
  "limiter", "encourager", "développer", "protéger", "garantir", "souligner", "évaluer",
  "transformer", "constater", "affirmer", "nuancer", "contester", "interdire", "autoriser",
  "accroître", "diminuer", "augmenter", "baisser", "progresser", "gaspiller", "trier",
  "s'engager", "s'intégrer", "s'informer", "s'épanouir", "se dégrader", "s'améliorer"
];

const CATEGORY_RELATIONS = {
  "Le monde du travail": {
    synonyms: ["l'emploi", "la carrière", "la vie professionnelle", "l'activité professionnelle", "le parcours professionnel", "le métier"],
    antonyms: ["le chômage", "l'inactivité", "la précarité", "l'exclusion professionnelle", "la perte d'emploi", "l'instabilité"]
  },
  "L'environnement": {
    synonyms: ["l'écologie", "la protection de la nature", "le développement durable", "la transition écologique", "la préservation", "la sobriété"],
    antonyms: ["la pollution", "le gaspillage", "la dégradation", "la surexploitation", "la destruction", "l'épuisement des ressources"]
  },
  "La technologie": {
    synonyms: ["le numérique", "l'innovation", "le progrès technique", "l'informatique", "la modernisation", "l'automatisation"],
    antonyms: ["l'obsolescence", "la fracture numérique", "la dépendance numérique", "le retard technologique", "la panne", "l'exclusion numérique"]
  },
  "L'éducation": {
    synonyms: ["l'apprentissage", "la formation", "l'enseignement", "la pédagogie", "l'instruction", "la transmission"],
    antonyms: ["l'échec scolaire", "le décrochage", "l'ignorance", "l'illettrisme", "l'exclusion scolaire", "le manque de formation"]
  },
  "La santé": {
    synonyms: ["le bien-être", "la prévention", "l'hygiène de vie", "la forme", "l'équilibre mental", "la qualité des soins"],
    antonyms: ["la maladie", "la sédentarité", "l'épuisement", "la souffrance", "la dépendance", "la dégradation physique"]
  },
  "Les médias et l'information": {
    synonyms: ["l'information", "la presse", "le débat public", "le journalisme", "la communication", "la vérification des faits"],
    antonyms: ["la désinformation", "la censure", "la manipulation", "la propagande", "la rumeur", "l'intox"]
  },
  "La société et les inégalités": {
    synonyms: ["la cohésion sociale", "la solidarité", "l'intégration", "la justice sociale", "l'égalité", "le vivre-ensemble"],
    antonyms: ["l'exclusion", "la discrimination", "les inégalités", "la marginalisation", "la ségrégation", "l'injustice"]
  },
  "La mondialisation": {
    synonyms: ["les échanges internationaux", "l'interdépendance", "l'ouverture", "la coopération internationale", "la circulation", "l'intégration mondiale"],
    antonyms: ["le protectionnisme", "l'isolement", "la fermeture", "le repli national", "l'autarcie", "la fragmentation"]
  }
};

const LEXICAL_RELATIONS = {
  analyser: {
    aide: "ana- 分解 + -lyser 分析",
    root: "analyse, analytique, analyser",
    derived: ["analyse", "analyste", "analytique", "analytiquement", "réanalyse"],
    synonyms: ["étudier", "examiner", "observer", "décomposer", "interpréter", "évaluer", "scruter", "décortiquer"],
    antonyms: ["ignorer", "négliger", "survoler", "confondre", "simplifier à l'excès", "généraliser"],
    associations: ["données", "résultats", "causes", "effets", "méthode", "critères", "rapport", "enquête"]
  },
  aborder: {
    aide: "a- + bord: arriver au bord d'un sujet",
    root: "bord, aborder, abord",
    derived: ["abord", "abordable", "inabordable", "abordage", "abordé"],
    synonyms: ["traiter", "évoquer", "examiner", "parler de", "s'attaquer à", "approcher", "considérer", "étudier"],
    antonyms: ["éviter", "éluder", "ignorer", "passer sous silence", "négliger", "contourner"],
    associations: ["sujet", "problème", "question", "débat", "thème", "angle", "discussion", "argument"]
  },
  améliorer: {
    aide: "meilleur -> améliorer: rendre meilleur",
    root: "meilleur, amélioration",
    derived: ["amélioration", "amélioré", "améliorable", "s'améliorer", "réaméliorer"],
    synonyms: ["perfectionner", "optimiser", "renforcer", "corriger", "faire progresser", "bonifier", "développer", "moderniser"],
    antonyms: ["aggraver", "détériorer", "dégrader", "empirer", "affaiblir", "abîmer"],
    associations: ["qualité", "résultats", "conditions", "performance", "service", "niveau", "situation", "efficacité"]
  },
  renforcer: {
    aide: "re- + force: rendre plus fort",
    root: "force, fort, renforcement",
    derived: ["renforcement", "force", "fortifier", "renforcé", "fort"],
    synonyms: ["consolider", "fortifier", "accroître", "augmenter", "intensifier", "soutenir", "muscler", "solidifier"],
    antonyms: ["affaiblir", "fragiliser", "diminuer", "réduire", "relâcher", "amoindrir"],
    associations: ["sécurité", "contrôle", "coopération", "compétences", "mesures", "protection", "confiance", "cohésion"]
  },
  réduire: {
    aide: "ré- 回向 + duc/duire 引导: ramener à une quantité plus faible",
    root: "duc(t), duire, duit",
    derived: ["réduction", "réducteur", "réductible", "irréductible", "réduit"],
    synonyms: ["diminuer", "baisser", "abaisser", "limiter", "restreindre", "amoindrir", "alléger", "atténuer", "minimiser", "rabaisser"],
    antonyms: ["augmenter", "accroître", "agrandir", "amplifier", "élargir", "hausser", "intensifier", "multiplier", "renforcer", "aggraver"],
    associations: ["diminuer", "limiter", "minimiser", "atténuer", "alléger", "abaisser", "éliminer", "optimiser", "compression", "restriction"]
  },
  favoriser: {
    aide: "faveur -> favoriser: rendre favorable",
    root: "faveur, favorable",
    derived: ["faveur", "favorable", "favorisé", "défavorisé", "favoritisme"],
    synonyms: ["encourager", "faciliter", "stimuler", "promouvoir", "soutenir", "avantager", "aider", "contribuer à"],
    antonyms: ["freiner", "empêcher", "entraver", "défavoriser", "bloquer", "limiter"],
    associations: ["accès", "égalité", "innovation", "échanges", "réussite", "participation", "intégration", "croissance"]
  },
  prévenir: {
    aide: "pré- avant + venir: agir avant qu'un problème arrive",
    root: "venir, prévention",
    derived: ["prévention", "préventif", "prévenu", "prévenance", "prévenir"],
    synonyms: ["éviter", "empêcher", "anticiper", "avertir", "alerter", "protéger", "limiter les risques", "devancer"],
    antonyms: ["provoquer", "aggraver", "laisser faire", "négliger", "exposer", "favoriser le risque"],
    associations: ["risque", "maladie", "accident", "campagne", "dépistage", "information", "alerte", "sécurité"]
  },
  limiter: {
    aide: "limite -> limiter: fixer une frontière",
    root: "limite, limitation",
    derived: ["limite", "limitation", "limité", "illimité", "délimiter"],
    synonyms: ["restreindre", "réduire", "borner", "encadrer", "freiner", "contenir", "modérer", "plafonner"],
    antonyms: ["élargir", "étendre", "augmenter", "libérer", "dépasser", "amplifier"],
    associations: ["seuil", "règle", "cadre", "contrôle", "restriction", "plafond", "frontière", "mesure"]
  },
  encourager: {
    aide: "courage -> encourager: donner du courage",
    root: "courage, encouragement",
    derived: ["encouragement", "courage", "encourageant", "décourager", "courageux"],
    synonyms: ["inciter", "motiver", "stimuler", "soutenir", "favoriser", "pousser à", "promouvoir", "aider"],
    antonyms: ["décourager", "freiner", "dissuader", "empêcher", "bloquer", "affaiblir"],
    associations: ["motivation", "soutien", "initiative", "participation", "effort", "réussite", "confiance", "engagement"]
  },
  développer: {
    aide: "dé- + envelopper: déplier, faire croître",
    root: "développement, développer",
    derived: ["développement", "développé", "développeur", "développable", "codéveloppement"],
    synonyms: ["faire croître", "étendre", "élargir", "approfondir", "renforcer", "promouvoir", "créer", "faire progresser"],
    antonyms: ["réduire", "freiner", "bloquer", "limiter", "restreindre", "affaiblir"],
    associations: ["projet", "compétences", "économie", "territoire", "innovation", "stratégie", "croissance", "formation"]
  },
  protéger: {
    aide: "pro- en avant + teger/couvrir: mettre à l'abri",
    root: "protection, protecteur",
    derived: ["protection", "protecteur", "protégé", "surprotéger", "déprotéger"],
    synonyms: ["préserver", "sauvegarder", "défendre", "mettre à l'abri", "sécuriser", "garantir", "conserver", "abriter"],
    antonyms: ["menacer", "exposer", "fragiliser", "détruire", "abandonner", "mettre en danger"],
    associations: ["sécurité", "droits", "données", "santé", "environnement", "biodiversité", "prévention", "garantie"]
  },
  garantir: {
    aide: "garant -> garantir: assurer par une garantie",
    root: "garant, garantie",
    derived: ["garantie", "garant", "garanti", "garantir", "garantissable"],
    synonyms: ["assurer", "protéger", "certifier", "promettre", "sécuriser", "préserver", "rendre certain", "couvrir"],
    antonyms: ["menacer", "compromettre", "fragiliser", "mettre en doute", "exposer", "retirer"],
    associations: ["droit", "sécurité", "qualité", "accès", "liberté", "égalité", "protection", "preuve"]
  },
  souligner: {
    aide: "ligne -> souligner: tracer sous une ligne, puis insister",
    root: "ligne, soulignement",
    derived: ["soulignement", "ligne", "souligné", "surligner", "interligne"],
    synonyms: ["mettre en évidence", "insister sur", "relever", "noter", "signaler", "faire ressortir", "accentuer", "rappeler"],
    antonyms: ["minimiser", "passer sous silence", "négliger", "ignorer", "effacer", "dissimuler"],
    associations: ["importance", "argument", "rapport", "constat", "preuve", "enjeu", "point clé", "exemple"]
  },
  évaluer: {
    aide: "valeur -> évaluer: déterminer une valeur",
    root: "valeur, évaluation",
    derived: ["évaluation", "valeur", "évaluateur", "évaluable", "réévaluer"],
    synonyms: ["estimer", "mesurer", "apprécier", "juger", "examiner", "analyser", "noter", "calculer"],
    antonyms: ["ignorer", "négliger", "sous-estimer", "surestimer", "deviner", "improviser"],
    associations: ["critères", "résultats", "impact", "coût", "niveau", "performance", "indicateur", "bilan"]
  },
  transformer: {
    aide: "trans- à travers + forme: changer de forme",
    root: "forme, transformation",
    derived: ["transformation", "forme", "transformé", "transformateur", "métamorphose"],
    synonyms: ["changer", "modifier", "convertir", "métamorphoser", "réformer", "faire évoluer", "adapter", "renouveler"],
    antonyms: ["conserver", "maintenir", "figer", "préserver intact", "stabiliser", "immobiliser"],
    associations: ["changement", "mutation", "transition", "innovation", "réforme", "adaptation", "évolution", "modernisation"]
  },
  augmenter: {
    aide: "augment- 增大",
    root: "augmentation, augmentatif",
    derived: ["augmentation", "augmentatif", "augmenté", "hausse", "suraugmentation"],
    synonyms: ["accroître", "hausser", "élever", "amplifier", "intensifier", "multiplier", "grossir", "renforcer"],
    antonyms: ["diminuer", "réduire", "baisser", "abaisser", "amoindrir", "alléger"],
    associations: ["hausse", "croissance", "prix", "niveau", "volume", "revenu", "coût", "demande"]
  },
  diminuer: {
    aide: "minus/minor 小 -> diminuer: rendre plus petit",
    root: "diminution, mineur",
    derived: ["diminution", "diminué", "diminutif", "amoindrissement", "mineur"],
    synonyms: ["réduire", "baisser", "amoindrir", "alléger", "atténuer", "rabaisser", "décroître", "affaiblir"],
    antonyms: ["augmenter", "accroître", "hausser", "amplifier", "intensifier", "agrandir"],
    associations: ["baisse", "recul", "réduction", "déclin", "moins", "niveau", "quantité", "pourcentage"]
  },
  baisser: {
    aide: "bas -> baisser: aller vers le bas",
    root: "bas, baisse",
    derived: ["baisse", "abaissé", "rabaisser", "abaissement", "bas"],
    synonyms: ["diminuer", "réduire", "descendre", "abaisser", "chuter", "reculer", "fléchir", "décroître"],
    antonyms: ["augmenter", "monter", "hausser", "accroître", "s'élever", "progresser"],
    associations: ["prix", "taux", "niveau", "température", "chômage", "demande", "courbe", "recul"]
  },
  accroître: {
    aide: "croître -> accroître: faire croître",
    root: "croissance, accroissement",
    derived: ["accroissement", "croissance", "croître", "accru", "croissant"],
    synonyms: ["augmenter", "renforcer", "amplifier", "développer", "intensifier", "élargir", "multiplier", "grossir"],
    antonyms: ["réduire", "diminuer", "baisser", "amoindrir", "restreindre", "affaiblir"],
    associations: ["croissance", "hausse", "expansion", "volume", "risque", "demande", "production", "inégalités"]
  }
};

const RELATION_PATTERNS = [
  {
    terms: ["mettre en evidence", "souligner", "constater", "affirmer", "nuancer", "contester", "argument", "these"],
    synonyms: ["montrer", "faire ressortir", "insister sur", "signaler", "démontrer", "relever", "mettre en lumière"],
    antonyms: ["dissimuler", "minimiser", "passer sous silence", "nier", "ignorer", "effacer", "éluder"],
    associations: ["argument", "preuve", "exemple", "constat", "idée principale", "démonstration", "débat"]
  },
  {
    terms: ["remettre en question", "questionner", "douter", "critique"],
    synonyms: ["questionner", "contester", "réexaminer", "mettre en doute", "interroger", "critiquer", "reconsidérer"],
    antonyms: ["accepter", "approuver", "confirmer", "valider", "croire sans réserve", "admettre", "maintenir"],
    associations: ["doute", "certitude", "preuve", "débat", "remise en cause", "esprit critique", "objection"]
  },
  {
    terms: ["en revanche", "toutefois", "neanmoins", "bien que", "pourtant", "cependant"],
    synonyms: ["cependant", "pourtant", "néanmoins", "mais", "à l'inverse", "en contrepartie", "malgré cela"],
    antonyms: ["de même", "également", "dans le même sens", "parallèlement", "ainsi", "en continuité", "sans opposition"],
    associations: ["opposition", "concession", "contraste", "nuance", "argument", "réserve", "transition"]
  },
  {
    terms: ["par consequent", "donc", "ainsi", "aboutir a", "entrainer", "susciter"],
    synonyms: ["donc", "ainsi", "de ce fait", "il en résulte que", "provoquer", "causer", "produire"],
    antonyms: ["sans conséquence", "indépendamment", "malgré cela", "sans effet", "sans lien", "par hasard", "en amont"],
    associations: ["cause", "effet", "résultat", "conséquence", "enchaînement", "impact", "raisonnement"]
  },
  {
    terms: ["a cause de", "grace a", "faute de", "afin de", "a condition que", "selon", "d'apres", "en effet", "quant a", "voire", "d'ailleurs"],
    synonyms: ["en raison de", "du fait de", "dans le but de", "à partir de", "d'après", "effectivement", "en outre"],
    antonyms: ["sans raison", "malgré", "indépendamment de", "contre toute attente", "sans objectif", "hors de propos", "sans source"],
    associations: ["cause", "but", "condition", "source", "précision", "référence", "enchaînement logique"]
  },
  {
    terms: ["prendre en compte", "avoir recours", "faire face", "etre confronte", "mettre en place", "encadrer", "interdire", "autoriser", "inciter"],
    synonyms: ["considérer", "utiliser", "affronter", "instaurer", "réglementer", "permettre", "encourager"],
    antonyms: ["négliger", "éviter", "subir passivement", "supprimer", "laisser sans règle", "interdire", "décourager"],
    associations: ["mesure", "solution", "problème", "règle", "politique publique", "action", "responsabilité"]
  },
  {
    terms: ["sensibiliser", "lutter contre", "s'adapter", "s'engager", "s'integrer", "s'informer", "s'epanouir"],
    synonyms: ["informer", "mobiliser", "combattre", "s'ajuster", "participer", "s'insérer", "se réaliser"],
    antonyms: ["ignorer", "renoncer", "subir", "rester passif", "s'exclure", "se désintéresser", "se replier"],
    associations: ["campagne", "engagement", "adaptation", "participation", "intégration", "information", "bien-être"]
  },
  {
    terms: ["demarche", "constat"],
    synonyms: ["avantage", "force", "ressource", "obstacle", "limite", "procédure", "observation"],
    antonyms: ["faiblesse", "handicap", "désavantage", "liberté totale", "absence de limite", "improvisation", "déni"],
    associations: ["argument", "situation", "choix", "décision", "analyse", "objectif", "solution"]
  },
  {
    terms: ["atout"],
    synonyms: ["avantage", "force", "ressource", "qualité", "point fort", "bénéfice", "levier"],
    antonyms: ["faiblesse", "handicap", "désavantage", "limite", "point faible", "obstacle", "inconvénient"],
    associations: ["compétence", "opportunité", "argument", "profil", "réussite", "valeur ajoutée", "stratégie"]
  },
  {
    terms: ["contrainte"],
    synonyms: ["obligation", "restriction", "limite", "pression", "exigence", "condition imposée", "entrave"],
    antonyms: ["liberté", "souplesse", "possibilité", "choix", "autonomie", "marge de manœuvre", "facilité"],
    associations: ["règle", "cadre", "délai", "budget", "pression", "adaptation", "négociation"]
  },
  {
    terms: ["gaspiller", "gaspillage"],
    synonyms: ["dilapider", "perdre inutilement", "consommer sans mesure", "jeter", "surexploiter", "dépenser à tort", "mal utiliser"],
    antonyms: ["économiser", "préserver", "réutiliser", "recycler", "optimiser", "ménager", "valoriser"],
    associations: ["déchets", "surconsommation", "ressources", "nourriture", "énergie", "eau", "sobriété"]
  },
  {
    terms: ["trier", "tri selectif"],
    synonyms: ["classer", "séparer", "sélectionner", "répartir", "organiser", "mettre de côté", "distinguer"],
    antonyms: ["mélanger", "confondre", "jeter ensemble", "désorganiser", "négliger le tri", "polluer", "éparpiller"],
    associations: ["bac jaune", "déchets", "recyclage", "emballages", "verre", "papier", "collecte"]
  },
  {
    terms: ["bien-etre", "bien etre"],
    synonyms: ["épanouissement", "équilibre", "confort", "santé globale", "qualité de vie", "sérénité", "mieux-être"],
    antonyms: ["mal-être", "souffrance", "stress", "inconfort", "épuisement", "angoisse", "déséquilibre"],
    associations: ["santé mentale", "sommeil", "activité physique", "repos", "relations sociales", "prévention", "hygiène de vie"]
  },
  {
    terms: ["vivre-ensemble", "vivre ensemble"],
    synonyms: ["cohabitation harmonieuse", "cohésion sociale", "convivialité", "respect mutuel", "vie commune", "lien social", "solidarité"],
    antonyms: ["division", "exclusion", "communautarisme fermé", "isolement", "conflit social", "intolérance", "fragmentation"],
    associations: ["quartier", "citoyenneté", "respect", "tolérance", "mixité", "solidarité", "règles communes"]
  },
  {
    terms: ["comportement", "habitude"],
    synonyms: ["conduite", "attitude", "pratique", "réflexe", "usage", "routine", "manière d'agir"],
    antonyms: ["exception", "rupture", "changement soudain", "inconstance", "improvisation", "abandon d'usage", "contre-habitude"],
    associations: ["routine", "choix", "prévention", "mode de vie", "consommation", "éducation", "santé"]
  },
  {
    terms: ["deserts medicaux", "desert medical", "penurie de medecins"],
    synonyms: ["zone sous-dotée", "manque de médecins", "territoire sans soins", "déficit médical", "inégalité d'accès aux soins", "pénurie médicale", "isolement sanitaire"],
    antonyms: ["offre de soins abondante", "accès facile aux soins", "maillage médical", "proximité médicale", "présence de spécialistes", "service accessible", "couverture sanitaire"],
    associations: ["médecin généraliste", "rendez-vous", "ruralité", "hôpital", "télémédecine", "patient", "urgence"]
  },
  {
    terms: ["condition de travail", "vie active"],
    synonyms: ["stabilité professionnelle", "cohésion d'équipe", "autonomie", "organisation", "phase d'évaluation", "fin de carrière", "pension"],
    antonyms: ["instabilité professionnelle", "individualisme", "passivité", "désorganisation", "embauche définitive", "activité professionnelle", "entrée dans la vie active"],
    associations: ["contrat", "collègues", "responsabilité", "planning", "employeur", "salarié", "cotisations"]
  },
  {
    terms: ["securite de l'emploi"],
    synonyms: ["stabilité de l'emploi", "emploi protégé", "poste stable", "garantie professionnelle", "sécurité professionnelle", "emploi durable", "protection du poste"],
    antonyms: ["précarité", "instabilité", "licenciement", "contrat court", "insécurité professionnelle", "chômage", "emploi fragile"],
    associations: ["CDI", "contrat", "ancienneté", "licenciement", "salarié", "revenu stable", "protection sociale"]
  },
  {
    terms: ["esprit d'equipe"],
    synonyms: ["solidarité collective", "coopération", "cohésion", "entraide", "collaboration", "sens du collectif", "travail en équipe"],
    antonyms: ["individualisme", "rivalité", "isolement", "conflit", "désunion", "chacun pour soi", "compétition interne"],
    associations: ["collègues", "projet", "communication", "confiance", "groupe", "objectif commun", "management"]
  },
  {
    terms: ["prise d'initiative"],
    synonyms: ["initiative personnelle", "autonomie", "proactivité", "capacité d'agir", "responsabilité", "élan personnel", "force de proposition"],
    antonyms: ["passivité", "attentisme", "obéissance passive", "dépendance", "absence d'initiative", "inaction", "conformisme"],
    associations: ["responsabilité", "créativité", "décision", "risque", "projet", "autonomie", "leadership"]
  },
  {
    terms: ["gestion du temps"],
    synonyms: ["organisation du temps", "planification", "priorisation", "emploi du temps maîtrisé", "répartition des tâches", "discipline horaire", "productivité"],
    antonyms: ["désorganisation", "retard", "procrastination", "improvisation", "perte de temps", "dispersion", "surcharge"],
    associations: ["agenda", "priorités", "délai", "planning", "efficacité", "pause", "rythme de travail"]
  },
  {
    terms: ["periode d'essai"],
    synonyms: ["phase d'essai", "période probatoire", "temps d'évaluation", "début de contrat", "phase d'adaptation", "test professionnel", "essai contractuel"],
    antonyms: ["embauche confirmée", "contrat définitif", "titularisation", "poste confirmé", "fin d'essai", "stabilité", "ancienneté"],
    associations: ["contrat", "employeur", "salarié", "rupture", "évaluation", "adaptation", "embauche"]
  },
  {
    terms: ["retraite"],
    synonyms: ["fin de carrière", "pension", "cessation d'activité", "vie après le travail", "départ à la retraite", "inactivité professionnelle", "pension de retraite"],
    antonyms: ["activité professionnelle", "emploi", "entrée dans la vie active", "début de carrière", "travail salarié", "embauche", "vie active"],
    associations: ["cotisations", "âge légal", "pension", "carrière", "réforme", "senior", "système social"]
  },
  {
    terms: ["risque environnemental", "ressource fragile"],
    synonyms: ["élévation du niveau marin", "destruction des forêts", "sobriété hydrique", "préservation de l'eau", "érosion côtière", "coupe forestière", "réduction de consommation d'eau"],
    antonyms: ["stabilité du niveau marin", "reforestation", "gaspillage d'eau", "protection des forêts", "reboisement", "abondance hydrique", "surexploitation de l'eau"],
    associations: ["climat", "littoral", "forêt", "bassin versant", "sécheresse", "biodiversité", "ressource en eau"]
  },
  {
    terms: ["montee des eaux"],
    synonyms: ["élévation du niveau marin", "hausse du niveau de la mer", "submersion", "érosion côtière", "inondation littorale", "recul du trait de côte", "risque côtier"],
    antonyms: ["stabilité du niveau marin", "recul des eaux", "protection du littoral", "sécurité côtière", "assèchement", "baisse du niveau", "absence de submersion"],
    associations: ["littoral", "îles", "inondation", "climat", "glaciers", "océan", "adaptation"]
  },
  {
    terms: ["deforestation"],
    synonyms: ["destruction des forêts", "coupe forestière", "déboisement", "perte de couvert forestier", "exploitation forestière excessive", "rasage des forêts", "recul forestier"],
    antonyms: ["reforestation", "boisement", "protection des forêts", "préservation forestière", "gestion durable", "reboisement", "forêt protégée"],
    associations: ["Amazonie", "arbres", "biodiversité", "sols", "carbone", "habitat", "agriculture intensive"]
  },
  {
    terms: ["economie d'eau"],
    synonyms: ["sobriété hydrique", "réduction de consommation d'eau", "préservation de l'eau", "usage raisonné de l'eau", "gestion économe", "anti-gaspillage d'eau", "maîtrise de la consommation"],
    antonyms: ["gaspillage d'eau", "surconsommation d'eau", "surexploitation", "fuite d'eau", "usage excessif", "dilapidation", "négligence"],
    associations: ["sécheresse", "robinet", "arrosage", "ressource en eau", "facture", "réutilisation", "sobriété"]
  },
  {
    terms: ["relation enseignant-eleve", "relation enseignant eleve"],
    synonyms: ["lien pédagogique", "rapport professeur-élève", "interaction éducative", "accompagnement", "relation de confiance", "suivi scolaire", "dialogue pédagogique"],
    antonyms: ["distance pédagogique", "conflit", "absence de dialogue", "méfiance", "rupture éducative", "indifférence", "autoritarisme"],
    associations: ["classe", "écoute", "feedback", "motivation", "respect", "apprentissage", "autorité"]
  },
  {
    terms: ["racisme"],
    synonyms: ["discrimination raciale", "xénophobie", "préjugé racial", "haine raciale", "stigmatisation", "intolérance", "ségrégation"],
    antonyms: ["antiracisme", "égalité", "tolérance", "respect", "inclusion", "diversité", "non-discrimination"],
    associations: ["origine", "couleur de peau", "plainte", "droits humains", "égalité", "préjugé", "justice"]
  },
  {
    terms: ["diplomatie"],
    synonyms: ["relations diplomatiques", "négociation internationale", "dialogue entre États", "médiation", "politique étrangère", "concertation", "coopération officielle"],
    antonyms: ["rupture diplomatique", "conflit armé", "isolement", "hostilité", "ultimatum", "guerre", "absence de dialogue"],
    associations: ["ambassade", "traité", "négociation", "ONU", "accord", "frontières", "chef d'État"]
  },
  {
    terms: ["durable", "transition ecologique", "developpement durable", "responsabilite environnementale", "economie circulaire", "gaspillage", "gaspiller", "trier"],
    synonyms: ["soutenable", "responsable", "écologique", "pérenne", "sobre", "réutiliser", "valoriser"],
    antonyms: ["jetable", "polluant", "irresponsable", "éphémère", "gaspilleur", "épuisement", "surexploitation"],
    associations: ["ressources", "recyclage", "tri", "cycle de vie", "empreinte carbone", "économie circulaire", "long terme"]
  },
  {
    terms: ["innovation", "progres technique", "mise a jour", "realite virtuelle", "realite augmentee", "paiement sans contact", "tracabilite", "biais algorithmique"],
    synonyms: ["nouveauté", "invention", "avancée technique", "modernisation", "amélioration technologique", "dispositif innovant", "solution nouvelle"],
    antonyms: ["routine", "immobilisme", "retard technique", "obsolescence", "archaïsme", "panne", "régression"],
    associations: ["recherche", "prototype", "algorithme", "données", "interface", "mise à jour", "utilisateur"]
  },
  {
    terms: ["telemedecine", "telesante", "mutuelle", "dossier medical", "douleur chronique", "vieillissement", "penurie de medecins", "fatigue"],
    synonyms: ["consultation à distance", "suivi médical", "assurance complémentaire", "dossier patient", "maladie chronique", "âge avancé", "manque de médecins"],
    antonyms: ["consultation en présence", "absence de suivi", "bonne santé", "jeunesse", "abondance médicale", "forme", "récupération"],
    associations: ["patient", "médecin", "ordonnance", "remboursement", "diagnostic", "traitement", "désert médical"]
  },
  {
    terms: ["reforme pedagogique", "examen final", "memorisation", "prise de parole", "frais d'inscription", "selection a l'universite", "relation enseignant eleve", "discipline", "curiosite intellectuelle", "confiance en soi"],
    synonyms: ["changement éducatif", "épreuve finale", "apprentissage par cœur", "expression orale", "coût des études", "admission sélective", "lien pédagogique", "rigueur", "envie d'apprendre"],
    antonyms: ["immobilisme scolaire", "contrôle continu", "oubli", "silence", "gratuité", "accès ouvert", "distance pédagogique", "indiscipline", "désintérêt"],
    associations: ["classe", "professeur", "étudiant", "université", "oral", "règle", "motivation"]
  },
  {
    terms: ["traitement de l'information", "verification des faits", "couverture mediatique", "debat public", "polarisation", "temps d'ecran", "attention du public", "titre accrocheur", "sensationnalisme", "publicite ciblee", "influenceur", "recommandation automatique", "moderation des contenus", "moderation", "bulle de filtres", "viralite"],
    synonyms: ["analyse de l'information", "fact-checking", "médiatisation", "discussion collective", "division de l'opinion", "exposition aux écrans", "audience", "titre attractif", "dramatisation", "ciblage publicitaire"],
    antonyms: ["désintérêt médiatique", "information non vérifiée", "silence médiatique", "consensus", "déconnexion", "discrétion", "sobriété éditoriale", "publicité non ciblée", "pluralisme", "modération absente"],
    associations: ["article", "réseau social", "algorithme", "audience", "source", "journaliste", "opinion"]
  },
  {
    terms: ["vivre ensemble", "participation citoyenne", "segregation urbaine", "solitude", "dignite humaine", "racisme", "manifestation", "manifester"],
    synonyms: ["cohabitation sociale", "engagement civique", "séparation urbaine", "isolement", "respect de la personne", "discrimination raciale", "mobilisation"],
    antonyms: ["fragmentation sociale", "passivité citoyenne", "mixité urbaine", "lien social", "humiliation", "antiracisme", "calme social"],
    associations: ["quartier", "citoyen", "égalité", "droits humains", "association", "manifestants", "justice"]
  },
  {
    terms: ["chaine d'approvisionnement", "ouverture economique", "fermeture des frontieres", "diplomatie", "conflit commercial", "taxe douaniere", "relocalisation", "specialisation economique"],
    synonyms: ["supply chain", "libéralisation", "contrôle des frontières", "relations internationales", "guerre commerciale", "droits de douane", "retour de production", "avantage comparatif"],
    antonyms: ["rupture logistique", "protectionnisme", "ouverture des frontières", "isolement diplomatique", "accord commercial", "libre-échange", "délocalisation", "diversification économique"],
    associations: ["importation", "exportation", "frontière", "accord", "entreprise", "production", "marché mondial"]
  },
  {
    terms: ["fracture numerique", "exclusion numerique", "dependance numerique", "obsolescence programmee"],
    synonyms: ["exclusion numérique", "inégalité d'accès", "dépendance aux écrans", "risque informatique", "vulnérabilité numérique", "retard technologique", "usure programmée"],
    antonyms: ["inclusion numérique", "autonomie numérique", "sobriété numérique", "accès équitable", "réparation", "sécurité renforcée", "maîtrise des usages"],
    associations: ["accès internet", "équipement", "piratage", "mise à jour", "réparation", "écran", "mot de passe"]
  },
  {
    terms: ["mobilite sociale", "ascension sociale", "reproduction sociale"],
    synonyms: ["ascension sociale", "changement de statut", "promotion sociale", "progression sociale", "trajectoire sociale", "élévation sociale", "circulation sociale"],
    antonyms: ["immobilité sociale", "reproduction sociale", "déclassement", "blocage social", "assignation sociale", "inégalité héritée", "plafond social"],
    associations: ["origine sociale", "diplôme", "revenu", "emploi", "mérite", "inégalités", "opportunités"]
  },
  {
    terms: ["pollution", "atmospherique", "sonore", "air", "eau"],
    synonyms: ["contamination", "nuisance", "dégradation", "rejet", "émission", "salissure", "altération"],
    antonyms: ["dépollution", "assainissement", "pureté", "propreté", "préservation", "air sain", "milieu intact"],
    associations: ["particules fines", "gaz toxiques", "qualité de l'air", "eaux usées", "bruit", "santé publique", "émissions"]
  },
  {
    terms: ["recyclage", "recycler", "tri", "dechets", "dechet", "selectif"],
    synonyms: ["réutilisation", "valorisation", "récupération", "tri", "transformation", "réemploi", "collecte sélective"],
    antonyms: ["gaspillage", "mise en décharge", "rejet", "incinération", "usage unique", "abandon", "surconsommation"],
    associations: ["bac de tri", "emballages", "matières premières", "compost", "collecte", "plastique", "papier"]
  },
  {
    terms: ["sobriete", "energetique", "energie", "energies", "renouvelables", "renovation"],
    synonyms: ["économies d'énergie", "efficacité énergétique", "frugalité", "modération", "réduction de consommation", "transition énergétique", "maîtrise de l'énergie"],
    antonyms: ["gaspillage énergétique", "surconsommation", "dilapidation", "inefficacité", "excès", "dépendance fossile", "passoire thermique"],
    associations: ["chauffage", "isolation", "éclairage", "électricité", "panneaux solaires", "éoliennes", "consommation"]
  },
  {
    terms: ["consommation", "responsable", "achat", "menage", "pouvoir", "inflation"],
    synonyms: ["achat durable", "consommation éthique", "choix raisonné", "sobriété", "commerce équitable", "achat responsable", "consommation consciente"],
    antonyms: ["surconsommation", "achat impulsif", "gaspillage", "consumérisme", "obsolescence", "dépense excessive", "produit jetable"],
    associations: ["label", "origine", "prix", "budget", "réparation", "durabilité", "impact environnemental"]
  },
  {
    terms: ["agriculture", "biologique", "bio", "circuits", "courts", "alimentaire", "alimentation"],
    synonyms: ["agriculture bio", "production biologique", "agroécologie", "culture écologique", "agriculture durable", "culture sans pesticides", "production locale"],
    antonyms: ["agriculture intensive", "agriculture conventionnelle", "monoculture", "pesticides", "culture industrielle", "engrais chimiques", "production standardisée"],
    associations: ["sols", "label bio", "producteurs locaux", "saisonnalité", "biodiversité", "ferme", "aliments"]
  },
  {
    terms: ["climat", "climatique", "rechauffement", "canicule", "secheresse", "inondation", "carbone", "empreinte"],
    synonyms: ["dérèglement climatique", "changement climatique", "réchauffement global", "crise climatique", "émissions de CO2", "impact carbone", "aléa climatique"],
    antonyms: ["stabilité climatique", "neutralité carbone", "atténuation", "adaptation réussie", "résilience", "captation du carbone", "climat tempéré"],
    associations: ["gaz à effet de serre", "température", "sécheresse", "inondations", "canicule", "empreinte carbone", "accord de Paris"]
  },
  {
    terms: ["biodiversite", "especes", "nature", "foret", "espaces", "verts", "ressource", "naturelle"],
    synonyms: ["diversité du vivant", "richesse écologique", "variété des espèces", "patrimoine naturel", "écosystèmes", "faune et flore", "capital naturel"],
    antonyms: ["appauvrissement du vivant", "extinction", "disparition des espèces", "déforestation", "artificialisation", "monoculture", "érosion de la biodiversité"],
    associations: ["habitat", "espèce protégée", "écosystème", "forêt", "zones humides", "pollinisateurs", "réserve naturelle"]
  },
  {
    terms: ["mobilite", "transports", "transport", "voiture", "publics", "douce", "circulation"],
    synonyms: ["déplacement", "transport collectif", "mobilité durable", "trajet", "circulation", "accessibilité", "déplacement quotidien"],
    antonyms: ["immobilité", "enclavement", "embouteillage", "dépendance automobile", "sédentarité", "isolement", "blocage"],
    associations: ["vélo", "bus", "train", "covoiturage", "piste cyclable", "trajet domicile-travail", "émissions"]
  },
  {
    terms: ["travail", "emploi", "professionnel", "professionnelle", "carriere", "metier", "marche"],
    synonyms: ["activité professionnelle", "poste", "métier", "vie professionnelle", "parcours professionnel", "fonction", "occupation"],
    antonyms: ["chômage", "inactivité", "perte d'emploi", "exclusion professionnelle", "oisiveté", "absence de poste", "retraite"],
    associations: ["contrat", "salaire", "entreprise", "collègue", "recrutement", "compétences", "conditions de travail"]
  },
  {
    terms: ["teletravail", "distance", "ligne", "plateforme", "application"],
    synonyms: ["travail à distance", "travail en ligne", "activité à domicile", "téléactivité", "travail hybride", "bureau virtuel", "visioconférence"],
    antonyms: ["présentiel", "travail sur site", "bureau traditionnel", "déplacement quotidien", "réunion physique", "contact direct", "site de l'entreprise"],
    associations: ["visioconférence", "connexion", "ordinateur", "autonomie", "isolement", "flexibilité", "horaires"]
  },
  {
    terms: ["precarite", "precaire", "contrat", "independant", "salaire", "salariale", "pouvoir"],
    synonyms: ["instabilité", "fragilité sociale", "insécurité économique", "vulnérabilité", "emploi instable", "revenu incertain", "situation fragile"],
    antonyms: ["stabilité", "sécurité de l'emploi", "contrat durable", "protection sociale", "revenu stable", "emploi permanent", "sécurité matérielle"],
    associations: ["CDD", "temps partiel", "bas salaire", "aides sociales", "loyer", "pouvoir d'achat", "risque social"]
  },
  {
    terms: ["chomage", "recherche", "embauche", "recrutement", "entretien", "essai"],
    synonyms: ["absence d'emploi", "sans-emploi", "inactivité forcée", "demande d'emploi", "perte de poste", "non-emploi", "sous-emploi"],
    antonyms: ["emploi", "activité", "embauche", "recrutement", "poste stable", "plein emploi", "insertion professionnelle"],
    associations: ["CV", "entretien", "offre d'emploi", "formation", "allocation", "marché du travail", "candidature"]
  },
  {
    terms: ["competence", "competences", "formation", "reconversion", "continue", "initiale", "apprentissage"],
    synonyms: ["savoir-faire", "aptitude", "qualification", "capacité", "expertise", "maîtrise", "habileté"],
    antonyms: ["incompétence", "lacune", "manque de qualification", "insuffisance", "déqualification", "ignorance", "maladresse"],
    associations: ["diplôme", "stage", "certification", "expérience", "formation continue", "reconversion", "employabilité"]
  },
  {
    terms: ["burn-out", "epuisement", "stress", "charge", "qualite de vie", "equilibre"],
    synonyms: ["épuisement professionnel", "surmenage", "fatigue extrême", "surcharge mentale", "usure professionnelle", "pression excessive", "détresse au travail"],
    antonyms: ["bien-être au travail", "équilibre", "repos", "récupération", "prévention", "sérénité", "charge raisonnable"],
    associations: ["pression", "horaires", "arrêt maladie", "management", "repos", "santé mentale", "prévention"]
  },
  {
    terms: ["entreprise", "management", "hierarchie", "equipe", "syndicat", "greve", "productivite"],
    synonyms: ["organisation", "société", "structure", "employeur", "groupe de travail", "direction", "collectif professionnel"],
    antonyms: ["travail indépendant", "désorganisation", "isolement", "absence de direction", "conflit social", "blocage", "désengagement"],
    associations: ["salariés", "hiérarchie", "négociation", "syndicat", "grève", "objectifs", "productivité"]
  },
  {
    terms: ["numerique", "technologie", "informatique", "logiciel", "reseau", "internet", "digital"],
    synonyms: ["technologique", "informatique", "digital", "connecté", "en ligne", "dématérialisé", "virtuel"],
    antonyms: ["analogique", "papier", "manuel", "hors ligne", "présentiel", "traditionnel", "non connecté"],
    associations: ["ordinateur", "smartphone", "plateforme", "réseau", "logiciel", "données", "connexion"]
  },
  {
    terms: ["donnees", "personnelles", "privee", "consentement", "collecte", "protection des donnees"],
    synonyms: ["informations personnelles", "données privées", "traces numériques", "renseignements sensibles", "vie privée", "identité numérique", "confidentialité"],
    antonyms: ["exposition des données", "fuite de données", "surveillance", "profilage abusif", "intrusion", "divulgation", "piratage"],
    associations: ["RGPD", "consentement", "confidentialité", "mot de passe", "cookies", "cybersécurité", "plateforme"]
  },
  {
    terms: ["intelligence artificielle", "algorithme", "automatisation", "robotisation", "reconnaissance", "faciale"],
    synonyms: ["IA", "système automatisé", "modèle prédictif", "apprentissage automatique", "traitement algorithmique", "machine intelligente", "automate"],
    antonyms: ["décision humaine", "travail manuel", "jugement personnel", "artisanat", "intervention humaine", "improvisation", "non-automatisation"],
    associations: ["données", "biais", "machine learning", "robot", "reconnaissance faciale", "automatisation", "éthique"]
  },
  {
    terms: ["fracture", "obsolescence", "cybersecurite", "securite informatique"],
    synonyms: ["faille", "rupture", "vulnérabilité", "risque informatique", "menace numérique", "panne", "insécurité"],
    antonyms: ["continuité", "sécurité", "protection", "fiabilité", "résilience", "mise à jour", "maintenance"],
    associations: ["piratage", "mot de passe", "logiciel", "mise à jour", "réparation", "réseau", "données"]
  },
  {
    terms: ["education", "scolaire", "eleves", "enseignement", "classe", "pedagogie"],
    synonyms: ["enseignement", "instruction", "apprentissage", "scolarité", "formation", "transmission", "éducation scolaire"],
    antonyms: ["ignorance", "échec scolaire", "décrochage", "déscolarisation", "illettrisme", "absence de formation", "exclusion scolaire"],
    associations: ["élève", "professeur", "classe", "devoirs", "examen", "programme", "évaluation"]
  },
  {
    terms: ["reussite", "echec", "decrochage", "orientation", "soutien", "devoirs"],
    synonyms: ["succès scolaire", "progression", "réussite éducative", "accompagnement", "orientation", "persévérance", "soutien pédagogique"],
    antonyms: ["échec", "abandon scolaire", "décrochage", "retard", "désorientation", "démotivation", "exclusion"],
    associations: ["notes", "examen", "motivation", "famille", "professeur", "aide aux devoirs", "parcours"]
  },
  {
    terms: ["esprit critique", "critique", "lecture", "culture generale", "expression", "orale", "ecrite"],
    synonyms: ["jugement critique", "discernement", "analyse", "réflexion personnelle", "argumentation", "prise de recul", "raisonnement"],
    antonyms: ["crédulité", "conformisme", "naïveté", "passivité", "acceptation aveugle", "absence de recul", "dogmatisme"],
    associations: ["source", "argument", "preuve", "débat", "lecture", "opinion", "nuance"]
  },
  {
    terms: ["egalite des chances", "inclusion", "autonomie", "motivation", "eleves"],
    synonyms: ["équité scolaire", "accès équitable", "justice éducative", "inclusion scolaire", "opportunités égales", "soutien individualisé", "émancipation"],
    antonyms: ["sélection sociale", "inégalité scolaire", "exclusion", "discrimination", "reproduction sociale", "barrière sociale", "découragement"],
    associations: ["bourse", "handicap", "origine sociale", "orientation", "soutien", "réussite", "parcours"]
  },
  {
    terms: ["sante", "soins", "medecine", "hopital", "urgences", "specialiste", "generaliste"],
    synonyms: ["état de santé", "bien-être physique", "prise en charge", "système médical", "soins médicaux", "condition physique", "suivi médical"],
    antonyms: ["maladie", "souffrance", "dégradation de la santé", "absence de soins", "renoncement aux soins", "urgence sanitaire", "mauvaise santé"],
    associations: ["médecin", "hôpital", "traitement", "prévention", "consultation", "remboursement", "patient"]
  },
  {
    terms: ["prevention", "depistage", "vaccination", "hygiene", "vie"],
    synonyms: ["mesure préventive", "anticipation", "protection sanitaire", "réduction des risques", "dépistage", "sensibilisation", "vaccination"],
    antonyms: ["négligence", "exposition au risque", "laisser-faire", "retard de diagnostic", "imprudence", "aggravation", "absence de prévention"],
    associations: ["campagne", "vaccin", "dépistage", "risque", "médecin", "information", "habitudes"]
  },
  {
    terms: ["mental", "mentale", "anxiete", "depression", "sommeil", "sedentarite", "activite physique"],
    synonyms: ["bien-être psychologique", "équilibre mental", "santé psychique", "forme physique", "activité régulière", "repos", "stabilité émotionnelle"],
    antonyms: ["mal-être", "anxiété", "dépression", "sédentarité", "insomnie", "épuisement", "isolement"],
    associations: ["stress", "sommeil", "sport", "psychologue", "fatigue", "routine", "soutien"]
  },
  {
    terms: ["tabac", "alcool", "sucre", "alimentation", "dependance"],
    synonyms: ["addiction", "consommation excessive", "habitude nocive", "usage problématique", "excès", "comportement à risque", "dépendance"],
    antonyms: ["sevrage", "modération", "sobriété", "alimentation équilibrée", "prévention", "maîtrise", "hygiène de vie"],
    associations: ["risque", "maladie", "habitude", "campagne", "sucre", "alcool", "tabac"]
  },
  {
    terms: ["information", "medias", "presse", "journalisme", "source", "fiable"],
    synonyms: ["actualité", "renseignement", "nouvelle", "contenu journalistique", "fait vérifié", "reportage", "donnée fiable"],
    antonyms: ["désinformation", "rumeur", "censure", "propagande", "fake news", "intox", "mensonge"],
    associations: ["journaliste", "article", "source", "vérification", "public", "débat", "réseau social"]
  },
  {
    terms: ["desinformation", "fake news", "manipulation", "rumeur", "propagande"],
    synonyms: ["fausse information", "intox", "mensonge médiatique", "rumeur", "information trompeuse", "propagande", "manipulation de l'opinion"],
    antonyms: ["information fiable", "vérification des faits", "transparence", "vérité", "source crédible", "journalisme rigoureux", "exactitude"],
    associations: ["réseaux sociaux", "complot", "fact-checking", "source", "partage viral", "opinion", "algorithme"]
  },
  {
    terms: ["liberte", "expression", "pluralisme", "censure", "opinion"],
    synonyms: ["liberté de parole", "droit d'expression", "diversité des opinions", "pluralité", "débat libre", "presse indépendante", "expression publique"],
    antonyms: ["censure", "répression", "silence imposé", "propagande officielle", "pensée unique", "contrôle de l'information", "interdiction"],
    associations: ["démocratie", "journaliste", "opinion", "débat", "droits", "tribune", "médias"]
  },
  {
    terms: ["societe", "social", "sociale", "inegalite", "inegalites", "cohesion", "solidarite", "vivre"],
    synonyms: ["vie collective", "lien social", "cohésion", "solidarité", "collectivité", "groupe social", "justice sociale"],
    antonyms: ["fragmentation", "exclusion", "isolement", "injustice", "rupture sociale", "individualisme", "marginalisation"],
    associations: ["citoyen", "quartier", "solidarité", "services publics", "associations", "inégalités", "cohésion"]
  },
  {
    terms: ["discrimination", "prejuge", "laicite", "mixite", "exclusion", "integration"],
    synonyms: ["traitement inégal", "stigmatisation", "exclusion", "préjugé", "ségrégation", "mise à l'écart", "injustice"],
    antonyms: ["égalité de traitement", "inclusion", "tolérance", "respect", "intégration", "équité", "non-discrimination"],
    associations: ["origine", "genre", "religion", "handicap", "droits", "plainte", "égalité"]
  },
  {
    terms: ["logement", "pauvrete", "quartier", "aide", "bourse", "allocation"],
    synonyms: ["habitat", "conditions de vie", "précarité matérielle", "difficulté sociale", "aide sociale", "hébergement", "ressources limitées"],
    antonyms: ["aisance", "confort", "stabilité résidentielle", "prospérité", "sécurité matérielle", "autonomie financière", "logement digne"],
    associations: ["loyer", "HLM", "revenu", "aides", "quartier", "famille", "services sociaux"]
  },
  {
    terms: ["citoyennete", "benevolat", "engagement", "scrutin", "revendication", "manifestation"],
    synonyms: ["participation citoyenne", "engagement civique", "action collective", "militantisme", "volontariat", "mobilisation", "devoir civique"],
    antonyms: ["indifférence", "abstention", "désengagement", "passivité", "individualisme", "repli", "apathie civique"],
    associations: ["vote", "association", "manifestation", "pétition", "solidarité", "droits", "responsabilité"]
  },
  {
    terms: ["mondialisation", "mondiale", "international", "internationale", "echanges", "commerce"],
    synonyms: ["globalisation", "internationalisation", "ouverture mondiale", "échanges internationaux", "intégration mondiale", "interconnexion", "circulation mondiale"],
    antonyms: ["protectionnisme", "isolement", "autarcie", "fermeture", "repli national", "localisme", "fragmentation"],
    associations: ["commerce", "frontières", "multinationales", "importations", "exportations", "marchés", "flux"]
  },
  {
    terms: ["culture", "culturelle", "linguistique", "identite", "locale", "diversite", "uniformisation"],
    synonyms: ["patrimoine culturel", "pluralité culturelle", "diversité", "identité locale", "traditions", "langues", "particularité culturelle"],
    antonyms: ["uniformisation", "standardisation", "acculturation", "effacement culturel", "homogénéisation", "perte d'identité", "monoculture"],
    associations: ["langue", "tradition", "cinéma", "tourisme", "patrimoine", "mode de vie", "culture locale"]
  },
  {
    terms: ["delocalisation", "approvisionnement", "concurrence", "protectionnisme", "interdependance"],
    synonyms: ["transfert d'activité", "externalisation", "chaîne mondiale", "dépendance économique", "concurrence globale", "interconnexion", "réorganisation productive"],
    antonyms: ["relocalisation", "production locale", "autonomie économique", "protectionnisme", "circuit court", "souveraineté industrielle", "ancrage local"],
    associations: ["usine", "coût du travail", "importations", "sous-traitance", "supply chain", "emploi", "frontières"]
  },
  {
    terms: ["crise", "migratoire", "flux", "tourisme", "masse", "cooperation", "gouvernance"],
    synonyms: ["mouvement de population", "circulation internationale", "coopération mondiale", "gestion globale", "déplacement massif", "mobilité internationale", "coordination internationale"],
    antonyms: ["fermeture des frontières", "immobilité", "isolement", "repli", "absence de coopération", "fragmentation", "politique nationale fermée"],
    associations: ["frontières", "migrants", "asile", "tourisme", "ONU", "accords", "solidarité internationale"]
  },
  {
    terms: ["egalite", "droit", "droits", "acces", "priorite", "dispositif", "mesure"],
    synonyms: ["équité", "justice", "garantie", "accès égal", "droit fondamental", "protection", "mesure publique"],
    antonyms: ["inégalité", "privilège", "exclusion", "privation", "injustice", "restriction", "arbitraire"],
    associations: ["loi", "citoyen", "service public", "égalité", "recours", "protection", "administration"]
  },
  {
    terms: ["qualite", "amelioration", "niveau", "performance", "efficacite"],
    synonyms: ["valeur", "niveau", "performance", "fiabilité", "efficacité", "amélioration", "excellence"],
    antonyms: ["médiocrité", "dégradation", "inefficacité", "baisse de niveau", "défaillance", "insuffisance", "détérioration"],
    associations: ["critère", "résultat", "évaluation", "service", "norme", "satisfaction", "progrès"]
  },
  {
    terms: ["hausse", "baisse", "recul", "progresser", "degrader", "ameliorer"],
    synonyms: ["variation", "évolution", "progression", "augmentation", "diminution", "changement", "tendance"],
    antonyms: ["stabilité", "stagnation", "immobilité", "maintien", "constance", "absence d'évolution", "équilibre"],
    associations: ["courbe", "statistique", "pourcentage", "indicateur", "tendance", "comparaison", "période"]
  },
  {
    terms: ["enjeu", "defi", "question", "probleme", "priorite"],
    synonyms: ["problématique", "question importante", "défi", "sujet central", "point sensible", "objectif", "préoccupation"],
    antonyms: ["détail secondaire", "non-sujet", "solution évidente", "absence de problème", "faible priorité", "évidence", "banalité"],
    associations: ["débat", "argument", "solution", "risque", "priorité", "décision", "responsabilité"]
  },
  {
    terms: ["sondage", "selon", "d'apres", "source", "rapport", "enquete"],
    synonyms: ["enquête d'opinion", "étude", "baromètre", "questionnaire", "données recueillies", "résultat statistique", "source citée"],
    antonyms: ["impression personnelle", "rumeur", "affirmation gratuite", "absence de preuve", "intuition", "opinion non vérifiée", "approximation"],
    associations: ["échantillon", "pourcentage", "répondants", "marge d'erreur", "institut", "résultat", "analyse"]
  }
];

function detectVerb(fr) {
  const normalized = normalize(fr);
  return VERB_PATTERNS.find(pattern => normalized.startsWith(normalize(pattern))) || null;
}

function detectGrammar(word) {
  const fr = word.fr.trim();
  const verb = word.verb || detectVerb(fr);
  if (verb) return { pos: "verbe / locution verbale", gender: "", verb };
  if (/^(le|un)\s/i.test(fr)) return { pos: "nom", gender: "masculin" };
  if (/^(la|une)\s/i.test(fr)) return { pos: "nom", gender: "féminin" };
  if (/^(les|des)\s/i.test(fr)) return { pos: "nom", gender: "pluriel" };
  if (/^l'/i.test(fr)) return { pos: "nom", gender: "m. ou f. selon le mot" };
  if (/(able|ique|el|elle|if|ive|aire|al|ale|eux|euse)$/i.test(fr)) return { pos: "adjectif", gender: "" };
  return { pos: "nom / expression", gender: "" };
}

function frenchExplanation(word, grammar) {
  if (word.explanation?.fr) return word.explanation.fr;
  if (grammar.verb) {
    return `Action ou démarche qui consiste à ${word.verb || word.fr}; cette expression sert à décrire un fait concret dans le thème ${word.category}.`;
  }
  return `Notion qui désigne un phénomène, une pratique, une qualité ou un enjeu lié au thème ${word.category}.`;
}

function chineseExplanation(word, grammar) {
  if (word.explanation?.zh) return word.explanation.zh;
  if (grammar.verb) {
    return `用于说明“${word.category}”主题中的行动、措施、变化或论证关系。`;
  }
  return `用于在“${word.category}”主题中提出概念、描述现象或支撑论点。`;
}

function enhanceWords(sourceWords) {
  return sourceWords.map(word => {
    if (word.source === "eudic") return normalizeEudicWord(word);
    const grammar = detectGrammar(word);
    const lexical = lexicalRelationFor(word, grammar);
    const synonyms = ensureAtLeastFive(word.synonyms, lexical.synonyms, [], word.fr);
    const antonyms = ensureAtLeastFive(word.antonyms, lexical.antonyms, [], word.fr);
    const associations = ensureAtLeastFive(word.associations, lexical.associations, [], word.fr);
    return {
      ...word,
      pos: word.pos || grammar.pos,
      gender: word.gender || grammar.gender,
      verb: word.verb || grammar.verb,
      conjugationPhrase: grammar.verb ? word.fr : "",
      explanation: {
        fr: frenchExplanation(word, grammar),
        zh: chineseExplanation(word, grammar)
      },
      synonyms,
      antonyms,
      associations,
      memory: word.memory || lexical.aide || "",
      root: word.root || lexical.root || "",
      derived: ensureAtLeastFive(word.derived, lexical.derived, [], word.fr)
    };
  });
}

function normalizeEudicWord(word) {
  const grammar = detectGrammar(word);
  const lexical = lexicalRelationFor(word, grammar);
  const fallback = buildLocalFallbackForWord(word, grammar, lexical);
  const hasRealZh = hasMeaningfulEudicText(word.zh) || hasMeaningfulEudicText(word.explanation?.zh);
  const zh = hasRealZh ? (word.explanation?.zh || word.zh) : fallback.zh;
  const frDefinition = hasMeaningfulEudicText(word.explanation?.fr) ? word.explanation.fr : fallback.explanation.fr;
  const zhDefinition = hasRealZh ? (word.explanation?.zh || word.zh) : fallback.explanation.zh;
  const examples = Array.isArray(word.examples) ? word.examples.filter(example => example?.fr) : [];
  return {
    ...word,
    category: "法语助手生词本",
    tags: uniqueList([...(word.tags || []), "法语助手", "生词本"]),
    zh,
    pos: word.pos || grammar.pos || fallback.pos,
    gender: word.gender || grammar.gender || "",
    verb: word.verb || grammar.verb || "",
    conjugationPhrase: grammar.verb ? word.fr : "",
    explanation: {
      fr: frDefinition,
      zh: zhDefinition
    },
    synonyms: ensureAtLeastFive(word.synonyms, lexical.synonyms, fallback.synonyms, word.fr),
    antonyms: ensureAtLeastFive(word.antonyms, lexical.antonyms, fallback.antonyms, word.fr),
    associations: ensureAtLeastFive(word.associations, lexical.associations, fallback.associations, word.fr),
    examples: examples.length ? examples : fallback.examples,
    memory: word.memory || lexical.aide || fallback.memory,
    root: word.root || lexical.root || fallback.root,
    derived: ensureAtLeastFive(word.derived, lexical.derived, fallback.derived, word.fr)
  };
}

function hasMeaningfulEudicText(value) {
  const text = String(value || "").trim();
  return Boolean(text && !/^法语助手未返回/.test(text));
}

function buildLocalFallbackForWord(word, grammar, lexical) {
  const fr = String(word.fr || "").trim();
  const category = word.eudicCategory ? `法语助手生词本 · ${word.eudicCategory}` : "法语助手生词本";
  const stripped = stripArticle(fr) || fr;
  const isVerb = Boolean(grammar.verb);
  const zh = isVerb ? `与“${stripped}”相关的动作或表达` : `与“${stripped}”相关的词语或表达`;
  const explanationFr = isVerb
    ? `Verbe ou locution utile pour exprimer une action, une attitude ou un changement autour de « ${stripped} ».`
    : `Mot ou expression utile pour nommer une idée, une qualité, une situation ou un objet autour de « ${stripped} ».`;
  const explanationZh = isVerb
    ? `本地词卡根据“${stripped}”生成的解释：用于表达动作、状态变化、态度或论述关系。`
    : `本地词卡根据“${stripped}”生成的解释：用于描述概念、人物、性质、情境或具体事物。`;
  return {
    zh,
    pos: grammar.pos || "nom / expression",
    explanation: { fr: explanationFr, zh: explanationZh },
    synonyms: lexical.synonyms.length ? lexical.synonyms : ["terme proche", "mot apparenté", "expression voisine", "notion associée", "formulation équivalente"],
    antonyms: lexical.antonyms.length ? lexical.antonyms : ["notion opposée", "sens contraire", "terme inverse", "idée opposée", "contre-exemple"],
    associations: lexical.associations.length ? lexical.associations : [category, "contexte", "usage", "exemple", "définition", "expression"],
    derived: lexical.derived,
    memory: `把“${stripped}”和具体语境一起记忆：先记词义，再记一个例句。`,
    root: stripped,
    examples: buildFallbackExamples(fr, stripped, isVerb)
  };
}

function buildFallbackExamples(fr, stripped, isVerb) {
  if (isVerb) {
    return [
      { fr: `Il faut savoir employer « ${fr} » dans une phrase claire.`, zh: `需要会在清楚的句子中使用“${fr}”。` },
      { fr: `Dans ce contexte, « ${fr} » permet de décrire une action précise.`, zh: `在这个语境中，“${fr}”可以描述一个具体动作。` },
      { fr: `Cet exemple aide à mieux comprendre l'usage de « ${fr} ».`, zh: `这个例句有助于更好理解“${fr}”的用法。` }
    ];
  }
  return [
    { fr: `Le mot « ${fr} » apparaît souvent dans un contexte concret.`, zh: `“${fr}”这个词常出现在具体语境中。` },
    { fr: `Il est utile de mémoriser « ${stripped} » avec une phrase simple.`, zh: `把“${stripped}”放在简单句中记忆很有用。` },
    { fr: `Cette phrase montre comment employer « ${fr} » naturellement.`, zh: `这个句子展示了如何自然地使用“${fr}”。` }
  ];
}

function lexicalRelationFor(word, grammar) {
  const merged = { synonyms: [], antonyms: [], associations: [], derived: [] };
  const searchable = normalize([word.fr, stripArticle(word.fr), word.zh].join(" "));
  const matchedPatterns = RELATION_PATTERNS
    .map(pattern => ({ pattern, score: relationPatternScore(pattern, searchable) }))
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score);
  for (const match of matchedPatterns) mergeRelations(merged, match.pattern);
  const keys = [
    grammar.verb,
    normalize(grammar.verb || "").replace(/^s'?|^se\s+/, ""),
    stripArticle(word.fr),
    word.fr
  ].filter(Boolean);
  for (const key of keys) {
    const normalized = normalize(key);
    const matchedKey = Object.keys(LEXICAL_RELATIONS).find(item => normalize(item) === normalized);
    if (matchedKey) mergeRelations(merged, LEXICAL_RELATIONS[matchedKey]);
  }
  return merged;
}

function relationPatternMatches(pattern, searchable) {
  return relationPatternScore(pattern, searchable) > 0;
}

function relationPatternScore(pattern, searchable) {
  const tokens = searchable.split(/\s+/).filter(Boolean);
  return Math.max(0, ...pattern.terms.map(term => {
    const normalized = normalize(term);
    if (!normalized) return 0;
    const matched = normalized.includes(" ")
      ? searchable.includes(normalized)
      : tokens.some(token => token === normalized || (normalized.length >= 6 && token.startsWith(normalized)));
    if (!matched) return 0;
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    return wordCount * 100 + normalized.length;
  }));
}

function mergeRelations(target, source = {}) {
  for (const key of ["synonyms", "antonyms", "associations", "derived"]) {
    for (const item of source[key] || []) {
      if (item && !target[key].some(existing => normalize(existing) === normalize(item))) {
        target[key].push(item);
      }
    }
  }
  if (!target.aide && source.aide) target.aide = source.aide;
  if (!target.root && source.root) target.root = source.root;
  return target;
}

function stripArticle(fr) {
  return String(fr || "").replace(/^(le|la|les|l'|un|une|des)\s*/i, "").trim();
}

function ensureAtLeastFive(primary = [], fallback = [], secondary = [], fr = "") {
  const generalFallback = ["terme voisin", "notion proche", "idée opposée", "contexte d'usage", "mot associé", "exemple concret"];
  const result = [];
  for (const item of [...primary, ...fallback, ...secondary, ...generalFallback]) {
    if (item && normalize(item) !== normalize(fr) && !result.some(existing => normalize(existing) === normalize(item))) {
      result.push(item);
    }
    if (result.length >= 5) break;
  }
  return result;
}

function conjugateVerb(verb) {
  const lower = String(verb || "").toLowerCase();
  const reflexive = lower.startsWith("s'") || lower.startsWith("se ");
  const base = lower
    .replace(/^s'/, "")
    .replace(/^se\s+/, "")
    .split(" ")[0];
  const key = normalize(base);
  const presentIrregular = {
    avoir: ["ai", "as", "a", "avons", "avez", "ont"],
    être: ["suis", "es", "est", "sommes", "êtes", "sont"],
    etre: ["suis", "es", "est", "sommes", "êtes", "sont"],
    faire: ["fais", "fais", "fait", "faisons", "faites", "font"],
    mettre: ["mets", "mets", "met", "mettons", "mettez", "mettent"],
    remettre: ["remets", "remets", "remet", "remettons", "remettez", "remettent"],
    prendre: ["prends", "prends", "prend", "prenons", "prenez", "prennent"],
    prévenir: ["préviens", "préviens", "prévient", "prévenons", "prévenez", "préviennent"],
    prevenir: ["préviens", "préviens", "prévient", "prévenons", "prévenez", "préviennent"],
    accroître: ["accrois", "accrois", "accroît", "accroissons", "accroissez", "accroissent"],
    accroitre: ["accrois", "accrois", "accroît", "accroissons", "accroissez", "accroissent"]
  };
  const imparfaitIrregular = {
    avoir: ["avais", "avais", "avait", "avions", "aviez", "avaient"],
    etre: ["étais", "étais", "était", "étions", "étiez", "étaient"],
    faire: ["faisais", "faisais", "faisait", "faisions", "faisiez", "faisaient"]
  };
  const subjPresentIrregular = {
    avoir: ["aie", "aies", "ait", "ayons", "ayez", "aient"],
    etre: ["sois", "sois", "soit", "soyons", "soyez", "soient"],
    faire: ["fasse", "fasses", "fasse", "fassions", "fassiez", "fassent"]
  };
  const simplePastIrregular = {
    avoir: ["eus", "eus", "eut", "eûmes", "eûtes", "eurent"],
    etre: ["fus", "fus", "fut", "fûmes", "fûtes", "furent"],
    faire: ["fis", "fis", "fit", "fîmes", "fîtes", "firent"],
    mettre: ["mis", "mis", "mit", "mîmes", "mîtes", "mirent"],
    remettre: ["remis", "remis", "remit", "remîmes", "remîtes", "remirent"],
    prendre: ["pris", "pris", "prit", "prîmes", "prîtes", "prirent"]
  };
  const pronouns = reflexive ? ["je me", "tu te", "il/elle se", "nous nous", "vous vous", "ils/elles se"] : ["je", "tu", "il/elle", "nous", "vous", "ils/elles"];
  const subjPronouns = reflexive ? ["que je me", "que tu te", "qu'il/elle se", "que nous nous", "que vous vous", "qu'ils/elles se"] : ["que je", "que tu", "qu'il/elle", "que nous", "que vous", "qu'ils/elles"];
  const present = presentIrregular[key] || regularPresent(base);
  const imperfect = imparfaitIrregular[key] || regularImperfect(base);
  const simplePast = simplePastIrregular[key] || regularSimplePast(base);
  const subjPresent = subjPresentIrregular[key] || regularSubjPresent(base);
  const subjImperfect = regularSubjImperfect(base, simplePast);
  const participle = pastParticiple(base);
  const future = futureSimple(base);
  const conditional = conditionalPresent(base);
  const presentParticiple = presentParticipleForm(base);
  const aux = reflexive ? "etre" : "avoir";
  const infPastAux = reflexive ? "s'être" : "avoir";
  const imperative = imperativePresent(base, present, reflexive);
  return {
    indicatifPresent: withPronouns(pronouns, present),
    indicatifPasseCompose: compound(aux, "present", participle, reflexive),
    indicatifImparfait: withPronouns(pronouns, imperfect),
    indicatifPlusQueParfait: compound(aux, "imparfait", participle, reflexive),
    indicatifPasseSimple: withPronouns(pronouns, simplePast),
    indicatifPasseAnterieur: compound(aux, "passeSimple", participle, reflexive),
    indicatifFuturSimple: withPronouns(["je", "tu", "il/elle", "nous", "vous", "ils/elles"], future),
    indicatifFuturAnterieur: compound(aux, "futur", participle, reflexive),
    subjonctifPresent: withPronouns(subjPronouns, subjPresent),
    subjonctifPasse: compound(aux, "subjPresent", participle, reflexive, true),
    subjonctifImparfait: withPronouns(subjPronouns, subjImperfect),
    subjonctifPlusQueParfait: compound(aux, "subjImperfect", participle, reflexive, true),
    conditionnelPresent: withPronouns(["je", "tu", "il/elle", "nous", "vous", "ils/elles"], conditional),
    conditionnelPasse: compound(aux, "conditionnel", participle, reflexive),
    imperatifPresent: imperative,
    imperatifPasse: imperativePast(aux, participle, reflexive),
    infinitifPresent: [verb],
    infinitifPasse: [`${infPastAux} ${participle}`],
    participePresent: [`en ${presentParticiple}`],
    participePasse: [participle]
  };
}

function withPronouns(pronouns, forms) {
  return pronouns.map((pronoun, index) => joinPronoun(pronoun, forms[index]));
}

function joinPronoun(pronoun, form) {
  return `${pronoun} ${form}`
    .replace(/\s+/g, " ")
    .replace(/\bje ([aeiouhéèê])/i, "j'$1")
    .replace(/\bme ([aeiouhéèê])/i, "m'$1")
    .replace(/\bte ([aeiouhéèê])/i, "t'$1")
    .replace(/\bse ([aeiouhéèê])/i, "s'$1")
    .replace("' ", "'");
}

function auxiliaryForms(aux, tense) {
  const avoir = {
    present: ["ai", "as", "a", "avons", "avez", "ont"],
    imparfait: ["avais", "avais", "avait", "avions", "aviez", "avaient"],
    passeSimple: ["eus", "eus", "eut", "eûmes", "eûtes", "eurent"],
    futur: ["aurai", "auras", "aura", "aurons", "aurez", "auront"],
    subjPresent: ["aie", "aies", "ait", "ayons", "ayez", "aient"],
    subjImperfect: ["eusse", "eusses", "eût", "eussions", "eussiez", "eussent"],
    conditionnel: ["aurais", "aurais", "aurait", "aurions", "auriez", "auraient"]
  };
  const etre = {
    present: ["suis", "es", "est", "sommes", "êtes", "sont"],
    imparfait: ["étais", "étais", "était", "étions", "étiez", "étaient"],
    passeSimple: ["fus", "fus", "fut", "fûmes", "fûtes", "furent"],
    futur: ["serai", "seras", "sera", "serons", "serez", "seront"],
    subjPresent: ["sois", "sois", "soit", "soyons", "soyez", "soient"],
    subjImperfect: ["fusse", "fusses", "fût", "fussions", "fussiez", "fussent"],
    conditionnel: ["serais", "serais", "serait", "serions", "seriez", "seraient"]
  };
  return (aux === "etre" ? etre : avoir)[tense];
}

function compound(aux, tense, participle, reflexive, subj = false) {
  const forms = auxiliaryForms(aux, tense);
  const pronouns = subj
    ? (reflexive ? ["que je me", "que tu te", "qu'il/elle se", "que nous nous", "que vous vous", "qu'ils/elles se"] : ["que j'", "que tu", "qu'il/elle", "que nous", "que vous", "qu'ils/elles"])
    : (reflexive ? ["je me", "tu te", "il/elle se", "nous nous", "vous vous", "ils/elles se"] : ["j'", "tu", "il/elle", "nous", "vous", "ils/elles"]);
  return forms.map((form, index) => `${pronouns[index]} ${form} ${participle}`.replace(/\s+/g, " ").replace("' ", "'"));
}

function regularPresent(base) {
  if (base.endsWith("er")) {
    const stem = base.slice(0, -2);
    return [`${stem}e`, `${stem}es`, `${stem}e`, `${stem}ons`, `${stem}ez`, `${stem}ent`];
  }
  if (base.endsWith("ir")) {
    const stem = base.slice(0, -2);
    return [`${stem}is`, `${stem}is`, `${stem}it`, `${stem}issons`, `${stem}issez`, `${stem}issent`];
  }
  if (base.endsWith("re")) {
    const stem = base.slice(0, -2);
    return [`${stem}s`, `${stem}s`, stem, `${stem}ons`, `${stem}ez`, `${stem}ent`];
  }
  return [base, base, base, base, base, base];
}

function pastParticiple(base) {
  const irregular = {
    avoir: "eu",
    etre: "été",
    faire: "fait",
    mettre: "mis",
    remettre: "remis",
    prendre: "pris",
    apprendre: "appris",
    comprendre: "compris"
  };
  const key = normalize(base);
  if (irregular[key]) return irregular[key];
  if (base.endsWith("er")) return `${base.slice(0, -2)}é`;
  if (base.endsWith("ir")) return `${base.slice(0, -2)}i`;
  if (base.endsWith("re")) return `${base.slice(0, -2)}u`;
  return base;
}

function futureSimple(base) {
  const stem = base.endsWith("re") ? base.slice(0, -1) : base;
  return [`${stem}ai`, `${stem}as`, `${stem}a`, `${stem}ons`, `${stem}ez`, `${stem}ont`];
}

function conditionalPresent(base) {
  const stem = base.endsWith("re") ? base.slice(0, -1) : base;
  return [`${stem}ais`, `${stem}ais`, `${stem}ait`, `${stem}ions`, `${stem}iez`, `${stem}aient`];
}

function regularImperfect(base) {
  const nous = regularPresent(base)[3];
  const stem = nous.endsWith("ons") ? nous.slice(0, -3) : base;
  return [`${stem}ais`, `${stem}ais`, `${stem}ait`, `${stem}ions`, `${stem}iez`, `${stem}aient`];
}

function regularSimplePast(base) {
  if (base.endsWith("er")) {
    const stem = base.slice(0, -2);
    return [`${stem}ai`, `${stem}as`, `${stem}a`, `${stem}âmes`, `${stem}âtes`, `${stem}èrent`];
  }
  const stem = base.endsWith("ir") || base.endsWith("re") ? base.slice(0, -2) : base;
  return [`${stem}is`, `${stem}is`, `${stem}it`, `${stem}îmes`, `${stem}îtes`, `${stem}irent`];
}

function regularSubjPresent(base) {
  const present = regularPresent(base);
  const ilsStem = present[5].endsWith("ent") ? present[5].slice(0, -3) : base;
  const nousStem = present[3].endsWith("ons") ? present[3].slice(0, -3) : ilsStem;
  return [`${ilsStem}e`, `${ilsStem}es`, `${ilsStem}e`, `${nousStem}ions`, `${nousStem}iez`, `${ilsStem}ent`];
}

function regularSubjImperfect(base, simplePast) {
  const stem = simplePast[1].endsWith("s") ? simplePast[1].slice(0, -1) : base;
  return [`${stem}sse`, `${stem}sses`, `${stem}^t`, `${stem}ssions`, `${stem}ssiez`, `${stem}ssent`].map(form => form.replace("a^t", "ât").replace("i^t", "ît").replace("u^t", "ût"));
}

function presentParticipleForm(base) {
  const nous = regularPresent(base)[3];
  const stem = nous.endsWith("ons") ? nous.slice(0, -3) : base;
  return `${stem}ant`;
}

function imperativePresent(base, present, reflexive) {
  const forms = [present[1], present[3], present[4]];
  if (!reflexive) return [`${forms[0]}`, `${forms[1]}`, `${forms[2]}`];
  return [`${forms[0]}-toi`, `${forms[1]}-nous`, `${forms[2]}-vous`];
}

function imperativePast(aux, participle, reflexive) {
  if (reflexive) return [`sois-toi ${participle}`, `soyons-nous ${participle}`, `soyez-vous ${participle}`];
  const forms = auxiliaryForms(aux, "subjPresent");
  return [`aie ${participle}`, `ayons ${participle}`, `ayez ${participle}`].map((form, index) => aux === "etre" ? [`sois ${participle}`, `soyons ${participle}`, `soyez ${participle}`][index] : form);
}

function conjugateVerb(phrase) {
  const parsed = parseVerbPhrase(phrase);
  const forms = verbForms(parsed.base);
  const aux = parsed.reflexive ? "etre" : "avoir";
  const participle = forms.participle;
  const finitePronouns = parsed.reflexive
    ? ["je me", "tu te", "il/elle se", "nous nous", "vous vous", "ils/elles se"]
    : ["je", "tu", "il/elle", "nous", "vous", "ils/elles"];
  const subjPronouns = parsed.reflexive
    ? ["que je me", "que tu te", "qu'il/elle se", "que nous nous", "que vous vous", "qu'ils/elles se"]
    : ["que je", "que tu", "qu'il/elle", "que nous", "que vous", "qu'ils/elles"];
  const simplePronouns = ["je", "tu", "il/elle", "nous", "vous", "ils/elles"];

  return {
    indicatifPresent: finite(finitePronouns, forms.present, parsed.tail),
    indicatifPasseCompose: compoundPhrase(aux, "present", participle, parsed),
    indicatifImparfait: finite(finitePronouns, forms.imparfait, parsed.tail),
    indicatifPlusQueParfait: compoundPhrase(aux, "imparfait", participle, parsed),
    indicatifPasseSimple: finite(finitePronouns, forms.passeSimple, parsed.tail),
    indicatifPasseAnterieur: compoundPhrase(aux, "passeSimple", participle, parsed),
    indicatifFuturSimple: finite(parsed.reflexive ? finitePronouns : simplePronouns, forms.futur, parsed.tail),
    indicatifFuturAnterieur: compoundPhrase(aux, "futur", participle, parsed),
    subjonctifPresent: finite(subjPronouns, forms.subjonctifPresent, parsed.tail),
    subjonctifPasse: compoundPhrase(aux, "subjPresent", participle, parsed, true),
    subjonctifImparfait: finite(subjPronouns, forms.subjonctifImparfait, parsed.tail),
    subjonctifPlusQueParfait: compoundPhrase(aux, "subjImperfect", participle, parsed, true),
    conditionnelPresent: finite(parsed.reflexive ? finitePronouns : simplePronouns, forms.conditionnel, parsed.tail),
    conditionnelPasse: compoundPhrase(aux, "conditionnel", participle, parsed),
    imperatifPresent: imperativePhrase(forms, parsed),
    imperatifPasse: imperativePastPhrase(aux, participle, parsed),
    infinitifPresent: [phrase],
    infinitifPasse: [`${parsed.reflexive ? "s'être" : "avoir"} ${participle}${parsed.tail}`.trim()],
    participePresent: [`en ${forms.participePresent}${parsed.tail}`.trim()],
    participePasse: [`${participle}${parsed.tail}`.trim()]
  };
}

function parseVerbPhrase(phrase) {
  const text = String(phrase || "").trim();
  const match = [...VERB_PATTERNS]
    .sort((a, b) => b.length - a.length)
    .find(pattern => normalize(text).startsWith(normalize(pattern)));
  const pattern = match || text.split(/\s+/)[0] || text;
  const reflexive = /^s'|^se\s/i.test(pattern);
  let base = pattern.split(/\s+/)[0];
  let fixedTail = pattern.slice(base.length).trim();
  if (reflexive) {
    const reflexiveMatch = pattern.match(/^s'([^\s]+)|^se\s+([^\s]+)/i);
    base = reflexiveMatch?.[1] || reflexiveMatch?.[2] || base.replace(/^s'/i, "");
    fixedTail = pattern.slice(reflexiveMatch?.[0].length || 0).trim();
  }
  const remaining = text.slice(pattern.length).trim();
  return {
    base,
    reflexive,
    tail: [fixedTail, remaining].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  };
}

function verbForms(base) {
  const key = normalize(base);
  const irregular = {
    avoir: {
      present: ["ai", "as", "a", "avons", "avez", "ont"],
      imparfait: ["avais", "avais", "avait", "avions", "aviez", "avaient"],
      passeSimple: ["eus", "eus", "eut", "eûmes", "eûtes", "eurent"],
      futur: ["aurai", "auras", "aura", "aurons", "aurez", "auront"],
      conditionnel: ["aurais", "aurais", "aurait", "aurions", "auriez", "auraient"],
      subjonctifPresent: ["aie", "aies", "ait", "ayons", "ayez", "aient"],
      subjonctifImparfait: ["eusse", "eusses", "eût", "eussions", "eussiez", "eussent"],
      imperatif: ["aie", "ayons", "ayez"],
      participePresent: "ayant",
      participle: "eu"
    },
    etre: {
      present: ["suis", "es", "est", "sommes", "êtes", "sont"],
      imparfait: ["étais", "étais", "était", "étions", "étiez", "étaient"],
      passeSimple: ["fus", "fus", "fut", "fûmes", "fûtes", "furent"],
      futur: ["serai", "seras", "sera", "serons", "serez", "seront"],
      conditionnel: ["serais", "serais", "serait", "serions", "seriez", "seraient"],
      subjonctifPresent: ["sois", "sois", "soit", "soyons", "soyez", "soient"],
      subjonctifImparfait: ["fusse", "fusses", "fût", "fussions", "fussiez", "fussent"],
      imperatif: ["sois", "soyons", "soyez"],
      participePresent: "étant",
      participle: "été"
    },
    faire: {
      present: ["fais", "fais", "fait", "faisons", "faites", "font"],
      imparfait: ["faisais", "faisais", "faisait", "faisions", "faisiez", "faisaient"],
      passeSimple: ["fis", "fis", "fit", "fîmes", "fîtes", "firent"],
      futur: ["ferai", "feras", "fera", "ferons", "ferez", "feront"],
      conditionnel: ["ferais", "ferais", "ferait", "ferions", "feriez", "feraient"],
      subjonctifPresent: ["fasse", "fasses", "fasse", "fassions", "fassiez", "fassent"],
      subjonctifImparfait: ["fisse", "fisses", "fît", "fissions", "fissiez", "fissent"],
      participePresent: "faisant",
      participle: "fait"
    }
  };
  if (key === "être") return irregular.etre;
  if (irregular[key]) return irregular[key];
  if (key === "mettre" || key === "remettre") return prefixedMettre(base);
  if (key === "prendre") return prendreForms(base);
  if (key === "prevenir" || key === "prévenir") return prevenirForms(base);
  if (key === "reduire" || key === "réduire") return reduireForms(base);
  if (key === "interdire") return interdireForms(base);
  if (key === "accroitre" || key === "accroître") return accroitreForms(base);
  return regularVerbForms(base);
}

function regularVerbForms(base) {
  if (base.endsWith("er")) return erForms(base);
  if (base.endsWith("ir")) return irForms(base);
  if (base.endsWith("re")) return reForms(base);
  return erForms(base);
}

function erForms(base) {
  const stem = base.slice(0, -2);
  const presentStem = spellingStem(stem);
  const nousStem = gerStem(stem);
  const simpleStem = spellingStem(stem);
  const futureStem = base;
  return {
    present: [`${presentStem}e`, `${presentStem}es`, `${presentStem}e`, `${nousStem}ons`, `${stem}ez`, `${presentStem}ent`],
    imparfait: [`${nousStem}ais`, `${nousStem}ais`, `${nousStem}ait`, `${nousStem}ions`, `${nousStem}iez`, `${nousStem}aient`],
    passeSimple: [`${simpleStem}ai`, `${simpleStem}as`, `${simpleStem}a`, `${simpleStem}âmes`, `${simpleStem}âtes`, `${simpleStem}èrent`],
    futur: [`${futureStem}ai`, `${futureStem}as`, `${futureStem}a`, `${futureStem}ons`, `${futureStem}ez`, `${futureStem}ont`],
    conditionnel: [`${futureStem}ais`, `${futureStem}ais`, `${futureStem}ait`, `${futureStem}ions`, `${futureStem}iez`, `${futureStem}aient`],
    subjonctifPresent: [`${presentStem}e`, `${presentStem}es`, `${presentStem}e`, `${nousStem}ions`, `${nousStem}iez`, `${presentStem}ent`],
    subjonctifImparfait: [`${simpleStem}asse`, `${simpleStem}asses`, `${simpleStem}ât`, `${simpleStem}assions`, `${simpleStem}assiez`, `${simpleStem}assent`],
    participePresent: `${nousStem}ant`,
    participle: `${stem}é`
  };
}

function irForms(base) {
  const stem = base.slice(0, -2);
  return {
    present: [`${stem}is`, `${stem}is`, `${stem}it`, `${stem}issons`, `${stem}issez`, `${stem}issent`],
    imparfait: [`${stem}issais`, `${stem}issais`, `${stem}issait`, `${stem}issions`, `${stem}issiez`, `${stem}issaient`],
    passeSimple: [`${stem}is`, `${stem}is`, `${stem}it`, `${stem}îmes`, `${stem}îtes`, `${stem}irent`],
    futur: [`${base}ai`, `${base}as`, `${base}a`, `${base}ons`, `${base}ez`, `${base}ont`],
    conditionnel: [`${base}ais`, `${base}ais`, `${base}ait`, `${base}ions`, `${base}iez`, `${base}aient`],
    subjonctifPresent: [`${stem}isse`, `${stem}isses`, `${stem}isse`, `${stem}issions`, `${stem}issiez`, `${stem}issent`],
    subjonctifImparfait: [`${stem}isse`, `${stem}isses`, `${stem}ît`, `${stem}issions`, `${stem}issiez`, `${stem}issent`],
    participePresent: `${stem}issant`,
    participle: `${stem}i`
  };
}

function reForms(base) {
  const stem = base.slice(0, -2);
  const futureStem = base.slice(0, -1);
  return {
    present: [`${stem}s`, `${stem}s`, stem, `${stem}ons`, `${stem}ez`, `${stem}ent`],
    imparfait: [`${stem}ais`, `${stem}ais`, `${stem}ait`, `${stem}ions`, `${stem}iez`, `${stem}aient`],
    passeSimple: [`${stem}is`, `${stem}is`, `${stem}it`, `${stem}îmes`, `${stem}îtes`, `${stem}irent`],
    futur: [`${futureStem}ai`, `${futureStem}as`, `${futureStem}a`, `${futureStem}ons`, `${futureStem}ez`, `${futureStem}ont`],
    conditionnel: [`${futureStem}ais`, `${futureStem}ais`, `${futureStem}ait`, `${futureStem}ions`, `${futureStem}iez`, `${futureStem}aient`],
    subjonctifPresent: [`${stem}e`, `${stem}es`, `${stem}e`, `${stem}ions`, `${stem}iez`, `${stem}ent`],
    subjonctifImparfait: [`${stem}isse`, `${stem}isses`, `${stem}ît`, `${stem}issions`, `${stem}issiez`, `${stem}issent`],
    participePresent: `${stem}ant`,
    participle: `${stem}u`
  };
}

function spellingStem(stem) {
  if (stem.endsWith("ég")) return `${stem.slice(0, -2)}èg`;
  if (stem.endsWith("é")) return stem;
  if (stem.endsWith("é")) return stem;
  if (stem.endsWith("ev")) return stem;
  if (stem.endsWith("ger")) return stem;
  return stem;
}

function gerStem(stem) {
  return stem.endsWith("g") ? `${stem}e` : stem;
}

function prefixedMettre(base) {
  const prefix = base.slice(0, -6);
  return {
    present: [`${prefix}mets`, `${prefix}mets`, `${prefix}met`, `${prefix}mettons`, `${prefix}mettez`, `${prefix}mettent`],
    imparfait: [`${prefix}mettais`, `${prefix}mettais`, `${prefix}mettait`, `${prefix}mettions`, `${prefix}mettiez`, `${prefix}mettaient`],
    passeSimple: [`${prefix}mis`, `${prefix}mis`, `${prefix}mit`, `${prefix}mîmes`, `${prefix}mîtes`, `${prefix}mirent`],
    futur: [`${prefix}mettrai`, `${prefix}mettras`, `${prefix}mettra`, `${prefix}mettrons`, `${prefix}mettrez`, `${prefix}mettront`],
    conditionnel: [`${prefix}mettrais`, `${prefix}mettrais`, `${prefix}mettrait`, `${prefix}mettrions`, `${prefix}mettriez`, `${prefix}mettraient`],
    subjonctifPresent: [`${prefix}mette`, `${prefix}mettes`, `${prefix}mette`, `${prefix}mettions`, `${prefix}mettiez`, `${prefix}mettent`],
    subjonctifImparfait: [`${prefix}misse`, `${prefix}misses`, `${prefix}mît`, `${prefix}missions`, `${prefix}missiez`, `${prefix}missent`],
    participePresent: `${prefix}mettant`,
    participle: `${prefix}mis`
  };
}

function prendreForms(base) {
  return {
    present: ["prends", "prends", "prend", "prenons", "prenez", "prennent"],
    imparfait: ["prenais", "prenais", "prenait", "prenions", "preniez", "prenaient"],
    passeSimple: ["pris", "pris", "prit", "prîmes", "prîtes", "prirent"],
    futur: ["prendrai", "prendras", "prendra", "prendrons", "prendrez", "prendront"],
    conditionnel: ["prendrais", "prendrais", "prendrait", "prendrions", "prendriez", "prendraient"],
    subjonctifPresent: ["prenne", "prennes", "prenne", "prenions", "preniez", "prennent"],
    subjonctifImparfait: ["prisse", "prisses", "prît", "prissions", "prissiez", "prissent"],
    participePresent: "prenant",
    participle: "pris"
  };
}

function prevenirForms(base) {
  return {
    present: ["préviens", "préviens", "prévient", "prévenons", "prévenez", "préviennent"],
    imparfait: ["prévenais", "prévenais", "prévenait", "prévenions", "préveniez", "prévenaient"],
    passeSimple: ["prévins", "prévins", "prévint", "prévînmes", "prévîntes", "prévinrent"],
    futur: ["préviendrai", "préviendras", "préviendra", "préviendrons", "préviendrez", "préviendront"],
    conditionnel: ["préviendrais", "préviendrais", "préviendrait", "préviendrions", "préviendriez", "préviendraient"],
    subjonctifPresent: ["prévienne", "préviennes", "prévienne", "prévenions", "préveniez", "préviennent"],
    subjonctifImparfait: ["prévinsse", "prévinsses", "prévînt", "prévinssions", "prévinssiez", "prévinssent"],
    participePresent: "prévenant",
    participle: "prévenu"
  };
}

function reduireForms(base) {
  return {
    present: ["réduis", "réduis", "réduit", "réduisons", "réduisez", "réduisent"],
    imparfait: ["réduisais", "réduisais", "réduisait", "réduisions", "réduisiez", "réduisaient"],
    passeSimple: ["réduisis", "réduisis", "réduisit", "réduisîmes", "réduisîtes", "réduisirent"],
    futur: ["réduirai", "réduiras", "réduira", "réduirons", "réduirez", "réduiront"],
    conditionnel: ["réduirais", "réduirais", "réduirait", "réduirions", "réduiriez", "réduiraient"],
    subjonctifPresent: ["réduise", "réduises", "réduise", "réduisions", "réduisiez", "réduisent"],
    subjonctifImparfait: ["réduisisse", "réduisisses", "réduisît", "réduisissions", "réduisissiez", "réduisissent"],
    participePresent: "réduisant",
    participle: "réduit"
  };
}

function interdireForms(base) {
  return {
    present: ["interdis", "interdis", "interdit", "interdisons", "interdisez", "interdisent"],
    imparfait: ["interdisais", "interdisais", "interdisait", "interdisions", "interdisiez", "interdisaient"],
    passeSimple: ["interdis", "interdis", "interdit", "interdîmes", "interdîtes", "interdirent"],
    futur: ["interdirai", "interdiras", "interdira", "interdirons", "interdirez", "interdiront"],
    conditionnel: ["interdirais", "interdirais", "interdirait", "interdirions", "interdiriez", "interdiraient"],
    subjonctifPresent: ["interdise", "interdises", "interdise", "interdisions", "interdisiez", "interdisent"],
    subjonctifImparfait: ["interdisse", "interdisses", "interdît", "interdissions", "interdissiez", "interdissent"],
    participePresent: "interdisant",
    participle: "interdit"
  };
}

function accroitreForms(base) {
  return {
    present: ["accrois", "accrois", "accroît", "accroissons", "accroissez", "accroissent"],
    imparfait: ["accroissais", "accroissais", "accroissait", "accroissions", "accroissiez", "accroissaient"],
    passeSimple: ["accrus", "accrus", "accrut", "accrûmes", "accrûtes", "accrurent"],
    futur: ["accroîtrai", "accroîtras", "accroîtra", "accroîtrons", "accroîtrez", "accroîtront"],
    conditionnel: ["accroîtrais", "accroîtrais", "accroîtrait", "accroîtrions", "accroîtriez", "accroîtraient"],
    subjonctifPresent: ["accroisse", "accroisses", "accroisse", "accroissions", "accroissiez", "accroissent"],
    subjonctifImparfait: ["accrusse", "accrusses", "accrût", "accrussions", "accrussiez", "accrussent"],
    participePresent: "accroissant",
    participle: "accru"
  };
}

function finite(pronouns, forms, tail) {
  return forms.map((form, index) => `${joinPronoun(pronouns[index], form)}${tail ? ` ${tail}` : ""}`);
}

function compoundPhrase(aux, tense, participle, parsed, subj = false) {
  const forms = auxiliaryForms(aux, tense);
  const pronouns = subj
    ? (parsed.reflexive ? ["que je me", "que tu te", "qu'il/elle se", "que nous nous", "que vous vous", "qu'ils/elles se"] : ["que j'", "que tu", "qu'il/elle", "que nous", "que vous", "qu'ils/elles"])
    : (parsed.reflexive ? ["je me", "tu te", "il/elle se", "nous nous", "vous vous", "ils/elles se"] : ["j'", "tu", "il/elle", "nous", "vous", "ils/elles"]);
  return forms.map((form, index) => `${pronouns[index]} ${form} ${participle}${parsed.tail ? ` ${parsed.tail}` : ""}`.replace(/\s+/g, " ").replace("' ", "'"));
}

function imperativePhrase(forms, parsed) {
  const tail = parsed.tail ? ` ${parsed.tail}` : "";
  const present = forms.imperatif || forms.present;
  const tuForm = forms.imperatif ? present[0] : dropImperativeS(present[1], parsed.base);
  const nousForm = forms.imperatif ? present[1] : present[3];
  const vousForm = forms.imperatif ? present[2] : present[4];
  if (parsed.reflexive) return [`${tuForm}-toi${tail}`, `${nousForm}-nous${tail}`, `${vousForm}-vous${tail}`];
  return [`${tuForm}${tail}`, `${nousForm}${tail}`, `${vousForm}${tail}`];
}

function dropImperativeS(form, base) {
  return base.endsWith("er") && form.endsWith("es") ? form.slice(0, -1) : form;
}

function imperativePastPhrase(aux, participle, parsed) {
  const tail = parsed.tail ? ` ${parsed.tail}` : "";
  if (parsed.reflexive) return [`sois-toi ${participle}${tail}`, `soyons-nous ${participle}${tail}`, `soyez-vous ${participle}${tail}`];
  return aux === "etre"
    ? [`sois ${participle}${tail}`, `soyons ${participle}${tail}`, `soyez ${participle}${tail}`]
    : [`aie ${participle}${tail}`, `ayons ${participle}${tail}`, `ayez ${participle}${tail}`];
}

function setupCategories() {
  els.category.innerHTML = `<option value="all">全部分类</option>`;
  const foundCategories = [...new Set(words.map(word => word.category))];
  const preferredOrder = window.B2_CATEGORY_ORDER || [];
  const categories = [
    ...preferredOrder.filter(category => foundCategories.includes(category)),
    ...foundCategories
      .filter(category => !preferredOrder.includes(category))
      .sort((a, b) => a.localeCompare(b, "fr"))
  ];
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.category.append(option);
  }
}

function filteredWords() {
  const query = normalize(state.query);
  return words.filter(word => {
    const categoryOk = state.category === "all" || word.category === state.category;
    const tagOk = state.tag === "all" || word.tags.includes(state.tag);
    const haystack = normalize([
      word.fr,
      word.zh,
      word.category,
      word.pos,
      word.gender,
      word.explanation?.fr,
      word.explanation?.zh,
      ...(word.synonyms || []),
      ...(word.antonyms || []),
      ...(word.associations || []),
      ...(word.derived || []),
      word.memory,
      word.root,
      ...word.tags,
      ...word.examples.flatMap(example => [example.fr, example.zh])
    ].join(" "));
    return categoryOk && tagOk && (!query || haystack.includes(query));
  });
}

function renderStats() {
  const known = Object.values(state.progress.known).filter(Boolean).length;
  els.totalCount.textContent = words.length;
  els.knownCount.textContent = known;
  els.accuracy.textContent = state.progress.total
    ? `${Math.round((state.progress.right / state.progress.total) * 100)}%`
    : "0%";
}

function renderWords() {
  const items = filteredWords();
  els.list.innerHTML = "";
  if (!items.length) {
    els.list.innerHTML = `<div class="word-card"><p class="translation">没有找到匹配词条。</p></div>`;
    return;
  }

  for (const word of items) {
    const card = document.createElement("article");
    card.className = "word-card";
    const done = Boolean(state.progress.known[word.fr]);
    const examples = Array.isArray(word.examples) ? word.examples : [];
    card.innerHTML = `
      <div class="word-head">
        <div>
          <h2>${escapeHtml(word.fr)}</h2>
          <p class="translation">${escapeHtml(word.zh)}</p>
        </div>
        <button class="known ${done ? "done" : ""}" type="button" aria-label="标记掌握">${done ? "✓" : "○"}</button>
      </div>
      <div class="badge-row">
        <span class="badge">${escapeHtml(word.category)}</span>
        <span class="badge">${escapeHtml(word.pos)}</span>
        ${word.gender ? `<span class="badge">${escapeHtml(word.gender)}</span>` : ""}
        ${word.tags.map(tag => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <ol class="examples">
        ${examples.length
          ? examples.map(example => `<li>${escapeHtml(example.fr)}<span>${escapeHtml(example.zh)}</span></li>`).join("")
          : `<li class="muted">暂无例句。</li>`}
      </ol>
    `;
    card.addEventListener("click", () => showDetail(word));
    card.querySelector(".known").addEventListener("click", event => {
      event.stopPropagation();
      state.progress.known[word.fr] = !state.progress.known[word.fr];
      saveProgress();
      renderStats();
      renderWords();
    });
    els.list.append(card);
  }
}

function renderList(items, emptyText = "暂无") {
  if (!items?.length) return `<span class="muted">${escapeHtml(emptyText)}</span>`;
  return items.map(item => `<span class="pill">${escapeHtml(item)}</span>`).join("");
}

function renderConjugation(word) {
  if (word.source === "eudic") {
    if (word.conjugation) {
      return `
        <section class="detail-section">
          <h3>动词变位 · Conjugaison</h3>
          ${renderApiConjugation(word.conjugation)}
        </section>
      `;
    }
    if (!word.verb) return "";
  }
  if (!word.verb) return "";
  const phrase = word.conjugationPhrase || word.verb;
  const forms = conjugateVerb(phrase);
  const rows = [
    ["直陈式现在时 · Indicatif présent", forms.indicatifPresent],
    ["直陈式复合过去时 · Indicatif passé composé", forms.indicatifPasseCompose],
    ["直陈式未完成过去时 · Indicatif imparfait", forms.indicatifImparfait],
    ["直陈式愈过去时 · Indicatif plus-que-parfait", forms.indicatifPlusQueParfait],
    ["直陈式简单过去时 · Indicatif passé simple", forms.indicatifPasseSimple],
    ["直陈式先过去时 · Indicatif passé antérieur", forms.indicatifPasseAnterieur],
    ["直陈式简单将来时 · Indicatif futur simple", forms.indicatifFuturSimple],
    ["直陈式先将来时 · Indicatif futur antérieur", forms.indicatifFuturAnterieur],
    ["虚拟式现在时 · Subjonctif présent", forms.subjonctifPresent],
    ["虚拟式过去时 · Subjonctif passé", forms.subjonctifPasse],
    ["虚拟式未完成过去时 · Subjonctif imparfait", forms.subjonctifImparfait],
    ["虚拟式愈过去时 · Subjonctif plus-que-parfait", forms.subjonctifPlusQueParfait],
    ["条件式现在时 · Conditionnel présent", forms.conditionnelPresent],
    ["条件式过去时 · Conditionnel passé", forms.conditionnelPasse],
    ["命令式现在时 · Impératif présent", forms.imperatifPresent],
    ["命令式过去时 · Impératif passé", forms.imperatifPasse],
    ["不定式现在时 · Infinitif présent", forms.infinitifPresent],
    ["不定式过去时 · Infinitif passé", forms.infinitifPasse],
    ["现在分词 · Participe présent", forms.participePresent],
    ["过去分词 · Participe passé", forms.participePasse]
  ];
  return `
    <section class="detail-section">
      <h3>动词变位 · Conjugaison</h3>
      <p class="muted">识别动词：${word.verb}；变位短语：${phrase}。常见规则动词、拼写变化动词和本词库核心不规则动词已校正。</p>
      <div class="conjugation">
        ${rows.map(([tense, formsForTense]) => `
          <div>
            <strong>${tense}</strong>
            ${formsForTense.map(form => `<span>${form}</span>`).join("")}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function showDetail(word) {
  state.detailWordKey = word.fr;
  els.detailCategory.textContent = word.category;
  els.detailTitle.textContent = word.fr;
  els.detailTranslation.textContent = word.zh;
  renderDetailBody(word, lookupCache[lookupCacheKey(word)], "正在准备本地内容...");
  els.detailDialog.showModal();
  enrichDetailFromApi(word);
}

function renderDetailBody(word, apiEntry, lookupStatus = "") {
  const isEudic = word.source === "eudic";
  const missingText = isEudic ? "本地生成/待补充" : "暂无";
  const examples = Array.isArray(word.examples) ? word.examples : [];
  els.detailBody.innerHTML = `
    <section class="detail-section">
      <h3>词性 · Nature</h3>
      <div class="detail-grid">
        <div><strong>词性</strong><span>${escapeHtml(word.pos)}</span></div>
        <div><strong>阴阳性</strong><span>${escapeHtml(word.gender || "不适用")}</span></div>
      </div>
    </section>
    <section class="detail-section">
      <h3>解释 · Définition</h3>
      <p>${escapeHtml(word.explanation.zh)}</p>
      <p class="muted">${escapeHtml(word.explanation.fr)}</p>
    </section>
    ${isEudic ? `
      <section class="detail-section">
        <h3>来源 · Source</h3>
        <div class="detail-grid">
          <div><strong>来源</strong><span>法语助手生词本</span></div>
          <div><strong>原生词本</strong><span>${escapeHtml(word.eudicCategory || "未标明")}</span></div>
        </div>
      </section>
    ` : ""}
    <section class="detail-section">
      <h3>助记 · Racine</h3>
      <div class="detail-grid">
        <div><strong>助记</strong><span>${escapeHtml(word.memory || missingText)}</span></div>
        <div><strong>词根</strong><span>${escapeHtml(word.root || missingText)}</span></div>
      </div>
      <div class="pill-row detail-pills">${renderList(word.derived, missingText)}</div>
    </section>
    <section class="detail-section">
      <h3>近义词 · Synonymes</h3>
      <div class="pill-row">${renderList(word.synonyms, missingText)}</div>
    </section>
    <section class="detail-section">
      <h3>反义词 · Antonymes</h3>
      <div class="pill-row">${renderList(word.antonyms, missingText)}</div>
    </section>
    <section class="detail-section">
      <h3>联想词 · Mots associés</h3>
      <div class="pill-row">${renderList(word.associations, missingText)}</div>
    </section>
    ${renderConjugation(word)}
    <section class="detail-section">
      <h3>例句 · Exemples</h3>
      <ol class="examples">
        ${examples.length
          ? examples.map(example => `<li>${escapeHtml(example.fr)}<span>${escapeHtml(example.zh)}</span></li>`).join("")
          : `<li class="muted">${isEudic ? "暂无本地生成例句。" : "暂无例句。"}</li>`}
      </ol>
    </section>
    ${isEudic ? "" : renderApiSection(apiEntry, lookupStatus)}
  `;
}

async function enrichDetailFromApi(word) {
  if (word.source === "eudic") {
    await enrichEudicDetail(word);
    return;
  }
  const cacheKey = lookupCacheKey(word);
  if (lookupCache[cacheKey]) {
    renderDetailBody(word, lookupCache[cacheKey], "已加载本地缓存的法语助手增强内容。");
  }

  if (!navigator.onLine) {
    renderDetailBody(word, lookupCache[cacheKey], "当前离线，显示本地词库和已缓存的在线内容。");
    return;
  }

  try {
    renderDetailBody(word, lookupCache[cacheKey], "正在连接在线词典...");
    const query = stripArticle(word.fr) || word.fr;
    const response = await fetch(`${LOOKUP_API_URL}?word=${encodeURIComponent(query)}&source=${encodeURIComponent(word.fr)}`);
    if (!response.ok) {
      const message = response.status === 404
        ? "尚未部署 API 代理；本地词库仍可离线使用。"
        : `在线词典暂时不可用（HTTP ${response.status}）。`;
      renderDetailBody(word, lookupCache[cacheKey], message);
      return;
    }
    const payload = await response.json();
    const normalized = normalizeLookupPayload(payload);
    if (!hasLookupContent(normalized)) {
      renderDetailBody(word, lookupCache[cacheKey], normalized.message || "在线词典没有返回可用的增强字段。");
      return;
    }
    lookupCache[cacheKey] = { ...normalized, fetchedAt: new Date().toISOString() };
    saveLookupCache();
    if (state.detailWordKey === word.fr && els.detailDialog.open) {
      renderDetailBody(word, lookupCache[cacheKey], "已同步在线词典内容，并缓存到本机。");
    }
  } catch {
    renderDetailBody(word, lookupCache[cacheKey], "无法连接在线词典代理；请检查代理部署和网络。");
  }
}

async function enrichEudicDetail(word) {
  if (!navigator.onLine) {
    renderDetailBody(word, null, "当前离线，显示已缓存的法语助手生词本内容。");
    return;
  }

  try {
    renderDetailBody(word, null, "正在连接法语助手补充释义...");
    const response = await fetch(`${EUDIC_API_URL}?action=word&word=${encodeURIComponent(word.fr)}`);
    if (!response.ok) {
      renderDetailBody(word, null, `法语助手详情暂时不可用（HTTP ${response.status}）。`);
      return;
    }
    const payload = await response.json();
    const detail = normalizeEudicSyncWords([{
      ...word,
      ...(payload.data || {}),
      fr: word.fr,
      eudicCategory: word.eudicCategory
    }])[0];
    if (!detail) {
      renderDetailBody(word, null, "法语助手没有返回可用释义。");
      return;
    }
    updateCachedEudicWord(detail);
    if (state.detailWordKey === word.fr && els.detailDialog.open) {
      renderDetailBody(detail, null, "已从法语助手补充释义，并缓存到本机。");
    }
  } catch {
    renderDetailBody(word, null, "无法连接法语助手详情接口；请稍后重试。");
  }
}

function updateCachedEudicWord(updatedWord) {
  const key = normalize(updatedWord.fr);
  eudicCache.words = (eudicCache.words || []).map(item => (
    normalize(item.fr) === key ? { ...item, ...updatedWord } : item
  ));
  if (!eudicCache.words.some(item => normalize(item.fr) === key)) {
    eudicCache.words.push(updatedWord);
  }
  saveEudicCache();
  words = enhanceWords(mergeWordSources(baseWords, eudicCache.words));
}

function lookupCacheKey(word) {
  return normalize(stripArticle(word.fr) || word.fr);
}

function normalizeLookupPayload(payload = {}) {
  const data = payload.data || payload.result || payload.entry || payload;
  const definitions = normalizeDefinitions(data);
  return {
    source: String(payload.source || data.source || "法语助手 API"),
    word: String(data.word || data.query || data.fr || ""),
    message: String(data.message || payload.message || ""),
    definitions,
    synonyms: normalizeStringList(data.synonyms || data.synonymes || data.synonym || data.syno),
    antonyms: normalizeStringList(data.antonyms || data.antonymes || data.antonym || data.anto),
    associations: normalizeStringList(data.associations || data.related || data.associated || data.collocations),
    examples: normalizeExamples(data.examples || data.exampleSentences || data.sentences),
    conjugation: data.conjugation || data.conjugations || data.forms || null,
    rawHtml: typeof data.html === "string" ? data.html : ""
  };
}

function normalizeDefinitions(data = {}) {
  const direct = [
    ...normalizeStringList(data.definitions),
    ...normalizeStringList(data.definition),
    ...normalizeStringList(data.explains),
    ...normalizeStringList(data.translation),
    ...normalizeStringList(data.translations),
    ...normalizeStringList(data.frDefinition),
    ...normalizeStringList(data.zhDefinition)
  ];
  if (data.basic?.explains) direct.push(...normalizeStringList(data.basic.explains));
  return uniqueList(direct);
}

function normalizeStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return uniqueList(value.flatMap(item => normalizeStringList(item)));
  if (typeof value === "object") return uniqueList(Object.values(value).flatMap(item => normalizeStringList(item)));
  return String(value)
    .split(/\n|；|;/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeExamples(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map(item => {
    if (typeof item === "string") return { fr: item, zh: "" };
    return {
      fr: String(item.fr || item.sentence || item.source || item.text || ""),
      zh: String(item.zh || item.translation || item.target || "")
    };
  }).filter(example => example.fr);
}

function uniqueList(items) {
  const result = [];
  for (const item of items) {
    const text = String(item || "").trim();
    if (text && !result.some(existing => normalize(existing) === normalize(text))) result.push(text);
  }
  return result;
}

function hasLookupContent(entry) {
  return Boolean(
    entry?.definitions?.length ||
    entry?.synonyms?.length ||
    entry?.antonyms?.length ||
    entry?.associations?.length ||
    entry?.examples?.length ||
    entry?.conjugation ||
    entry?.rawHtml
  );
}

function renderApiSection(entry, status) {
  return `
    <section class="detail-section online-section">
      <h3>在线词典增强 · Enrichissement</h3>
      <p class="lookup-status">${escapeHtml(status || "等待在线词典返回内容。")}</p>
      ${entry ? `
        ${entry.message ? `<p class="muted">${escapeHtml(entry.message)}</p>` : ""}
        ${entry.definitions?.length ? `
          <div class="online-block">
            <strong>词典解释</strong>
            <ul>${entry.definitions.slice(0, 8).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
        ` : ""}
        ${entry.synonyms?.length ? `<div class="online-block"><strong>近义词</strong><div class="pill-row">${renderList(entry.synonyms.slice(0, 12))}</div></div>` : ""}
        ${entry.antonyms?.length ? `<div class="online-block"><strong>反义词</strong><div class="pill-row">${renderList(entry.antonyms.slice(0, 12))}</div></div>` : ""}
        ${entry.associations?.length ? `<div class="online-block"><strong>搭配/联想</strong><div class="pill-row">${renderList(entry.associations.slice(0, 12))}</div></div>` : ""}
        ${entry.examples?.length ? `
          <div class="online-block">
            <strong>在线例句</strong>
            <ol class="examples">${entry.examples.slice(0, 5).map(example => `<li>${escapeHtml(example.fr)}${example.zh ? `<span>${escapeHtml(example.zh)}</span>` : ""}</li>`).join("")}</ol>
          </div>
        ` : ""}
        ${entry.conjugation ? renderApiConjugation(entry.conjugation) : ""}
      ` : ""}
    </section>
  `;
}

function renderApiConjugation(conjugation) {
  if (!conjugation || typeof conjugation !== "object") return "";
  const rows = Object.entries(conjugation).slice(0, 24);
  if (!rows.length) return "";
  return `
    <div class="online-block">
      <strong>在线变位</strong>
      <div class="conjugation">
        ${rows.map(([tense, forms]) => `
          <div>
            <strong>${escapeHtml(tense)}</strong>
            ${normalizeStringList(forms).slice(0, 8).map(form => `<span>${escapeHtml(form)}</span>`).join("")}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickQuizWord() {
  const pool = filteredWords();
  state.current = pool[Math.floor(Math.random() * pool.length)] || words[0];
  els.feedback.textContent = "";
  els.answer.value = "";
  renderQuiz();
  els.answer.focus();
}

function renderQuiz() {
  const word = state.current || words[0];
  const frToZh = state.quizMode === "fr-zh";
  els.quizDirection.textContent = frToZh ? "法语 → 中文" : "中文 → 法语";
  els.quizCategory.textContent = word.category;
  els.quizPrompt.textContent = frToZh ? word.fr : word.zh;
  els.answer.placeholder = frToZh ? "输入中文意思" : "输入法语单词或短语";
}

function checkAnswer() {
  const word = state.current;
  if (!word) return;
  const answer = normalize(els.answer.value);
  const expected = state.quizMode === "fr-zh" ? normalize(word.zh) : normalize(word.fr);
  const alternatives = (word.alt || []).map(normalize);
  const ok = expected.includes(answer) || answer.includes(expected) || alternatives.includes(answer);

  state.progress.total += 1;
  if (ok && answer) {
    state.progress.right += 1;
    state.progress.known[word.fr] = true;
  }
  saveProgress();
  renderStats();

  const example = word.examples[0] || { fr: "暂无例句。", zh: "" };
  els.feedback.innerHTML = ok && answer
    ? `<strong>正确。</strong><br>${escapeHtml(word.fr)} = ${escapeHtml(word.zh)}<br>${escapeHtml(example.fr)}<br>${escapeHtml(example.zh)}`
    : `<strong>答案：</strong>${escapeHtml(word.fr)} = ${escapeHtml(word.zh)}<br>${escapeHtml(example.fr)}<br>${escapeHtml(example.zh)}`;
}

function setEudicStatus(message, tone = "") {
  if (!els.eudicStatus) return;
  els.eudicStatus.textContent = message;
  els.eudicStatus.dataset.tone = tone;
}

function renderEudicStatus() {
  const count = eudicCache.words?.length || 0;
  if (!count) {
    setEudicStatus("尚未同步法语助手生词本。同步后会缓存到本机，离线时也可复习。");
    return;
  }
  const syncedAt = eudicCache.syncedAt ? new Date(eudicCache.syncedAt) : null;
  const time = syncedAt && !Number.isNaN(syncedAt.getTime())
    ? syncedAt.toLocaleString("zh-CN", { hour12: false })
    : "未知时间";
  setEudicStatus(`已缓存 ${count} 个法语助手生词，最后同步：${time}。`);
}

async function syncEudicWords() {
  if (!navigator.onLine) {
    setEudicStatus("当前离线，无法同步；仍可使用已缓存的法语助手生词。", "error");
    return;
  }
  els.syncEudic.disabled = true;
  setEudicStatus("正在连接法语助手并同步生词本...");
  try {
    const response = await fetch(`${EUDIC_API_URL}?action=sync`);
    if (!response.ok) {
      const payload = await safeJson(response);
      const message = payload?.error === "Eudic proxy is not configured"
        ? "Vercel 还没有配置 FRDIC_API_KEY，无法同步法语助手生词本。"
        : `法语助手同步失败（HTTP ${response.status}）。`;
      setEudicStatus(message, "error");
      return;
    }
    const payload = await response.json();
    const syncedWords = normalizeEudicSyncWords(payload.words || []);
    eudicCache = {
      source: "eudic",
      syncedAt: payload.syncedAt || new Date().toISOString(),
      words: syncedWords
    };
    saveEudicCache();
    refreshWordsFromSources();
    setEudicStatus(`已同步 ${syncedWords.length} 个法语助手生词，并加入随机测试。`, "success");
  } catch {
    setEudicStatus("无法连接法语助手同步代理；请检查 Vercel 部署和网络。", "error");
  } finally {
    els.syncEudic.disabled = false;
  }
}

function normalizeEudicSyncWords(items) {
  const normalized = items.map(item => ({
    ...item,
    source: "eudic",
    category: "法语助手生词本",
    tags: uniqueList([...(item.tags || []), "法语助手", "生词本"]),
    fr: String(item.fr || item.word || "").trim(),
    zh: String(item.zh || item.translation || item.explanation?.zh || "法语助手未返回中文释义").trim(),
    examples: normalizeExamples(item.examples || []),
    synonyms: normalizeStringList(item.synonyms || []),
    antonyms: normalizeStringList(item.antonyms || []),
    associations: normalizeStringList(item.associations || [])
  })).filter(item => item.fr);
  const seen = new Set();
  return normalized.filter(item => {
    const key = normalize(item.fr);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

els.tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    state.view = tab.dataset.view;
    els.tabs.forEach(item => item.classList.toggle("active", item === tab));
    Object.entries(els.panels).forEach(([name, panel]) => panel.classList.toggle("active", name === state.view));
    if (state.view === "quiz") pickQuizWord();
  });
});

els.search.addEventListener("input", event => {
  state.query = event.target.value;
  renderWords();
});

els.category.addEventListener("change", event => {
  state.category = event.target.value;
  renderWords();
});

els.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    state.tag = chip.dataset.tag;
    els.chips.forEach(item => item.classList.toggle("active", item === chip));
    renderWords();
  });
});

els.check.addEventListener("click", checkAnswer);
els.answer.addEventListener("keydown", event => {
  if (event.key === "Enter") checkAnswer();
});
els.next.addEventListener("click", pickQuizWord);
els.switchQuiz.addEventListener("click", () => {
  state.quizMode = state.quizMode === "fr-zh" ? "zh-fr" : "fr-zh";
  pickQuizWord();
});

els.importFile.addEventListener("change", async event => {
  const [file] = event.target.files;
  if (!file) return;
  const text = await file.text();
  const importedWords = JSON.parse(text);
  if (!Array.isArray(importedWords)) throw new Error("词库必须是数组");
  localStorage.setItem(IMPORT_KEY, JSON.stringify(importedWords));
  location.reload();
});

if (els.syncEudic) {
  els.syncEudic.addEventListener("click", syncEudicWords);
}

els.exportProgress.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.progress, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "delf-b2-progress.json";
  link.click();
  URL.revokeObjectURL(url);
});

els.resetProgress.addEventListener("click", () => {
  state.progress = { known: {}, right: 0, total: 0 };
  saveProgress();
  renderStats();
  renderWords();
});

els.closeDetail.addEventListener("click", () => els.detailDialog.close());
els.detailDialog.addEventListener("click", event => {
  if (event.target === els.detailDialog) els.detailDialog.close();
});

words = enhanceWords(words);
setupCategories();
renderStats();
renderWords();
renderEudicStatus();
pickQuizWord();
