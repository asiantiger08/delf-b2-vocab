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
    const definitions = firstDefined(detail.definitions, detail.definition, detail.explains, detail.exp, detail.translation, detail.translations, detail.basic?.explains);
    const examples = normalizeExamples(firstDefined(detail.examples, detail.sentences, detail.exampleSentences, detail.contexts));
    const zh = normalizeText(item.zh) || firstTranslation(definitions) || normalizeText(detail.translation || detail.trans || "");
    return {
      fr: item.fr,
      zh: zh || "法语助手未返回中文释义",
      category: "法语助手生词本",
      source: "eudic",
      eudicCategory: item.eudicCategory,
      pos: normalizeText(detail.pos || detail.partOfSpeech || detail.nature || ""),
      gender: normalizeText(detail.gender || detail.genre || ""),
      explanation: {
        fr: firstFrenchDefinition(detail, definitions),
        zh: zh || "法语助手未返回中文解释"
      },
      synonyms: normalizeStringList(firstDefined(detail.synonyms, detail.synonymes, detail.syno, detail.synonym)),
      antonyms: normalizeStringList(firstDefined(detail.antonyms, detail.antonymes, detail.anto, detail.antonym)),
      associations: normalizeStringList(firstDefined(detail.associations, detail.related, detail.collocations, detail.phrases, detail.contexts)),
      examples,
      conjugation: detail.conjugation || detail.conjugations || detail.forms || null,
      tags: ["法语助手", "生词本"],
      raw: sanitizeRawDetail(detail)
    };
  });
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
  return String(value)
    .split(/\n|；|;|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function firstFrenchDefinition(detail, definitions) {
  const direct = firstDefined(detail.frDefinition, detail.definition_fr, detail.def_fr);
  const [first] = normalizeStringList(direct || definitions);
  return first || "法语助手未返回法语解释";
}

function firstTranslation(value) {
  const [first] = normalizeStringList(value);
  return first || "";
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
