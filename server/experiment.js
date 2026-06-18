/**
 * experiment.js
 *
 * Compare:
 * 1. LLM Only
 * 2. Local RAG Only
 * 3. Local RAG + STCF
 *
 * Metrics:
 * FR  ↓ hallucination rate
 * RR  ↓ exact POI repetition rate
 * AR  ↓ area over-concentration / parent-child repetition rate
 * STR ↑ start-time rationality
 * PR  ↑ POI relevance
 *
 * Updated:
 * - JSON-only knowledge loading
 * - New schema support: english_name, pinyin, aliases, area, parent_poi, route_role, EIRE
 * - Better POI matching
 * - Better Stop 1–6 parser
 * - More accurate STR using "Best time to visit" first
 * - More accurate PR using structured semantic fields before text keywords
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const {
  extractPOIFromSources,
  parseIntent,
  stcfFilter
} = require("./stcfAlgorithm");

/**
 * =========================
 * Config
 * =========================
 */

const DEEPSEEK_API_KEY = normalizeBearerToken(
  process.env.DEEPSEEK_API_KEY || ""
);

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";

const DEEPSEEK_TIMEOUT_MS = Number(
  process.env.DEEPSEEK_TIMEOUT_MS || 300000
);

const LOCAL_KNOWLEDGE_DIR = path.resolve(
  __dirname,
  process.env.LOCAL_KNOWLEDGE_DIR || "./knowledge"
);

const RAG_TOP_K = Number(process.env.RAG_TOP_K || 12);

const STCF_TOP_K = Number(process.env.STCF_TOP_K || 20);

const OUTPUT_DIR = path.resolve(__dirname, "./experiment_outputs");

const DEFAULT_TEST_QUERIES = [
  "Plan a one-day Xiamen local food and culture route.",
  "Plan a one-day Xiamen route focused on seaside views and local snacks.",
  "Plan a relaxing one-day Xiamen citywalk with less walking.",
  "Plan a night route in Xiamen with food, sea views, and nightlife.",
  "Plan a two-day Xiamen trip including culture, scenery, and local snacks.",
  "Plan a three-day Xiamen trip for first-time visitors, including famous attractions and local food.",
  "Plan a one-day Xiamen route for someone interested in old streets and local markets.",
  "Plan a one-day Xiamen route with temples, history, and traditional food.",
  "Plan a Xiamen trip that avoids too much walking and has enough rest time.",
  "Plan an evening food route in Xiamen with places suitable after 6 PM.",

  "厦门一日游，想吃本地小吃，也想看一些文化街区。",
  "厦门一日游，想去海边、老街和本地美食。",
  "帮我安排一个轻松的厦门 citywalk，少走路，不要太累。",
  "厦门晚上可以玩的路线，想要夜景和夜宵。",
  "厦门两日游，想包含文化景点、海边风景和本地小吃。",
  "第一次去厦门，帮我安排三天路线，要有经典景点和特色美食。",
  "厦门一日游，想逛老街、市场和本地小吃店。",
  "厦门一日游，想看寺庙、历史建筑，也想吃闽南小吃。",
  "帮我安排一个适合拍照的厦门轻松路线，不想赶行程。",
  "厦门晚上路线，想吃东西、看海景，不想去太远的地方。",

  "Plan a Monday Xiamen route with attractions that are likely to be open.",
  "Plan a Xiamen food route with breakfast, lunch, afternoon snack, and dinner.",
  "Plan a Xiamen cultural route including old architecture and historical streets.",
  "Plan a Xiamen seaside route with beaches, island views, and sunset.",
  "Plan a two-day Xiamen trip for someone who likes slow travel and photography.",
  "厦门周一可以去哪里？帮我安排一日游，避免闭馆景点。",
  "厦门美食路线，想从早餐吃到晚餐，包含小吃和正餐。",
  "厦门文化路线，想看老建筑、老街区和历史氛围。",
  "厦门海边路线，想看沙滩、海景和日落。",
  "厦门两日慢旅行，适合拍照、散步和吃本地美食。"
];

/**
 * =========================
 * Utilities
 * =========================
 */

function normalizeBearerToken(value = "") {
  const token = String(value || "").trim();
  if (!token) return "";
  return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
}

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(text = "") {
  return normalizeText(text).replace(/\s+/g, "");
}

function round3(value) {
  return Number((value || 0).toFixed(3));
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function uniqueStrings(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const text = String(item || "").trim();
    const key = normalizeName(text);

    if (!text || !key || seen.has(key)) continue;

    seen.add(key);
    out.push(text);
  }

  return out;
}

/**
 * =========================
 * DeepSeek
 * =========================
 */

async function callDeepSeekFresh(prompt, options = {}) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("Missing DEEPSEEK_API_KEY in .env");
  }

  const messages = [
    {
      role: "system",
      content: `
You are a travel planner for an experiment.

Treat this as a completely independent experiment case.
Ignore any previous conversation, previous route, previous answer, or previous baseline result.
Use only the current user request and the current provided context.
Do not mention that this is an experiment.
Generate only the final route plan.
Do not output <think>.
`.trim()
    },
    {
      role: "user",
      content: prompt
    }
  ];

  const response = await axios.post(
    "https://api.deepseek.com/chat/completions",
    {
      model: DEEPSEEK_MODEL,
      messages,
      temperature: options.temperature ?? 0.35,
      max_tokens: options.maxTokens ?? 1800
    },
    {
      headers: {
        Authorization: DEEPSEEK_API_KEY,
        "Content-Type": "application/json"
      },
      timeout: DEEPSEEK_TIMEOUT_MS
    }
  );

  return response.data?.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * =========================
 * Knowledge loading
 * =========================
 */

function readKnowledgeFiles(dir) {
  if (!fs.existsSync(dir)) return [];

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

function tokenize(text = "") {
  const normalized = normalizeText(text);

  const englishTokens = normalized
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => token.length >= 2);

  const chineseTokens = [];
  const chineseChunks = String(text || "").match(/[\u4e00-\u9fa5]{2,}/g) || [];

  for (const chunk of chineseChunks) {
    chineseTokens.push(chunk);

    for (let i = 0; i < chunk.length - 1; i++) {
      chineseTokens.push(chunk.slice(i, i + 2));
    }

    for (let i = 0; i < chunk.length - 2; i++) {
      chineseTokens.push(chunk.slice(i, i + 3));
    }
  }

  return [...new Set([...englishTokens, ...chineseTokens])];
}

function detectQueryIntent(query = "") {
  return {
    wantsFood:
      /food|eat|restaurant|snack|cuisine|local food|美食|吃|小吃|餐厅|饭|甜品|海鲜|沙茶面|花生汤|五香|福建菜|闽南|夜市|street food|早餐|午餐|晚餐|夜宵/i.test(query),

    wantsCulture:
      /culture|museum|temple|history|architecture|art|old street|文化|历史|博物馆|寺|建筑|艺术|中山路|八市|老街|骑楼|华侨|嘉庚|文创|村落|街区|大学|炮台|非遗/i.test(query),

    wantsScenery:
      /scenery|beach|park|island|sea|sunrise|sunset|view|景点|风景|海|沙滩|公园|鼓浪屿|环岛路|植物园|海边|seaside|日落|看海|拍照/i.test(query),

    wantsNight:
      /night|evening|nightlife|晚上|夜晚|夜游|夜景|夜宵/i.test(query),

    wantsRelaxed:
      /relaxing|easy|slow|less walking|轻松|少走路|不累|慢节奏|citywalk|散步/i.test(query)
  };
}

function inferDocCategory(text = "") {
  if (
    /food|美食|小吃|餐厅|甜品|海鲜|沙茶面|花生汤|五香|鸭肉粥|福建菜|闽南菜|夜市|烧烤|姜母鸭|海蛎煎|street food|snack|市场|咖啡|夜宵/i.test(text)
  ) {
    return "food";
  }

  if (
    /culture|文化|历史|寺|博物馆|建筑|中山路|八市|老街|骑楼|艺术|华侨|嘉庚|文创|村落|街区|village|creative|temple|大学|炮台|非遗/i.test(text)
  ) {
    return "culture";
  }

  if (
    /scenery|景点|风景|海滩|公园|鼓浪屿|环岛路|沙滩|海边|植物园|seaside|beach|view|日落|山|湖|岛/i.test(text)
  ) {
    return "scenery";
  }

  return "unknown";
}

function scoreDocument(doc, query) {
  const queryTokens = tokenize(query);
  const docText = `${doc.title}\n${doc.text}`;
  const normalizedDoc = normalizeText(docText);
  const docNoSpace = normalizedDoc.replace(/\s+/g, "");

  const intent = detectQueryIntent(query);
  const category = inferDocCategory(docText);

  let score = 0;

  for (const token of queryTokens) {
    const normalizedToken = normalizeText(token);
    const tokenNoSpace = normalizedToken.replace(/\s+/g, "");

    if (!normalizedToken) continue;

    if (
      normalizedDoc.includes(normalizedToken) ||
      (tokenNoSpace.length >= 2 && docNoSpace.includes(tokenNoSpace))
    ) {
      score += normalizedToken.length >= 3 ? 2 : 1;
    }
  }

  if (intent.wantsFood && category === "food") score += 6;
  if (intent.wantsCulture && category === "culture") score += 6;
  if (intent.wantsScenery && category === "scenery") score += 6;

  if (
    intent.wantsNight &&
    /night|晚上|夜晚|夜景|夜游|21:|22:|23:|24小时|open 24|夜市|夜宵/i.test(docText)
  ) {
    score += 3;
  }

  if (/gulangyu|鼓浪屿/i.test(query) && /gulangyu|鼓浪屿/i.test(docText)) score += 8;
  if (/bashi|八市|第八市场/i.test(query) && /bashi|八市|第八市场/i.test(docText)) score += 8;
  if (/zhongshan|中山路/i.test(query) && /zhongshan|中山路/i.test(docText)) score += 8;
  if (/nanputuo|南普陀/i.test(query) && /nanputuo|南普陀/i.test(docText)) score += 8;
  if (/zengcuoan|曾厝垵/i.test(query) && /zengcuoan|曾厝垵/i.test(docText)) score += 8;
  if (/shapowei|沙坡尾/i.test(query) && /shapowei|沙坡尾/i.test(docText)) score += 8;

  return score;
}

function localRagSearch(query, allKnowledgeFiles, topK = RAG_TOP_K) {
  return allKnowledgeFiles
    .map(doc => ({
      ...doc,
      score: scoreDocument(doc, query)
    }))
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * =========================
 * POI matching helpers
 * =========================
 */

function getPOIText(poi) {
  return [
    poi.name,
    poi.english_name,
    poi.name_en,
    poi.pinyin,
    poi.source_title,
    poi.description,
    poi.address,
    poi.district,
    poi.area,
    poi.parent_poi,
    poi.semantic?.main_category,
    ...(poi.semantic?.secondary_categories || []),
    ...(poi.semantic?.tags || []),
    ...(poi.semantic?.scenarios || []),
    ...(poi.route_role?.primary_for || []),
    ...(poi.route_role?.secondary_for || []),
    ...(poi.route_role?.avoid_for || []),
    ...(poi.aliases || []),
    ...(poi.EIRE?.entity || []),
    ...(poi.EIRE?.intent || []),
    ...(poi.EIRE?.relation || [])
  ]
    .filter(Boolean)
    .join(" ");
}

function getPOITypes(poi) {
  const text = getPOIText(poi);
  const main = String(poi.semantic?.main_category || "").toLowerCase();
  const primaryFor = poi.route_role?.primary_for || [];
  const secondaryCategories = poi.semantic?.secondary_categories || [];

  return {
    isFood:
      main === "food" ||
      primaryFor.includes("food") ||
      secondaryCategories.includes("food") ||
      /food|美食|小吃|餐厅|甜品|海鲜|沙茶面|花生汤|五香|福建菜|闽南菜|夜市|烧烤|姜母鸭|海蛎煎|snack|street food|night market|市场|咖啡|茶|早餐|午餐|晚餐/i.test(text),

    isCulture:
      main === "culture" ||
      primaryFor.includes("culture") ||
      secondaryCategories.includes("culture") ||
      /culture|文化|历史|寺|寺庙|博物馆|建筑|中山路|八市|老街|骑楼|艺术|华侨|嘉庚|文创|村落|街区|village|creative|temple|buddhist|大学|炮台|非遗/i.test(text),

    isScenery:
      main === "scenery" ||
      primaryFor.includes("scenery") ||
      secondaryCategories.includes("scenery") ||
      /scenery|景点|风景|海滩|公园|鼓浪屿|环岛路|沙滩|海边|植物园|seaside|beach|view|日落|看海|山|湖|岛|园/i.test(text)
  };
}

function buildPOIAliases(poi) {
  return uniqueStrings([
    poi.name,
    poi.english_name,
    poi.name_en,
    poi.pinyin,
    poi.poi_id,
    poi.source_title,
    poi.source_title?.replace(/\.(md|json|txt)$/i, ""),
    poi.source_title?.replace(/\.(md|json|txt)$/i, "").replace(/^XM\d+[_\s-]*/i, ""),
    ...(poi.aliases || []),
    poi.area,
    poi.parent_poi,
    ...(poi.semantic?.tags || []),
    ...(poi.semantic?.scenarios || []),
    ...(poi.semantic?.secondary_categories || []),
    ...(poi.route_role?.primary_for || []),
    ...(poi.route_role?.secondary_for || []),
    ...(poi.EIRE?.entity || []),
    ...(poi.EIRE?.intent || []),
    ...(poi.EIRE?.relation || [])
  ])
    .filter(Boolean)
    .map(x => String(x).trim())
    .filter(x => x.length >= 2);
}

function findMatchingPOI(rawName, allPOIs) {
  const rawNorm = normalizeName(rawName);
  if (!rawNorm) return null;

  let best = null;
  let bestLen = 0;

  for (const poi of allPOIs) {
    for (const alias of buildPOIAliases(poi)) {
      const aliasNorm = normalizeName(alias);
      if (!aliasNorm || aliasNorm.length < 2) continue;

      const exact = rawNorm === aliasNorm;
      const contains =
        rawNorm.includes(aliasNorm) ||
        aliasNorm.includes(rawNorm);

      if ((exact || contains) && aliasNorm.length > bestLen) {
        best = poi;
        bestLen = aliasNorm.length;
      }
    }
  }

  return best;
}

function getCanonicalPOIKey(poi = {}) {
  const id = String(poi.poi_id || "").trim().toLowerCase();
  if (/^xm\d+$/i.test(id)) return id;

  return normalizeName(poi.name || poi.source_title || "");
}

function getAreaKey(poi = {}) {
  return normalizeName(poi.area || poi.parent_poi || poi.district || "");
}

/**
 * =========================
 * Prompt builders
 * =========================
 */

function buildRouteFormatInstruction() {
  return `
Output only the route plan. Do not output analysis or source list.

For one-day routes, output 4 to 6 POIs when enough valid POIs are available.
For multi-day routes, output 4 to 6 POIs per day when enough valid POIs are available.

Use this structure:

Title: One short route title

Day 1 Stop 1: POI name
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

Day 1 Stop 2: POI name
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

Day 1 Stop 3: POI name
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

Day 1 Stop 4: POI name
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

Optional if appropriate:

Day 1 Stop 5: POI name
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

Day 1 Stop 6: POI name
- Why included: ...
- Best time to visit: ...
- Estimated stay: ...
- Address: ...

For multi-day routes, continue with Day 2 Stop 1, Day 2 Stop 2, and so on.
`.trim();
}

function buildLLMOnlyPrompt(query) {
  return `
User request:
${query}

Generate a practical Xiamen travel route.

Important:
- This is a fresh independent request.
- Do not rely on any previous generated route.
- Do not mention sources.
- Prefer 4 to 6 POIs per day.
- Do not invent impossible schedules.

${buildRouteFormatInstruction()}
`.trim();
}

function buildLocalRAGPrompt(query, candidatePOIs) {
  return `
User request:
${query}

Candidate POIs retrieved from local knowledge base:
${JSON.stringify(candidatePOIs, null, 2)}

Instructions:
- Use the candidate POIs as supporting context.
- Prefer POIs from the candidate list.
- Do not invent POIs.
- This is a fresh independent request.
- Do not rely on any previous generated route.
- Prefer 4 to 6 POIs per day when enough candidates are available.

${buildRouteFormatInstruction()}
`.trim();
}

function buildSTCFPrompt(query, stcfResult) {
  const filteredPOIs = stcfResult.filteredPOIs || [];
  const dayPlan = stcfResult.dayPlan || [];

  return `
User request:
${query}

Allowed POIs after full STCF filtering:
${JSON.stringify(filteredPOIs, null, 2)}

STCF route assignment:
${JSON.stringify(dayPlan, null, 2)}

Strict rules:
1. Use ONLY the allowed POIs after full STCF filtering.
2. Do not invent new POIs.
3. Do not use POIs outside the allowed list.
4. Do not repeat POIs.
5. Follow the STCF route assignment where possible.
6. Respect opening hours, night availability, closed days, and user preferences.
7. For each day, output 4 to 6 POIs if the STCF route assignment provides enough POIs.
8. If the STCF route assignment has fewer than four POIs for a day, output only the feasible POIs.
9. If a field is unknown, write "unknown".
10. This is a fresh independent request.
11. Do not mention STCF, RAG, scores, or internal filtering.

${buildRouteFormatInstruction()}
`.trim();
}

/**
 * =========================
 * Answer parsing
 * =========================
 */

function cleanSlotPOIName(raw = "") {
  return String(raw || "")
    .replace(/\*\*/g, "")
    .replace(/^[-*•]\s*/, "")
    .replace(/\(.*?\)|（.*?）/g, "")
    .replace(/[,，].*$/, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+–\s+.*$/, "")
    .replace(/\s+—\s+.*$/, "")
    .replace(/\s*\|.*$/, "")
    .trim();
}

function extractTimeRangeMinutes(text = "") {
  const t = String(text || "").toLowerCase();

  const ampmMatch = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (ampmMatch) {
    const start = convertAmPmToMinutes(
      Number(ampmMatch[1]),
      Number(ampmMatch[2] || 0),
      ampmMatch[3]
    );
    const end = convertAmPmToMinutes(
      Number(ampmMatch[4]),
      Number(ampmMatch[5] || 0),
      ampmMatch[6]
    );
    return { start, end, mid: Math.round((start + end) / 2) };
  }

  const rangeMatch = t.match(/(\d{1,2})[:：](\d{2})\s*(?:-|–|—|to|至|到)\s*(\d{1,2})[:：](\d{2})/i);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]) * 60 + Number(rangeMatch[2]);
    const end = Number(rangeMatch[3]) * 60 + Number(rangeMatch[4]);
    return { start, end, mid: Math.round((start + end) / 2) };
  }

  const singleMatch = t.match(/(\d{1,2})[:：](\d{2})/);
  if (singleMatch) {
    const value = Number(singleMatch[1]) * 60 + Number(singleMatch[2]);
    return { start: value, end: value, mid: value };
  }

  return null;
}

function convertAmPmToMinutes(hour, minute, ampm) {
  let h = hour;
  const marker = String(ampm || "").toLowerCase();

  if (marker === "pm" && h < 12) h += 12;
  if (marker === "am" && h === 12) h = 0;

  return h * 60 + minute;
}

function parseDayStopLine(line = "") {
  const text = line.trim();

  let match = text.match(/^day\s*(\d+)\s*stop\s*(\d+)\s*[:：]\s*(.+)$/i);
  if (match) {
    return {
      day: Number(match[1]),
      slot: `stop ${match[2]}`,
      stopIndex: Number(match[2]),
      rawName: cleanSlotPOIName(match[3])
    };
  }

  match = text.match(/^(day\s*\d+\s*)?(morning|noon|afternoon|evening|late afternoon|night|stop\s*\d+|上午|中午|下午|晚上|早上|傍晚|第\s*\d+\s*站)\s*[:：]\s*(.+)$/i);
  if (match) {
    const dayMatch = String(match[1] || "").match(/\d+/);
    const stopMatch = String(match[2] || "").match(/\d+/);

    return {
      day: dayMatch ? Number(dayMatch[0]) : 1,
      slot: match[2].toLowerCase(),
      stopIndex: stopMatch ? Number(stopMatch[0]) : null,
      rawName: cleanSlotPOIName(match[3])
    };
  }

  return null;
}

function extractPlannedPOIs(answer, allPOIs) {
  const lines = String(answer || "")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);

  const planned = [];
  let current = null;

  for (const line of lines) {
    const slot = parseDayStopLine(line);

    if (slot) {
      const matchedPOI = findMatchingPOI(slot.rawName, allPOIs);

      current = {
        day: slot.day || 1,
        slot: slot.slot,
        stopIndex: slot.stopIndex,
        rawName: slot.rawName,
        matched: Boolean(matchedPOI),
        poi: matchedPOI,
        bestTimeText: "",
        estimatedTimeMin: null
      };

      planned.push(current);
      continue;
    }

    if (!current) continue;

    const bestTimeMatch = line.match(/^-?\s*Best time to visit\s*[:：]\s*(.+)$/i);
    if (bestTimeMatch) {
      current.bestTimeText = bestTimeMatch[1].trim();

      const range = extractTimeRangeMinutes(current.bestTimeText);
      if (range) current.estimatedTimeMin = range.mid;
    }
  }

  const byDay = new Map();

  for (const item of planned) {
    if (!byDay.has(item.day)) byDay.set(item.day, []);
    byDay.get(item.day).push(item);
  }

  for (const [, items] of byDay.entries()) {
    items.forEach((item, index) => {
      if (!item.stopIndex) item.stopIndex = index + 1;
      if (item.estimatedTimeMin === null) {
        item.estimatedTimeMin = estimateMinutesByStopIndex(item.stopIndex, items.length);
      }
    });
  }

  return planned;
}

function estimateMinutesByStopIndex(stopIndex, dayStopCount) {
  const n = Math.max(dayStopCount || 4, 1);
  const i = Math.max(stopIndex || 1, 1);

  const start = 9 * 60;
  const end = 20 * 60;

  if (n === 1) return 10 * 60;

  return Math.round(start + ((i - 1) * (end - start)) / (n - 1));
}

/**
 * =========================
 * Metrics
 * =========================
 */

function calculateFR(plannedPOIs) {
  if (!plannedPOIs.length) return 1;

  const hallucinated = plannedPOIs.filter(item => !item.matched).length;
  return round3(hallucinated / plannedPOIs.length);
}

function calculateRR(plannedPOIs) {
  if (!plannedPOIs.length) return 0;

  const seen = new Set();
  let repeated = 0;

  for (const item of plannedPOIs) {
    const key = item.poi
      ? getCanonicalPOIKey(item.poi)
      : normalizeName(item.rawName);

    if (!key) continue;

    if (seen.has(key)) repeated++;
    else seen.add(key);
  }

  return round3(repeated / plannedPOIs.length);
}

function calculateAreaRepetitionRate(plannedPOIs) {
  const matched = plannedPOIs.filter(item => item.matched && item.poi);
  if (!matched.length) return 0;

  const byDay = new Map();

  for (const item of matched) {
    if (!byDay.has(item.day)) byDay.set(item.day, []);
    byDay.get(item.day).push(item);
  }

  let overRepeated = 0;
  let total = 0;

  for (const [, items] of byDay.entries()) {
    const areaCounts = new Map();

    for (const item of items) {
      const areaKey = getAreaKey(item.poi);
      if (!areaKey) continue;

      areaCounts.set(areaKey, (areaCounts.get(areaKey) || 0) + 1);
      total++;
    }

    for (const count of areaCounts.values()) {
      if (count > 3) {
        overRepeated += count - 3;
      }
    }
  }

  if (!total) return 0;

  return round3(overRepeated / total);
}

function structuredIntentMatchScore(poi, intent) {
  if (!poi) return 0;

  const main = String(poi.semantic?.main_category || "").toLowerCase();
  const secondary = poi.semantic?.secondary_categories || [];
  const primaryFor = poi.route_role?.primary_for || [];
  const secondaryFor = poi.route_role?.secondary_for || [];
  const scenarios = poi.semantic?.scenarios || [];
  const eireIntent = poi.EIRE?.intent || [];

  const strong = new Set([main, ...primaryFor]);
  const medium = new Set([...secondary, ...secondaryFor, ...scenarios, ...eireIntent]);

  const wants = [];
  if (intent.wantsFood) wants.push("food");
  if (intent.wantsCulture) wants.push("culture");
  if (intent.wantsScenery) wants.push("scenery");
  if (intent.wantsNight) wants.push("night");
  if (intent.wantsRelaxed) wants.push("relaxed");

  if (!wants.length) return 1;

  for (const w of wants) {
    if (strong.has(w)) return 1;
  }

  for (const w of wants) {
    if (medium.has(w)) return 0.75;
  }

  const types = getPOITypes(poi);

  if (intent.wantsFood && types.isFood) return 0.6;
  if (intent.wantsCulture && types.isCulture) return 0.6;
  if (intent.wantsScenery && types.isScenery) return 0.6;

  return 0;
}

function calculatePR(plannedPOIs, intent) {
  if (!plannedPOIs.length) return 0;

  const scores = plannedPOIs.map(item => {
    if (!item.matched || !item.poi) return 0;
    return structuredIntentMatchScore(item.poi, intent);
  });

  return round3(scores.reduce((sum, v) => sum + v, 0) / scores.length);
}

function timeToMinutes(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/(\d{1,2})[:：](\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function isPOIOpenAtMinute(poi, minute) {
  const time = poi.time || {};

  const open = timeToMinutes(time.open_time);
  const close = timeToMinutes(time.close_time);

  if (open === null || close === null || minute === null) {
    return true;
  }

  if (close < open) {
    return minute >= open || minute <= close;
  }

  return minute >= open && minute <= close;
}

function isNightMinute(minute) {
  return minute >= 18 * 60 || minute <= 5 * 60;
}

function isSlotReasonable(item) {
  if (!item.matched || !item.poi) return false;

  const minute = item.estimatedTimeMin;

  if (minute === null || minute === undefined) {
    return true;
  }

  if (isNightMinute(minute) && item.poi.time?.night_available === false) {
    return false;
  }

  return isPOIOpenAtMinute(item.poi, minute);
}

function calculateSTR(plannedPOIs) {
  if (!plannedPOIs.length) return 0;

  const reasonable = plannedPOIs.filter(isSlotReasonable).length;
  return round3(reasonable / plannedPOIs.length);
}

function calculateAvgStopsPerDay(plannedPOIs) {
  if (!plannedPOIs.length) return 0;

  const byDay = new Map();

  for (const item of plannedPOIs) {
    if (!byDay.has(item.day)) byDay.set(item.day, 0);
    byDay.set(item.day, byDay.get(item.day) + 1);
  }

  const counts = [...byDay.values()];
  return round3(counts.reduce((sum, v) => sum + v, 0) / counts.length);
}

function calculateMetrics(answer, query, allPOIs) {
  const plannedPOIs = extractPlannedPOIs(answer, allPOIs);
  const intent = parseIntent(query);

  return {
    planned_count: plannedPOIs.length,
    avg_stops_per_day: calculateAvgStopsPerDay(plannedPOIs),
    FR: calculateFR(plannedPOIs),
    RR: calculateRR(plannedPOIs),
    AR: calculateAreaRepetitionRate(plannedPOIs),
    STR: calculateSTR(plannedPOIs),
    PR: calculatePR(plannedPOIs, intent),
    extracted_pois: plannedPOIs.map(item => ({
      day: item.day,
      slot: item.slot,
      stopIndex: item.stopIndex,
      rawName: item.rawName,
      bestTimeText: item.bestTimeText || "",
      estimatedTimeMin: item.estimatedTimeMin,
      matched: item.matched,
      matchedName: item.poi?.name || null,
      matchedCategory: item.poi?.semantic?.main_category || null,
      matchedArea: item.poi?.area || null
    }))
  };
}

/**
 * =========================
 * Experiment methods
 * =========================
 */

async function runLLMOnly(query, allPOIs) {
  const prompt = buildLLMOnlyPrompt(query);

  const answer = await callDeepSeekFresh(prompt, {
    temperature: 0.65,
    maxTokens: 1800
  });

  return {
    method: "LLM Only",
    answer,
    metrics: calculateMetrics(answer, query, allPOIs),
    candidate_count: 0,
    retrieved_candidate_count: 0,
    stcf_debug: null,
    stcf_process_log: []
  };
}

async function runLocalRAGOnly(query, allKnowledgeFiles, allPOIs) {
  const sources = localRagSearch(query, allKnowledgeFiles, RAG_TOP_K);
  const candidatePOIs = extractPOIFromSources(sources);

  const prompt = buildLocalRAGPrompt(query, candidatePOIs);

  const answer = await callDeepSeekFresh(prompt, {
    temperature: 0.45,
    maxTokens: 1800
  });

  return {
    method: "Local RAG Only",
    answer,
    metrics: calculateMetrics(answer, query, allPOIs),
    candidate_count: candidatePOIs.length,
    retrieved_candidate_count: candidatePOIs.length,
    stcf_debug: null,
    stcf_process_log: []
  };
}

async function runLocalRAGSTCF(query, allKnowledgeFiles, allPOIs) {
  const sources = localRagSearch(query, allKnowledgeFiles, RAG_TOP_K);
  const candidatePOIs = extractPOIFromSources(sources);

  const stcfResult = stcfFilter(candidatePOIs, query, {
    topK: STCF_TOP_K,
    filterMode: "experiment_stcf",
    minPOIsPerDay: 4,
    maxPOIsPerDay: 6
  });

  const filteredPOIs = stcfResult.filteredPOIs || [];

  const prompt = buildSTCFPrompt(query, stcfResult);

  const answer = await callDeepSeekFresh(prompt, {
    temperature: 0.3,
    maxTokens: 2200
  });

  return {
    method: "Local RAG + STCF",
    answer,
    metrics: calculateMetrics(answer, query, allPOIs),
    candidate_count: filteredPOIs.length,
    retrieved_candidate_count: candidatePOIs.length,
    stcf_debug: stcfResult.debug || null,
    stcf_process_log: stcfResult.processLog || [],
    stcf_day_plan: stcfResult.dayPlan || [],
    stcf_removed_pois: stcfResult.removedPOIs || []
  };
}

/**
 * =========================
 * Aggregation and output
 * =========================
 */

function average(values) {
  if (!values.length) return 0;
  return round3(values.reduce((sum, v) => sum + Number(v || 0), 0) / values.length);
}

function aggregateResults(rows) {
  const methods = [...new Set(rows.map(row => row.method))];

  return methods.map(method => {
    const group = rows.filter(row => row.method === method);

    return {
      method,
      n: group.length,
      FR: average(group.map(row => row.metrics.FR)),
      RR: average(group.map(row => row.metrics.RR)),
      AR: average(group.map(row => row.metrics.AR)),
      STR: average(group.map(row => row.metrics.STR)),
      PR: average(group.map(row => row.metrics.PR)),
      avg_planned_count: average(group.map(row => row.metrics.planned_count)),
      avg_stops_per_day: average(group.map(row => row.metrics.avg_stops_per_day)),
      avg_candidate_count: average(group.map(row => row.candidate_count)),
      avg_retrieved_candidate_count: average(group.map(row => row.retrieved_candidate_count))
    };
  });
}

function toCsv(rows) {
  const headers = [
    "query_id",
    "query",
    "method",
    "retrieved_candidate_count",
    "candidate_count",
    "planned_count",
    "avg_stops_per_day",
    "FR",
    "RR",
    "AR",
    "STR",
    "PR",
    "answer"
  ];

  const escape = value => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.query_id,
        row.query,
        row.method,
        row.retrieved_candidate_count,
        row.candidate_count,
        row.metrics.planned_count,
        row.metrics.avg_stops_per_day,
        row.metrics.FR,
        row.metrics.RR,
        row.metrics.AR,
        row.metrics.STR,
        row.metrics.PR,
        row.answer
      ]
        .map(escape)
        .join(",")
    );
  }

  return lines.join("\n");
}

function printSummary(summary) {
  console.log("\n=== Experiment Summary ===");
  console.table(
    summary.map(row => ({
      Method: row.method,
      "FR ↓": row.FR,
      "RR ↓": row.RR,
      "AR ↓": row.AR,
      "STR ↑": row.STR,
      "PR ↑": row.PR,
      "Avg POIs": row.avg_planned_count,
      "Avg Stops/Day": row.avg_stops_per_day,
      "Avg Candidates": row.avg_candidate_count,
      "Avg Retrieved": row.avg_retrieved_candidate_count
    }))
  );
}

/**
 * =========================
 * Main
 * =========================
 */

async function main() {
  ensureDir(OUTPUT_DIR);

  const queryFile = path.resolve(__dirname, "./experiment_queries.json");
  const queries = readJsonIfExists(queryFile, DEFAULT_TEST_QUERIES);

  if (!Array.isArray(queries) || queries.length === 0) {
    throw new Error("No test queries found.");
  }

  const allKnowledgeFiles = readKnowledgeFiles(LOCAL_KNOWLEDGE_DIR);

  if (!allKnowledgeFiles.length) {
    throw new Error(`No knowledge files found in ${LOCAL_KNOWLEDGE_DIR}`);
  }

  const allPOIs = extractPOIFromSources(allKnowledgeFiles);

  console.log(`Loaded ${allKnowledgeFiles.length} JSON knowledge files.`);
  console.log(`Loaded ${allPOIs.length} POI objects.`);
  console.log(`Running ${queries.length} queries x 3 methods...`);
  console.log("Methods: LLM Only, Local RAG Only, Local RAG + STCF");
  console.log("Each DeepSeek call uses a fresh independent context.\n");

  const rows = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const queryId = i + 1;

    console.log(`\n[${queryId}/${queries.length}] ${query}`);

    const methods = [
      runLLMOnly,
      runLocalRAGOnly,
      runLocalRAGSTCF
    ];

    for (const methodFn of methods) {
      try {
        const result =
          methodFn === runLLMOnly
            ? await methodFn(query, allPOIs)
            : await methodFn(query, allKnowledgeFiles, allPOIs);

        rows.push({
          query_id: queryId,
          query,
          ...result
        });

        console.log(
          `  ${result.method}: FR=${result.metrics.FR}, RR=${result.metrics.RR}, AR=${result.metrics.AR}, STR=${result.metrics.STR}, PR=${result.metrics.PR}, planned=${result.metrics.planned_count}, candidates=${result.candidate_count}`
        );
      } catch (err) {
        console.error(`  Failed: ${methodFn.name}`, err.response?.data || err.message);
      }
    }
  }

  const summary = aggregateResults(rows);

  const detailPath = path.join(OUTPUT_DIR, "experiment_details.json");
  const summaryPath = path.join(OUTPUT_DIR, "experiment_summary.json");
  const csvPath = path.join(OUTPUT_DIR, "experiment_results.csv");

  fs.writeFileSync(detailPath, JSON.stringify(rows, null, 2), "utf8");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  fs.writeFileSync(csvPath, toCsv(rows), "utf8");

  printSummary(summary);

  console.log("\nSaved files:");
  console.log(`- ${detailPath}`);
  console.log(`- ${summaryPath}`);
  console.log(`- ${csvPath}`);
}

main().catch(err => {
  console.error("Experiment failed:", err.response?.data || err.message);
  process.exit(1);
});