const STORAGE_KEY = "delf-b2-vocab-progress";
const IMPORT_KEY = "delf-b2-vocab-import";

let words = [...window.B2_VOCAB];
const imported = localStorage.getItem(IMPORT_KEY);
if (imported) {
  try {
    words = JSON.parse(imported);
  } catch {
    localStorage.removeItem(IMPORT_KEY);
  }
}

let state = {
  view: "browse",
  query: "",
  category: "all",
  tag: "all",
  quizMode: "fr-zh",
  current: null,
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
    const grammar = detectGrammar(word);
    const relation = CATEGORY_RELATIONS[word.category] || { synonyms: [], antonyms: [] };
    const lexical = lexicalRelationFor(word, grammar);
    const synonyms = ensureAtLeastFive(word.synonyms, lexical.synonyms, relation.synonyms, word.fr);
    const antonyms = ensureAtLeastFive(word.antonyms, lexical.antonyms, relation.antonyms, word.fr);
    const associations = ensureAtLeastFive(word.associations, lexical.associations, relation.synonyms, word.fr);
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

function lexicalRelationFor(word, grammar) {
  const keys = [
    grammar.verb,
    normalize(grammar.verb || "").replace(/^s'?|^se\s+/, ""),
    stripArticle(word.fr),
    word.fr
  ].filter(Boolean);
  for (const key of keys) {
    const normalized = normalize(key);
    const matchedKey = Object.keys(LEXICAL_RELATIONS).find(item => normalize(item) === normalized);
    if (matchedKey) return LEXICAL_RELATIONS[matchedKey];
  }
  return { synonyms: [], antonyms: [], associations: [], derived: [] };
}

function stripArticle(fr) {
  return String(fr || "").replace(/^(le|la|les|l'|un|une|des)\s*/i, "").trim();
}

function ensureAtLeastFive(primary = [], fallback = [], secondary = [], fr = "") {
  const generalFallback = ["notion liée", "champ lexical", "contexte", "enjeu", "exemple", "usage"];
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
    card.innerHTML = `
      <div class="word-head">
        <div>
          <h2>${word.fr}</h2>
          <p class="translation">${word.zh}</p>
        </div>
        <button class="known ${done ? "done" : ""}" type="button" aria-label="标记掌握">${done ? "✓" : "○"}</button>
      </div>
      <div class="badge-row">
        <span class="badge">${word.category}</span>
        <span class="badge">${word.pos}</span>
        ${word.gender ? `<span class="badge">${word.gender}</span>` : ""}
        ${word.tags.map(tag => `<span class="badge">${tag}</span>`).join("")}
      </div>
      <ol class="examples">
        ${word.examples.map(example => `<li>${example.fr}<span>${example.zh}</span></li>`).join("")}
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

function renderList(items) {
  if (!items?.length) return `<span class="muted">暂无</span>`;
  return items.map(item => `<span class="pill">${item}</span>`).join("");
}

function renderConjugation(word) {
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
  els.detailCategory.textContent = word.category;
  els.detailTitle.textContent = word.fr;
  els.detailTranslation.textContent = word.zh;
  els.detailBody.innerHTML = `
    <section class="detail-section">
      <h3>词性 · Nature</h3>
      <div class="detail-grid">
        <div><strong>词性</strong><span>${word.pos}</span></div>
        <div><strong>阴阳性</strong><span>${word.gender || "不适用"}</span></div>
      </div>
    </section>
    <section class="detail-section">
      <h3>解释 · Définition</h3>
      <p>${word.explanation.zh}</p>
      <p class="muted">${word.explanation.fr}</p>
    </section>
    <section class="detail-section">
      <h3>助记 · Racine</h3>
      <div class="detail-grid">
        <div><strong>助记</strong><span>${word.memory || "暂无"}</span></div>
        <div><strong>词根</strong><span>${word.root || "暂无"}</span></div>
      </div>
      <div class="pill-row detail-pills">${renderList(word.derived)}</div>
    </section>
    <section class="detail-section">
      <h3>近义词 · Synonymes</h3>
      <div class="pill-row">${renderList(word.synonyms)}</div>
    </section>
    <section class="detail-section">
      <h3>反义词 · Antonymes</h3>
      <div class="pill-row">${renderList(word.antonyms)}</div>
    </section>
    <section class="detail-section">
      <h3>联想词 · Mots associés</h3>
      <div class="pill-row">${renderList(word.associations)}</div>
    </section>
    ${renderConjugation(word)}
    <section class="detail-section">
      <h3>例句 · Exemples</h3>
      <ol class="examples">
        ${word.examples.map(example => `<li>${example.fr}<span>${example.zh}</span></li>`).join("")}
      </ol>
    </section>
  `;
  els.detailDialog.showModal();
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

  const example = word.examples[0];
  els.feedback.innerHTML = ok && answer
    ? `<strong>正确。</strong><br>${word.fr} = ${word.zh}<br>${example.fr}<br>${example.zh}`
    : `<strong>答案：</strong>${word.fr} = ${word.zh}<br>${example.fr}<br>${example.zh}`;
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
pickQuizWord();
