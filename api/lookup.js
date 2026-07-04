const DEFAULT_KEY_HEADER = "Authorization";
const DEFAULT_ENDPOINT = "https://api.frdic.com/api/open/v1/studylist/word";
const DEFAULT_LANGUAGE = "fr";

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
  const word = String(request.query.word || "").trim();

  if (!word) {
    response.status(400).json({ error: "Missing word" });
    return;
  }

  if (!endpoint || !apiKey) {
    response.status(501).json({
      error: "Dictionary proxy is not configured",
      requiredEnv: ["FRDIC_API_KEY"],
      optionalEnv: ["FRDIC_API_URL", "FRDIC_API_LANGUAGE"],
      word
    });
    return;
  }

  const url = new URL(endpoint);
  url.searchParams.set(process.env.FRDIC_API_QUERY_PARAM || "word", word);
  url.searchParams.set(process.env.FRDIC_API_LANGUAGE_PARAM || "language", language);
  if (request.query.source) url.searchParams.set("source", String(request.query.source));

  const headers = {
    Accept: "application/json"
  };
  headers[keyHeader] = authorizationValue(apiKey, keyPrefix);

  try {
    const upstream = await fetch(url, { headers });
    const contentType = upstream.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await upstream.json()
      : { html: await upstream.text() };

    response.status(upstream.status).json({
      source: "frdic",
      word,
      data: normalizeDictionaryPayload(payload)
    });
  } catch (error) {
    response.status(502).json({
      error: "Dictionary upstream request failed",
      message: error instanceof Error ? error.message : "Unknown error",
      word
    });
  }
}

function normalizeDictionaryPayload(payload) {
  const data = payload.data || payload.result || payload.entry || payload;
  return {
    word: data.word || data.query || data.fr || payload.word || "",
    definitions: firstDefined(data.definitions, data.definition, data.explains, data.exp, data.translation, data.translations, data.basic?.explains),
    synonyms: firstDefined(data.synonyms, data.synonymes, data.syno, data.synonym),
    antonyms: firstDefined(data.antonyms, data.antonymes, data.anto, data.antonym),
    associations: firstDefined(data.associations, data.related, data.collocations, data.phrases, data.contexts),
    examples: firstDefined(data.examples, data.sentences, data.exampleSentences, data.contexts),
    conjugation: data.conjugation || data.conjugations || data.forms || null,
    html: typeof data.html === "string" ? data.html : ""
  };
}

function authorizationValue(apiKey, keyPrefix) {
  const trimmed = String(apiKey || "").trim();
  if (!keyPrefix || /^NIS\s+/i.test(trimmed) || /^Bearer\s+/i.test(trimmed)) return trimmed;
  return `${keyPrefix} ${trimmed}`;
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "") || [];
}
