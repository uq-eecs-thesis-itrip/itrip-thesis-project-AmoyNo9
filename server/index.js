require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const {
  cleanThinkText,
  extractPOIFromSources,
  stcfFilter,
  optimizeDraftAnswer
} = require("./stcfAlgorithm");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 5000;
const DEEPSEEK_API_KEY = normalizeBearerToken(process.env.DEEPSEEK_API_KEY || "");
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 300000);
const DEEPSEEK_MAX_TOKENS = Number(process.env.DEEPSEEK_MAX_TOKENS || 2200);
const LOCAL_KNOWLEDGE_DIR = path.resolve(__dirname, process.env.LOCAL_KNOWLEDGE_DIR || "./knowledge");
const RAG_TOP_K = Number(process.env.RAG_TOP_K || 18);

function normalizeBearerToken(value = "") {
  const token = String(value || "").trim();
  if (!token) return "";
  return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
}

function getDeepSeekHeaders() {
  return {
    Authorization: DEEPSEEK_API_KEY,
    "Content-Type": "application/json"
  };
}

function getAxiosErrorMessage(err) {
  return err.response?.data || err.message || "Unknown error";
}

function readKnowledgeFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  // New knowledge base is JSON-only. Keeping this JSON-only avoids duplicated POIs from .md + .json pairs.
  const allowedExt = new Set([".json"]);
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExt.has(ext)) continue;
      files.push({
        title: entry.name,
        path: fullPath,
        relativePath: path.relative(dir, fullPath),
        text: fs.readFileSync(fullPath, "utf8")
      });
    }
  }

  walk(dir);
  return files;
}

function normalizeSearchText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNoSpace(text = "") {
  return normalizeSearchText(text).replace(/\s+/g, "");
}

function tokenize(text = "") {
  const normalized = normalizeSearchText(text);
  const englishTokens = normalized.split(/\s+/).filter(Boolean).filter(token => token.length >= 2);
  const chineseTokens = [];
  const chineseChunks = String(text || "").match(/[\u4e00-\u9fa5]{2,}/g) || [];

  for (const chunk of chineseChunks) {
    chineseTokens.push(chunk);
    for (let i = 0; i < chunk.length - 1; i++) chineseTokens.push(chunk.slice(i, i + 2));
    for (let i = 0; i < chunk.length - 2; i++) chineseTokens.push(chunk.slice(i, i + 3));
  }

  return [...new Set([...englishTokens, ...chineseTokens])];
}

function parseJSONDoc(text = "") {
  try {
    const start = String(text).indexOf("{");
    const end = String(text).lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    return JSON.parse(String(text).slice(start, end + 1));
  } catch {
    return null;
  }
}

function detectQueryIntent(query = "") {
  return {
    wantsFood: /food|eat|restaurant|snack|cuisine|local food|美食|吃|小吃|餐厅|饭|甜品|海鲜|沙茶面|花生汤|五香|福建菜|闽南|夜市|street food/i.test(query),
    wantsCulture: /culture|museum|temple|history|architecture|art|old street|文化|历史|博物馆|寺|建筑|艺术|中山路|八市|老街|骑楼|华侨|嘉庚|文创|村落|街区|temple/i.test(query),
    wantsScenery: /scenery|beach|park|island|sea|sunrise|sunset|view|景点|风景|海|沙滩|公园|鼓浪屿|环岛路|植物园|海边|seaside/i.test(query),
    wantsNight: /night|evening|nightlife|晚上|夜晚|夜游|夜景|夜宵/i.test(query),
    wantsRelaxed: /relaxing|easy|slow|less walking|轻松|少走路|不累|慢节奏|citywalk/i.test(query)
  };
}

function inferDocCategory(text = "") {
  if (/food|美食|小吃|餐厅|甜品|海鲜|沙茶面|花生汤|五香|鸭肉粥|福建菜|闽南菜|夜市|烧烤|姜母鸭|海蛎煎|street food|snack/i.test(text)) return "food";
  if (/culture|文化|历史|寺|博物馆|建筑|中山路|八市|老街|骑楼|艺术|华侨|嘉庚|文创|村落|街区|village|creative|temple/i.test(text)) return "culture";
  if (/scenery|景点|风景|海滩|公园|鼓浪屿|环岛路|沙滩|海边|植物园|seaside|beach|view/i.test(text)) return "scenery";
  return "unknown";
}

function getDocAliases(doc = {}) {
  const json = parseJSONDoc(doc.text || "") || {};
  const semantic = json.semantic || {};
  const routeRole = json.route_role || {};
  const eire = json.EIRE || {};
  const title = String(doc.title || "");

  return [
    title,
    title.replace(/\.(md|json|txt)$/i, ""),
    title.replace(/\.(md|json|txt)$/i, "").replace(/^XM\d+[_\s-]*/i, ""),
    json.poi_id,
    json.id,
    json.name,
    json.title,
    json.english_name,
    json.name_en,
    json.en_name,
    json.pinyin,
    json.area,
    json.parent_poi,
    ...(json.aliases || []),
    ...(semantic.tags || []),
    ...(semantic.scenarios || []),
    ...(semantic.secondary_categories || []),
    ...(eire.entity || []),
    ...(eire.intent || []),
    ...(eire.relation || []),
    ...(routeRole.primary_for || []),
    ...(routeRole.secondary_for || [])
  ]
    .filter(Boolean)
    .map(x => String(x).trim())
    .filter(x => x.length >= 2);
}

function extractSourceIdentityText(doc = {}) {
  return getDocAliases(doc).join("\n");
}

function aliasMatches(a = "", b = "") {
  const na = normalizeSearchText(a);
  const nb = normalizeSearchText(b);
  const nsa = normalizeNoSpace(a);
  const nsb = normalizeNoSpace(b);
  if (!na || !nb || na.length < 2 || nb.length < 2) return false;
  return na.includes(nb) || nb.includes(na) || (nsa.length >= 2 && nsb.length >= 2 && (nsa.includes(nsb) || nsb.includes(nsa)));
}

function identityMatchesDraftPOI(sourceLike = {}, draftPOINames = []) {
  if (!draftPOINames.length) return false;
  const aliases = getDocAliases({ title: sourceLike.title, text: sourceLike.text });
  return draftPOINames.some(name => aliases.some(alias => aliasMatches(alias, name)));
}

function scoreDocument(doc, query, options = {}) {
  const queryTokens = tokenize(query);
  const docText = `${doc.title}\n${doc.text}`;
  const normalizedDoc = normalizeSearchText(docText);
  const docNoSpace = normalizedDoc.replace(/\s+/g, "");
  const aliases = getDocAliases(doc);
  const aliasText = aliases.join("\n");
  const normalizedIdentity = normalizeSearchText(aliasText);
  const identityNoSpace = normalizeNoSpace(aliasText);
  const intent = detectQueryIntent(query);
  const category = inferDocCategory(docText);

  let score = 0;
  const matchedTokens = [];

  for (const token of queryTokens) {
    const normalizedToken = normalizeSearchText(token);
    if (!normalizedToken) continue;
    if (normalizedDoc.includes(normalizedToken)) {
      score += normalizedToken.length >= 3 ? 2 : 1;
      matchedTokens.push(token);
    }
  }

  const mustIncludePhrases = options.mustIncludePhrases || [];
  for (const phrase of mustIncludePhrases) {
    const normalizedPhrase = normalizeSearchText(phrase);
    const phraseNoSpace = normalizeNoSpace(phrase);
    if (!normalizedPhrase || normalizedPhrase.length < 2) continue;

    const identityMatched =
      normalizedIdentity.includes(normalizedPhrase) ||
      (phraseNoSpace.length >= 2 && identityNoSpace.includes(phraseNoSpace)) ||
      aliases.some(alias => aliasMatches(alias, phrase));

    const fullTextMatched =
      normalizedDoc.includes(normalizedPhrase) ||
      (phraseNoSpace.length >= 2 && docNoSpace.includes(phraseNoSpace));

    if (identityMatched) {
      score += 100;
      matchedTokens.push(`DRAFT_POI_IDENTITY:${phrase}`);
    } else if (fullTextMatched) {
      score += 5;
      matchedTokens.push(`DRAFT_POI_CONTEXT_ONLY:${phrase}`);
    }
  }

  const categoryBoost = options.draftVerificationMode ? 1 : 6;
  if (intent.wantsFood && category === "food") score += categoryBoost;
  if (intent.wantsCulture && category === "culture") score += categoryBoost;
  if (intent.wantsScenery && category === "scenery") score += categoryBoost;

  if (intent.wantsNight && /night|晚上|夜晚|夜景|夜游|21:|22:|23:|24小时|open 24/i.test(docText)) {
    score += options.draftVerificationMode ? 1 : 3;
  }

  const poiBoosts = [
    [/gulangyu|鼓浪屿/i, options.draftVerificationMode ? 2 : 8],
    [/bashi|八市/i, options.draftVerificationMode ? 2 : 8],
    [/zhongshan|中山路/i, options.draftVerificationMode ? 2 : 8],
    [/zengcuoan|曾厝垵/i, options.draftVerificationMode ? 2 : 30],
    [/nanputuo|南普陀/i, options.draftVerificationMode ? 2 : 30]
  ];

  for (const [regex, boost] of poiBoosts) {
    if (regex.test(query) && regex.test(docText)) score += boost;
  }

  return { score, matchedTokens, category };
}

function localRagSearch(query, options = {}) {
  const topK = options.topK || RAG_TOP_K;
  const processLog = [];
  processLog.push(`Reading local knowledge files from: ${LOCAL_KNOWLEDGE_DIR}`);

  const docs = readKnowledgeFiles(LOCAL_KNOWLEDGE_DIR);
  processLog.push(`Loaded local knowledge file(s).`);

  const scoredDocs = docs
    .map(doc => {
      const scored = scoreDocument(doc, query, {
        mustIncludePhrases: options.mustIncludePhrases || [],
        draftVerificationMode: options.draftVerificationMode || false
      });
      return { ...doc, score: scored.score, matchedTokens: scored.matchedTokens, category: scored.category };
    })
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  processLog.push(`Local RAG selected ${scoredDocs.length} relevant source file(s).`);
  processLog.push(`Selected sources: ${scoredDocs.length ? scoredDocs.map(doc => `${doc.title}(${doc.score})`).join(", ") : "none"}`);

  const sources = scoredDocs.map(doc => ({
    title: doc.title,
    text: doc.text,
    score: doc.score,
    category: doc.category,
    path: doc.relativePath,
    matchedTokens: doc.matchedTokens
  }));

  return {
    sources,
    processLog,
    debug: {
      knowledge_dir: LOCAL_KNOWLEDGE_DIR,
      loaded_file_count: docs.length,
      selected_source_count: sources.length,
      top_k: topK
    }
  };
}

function forceIncludeDraftPOISources(existingSources = [], draftPOINames = []) {
  const docs = readKnowledgeFiles(LOCAL_KNOWLEDGE_DIR);
  const existingTitles = new Set(existingSources.map(s => s.title));
  const extraSources = [];

  for (const doc of docs) {
    if (existingTitles.has(doc.title)) continue;
    if (!identityMatchesDraftPOI(doc, draftPOINames)) continue;
    extraSources.push({
      title: doc.title,
      text: doc.text,
      score: 999,
      category: inferDocCategory(doc.text),
      path: doc.relativePath,
      matchedTokens: ["FORCED_DRAFT_POI_IDENTITY"]
    });
    existingTitles.add(doc.title);
  }

  return extraSources;
}

function filterSourcesByDraftPOIIdentity(sources = [], draftPOINames = []) {
  if (!draftPOINames.length) return sources;
  return sources.filter(source => identityMatchesDraftPOI(source, draftPOINames));
}

async function callDeepSeek(messages, options = {}) {
  if (!DEEPSEEK_API_KEY) {
    return "DeepSeek API key is missing. Please set DEEPSEEK_API_KEY in your environment variables.";
  }

  try {
    const requestBody = {
      model: DEEPSEEK_MODEL,
      messages,
      stream: false,
      temperature: options.temperature ?? 0.35,
      max_tokens: options.maxTokens || DEEPSEEK_MAX_TOKENS
    };

    const res = await axios.post("https://api.deepseek.com/chat/completions", requestBody, {
      headers: getDeepSeekHeaders(),
      timeout: options.timeout || DEEPSEEK_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const content = res.data?.choices?.[0]?.message?.content || "";
    return cleanThinkText(content) || "DeepSeek returned no valid content.";
  } catch (err) {
    const detail = getAxiosErrorMessage(err);
    console.error("DeepSeek API error:", detail);

    if (err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout") || err.message?.toLowerCase().includes("aborted")) {
      return "DeepSeek API request timed out or was aborted. Please increase DEEPSEEK_TIMEOUT_MS, reduce RAG_TOP_K, reduce max_tokens, or use deepseek-v4-flash for testing.";
    }

    return "DeepSeek API call failed. Please check your API key, model name, network connection, and account balance.";
  }
}

function buildInitialDraftPrompt(message) {
  return `
You are a Xiamen travel planner.

User request:
${message}

Task:
Generate an initial travel route draft.

Output format requirements:
1. Write in English.
2. Use Chinese POI names unchanged if you use Chinese place names.
3. For every Chinese POI heading, write Chinese name (Pinyin).
4. Output ONLY the route plan.
5. Do not include summaries, tables, metadata, source lists, markdown separators, or internal reasoning.
6. Do not output <think>.

Use this structure for one-day routes:
Title: One short route title

Morning: POI name (pinyin)
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...

Noon: POI name (pinyin)
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...

Afternoon: POI name (pinyin)
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...

Evening: POI name (pinyin)
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...

For multi-day routes, prefix each slot with Day 1 / Day 2, for example:
Day 1 Morning: POI name (pinyin)
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
`.trim();
}

function cleanDraftPOIName(name = "") {
  return String(name || "")
    .replace(/\(.*?\)|（.*?）/g, "")
    .replace(/^Day\s*\d+\s*/i, "")
    .replace(/\s*(\+|&|\/|、|和|及|与)\s*.*$/i, "")
    .replace(/\s+near\s+.*$/i, "")
    .replace(/\s+around\s+.*$/i, "")
    .replace(/[-–—]\s*.*$/, "")
    .trim();
}

function extractPossiblePOINamesFromDraft(draftAnswer = "") {
  const lines = String(draftAnswer || "").split(/\n+/).map(line => line.trim()).filter(Boolean);
  const poiNames = [];

  for (const line of lines) {
    const cleanedLine = line.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();
    const timeSlotMatch = cleanedLine.match(/^(day\s*\d+\s*)?(morning|noon|afternoon|evening|late afternoon|上午|中午|下午|晚上|早上|傍晚)\s*[:：]\s*(.+)$/i);

    if (timeSlotMatch?.[3]) {
      const raw = timeSlotMatch[3].replace(/^[-*•]\s*/, "").trim();
      const primaryName = cleanDraftPOIName(raw);
      if (primaryName) poiNames.push(primaryName);
      const parts = raw
        .replace(/\(.*?\)|（.*?）/g, "")
        .split(/\+|&|\/|、|和|及|与|near|around/i)
        .map(x => cleanDraftPOIName(x))
        .filter(x => x.length >= 2);
      poiNames.push(...parts);
    }

    const titleLikeMatch = cleanedLine.match(/^([^:：]{2,50})$/);
    if (titleLikeMatch?.[1] && /[\u4e00-\u9fa5]|XM\d+|Museum|Park|Cuisine|Soup|Temple|Road|Street|Beach|Island|Village|University|Art|Garden|Fort/i.test(titleLikeMatch[1])) {
      const titleName = cleanDraftPOIName(titleLikeMatch[1]);
      if (titleName) poiNames.push(titleName);
    }
  }

  return [...new Set(poiNames.map(name => cleanDraftPOIName(name)).filter(name => name.length >= 2))];
}

function normalizePOIMatchText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9\s]/gu, " ")
    .replace(/\s+/g, "")
    .trim();
}

function getPOIAliasListForDraftMatch(poi = {}) {
  return [
    poi.name,
    poi.english_name,
    poi.name_en,
    poi.pinyin,
    poi.poi_id,
    poi.source_title,
    poi.source_title?.replace(/\.(md|json|txt)$/i, ""),
    ...(poi.aliases || []),
    ...(poi.semantic?.tags || []),
    ...(poi.semantic?.scenarios || [])
  ]
    .filter(Boolean)
    .map(x => String(x).trim())
    .filter(x => x.length >= 2);
}

function markDraftMentionedPOIs(poiList = [], draftPOINames = []) {
  const draftKeys = new Set(
    draftPOINames
      .map(name => normalizePOIMatchText(name))
      .filter(Boolean)
  );

  return poiList.map(poi => {
    const aliases = getPOIAliasListForDraftMatch(poi);
    const mentioned = aliases.some(alias => {
      const aliasKey = normalizePOIMatchText(alias);
      if (!aliasKey) return false;

      return (
        draftKeys.has(aliasKey) ||
        [...draftKeys].some(draftKey => {
          if (draftKey.length < 2 || aliasKey.length < 2) return false;
          return draftKey === aliasKey;
        })
      );
    });

    return {
      ...poi,
      _mentioned_in_draft: mentioned
    };
  });
}

function buildRagQueryFromDraft(userMessage = "", draftAnswer = "") {
  const poiNames = extractPossiblePOINamesFromDraft(draftAnswer);
  const intentKeywords = [];

  if (/美食|吃|小吃|餐厅|food|snack|restaurant|cuisine/i.test(userMessage)) {
    intentKeywords.push("food snack restaurant local cuisine 福建菜 闽南 小吃 沙茶面 花生汤 五香 夜市 street food");
  }
  if (/文化|历史|博物馆|建筑|culture|history|museum|heritage|temple/i.test(userMessage)) {
    intentKeywords.push("culture history museum architecture heritage temple 华侨 嘉庚 博物馆 建筑 文创 村落 街区 南普陀寺");
  }
  if (/风景|景点|海边|公园|scenery|view|park|beach|island/i.test(userMessage)) {
    intentKeywords.push("scenery view park beach island 海边 公园 鼓浪屿 环岛路 seaside village 曾厝垵 日落 看海");
  }
  if (/晚上|夜晚|夜景|夜宵|night|evening/i.test(userMessage)) {
    intentKeywords.push("night evening nightlife night view 夜景 夜宵 晚上 夜市 曾厝垵");
  }
  if (/轻松|少走路|citywalk|relax|easy/i.test(userMessage)) {
    intentKeywords.push("relaxed citywalk short walking easy route 少走路 轻松");
  }

  return [userMessage, poiNames.length ? `Draft POIs: ${poiNames.join(", ")}` : "", draftAnswer, intentKeywords.join("\n")]
    .filter(Boolean)
    .join("\n");
}

function compactPOIForPrompt(poi = {}) {
  return {
    name: poi.name,
    pinyin: poi.pinyin || "",
    english_name: poi.english_name || poi.name_en || "",
    aliases: poi.aliases || [],
    category: poi.semantic?.main_category || "unknown",
    secondary_categories: poi.semantic?.secondary_categories || [],
    scenarios: poi.semantic?.scenarios || [],
    area: poi.area || "",
    parent_poi: poi.parent_poi || null,
    is_area_poi: Boolean(poi.is_area_poi),
    is_sub_poi: Boolean(poi.is_sub_poi),
    address: poi.address || "unknown",
    open_time: poi.time?.open_time || "unknown",
    close_time: poi.time?.close_time || "unknown",
    recommended_duration_min: poi.time?.recommended_duration_min || "unknown",
    best_visit_time: poi.time?.best_visit_time || "unknown",
    night_available: poi.time?.night_available,
    route_role: poi.route_role || {},
    description: poi.description || ""
  };
}

function compactDayPlanForPrompt(dayPlan = []) {
  return dayPlan.map(day => ({
    day: day.day,
    theme: day.theme,
    areas: day.areas || [],
    pois: (day.pois || []).map(compactPOIForPrompt),
    route_distance: day.route_distance || null
  }));
}

function buildFinalPrompt({ message, optimizedDraft, filteredPOIs, dayPlan }) {
  const allowedPOIs = filteredPOIs.map(compactPOIForPrompt);
  const compactDayPlan = compactDayPlanForPrompt(dayPlan);

  return `
You are a strict Xiamen travel route optimizer.

User request:
${message}

Filtering output summary:
${optimizedDraft}

Allowed reasonable POIs:
${JSON.stringify(allowedPOIs, null, 2)}

Route assignment after filtering:
${JSON.stringify(compactDayPlan, null, 2)}

Task:
Rewrite the final answer using ONLY the allowed reasonable POIs and the route assignment.

Output format requirements:
1. Write the final answer in English.
2. Keep Chinese POI names unchanged.
3. For every POI heading, output the POI name as: Chinese name (Pinyin).
4. If a POI has a pinyin field, use that pinyin exactly.
5. If pinyin is missing, generate standard Hanyu Pinyin.
6. Output ONLY the final route plan.
7. Do not output route summary.
8. Do not output overview.
9. Do not output tables.
10. Do not output markdown separators such as "---".
11. Do not output source list.
12. Do not output metadata.
13. Do not mention local RAG.
14. Do not mention filtering algorithm.
15. Do not mention internal scores.
16. Do not output removed content.
17. Do not add new POIs.
18. Do not output <think>.

Route structure rules:
1. Follow the provided route assignment by day as closely as possible.
2. Do not split POIs from the same area across different days unless the route assignment already does so.
3. If a large area POI is selected, do not separately add internal sub-POIs unless they are already in the allowed POI list and route assignment.
4. For a scenic route, prioritize scenery POIs. Culture POIs can only be supporting stops, not the majority of the route.
5. Avoid repeating the same travel area across different days.
6. If multiple allowed POIs are located inside 鼓浪屿, arrange them on the same day.
7. If a day has only two feasible POIs, output only two slots for that day instead of inventing new POIs.

Use this structure:

Title: One short route title

Day 1: Route theme

Morning: POI name (Pinyin)
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

Afternoon: POI name (Pinyin)
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

Day 2: Route theme

Morning: POI name (Pinyin)
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

Afternoon: POI name (Pinyin)
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

Information rules:
1. If opening time is unknown, write "unknown".
2. If address is unknown, write "unknown".
3. If estimated stay is unknown, write "unknown".
4. Be concise, practical, and route-oriented.
`.trim();
}

app.post("/api/travel-plan", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ answer: "Please enter your travel request.", pois: [] });
    }

    const userMessage = message.trim();
    const deepseekProcess = [];
    const ragProcess = [];
    const filterProcess = [];

    deepseekProcess.push("Sending user request to DeepSeek for initial draft generation.");
    deepseekProcess.push("DeepSeek is generating a draft without local RAG context.");

    const draftPrompt = buildInitialDraftPrompt(userMessage);
    const draftAnswer = await callDeepSeek(
      [
        { role: "system", content: "You are a Xiamen travel planner. Generate only a clean initial route draft. Do not include summaries, tables, metadata, source lists, markdown separators, or internal reasoning." },
        { role: "user", content: draftPrompt }
      ],
      { temperature: 0.65, maxTokens: 1800 }
    );

    deepseekProcess.push("DeepSeek generated the initial draft.");
    ragProcess.push("Building local RAG query from user request and DeepSeek draft.");

    const draftPOINames = extractPossiblePOINamesFromDraft(draftAnswer);
    ragProcess.push(`Extracted possible POI names from draft: ${draftPOINames.length ? draftPOINames.join(", ") : "none"}`);

    const ragQuery = buildRagQueryFromDraft(userMessage, draftAnswer);
    ragProcess.push("Starting local RAG retrieval to verify the DeepSeek draft.");

    const ragResult = localRagSearch(ragQuery, {
      topK: RAG_TOP_K,
      mustIncludePhrases: draftPOINames,
      draftVerificationMode: true
    });

    ragProcess.push(...ragResult.processLog);

    const forcedSources = forceIncludeDraftPOISources(ragResult.sources, draftPOINames);
    if (forcedSources.length > 0) {
      ragProcess.push(`Force-included draft POI source(s): ${forcedSources.map(s => s.title).join(", ")}`);
    }

    const mergedSources = [...ragResult.sources, ...forcedSources];
    const sources = filterSourcesByDraftPOIIdentity(mergedSources, draftPOINames);
    ragProcess.push(`Filtered RAG sources by draft POI identity: ${sources.length}/${mergedSources.length} source item(s) kept.`);

    if (!sources.length) {
      return res.json({
        answer: "DeepSeek generated an initial draft, but local RAG found no matching source identity to verify its POIs. Please check whether your local POI file names, JSON name/title, pinyin, aliases, or English names match the draft POI names.",
        draftAnswer,
        optimizedDraft: "",
        pois: [],
        removedPOIs: [],
        hiddenDuplicates: [],
        dayPlan: [],
        rejectedClaims: [{ sentence: "No local RAG source identity matched the DeepSeek draft POIs.", reason: "The draft could not be verified by local knowledge file identity fields." }],
        intent: null,
        debug: { ...ragResult.debug, rag_query: ragQuery, draft_poi_names: draftPOINames, forced_source_count: forcedSources.length, forced_sources: forcedSources.map(s => s.title), identity_filtered_source_count: sources.length },
        thinking: { deepseekProcess, ragProcess, filterProcess },
        processLog: [...deepseekProcess, ...ragProcess, ...filterProcess]
      });
    }

    filterProcess.push("Extracting POI objects from matched local RAG sources.");
    const rawPOIList = extractPOIFromSources(sources);
    const poiList = markDraftMentionedPOIs(rawPOIList, draftPOINames);

    const draftMentionedCount = poiList.filter(poi => poi._mentioned_in_draft).length;

    filterProcess.push(
     `Extracted ${poiList.length} POI object(s) from matched local RAG sources.`
    );

    filterProcess.push(
     `Marked ${draftMentionedCount}/${poiList.length} POI object(s) as mentioned in the DeepSeek draft.`
    );
    filterProcess.push("Running filtering algorithm to remove unreasonable or unsupported POIs.");

    const {
      intent,
      filteredPOIs,
      removedPOIs,
      hiddenDuplicates,
      dayPlan,
      debug,
      processLog: stcfProcessLog
    } = stcfFilter(poiList, userMessage, {
      topK: 8,
      filterMode: "verify_draft_with_rag",
      maxSecondaryCulture: 1,
      maxSecondaryFood: 1
    });

    filterProcess.push(...stcfProcessLog);

    if (!filteredPOIs.length) {
      return res.json({
        answer: "Local RAG matched the draft, but all candidate POIs were filtered as unreasonable or unsuitable.",
        draftAnswer,
        optimizedDraft: "",
        pois: [],
        removedPOIs,
        hiddenDuplicates,
        dayPlan: [],
        rejectedClaims: [],
        intent,
        debug: { ...ragResult.debug, ...debug, rag_query: ragQuery, draft_poi_names: draftPOINames, forced_source_count: forcedSources.length, forced_sources: forcedSources.map(s => s.title), identity_filtered_source_count: sources.length },
        thinking: { deepseekProcess, ragProcess, filterProcess },
        processLog: [...deepseekProcess, ...ragProcess, ...filterProcess]
      });
    }

    filterProcess.push("Checking DeepSeek draft lines against filtered local RAG POIs.");
    const optimized = optimizeDraftAnswer({ userMessage, draftAnswer, candidatePOIs: filteredPOIs, dayPlan, intent });
    filterProcess.push(...optimized.processLog);

    
    const finalPrompt = buildFinalPrompt({
      message: userMessage,
      optimizedDraft: optimized.optimizedDraft,
      filteredPOIs,
      dayPlan
    });

    const answer = await callDeepSeek(
      [
        { role: "system", content: "You are a strict route optimizer. Use only verified POIs from the provided allowed list and route assignment. Write only a clean route plan in English and keep Chinese POI names unchanged with pinyin in brackets." },
        { role: "user", content: finalPrompt }
      ],
      { temperature: 0.5, maxTokens: 1800 }
    );

    

    res.json({
      answer,
      draftAnswer,
      optimizedDraft: optimized.optimizedDraft,
      metrics: optimized.metrics,
      rejectedClaims: optimized.rejectedClaims,
      selectedPOIReasons: optimized.selectedPOIReasons,
      pois: filteredPOIs,
      removedPOIs,
      hiddenDuplicates,
      dayPlan,
      intent,
      debug: {
        ...ragResult.debug,
        ...debug,
        rag_query: ragQuery,
        draft_poi_names: draftPOINames,
        forced_source_count: forcedSources.length,
        forced_sources: forcedSources.map(s => s.title),
        identity_filtered_source_count: sources.length,
        quality_metrics: optimized.metrics
      },
      thinking: { deepseekProcess, ragProcess, filterProcess },
      processLog: [...deepseekProcess, ...ragProcess, ...filterProcess]
    });
  } catch (err) {
    console.error("Server error:", getAxiosErrorMessage(err));
    res.status(500).json({ answer: "Server error. Please check the backend terminal logs.", pois: [], error: getAxiosErrorMessage(err) });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    server: `http://localhost:${PORT}`,
    deepseek_model: DEEPSEEK_MODEL,
    knowledge_dir: LOCAL_KNOWLEDGE_DIR,
    rag_top_k: RAG_TOP_K,
    timeout_ms: DEEPSEEK_TIMEOUT_MS,
    max_tokens: DEEPSEEK_MAX_TOKENS,
    knowledge_mode: "json-only"
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`✅ Local knowledge dir: ${LOCAL_KNOWLEDGE_DIR}`);
  console.log(`✅ DeepSeek model: ${DEEPSEEK_MODEL}`);
  console.log(`✅ RAG_TOP_K: ${RAG_TOP_K}`);
  console.log("✅ Knowledge mode: JSON-only");
});
