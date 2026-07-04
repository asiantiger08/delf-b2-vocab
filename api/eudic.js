const DEFAULT_KEY_HEADER = "Authorization";
const DEFAULT_ENDPOINT = "https://api.frdic.com/fr/mcp";
const DEFAULT_LANGUAGE = "fr";
const MAX_CATEGORIES = 30;
const MAX_PAGES_PER_CATEGORY = 30;
const PAGE_SIZE = 100;
const DETAIL_CHUNK_SIZE = 20;

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const endpoint = process.env.FRDIC_API_URL || DEFAULT_ENDPOINT;
  const apiKey = process.env.FRDIC_API_KEY;
  const keyHeader = process.env.FRDIC_API_KEY_HEADER || DEFAULT_KEY_HEADER;
  const keyPrefix = process.env.FRDIC_API_KEY_PREFIX || "";
  const language = process.env.FRDIC_API_LANGUAGE || DEFAULT_LANGUAGE;
  const action = String(request.query.action || "sync");

  if (!endpoint || !apiKey) {
    response.status(501).json({
      error: "Eudic proxy is not configured",
      requiredEnv: ["FRDIC_API_KEY"],
      optionalEnv: ["FRDIC_API_URL", "FRDIC_API_LANGUAGE"]
    });
    return;
  }

  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json"
  };
  headers[keyHeader] = authorizationValue(apiKey, keyPrefix);

  try {
    if (action === "categories") {
      const categories = await getCategories(endpoint, headers, language);
      response.status(200).json({ source: "eudic", categories });
      return;
    }

    if (action === "word") {
      const word = String(request.query.word || "").trim();
      if (!word) {
        response.status(400).json({ error: "Missing word" });
        return;
      }
      const entry = await getSingleWordDetail(endpoint, headers, language, word);
      response.status(200).json({ source: "eudic", word, data: entry });
      return;
    }

    const categories = await getCategories(endpoint, headers, language);
    const selectedCategoryId = String(request.query.categoryId || "").trim();
    const selected = selectedCategoryId
      ? categories.filter(category => String(category.id) === selectedCategoryId)
      : categories.slice(0, MAX_CATEGORIES);
    const rawWords = await getWordsFromCategories(endpoint, headers, language, selected);
    const details = await getUserVocabDetails(endpoint, headers, language, rawWords.map(item => item.fr));
    const words = mergeWordsWithDetails(rawWords, details);

    response.status(200).json({
      source: "eudic",
      category: "法语助手生词本",
      syncedAt: new Date().toISOString(),
      categories: selected,
      count: words.length,
      words
    });
  } catch (error) {
    response.status(502).json({
      error: "Eudic upstream request failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

async function getCategories(endpoint, headers, language) {
  const payload = await callMcpTool(endpoint, headers, language, "get_category", {});
  const items = extractArray(payload);
  return uniqueBy(
    items.map((item, index) => ({
      id: String(item.id || item.category_id || item.book_id || item.uuid || item.value || index),
      name: String(item.name || item.category || item.title || item.label || item.book_name || "默认生词本")
    })),
    item => item.id
  );
}

async function getWordsFromCategories(endpoint, headers, language, categories) {
  const allWords = [];
  for (const category of categories) {
    for (let page = 1; page <= MAX_PAGES_PER_CATEGORY; page += 1) {
      const payload = await callMcpTool(endpoint, headers, language, "get_words", {
        id: category.id,
        page,
        page_size: PAGE_SIZE
      });
      const items = extractArray(payload);
      if (!items.length) break;
      for (const item of items) {
        const fr = normalizeWordText(item.word || item.name || item.fr || item.vocab || item.text || item);
        if (!fr) continue;
        allWords.push({
          fr,
          zh: normalizeText(item.translation || item.trans || item.explain || item.meaning || item.note || ""),
          eudicCategory: category.name,
          raw: item
        });
      }
      if (items.length < PAGE_SIZE) break;
    }
  }
  return uniqueBy(allWords, item => normalizeForCompare(item.fr));
}

async function getUserVocabDetails(endpoint, headers, language, words) {
  const details = new Map();
  const uniqueWords = uniqueBy(words.filter(Boolean), item => normalizeForCompare(item));
  for (let index = 0; index < uniqueWords.length; index += DETAIL_CHUNK_SIZE) {
    const chunk = uniqueWords.slice(index, index + DETAIL_CHUNK_SIZE);
    const payload = await callMcpTool(endpoint, headers, language, "get_user_vocab_by_words", { words: chunk });
    for (const item of extractArray(payload)) {
      const data = item?.data || item?.result || item?.entry || item || {};
      const word = normalizeWordText(data.word || data.query || data.fr || item.word || "");
      if (word) details.set(normalizeForCompare(word), data);
    }
  }
  return details;
}

async function getSingleWordDetail(endpoint, headers, language, word) {
  let detail = {};
  try {
    const payload = await callMcpTool(endpoint, headers, language, "get_word", { word });
    detail = extractDetailObject(payload, word);
  } catch {
    detail = {};
  }

  if (!hasDetailContent(detail)) {
    try {
      const payload = await callMcpTool(endpoint, headers, language, "get_user_vocab_by_words", { words: [word] });
      const [first] = extractArray(payload);
      detail = extractDetailObject(first, word);
    } catch {
      detail = {};
    }
  }

  return normalizeWordEntry({
    fr: word,
    zh: "",
    eudicCategory: "",
    raw: {}
  }, detail);
}

async function callMcpTool(endpoint, headers, language, name, args) {
  const url = new URL(endpoint.replace("{language}", language));
  const upstream = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now() + Math.floor(Math.random() * 10000),
      method: "tools/call",
      params: { name, arguments: args }
    })
  });
  const text = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`法语助手 MCP 请求失败：HTTP ${upstream.status}`);
  }
  return parseMcpPayload(text);
}

function parseMcpPayload(text) {
  const dataLine = String(text || "")
    .split(/\r?\n/)
    .find(line => line.startsWith("data:"));
  const jsonText = dataLine ? dataLine.replace(/^data:\s*/, "") : text;
  const message = JSON.parse(jsonText);
  const content = message.result?.content || [];
  const firstText = content.find(item => item.type === "text")?.text;
  if (!firstText) return message.result || message;
  try {
    return JSON.parse(firstText);
  } catch {
    return firstText;
  }
}

function mergeWordsWithDetails(rawWords, details) {
  return rawWords.map(item => {
    const detail = details.get(normalizeForCompare(item.fr)) || {};
    return normalizeWordEntry(item, detail);
  });
}

function normalizeWordEntry(item, detail = {}) {
  const raw = normalizeRawWord(item.raw || {});
  const data = { ...raw, ...detail };
  const definitions = firstDefined(
    data.definitions,
    data.definition,
    data.explains,
    data.exp,
    data.translation,
    data.translations,
    data.trans,
    data.meaning,
    data.note,
    data.basic?.explains
  );
  const parsedExp = parseExpText(firstDefined(data.exp, data.explains, data.definition, data.definitions, data.translation, data.trans, data.meaning, item.zh));
  const examples = [
    ...normalizeExamples(firstDefined(data.examples, data.sentences, data.exampleSentences, data.contexts, data.sample_sentences)),
    ...parsedExp.examples
  ];
  const zh = cleanDefinitionText(normalizeText(item.zh)) || parsedExp.zh || firstTranslation(definitions) || cleanDefinitionText(data.translation || data.trans || data.meaning || "");
  const frDefinition = firstFrenchDefinition(data, definitions);
  const grammar = parseGrammar(data, parsedExp.cleaned);
  return {
    fr: item.fr,
    zh: zh || "法语助手未返回中文释义",
    category: "法语助手生词本",
    source: "eudic",
    eudicCategory: item.eudicCategory,
    pos: normalizeText(data.pos || data.partOfSpeech || data.nature || data.part_of_speech || grammar.pos || ""),
    gender: normalizeText(data.gender || data.genre || grammar.gender || ""),
    explanation: {
      fr: frDefinition,
      zh: zh || "法语助手未返回中文解释"
    },
    synonyms: normalizeStringList(firstDefined(data.synonyms, data.synonymes, data.syno, data.synonym)),
    antonyms: normalizeStringList(firstDefined(data.antonyms, data.antonymes, data.anto, data.antonym)),
    associations: normalizeStringList(firstDefined(data.associations, data.related, data.collocations, data.phrases, data.contexts)),
    examples: uniqueExamples(examples),
    conjugation: data.conjugation || data.conjugations || data.forms || null,
    tags: ["法语助手", "生词本"],
    raw: sanitizeRawDetail(data)
  };
}

function normalizeRawWord(raw) {
  if (!raw || typeof raw !== "object") return {};
  return {
    word: raw.word || raw.name || raw.fr || raw.vocab || raw.text,
    translation: raw.translation || raw.trans || raw.explain || raw.meaning || raw.note,
    definitions: raw.definitions || raw.definition || raw.explains || raw.exp,
    examples: raw.examples || raw.sentences || raw.exampleSentences,
    pos: raw.pos || raw.partOfSpeech || raw.nature,
    gender: raw.gender || raw.genre,
    synonyms: raw.synonyms || raw.synonymes || raw.syno || raw.synonym,
    antonyms: raw.antonyms || raw.antonymes || raw.anto || raw.antonym,
    associations: raw.associations || raw.related || raw.collocations || raw.phrases
  };
}

function extractDetailObject(payload, word) {
  const first = Array.isArray(payload) ? payload[0] : payload;
  const data = first?.data || first?.result || first?.entry || first?.wordInfo || first || {};
  if (!data || typeof data !== "object") return {};
  const result = { ...data };
  if (!result.word) result.word = word;
  return result;
}

function hasDetailContent(detail) {
  if (!detail || typeof detail !== "object") return false;
  return Boolean(
    firstTranslation(firstDefined(detail.definitions, detail.definition, detail.explains, detail.exp, detail.translation, detail.translations, detail.trans, detail.meaning, detail.basic?.explains)) ||
    normalizeExamples(firstDefined(detail.examples, detail.sentences, detail.exampleSentences, detail.contexts)).length ||
    normalizeStringList(firstDefined(detail.synonyms, detail.synonymes, detail.syno, detail.synonym)).length ||
    detail.conjugation ||
    detail.conjugations ||
    detail.forms
  );
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["data", "result", "items", "words", "categories", "list", "rows", "vocabularies"]) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && typeof payload[key] === "object") {
      const nested = extractArray(payload[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

function normalizeExamples(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map(item => {
    if (typeof item === "string") return { fr: item, zh: "" };
    return {
      fr: normalizeText(item.fr || item.sentence || item.source || item.text || item.example || ""),
      zh: normalizeText(item.zh || item.translation || item.target || item.trans || "")
    };
  }).filter(example => example.fr);
}

function normalizeStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return uniqueBy(value.flatMap(item => normalizeStringList(item)), normalizeForCompare);
  if (typeof value === "object") return uniqueBy(Object.values(value).flatMap(item => normalizeStringList(item)), normalizeForCompare);
  return stripHtml(value)
    .split(/\n|；|;|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function firstFrenchDefinition(detail, definitions) {
  const direct = firstDefined(detail.frDefinition, detail.definition_fr, detail.def_fr);
  const [first] = normalizeStringList(direct || definitions);
  return first && !/[\u4e00-\u9fff]/.test(first) ? first : "法语助手未返回法语解释";
}

function firstTranslation(value) {
  return cleanDefinitionText(normalizeStringList(value).join(" "));
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "") || [];
}

function normalizeWordText(value) {
  if (typeof value === "object") return "";
  return normalizeText(value);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function cleanDefinitionText(value) {
  const cleaned = stripHtml(value)
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^(v\.|n\.|adj\.|adv\.|pron\.|pré?p\.|conj\.)\b/i.test(line))
    .filter(line => /[\u4e00-\u9fff]/.test(line));
  return cleaned.slice(0, 4).join("；");
}

function parseExpText(value) {
  const cleaned = stripHtml(value);
  const lines = cleaned.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const zhLines = lines
    .filter(line => /[\u4e00-\u9fff]/.test(line))
    .filter(line => !/[a-zàâçéèêëîïôûùüÿñæœ]{3,}\s+[\wàâçéèêëîïôûùüÿñæœ'\- ]+[\u4e00-\u9fff]/i.test(line));
  return {
    cleaned,
    zh: cleanDefinitionText(zhLines.join("\n")),
    examples: lines.flatMap(line => exampleFromMixedLine(line)).filter(Boolean)
  };
}

function exampleFromMixedLine(line) {
  const text = stripHtml(line);
  if (!/[\u4e00-\u9fff]/.test(text) || !/[a-zàâçéèêëîïôûùüÿñæœ]/i.test(text)) return [];
  const match = text.match(/^(.+?[a-zàâçéèêëîïôûùüÿñæœ0-9'’.,;:!?() -])\s*([\u4e00-\u9fff].*)$/i);
  if (!match) return [];
  const fr = match[1].replace(/^\d+\.\s*/, "").trim();
  const zh = match[2].trim();
  if (fr.length < 3 || zh.length < 2) return [];
  return [{ fr, zh }];
}

function parseGrammar(data, expText) {
  const source = normalizeText(data.pos || data.partOfSpeech || data.nature || data.part_of_speech || expText);
  if (/n\.?\s*f\.?|nom\s+féminin/i.test(source)) return { pos: "nom", gender: "féminin" };
  if (/n\.?\s*m\.?|nom\s+masculin/i.test(source)) return { pos: "nom", gender: "masculin" };
  if (/v\.|verbe/i.test(source)) return { pos: "verbe", gender: "" };
  if (/adj\.|adjectif/i.test(source)) return { pos: "adjectif", gender: "" };
  if (/adv\.|adverbe/i.test(source)) return { pos: "adverbe", gender: "" };
  return { pos: "", gender: "" };
}

function uniqueExamples(examples) {
  return uniqueBy(examples.filter(example => example?.fr), example => normalizeForCompare(`${example.fr} ${example.zh || ""}`));
}

function normalizeForCompare(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function sanitizeRawDetail(detail) {
  if (!detail || typeof detail !== "object") return {};
  const result = { ...detail };
  delete result.html;
  delete result.rawHtml;
  return result;
}

function authorizationValue(apiKey, keyPrefix) {
  const trimmed = String(apiKey || "").trim();
  if (!keyPrefix || /^NIS\s+/i.test(trimmed) || /^Bearer\s+/i.test(trimmed)) return trimmed;
  return `${keyPrefix} ${trimmed}`;
}
