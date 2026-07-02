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
    const synonyms = ensureAtLeastFive(word.synonyms, relation.synonyms, word.fr);
    const antonyms = ensureAtLeastFive(word.antonyms, relation.antonyms, word.fr);
    return {
      ...word,
      pos: word.pos || grammar.pos,
      gender: word.gender || grammar.gender,
      verb: word.verb || grammar.verb,
      explanation: {
        fr: frenchExplanation(word, grammar),
        zh: chineseExplanation(word, grammar)
      },
      synonyms,
      antonyms
    };
  });
}

function ensureAtLeastFive(primary = [], fallback = [], fr = "") {
  const generalFallback = ["un concept proche", "une idée voisine", "une notion liée", "une expression équivalente", "un terme associé", "une formulation comparable"];
  const result = [];
  for (const item of [...primary, ...fallback, ...generalFallback]) {
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
  return `${pronoun} ${form}`.replace(/\s+/g, " ").replace(/\bje ([aeiouhéèê])/i, "j'$1").replace("' ", "'");
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
  const forms = conjugateVerb(word.verb);
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
      <p class="muted">识别动词：${word.verb}。规则生成适合 B2 复习；个别强不规则动词建议再对照权威变位表。</p>
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
      <h3>近义词 · Synonymes</h3>
      <div class="pill-row">${renderList(word.synonyms)}</div>
    </section>
    <section class="detail-section">
      <h3>反义词 · Antonymes</h3>
      <div class="pill-row">${renderList(word.antonyms)}</div>
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
