const DEFAULT_KEY_HEADER = "Authorization";
const DEFAULT_ENDPOINT = "https://api.frdic.com/fr/mcp";
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

  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json"
  };
  headers[keyHeader] = authorizationValue(apiKey, keyPrefix);

  try {
    const payload = await callMcpLookup(endpoint, headers, word, language);

    response.status(200).json({
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

async function callMcpLookup(endpoint, headers, word, language) {
  const url = new URL(endpoint.replace("{language}", language));
  const upstream = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: "get_user_vocab_by_words",
        arguments: { words: [word] }
      }
    })
  });
  const text = await upstream.text();
  if (!upstream.ok) {
    return { message: `法语助手 MCP 请求失败：HTTP ${upstream.status}`, raw: text };
  }
  return parseMcpPayload(text);
}

function parseMcpPayload(text) {
  const dataLine = String(text || "")
    .split(/\r?\n/)
    .find(line => line.startsWith("data:"));
  const jsonText = dataLine ? dataLine.replace(/^data:\s*/, "") : text;
  try {
    const message = JSON.parse(jsonText);
    const content = message.result?.content || [];
    const firstText = content.find(item => item.type === "text")?.text;
    if (!firstText) return message;
    try {
      const parsedText = JSON.parse(firstText);
      if (Array.isArray(parsedText) && !parsedText.length) {
        return { message: "法语助手账号语料库中没有这个词条。该 MCP 工具只返回已收录/已收藏的用户语料，不是公共词典全库。" };
      }
      return parsedText;
    } catch {
      return { definitions: [firstText] };
    }
  } catch {
    return { message: "无法解析法语助手 MCP 返回内容。", raw: text };
  }
}

function normalizeDictionaryPayload(payload) {
  const firstItem = Array.isArray(payload) ? payload[0] : payload;
  const data = firstItem?.data || firstItem?.result || firstItem?.entry || firstItem || {};
  return {
    word: data.word || data.query || data.fr || firstItem?.word || "",
    message: data.message || "",
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
