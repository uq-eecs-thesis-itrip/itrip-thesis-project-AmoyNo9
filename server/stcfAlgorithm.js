function cleanThinkText(text = "") {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim();
}

function extractJsonFromText(text = "") {
  const cleaned = String(text || "")
    .replace(/<document_metadata>[\s\S]*?<\/document_metadata>/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function getLineValue(text, label) {
  const regex = new RegExp(`- ${label}:\\s*(.*)`, "i");
  const match = String(text || "").match(regex);
  return match ? match[1].trim() : "";
}

/**
 * =========================
 * Normalisation helpers
 * =========================
 */

function normalizePlainText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNoSpace(text = "") {
  return normalizePlainText(text).replace(/\s+/g, "");
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function uniqueStrings(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const text = String(item || "").trim();
    const key = normalizeNoSpace(text);

    if (!text || seen.has(key)) continue;

    seen.add(key);
    out.push(text);
  }

  return out;
}

function inferCategory(text = "") {
  if (
    /food|美食|小吃|餐厅|甜品|海鲜|沙茶面|花生汤|五香|鸭肉粥|福建菜|闽南菜|夜市|烧烤|姜母鸭|海蛎煎|street food|snack|咖啡|茶|甜品|市场|夜宵/i.test(text)
  ) {
    return "food";
  }

  if (
    /culture|文化|寺|博物馆|历史|建筑|中山路|八市|老街|骑楼|艺术|华侨|嘉庚|文创|村落|街区|village|creative|temple|寺庙|大学|炮台|故居|剧场|书店|非遗/i.test(text)
  ) {
    return "culture";
  }

  if (
    /scenery|景点|风景|海滩|公园|鼓浪屿|环岛路|日出|日落|沙滩|海边|植物园|seaside|beach|view|观景|山|湖|园|岛|湿地|森林/i.test(text)
  ) {
    return "scenery";
  }

  return "unknown";
}

function normalizeCategory(value = "", fallbackText = "") {
  const raw = String(value || "").toLowerCase();

  if (/food|美食|小吃|餐厅|甜品|花生汤|五香|福建菜|闽南菜|夜市|烧烤|snack|street food|market|cafe|coffee/.test(raw)) {
    return "food";
  }

  if (/culture|文化|历史|博物馆|寺|建筑|艺术|文创|村落|街区|village|creative|temple|university|heritage/.test(raw)) {
    return "culture";
  }

  if (/scenery|景点|风景|公园|海滩|海边|鼓浪屿|seaside|beach|view|island|park|mountain|garden/.test(raw)) {
    return "scenery";
  }

  return inferCategory(fallbackText);
}

function normalizeTimeSlot(slot = "") {
  const s = String(slot || "").toLowerCase();

  if (/morning|上午|早上|breakfast/.test(s)) return "morning";
  if (/noon|中午|lunch/.test(s)) return "noon";
  if (/afternoon|下午|late afternoon/.test(s)) return "afternoon";
  if (/evening|晚上|night|dinner/.test(s)) return "evening";

  return "";
}

function formatPOIName(poi = {}) {
  const secondary = poi.pinyin || poi.english_name || poi.name_en || poi.englishName;
  return secondary ? `${poi.name} (${secondary})` : poi.name;
}

/**
 * =========================
 * POI extraction
 * =========================
 */

function normalizePOI(jsonPOI = {}, source = {}) {
  const textForFallback = JSON.stringify(jsonPOI);
  const semantic = jsonPOI.semantic || {};
  const score = jsonPOI.score || {};
  const time = jsonPOI.time || {};
  const routeRole = jsonPOI.route_role || {};
  const routeConstraints = jsonPOI.route_constraints || {};
  const constraints = jsonPOI.constraints || {};

  const category = normalizeCategory(
    semantic.main_category ||
      jsonPOI.main_category ||
      jsonPOI.category ||
      jsonPOI.type ||
      "",
    textForFallback
  );

  const pinyin = jsonPOI.pinyin || jsonPOI.pin_yin || "";
  const englishName =
    jsonPOI.english_name ||
    jsonPOI.name_en ||
    jsonPOI.englishName ||
    "";

  const aliases = uniqueStrings([
    ...asArray(jsonPOI.aliases),
    jsonPOI.name,
    englishName,
    pinyin,
    jsonPOI.title,
    jsonPOI.poi_id,
    source.title?.replace(/\.(md|json|txt)$/i, ""),
    ...(semantic.tags || []),
    ...(semantic.scenarios || []),
    ...(jsonPOI.EIRE?.entity || []),
    ...(jsonPOI.EIRE?.intent || []),
    ...(jsonPOI.EIRE?.relation || [])
  ]);

  return {
    poi_id:
      jsonPOI.poi_id ||
      jsonPOI.id ||
      source.title?.split("_")[0] ||
      "",
    name:
      jsonPOI.name ||
      jsonPOI.title ||
      source.title?.replace(/\.(md|json|txt)$/i, "") ||
      "Unknown POI",
    english_name: englishName,
    pinyin,
    aliases,
    city: jsonPOI.city || "厦门",
    district: jsonPOI.district || "",
    address: jsonPOI.address || "",
    area:
      jsonPOI.area ||
      routeConstraints.area ||
      jsonPOI.district ||
      "",
    parent_poi: jsonPOI.parent_poi || jsonPOI.parentPOI || null,
    is_area_poi: Boolean(jsonPOI.is_area_poi || jsonPOI.isAreaPOI),
    is_sub_poi: Boolean(jsonPOI.is_sub_poi || jsonPOI.isSubPOI),
    location: jsonPOI.location || null,
    time: {
      open_time:
        time.open_time ||
        time.open ||
        jsonPOI.open_time ||
        jsonPOI.opening_time ||
        "unknown",
      close_time:
        time.close_time ||
        time.close ||
        jsonPOI.close_time ||
        jsonPOI.closing_time ||
        "unknown",
      recommended_duration_min:
        Number(
          time.recommended_duration_min ||
            jsonPOI.recommended_duration_min ||
            jsonPOI.duration ||
            60
        ) || 60,
      best_visit_time:
        time.best_visit_time ||
        jsonPOI.best_visit_time ||
        "",
      night_available:
        typeof time.night_available === "boolean"
          ? time.night_available
          : typeof jsonPOI.night_available === "boolean"
            ? jsonPOI.night_available
            : null,
      closed_day:
        time.closed_day ||
        jsonPOI.closed_day ||
        jsonPOI.closed ||
        null
    },
    semantic: {
      main_category: category,
      secondary_categories: Array.isArray(semantic.secondary_categories)
        ? semantic.secondary_categories
        : [],
      tags: Array.isArray(semantic.tags)
        ? semantic.tags
        : Array.isArray(jsonPOI.tags)
          ? jsonPOI.tags
          : [],
      scenarios: Array.isArray(semantic.scenarios)
        ? semantic.scenarios
        : Array.isArray(jsonPOI.scenarios)
          ? jsonPOI.scenarios
          : [],
      style: semantic.style || jsonPOI.style || ""
    },
    EIRE: jsonPOI.EIRE || {
      entity: [],
      intent: [],
      relation: []
    },
    route_role: {
      primary_for: asArray(routeRole.primary_for),
      secondary_for: asArray(routeRole.secondary_for),
      avoid_for: asArray(routeRole.avoid_for),
      recommended_time_slots: asArray(routeRole.recommended_time_slots)
        .map(normalizeTimeSlot)
        .filter(Boolean),
      not_recommended_time_slots: asArray(routeRole.not_recommended_time_slots)
        .map(normalizeTimeSlot)
        .filter(Boolean)
    },
    route_constraints: {
      can_be_standalone_stop:
        routeConstraints.can_be_standalone_stop !== undefined
          ? Boolean(routeConstraints.can_be_standalone_stop)
          : true,
      can_be_combined_with: asArray(routeConstraints.can_be_combined_with),
      should_not_split_area_across_days:
        routeConstraints.should_not_split_area_across_days !== undefined
          ? Boolean(routeConstraints.should_not_split_area_across_days)
          : true,
      max_same_area_pois_per_day:
        Number(routeConstraints.max_same_area_pois_per_day || 0) || null,
      min_visit_gap_min:
        Number(routeConstraints.min_visit_gap_min || 0) || 0
    },
    score: {
      popularity:
        Number(score.popularity || jsonPOI.popularity || 0.5) || 0.5,
      niche:
        Number(score.niche || jsonPOI.niche || 0.5) || 0.5,
      rating:
        Number(score.rating || jsonPOI.rating || 4.0) || 4.0,
      scenery_score:
        Number(score.scenery_score || 0) || 0,
      culture_score:
        Number(score.culture_score || 0) || 0,
      food_score:
        Number(score.food_score || 0) || 0,
      relaxed_score:
        Number(score.relaxed_score || 0) || 0
    },
    constraints: {
      ticket_required:
        typeof constraints.ticket_required === "boolean"
          ? constraints.ticket_required
          : null,
      constraint_type: constraints.constraint_type || "",
      weather_sensitive:
        typeof constraints.weather_sensitive === "boolean"
          ? constraints.weather_sensitive
          : null,
      needs_reservation_check:
        typeof constraints.needs_reservation_check === "boolean"
          ? constraints.needs_reservation_check
          : null
    },
    description:
      jsonPOI.description ||
      jsonPOI.content ||
      source.text?.slice(0, 1200) ||
      "",
    retrieval_score: source.score || 0,
    source_title: source.title
  };
}



function extractPOIFromSources(sources = []) {
  return sources
    .map(source => {
      const jsonPOI = extractJsonFromText(source.text || "");

      
        return normalizePOI(jsonPOI, source);
      

      
    })
    .filter(Boolean);
}

/**
 * =========================
 * Intent parsing
 * =========================
 */

function detectTripDays(message = "") {
  if (/four days|4 days|four-day|4-day|四天|4天|四日|4日/i.test(message)) return 4;
  if (/three days|3 days|three-day|3-day|三天|3天|三日|3日/i.test(message)) return 3;
  if (/two days|2 days|two-day|2-day|两天|二天|2天|两日|二日|2日/i.test(message)) return 2;
  return 1;
}

function parseIntent(message = "") {
  const wantsFood =
    /food|eat|restaurant|snack|cuisine|local food|美食|吃|小吃|餐厅|饭|甜品|海鲜|沙茶面|花生汤|五香|鸭肉粥|福建菜|闽南|夜市|夜宵|早餐|午餐|晚餐/i.test(message);

  const wantsCulture =
    /culture|museum|temple|history|architecture|art|old street|文化|历史|博物馆|寺|建筑|艺术|中山路|八市|老街|骑楼|华侨|嘉庚|文创|村落|街区|寺庙|大学|炮台|非遗/i.test(message);

  const wantsScenery =
    /scenery|beach|park|island|sea|sunrise|sunset|view|景点|风景|海|沙滩|公园|鼓浪屿|环岛路|植物园|海边|日落|看海|拍照/i.test(message);

  return {
    tripDays: detectTripDays(message),
    wantsFood,
    wantsCulture,
    wantsScenery,
    wantsNight:
      /night|evening|nightlife|晚上|夜晚|夜游|夜景|夜宵/i.test(message),
    wantsRelaxed:
      /relaxing|easy|slow|less walking|轻松|少走路|不累|慢节奏|citywalk|散步/i.test(message),
    wantsMuseum:
      /museum|博物馆|艺术馆|展馆|展览/i.test(message),
    wantsHistory:
      /history|historic|heritage|历史|古迹|遗址|老建筑/i.test(message),
    mentionsMonday:
      /monday|周一|星期一/i.test(message),
    primaryIntent:
      wantsFood ? "food" : wantsCulture ? "culture" : wantsScenery ? "scenery" : "general"
  };
}

/**
 * =========================
 * Semantic matching
 * =========================
 */

function getPOIText(poi) {
  return [
    poi.name,
    poi.english_name,
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
    ...(poi.aliases || []),
    ...(poi.EIRE?.entity || []),
    ...(poi.EIRE?.intent || []),
    ...(poi.EIRE?.relation || [])
  ]
    .filter(Boolean)
    .join(" ");
}

function getPOITypes(poi) {
  const mainCategory = String(poi.semantic?.main_category || "").toLowerCase();
  const secondaryCategories = (poi.semantic?.secondary_categories || []).join(" ");
  const primaryFor = (poi.route_role?.primary_for || []).join(" ");
  const secondaryFor = (poi.route_role?.secondary_for || []).join(" ");
  const text = getPOIText(poi);

  const isFood =
    mainCategory === "food" ||
    /food|美食|小吃|餐厅|甜品|海鲜|沙茶面|花生汤|五香|福建菜|闽南菜|夜市|烧烤|姜母鸭|海蛎煎|snack|street food|night market|咖啡|茶|市场/i.test(
      `${text} ${secondaryCategories} ${primaryFor} ${secondaryFor}`
    );

  const isCulture =
    mainCategory === "culture" ||
    /culture|文化|历史|寺|寺庙|博物馆|建筑|中山路|八市|老街|骑楼|艺术|华侨|嘉庚|文创|村落|街区|village|creative|temple|buddhist|大学|炮台|非遗/i.test(
      `${text} ${secondaryCategories} ${primaryFor} ${secondaryFor}`
    );

  const isScenery =
    mainCategory === "scenery" ||
    /scenery|景点|风景|海滩|公园|鼓浪屿|环岛路|沙滩|海边|植物园|seaside|beach|view|看海|日落|山|湖|岛|园/i.test(
      `${text} ${secondaryCategories} ${primaryFor} ${secondaryFor}`
    );

  return {
    isFood,
    isCulture,
    isScenery
  };
}

function matchesRouteRole(poi, intent) {
  const primaryFor = poi.route_role?.primary_for || [];
  const secondaryFor = poi.route_role?.secondary_for || [];
  const avoidFor = poi.route_role?.avoid_for || [];

  const wanted = [];
  if (intent.wantsFood) wanted.push("food");
  if (intent.wantsCulture) wanted.push("culture");
  if (intent.wantsScenery) wanted.push("scenery");
  if (intent.wantsNight) wanted.push("night");
  if (intent.wantsRelaxed) wanted.push("relaxed");

  if (!wanted.length) return true;

  for (const w of wanted) {
    if (avoidFor.includes(w)) return false;
  }

  return wanted.some(w => primaryFor.includes(w) || secondaryFor.includes(w));
}

function semanticFilter(pois, intent) {
  const hasSpecificIntent = intent.wantsFood || intent.wantsCulture || intent.wantsScenery;

  if (!hasSpecificIntent) {
    return {
      kept: pois,
      removed: []
    };
  }

  const kept = [];
  const removed = [];

  for (const poi of pois) {
    const types = getPOITypes(poi);
    const routeRoleOK = matchesRouteRole(poi, intent);

    const typeOK =
      (intent.wantsFood && types.isFood) ||
      (intent.wantsCulture && types.isCulture) ||
      (intent.wantsScenery && types.isScenery);

    if (typeOK && routeRoleOK) {
      kept.push(poi);
    } else {
      removed.push({
        ...poi,
        removed_reason: "Removed because its semantic category or route role does not match the user intent."
      });
    }
  }

  return { kept, removed };
}

/**
 * =========================
 * Temporal and validity filters
 * =========================
 */

function isUnknownTime(value) {
  const text = String(value || "").toLowerCase();
  return !text || text === "unknown" || text === "null" || text === "undefined";
}

function temporalFilter(pois, intent) {
  const kept = [];
  const removed = [];

  for (const poi of pois) {
    const time = poi.time || {};
    const openTime = time.open_time;
    const closeTime = time.close_time;
    const closedDay = String(time.closed_day || "").toLowerCase();

    const openUnknown = isUnknownTime(openTime);
    const closeUnknown = isUnknownTime(closeTime);

    if (intent.wantsNight) {
      if (time.night_available === false && !openUnknown && !closeUnknown) {
        removed.push({
          ...poi,
          removed_reason: "Removed because it is clearly not available for a night request."
        });
        continue;
      }

      if (openUnknown || closeUnknown) {
        poi.filter_warning = "Opening time is unknown, so it was kept instead of being removed.";
      }
    }

    if (
      intent.mentionsMonday &&
      /monday|周一|星期一/i.test(closedDay)
    ) {
      removed.push({
        ...poi,
        removed_reason: "Removed because the user mentioned Monday and this POI is closed on Monday."
      });
      continue;
    }

    kept.push(poi);
  }

  return { kept, removed };
}

function constraintFilter(pois) {
  const kept = [];
  const removed = [];

  for (const poi of pois) {
    if (!poi.name || poi.name === "Unknown POI") {
      removed.push({
        ...poi,
        removed_reason: "Removed because the POI has no valid name."
      });
      continue;
    }

    if (poi.city && !/厦门|xiamen/i.test(poi.city)) {
      removed.push({
        ...poi,
        removed_reason: "Removed because it is not located in Xiamen."
      });
      continue;
    }

    if (poi.route_constraints?.can_be_standalone_stop === false && !poi.parent_poi) {
      removed.push({
        ...poi,
        removed_reason: "Removed because it cannot be used as a standalone stop."
      });
      continue;
    }

    kept.push(poi);
  }

  return { kept, removed };
}

/**
 * =========================
 * Ranking
 * =========================
 */

function poiText(poi) {
  return JSON.stringify(poi || {});
}

function scorePOI(poi, intent, message) {
  const text = poiText(poi);
  const types = getPOITypes(poi);

  let score = 0;
  if (poi._mentioned_in_draft) {
  score += 1000;
  }

  score += toNumber(poi.retrieval_score, 0);
  score += toNumber(poi.score?.popularity, 0.5);
  score += toNumber(poi.score?.rating, 4.0) / 5;

  

  if (intent.wantsFood && types.isFood) score += 1.5 + toNumber(poi.score?.food_score, 0);
  if (intent.wantsCulture && types.isCulture) score += 1.2 + toNumber(poi.score?.culture_score, 0);
  if (intent.wantsScenery && types.isScenery) score += 1.2 + toNumber(poi.score?.scenery_score, 0);

  if (intent.wantsNight && poi.time?.night_available) score += 0.5;

  if (intent.wantsRelaxed) {
    if ((poi.time?.recommended_duration_min || 60) <= 90) score += 0.4;
    score += toNumber(poi.score?.relaxed_score, 0);
  }

  const primaryFor = poi.route_role?.primary_for || [];
  const secondaryFor = poi.route_role?.secondary_for || [];

  if (intent.wantsFood && primaryFor.includes("food")) score += 0.8;
  if (intent.wantsCulture && primaryFor.includes("culture")) score += 0.8;
  if (intent.wantsScenery && primaryFor.includes("scenery")) score += 0.8;
  if (intent.wantsFood && secondaryFor.includes("food")) score += 0.3;
  if (intent.wantsCulture && secondaryFor.includes("culture")) score += 0.3;
  if (intent.wantsScenery && secondaryFor.includes("scenery")) score += 0.3;

  for (const alias of poi.aliases || []) {
    if (alias && normalizeNoSpace(message).includes(normalizeNoSpace(alias))) {
      score += 3;
      break;
    }
  }

  if (/Bashi|八市|第八市场/i.test(message) && /Bashi|八市|第八市场/i.test(text)) score += 2;
  if (/Zhongshan|中山路/i.test(message) && /Zhongshan|中山路/i.test(text)) score += 2;
  if (/Gulangyu|鼓浪屿/i.test(message) && /Gulangyu|鼓浪屿/i.test(text)) score += 2;
  if (/Zengcuoan|曾厝垵/i.test(message) && /Zengcuoan|曾厝垵/i.test(text)) score += 2;
  if (/Nanputuo|南普陀/i.test(message) && /Nanputuo|南普陀/i.test(text)) score += 2;

  return Number(score.toFixed(3));
}

function rankPOIs(pois, intent, message) {
  return pois
    .map(poi => ({
      ...poi,
      final_score: scorePOI(poi, intent, message)
    }))
    .sort((a, b) => b.final_score - a.final_score);
}

/**
 * =========================
 * De-duplication and hierarchy
 * =========================
 */

function normalizePOIKeyText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/\.(md|json|txt)$/i, "")
    .replace(/^xm\d+[_\s-]*/i, "")
    .replace(/[_\-]/g, " ")
    .replace(/[（）()【】[\]{}]/g, " ")
    .replace(/[，。、“”‘’：:；;,.!?！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCanonicalPOIKey(poi = {}) {
  const id = String(poi.poi_id || "").trim().toLowerCase();

  if (/^xm\d+$/i.test(id)) return id;

  const name = normalizePOIKeyText(poi.name || "");
  if (name) return name;

  const sourceTitle = normalizePOIKeyText(poi.source_title || "");
  if (sourceTitle) return sourceTitle;

  return "";
}

function uniquePOIs(pois) {
  const seen = new Set();
  const kept = [];
  const removed = [];
  const duplicates = [];

  for (const poi of pois) {
    const key = getCanonicalPOIKey(poi);

    if (!key) {
      removed.push({
        ...poi,
        removed_reason: "Removed because it has no unique key."
      });
      continue;
    }

    if (seen.has(key)) {
      duplicates.push({
        ...poi,
        removed_reason: "Hidden because this is a duplicate source of an already kept POI."
      });
      continue;
    }

    seen.add(key);
    kept.push(poi);
  }

  return {
    kept,
    removed,
    duplicates
  };
}

function removeHierarchyConflicts(pois, intent, options = {}) {
  const maxSameParent = options.maxSameParentPOIs ?? 3;
  const explicitCultureNeed =
    intent.wantsCulture || intent.wantsMuseum || intent.wantsHistory;

  const selectedNames = new Set(pois.map(p => p.name));
  const byParent = new Map();
  const kept = [];
  const removed = [];

  for (const poi of pois) {
    if (!poi.parent_poi) {
      kept.push(poi);
      continue;
    }

    const parentSelected = selectedNames.has(poi.parent_poi);
    const parent = poi.parent_poi;

    if (!byParent.has(parent)) byParent.set(parent, []);
    const siblings = byParent.get(parent);

    if (
      parentSelected &&
      poi.is_sub_poi &&
      !explicitCultureNeed &&
      poi.semantic?.main_category !== "food"
    ) {
      removed.push({
        ...poi,
        removed_reason: `Removed because it is an internal sub-POI of ${parent} and the parent area is already selected.`
      });
      continue;
    }

    if (siblings.length >= maxSameParent) {
      removed.push({
        ...poi,
        removed_reason: `Removed because too many POIs under the same parent area (${parent}) were already selected.`
      });
      continue;
    }

    siblings.push(poi);
    kept.push(poi);
  }

  return { kept, removed };
}

function enforceScenarioQuota(pois, intent, options = {}) {
  
  if (!intent.wantsScenery || intent.wantsFood || intent.wantsCulture) {
    return {
      kept: pois,
      removed: []
    };
  }

  const maxSupportingCulture = options.maxSupportingCulture ?? 1;
  const maxSupportingFood = options.maxSupportingFood ?? 1;

  const scenery = [];
  const culture = [];
  const food = [];
  const other = [];

  for (const poi of pois) {
    const main = poi.semantic?.main_category;
    const primaryFor = poi.route_role?.primary_for || [];
    const secondaryFor = poi.route_role?.secondary_for || [];

    if (main === "scenery" || primaryFor.includes("scenery")) {
      scenery.push(poi);
    } else if (main === "culture" || secondaryFor.includes("scenery")) {
      culture.push(poi);
    } else if (main === "food") {
      food.push(poi);
    } else {
      other.push(poi);
    }
  }

  const kept = [
    ...scenery,
    ...culture.slice(0, maxSupportingCulture),
    ...food.slice(0, maxSupportingFood),
    ...other.slice(0, 1)
  ];

  const keptKeys = new Set(kept.map(getCanonicalPOIKey));
  const removed = pois
    .filter(p => !keptKeys.has(getCanonicalPOIKey(p)))
    .map(poi => ({
      ...poi,
      removed_reason: "Removed because it exceeded the supporting-category quota for a scenic route."
    }));

  return { kept, removed };
}

/**
 * =========================
 * Spatial helpers
 * =========================
 */

function getLatLng(poi) {
  const loc = poi.location;
  if (!loc) return null;

  if (Array.isArray(loc) && loc.length >= 2) {
    const lat = Number(loc[0]);
    const lng = Number(loc[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  if (typeof loc === "object") {
    const lat = Number(loc.lat ?? loc.latitude);
    const lng = Number(loc.lng ?? loc.lon ?? loc.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
}

function distanceKm(a, b) {
  const pa = getLatLng(a);
  const pb = getLatLng(b);

  if (!pa || !pb) return null;

  const R = 6371;
  const dLat = ((pb.lat - pa.lat) * Math.PI) / 180;
  const dLng = ((pb.lng - pa.lng) * Math.PI) / 180;

  const lat1 = (pa.lat * Math.PI) / 180;
  const lat2 = (pb.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.asin(Math.sqrt(x));
}

function routeDistanceKm(pois = []) {
  let total = 0;
  let knownLegs = 0;

  for (let i = 0; i < pois.length - 1; i++) {
    const d = distanceKm(pois[i], pois[i + 1]);

    if (d !== null) {
      total += d;
      knownLegs++;
    }
  }

  return {
    totalKm: Number(total.toFixed(2)),
    knownLegs
  };
}

function optimizeRouteOrder(pois = []) {
  if (pois.length <= 2) return pois;

  const withLocation = pois.filter(p => getLatLng(p));
  if (withLocation.length < 3) return pois;

  const remaining = [...pois];
  const ordered = [remaining.shift()];

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];

    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = distanceKm(last, remaining[i]);
      const score = d === null ? 9999 : d;

      if (score < bestDistance) {
        bestDistance = score;
        bestIndex = i;
      }
    }

    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }

  return ordered;
}

function getMaxDistanceByIntent(intent) {
  if (intent.wantsRelaxed) return 5;
  if (intent.tripDays >= 2) return 10;
  return 8;
}

function removeTooFarPOIs(pois = [], maxDistanceKm = 8) {
  if (pois.length <= 1) {
    return {
      kept: pois,
      removed: []
    };
  }

  const kept = [pois[0]];
  const removed = [];

  for (let i = 1; i < pois.length; i++) {
    const last = kept[kept.length - 1];
    const current = pois[i];
    const d = distanceKm(last, current);

    if (d === null || d <= maxDistanceKm) {
      kept.push(current);
    } else {
      removed.push({
        ...current,
        removed_reason: `Removed because it is too far from the previous POI: ${Number(d.toFixed(2))} km.`
      });
    }
  }

  return { kept, removed };
}

/**
 * =========================
 * Day assignment
 * =========================
 */

function buildDayTheme(day, intent) {
  if (intent.wantsFood && intent.wantsCulture) return `Day ${day}: Food and culture route`;
  if (intent.wantsFood) return `Day ${day}: Local food route`;
  if (intent.wantsCulture) return `Day ${day}: Culture route`;
  if (intent.wantsScenery) return `Day ${day}: Scenic route`;
  if (intent.wantsNight) return `Day ${day}: Night route`;
  return `Day ${day}: Filtered Xiamen route`;
}

function getAreaKey(poi) {
  return poi.area || poi.parent_poi || poi.district || poi.name || "unknown area";
}

function groupByArea(pois = []) {
  const groups = new Map();

  for (const poi of pois) {
    const area = getAreaKey(poi);
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(poi);
  }

  return Array.from(groups.entries()).map(([area, items]) => ({
    area,
    items
  }));
}

function getMaxSameAreaPerDay(area, items, options) {
  if (options.maxSameAreaPOIsPerDay) return options.maxSameAreaPOIsPerDay;

  const explicit = items
    .map(p => p.route_constraints?.max_same_area_pois_per_day)
    .filter(Boolean);

  if (explicit.length) return Math.max(...explicit);

  if (/鼓浪屿/.test(area)) return 3;
  return 4;
}

function trimAreaGroup(items, maxItems) {
  return items.slice(0, Math.max(1, maxItems));
}

function splitPOIsByDays(pois, intent, options = {}) {
  const days = Math.min(Math.max(intent.tripDays || 1, 1), 4);
  const maxPOIsPerDay = options.maxPOIsPerDay || 6;
  const minPOIsPerDay = options.minPOIsPerDay || 4;

  const unique = uniquePOIs(pois);
  const groups = groupByArea(unique.kept);

  const plans = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    theme: buildDayTheme(i + 1, intent),
    pois: [],
    areas: [],
    route_distance: null,
    rejected_by_distance: []
  }));

  const removed = [...unique.removed];
  const duplicates = unique.duplicates || [];

  const trimmedGroups = groups
    .map(group => {
      const maxSameArea = getMaxSameAreaPerDay(group.area, group.items, options);
      const sorted = optimizeRouteOrder(group.items);
      const keptItems = trimAreaGroup(sorted, maxSameArea);
      const removedItems = sorted.slice(maxSameArea).map(poi => ({
        ...poi,
        removed_reason: `Removed because area "${group.area}" exceeded the per-day area quota.`
      }));

      removed.push(...removedItems);

      return {
        area: group.area,
        items: keptItems
      };
    })
    .filter(group => group.items.length > 0);

  for (const group of trimmedGroups.sort((a, b) => b.items.length - a.items.length)) {
    let targetIndex = 0;
    let bestLoad = Infinity;

    for (let i = 0; i < plans.length; i++) {
      const load = plans[i].pois.length;
      if (load < bestLoad) {
        bestLoad = load;
        targetIndex = i;
      }
    }

    const target = plans[targetIndex];

    for (const poi of group.items) {
      if (target.pois.length < maxPOIsPerDay) {
        target.pois.push(poi);
        if (!target.areas.includes(group.area)) target.areas.push(group.area);
      } else {
        removed.push({
          ...poi,
          removed_reason: `Removed because Day ${target.day} already reached the maximum of ${maxPOIsPerDay} POIs.`
        });
      }
    }
  }

  const maxDistanceKm = getMaxDistanceByIntent(intent);
  const removedByDistance = [];

  const finalPlans = plans.map(day => {
    const ordered = optimizeRouteOrder(day.pois);
    const distanceFiltered = removeTooFarPOIs(ordered, maxDistanceKm);

    removedByDistance.push(...distanceFiltered.removed);

    return {
      ...day,
      pois: distanceFiltered.kept,
      route_distance: routeDistanceKm(distanceFiltered.kept),
      max_distance_rule_km: maxDistanceKm,
      min_pois_rule: minPOIsPerDay,
      max_pois_rule: maxPOIsPerDay,
      rejected_by_distance: distanceFiltered.removed.map(item => ({
        name: item.name,
        source_title: item.source_title,
        reason: item.removed_reason
      }))
    };
  });

  return {
    dayPlan: finalPlans,
    removed: [...removed, ...removedByDistance],
    duplicates
  };
}

/**
 * =========================
 * Main STCF filter
 * =========================
 */

function stcfFilter(pois, message, options = {}) {
  const processLog = [];
  const removedPOIs = [];
  const intent = parseIntent(message);

  const minPOIsPerDay = options.minPOIsPerDay || 4;
  const maxPOIsPerDay = options.maxPOIsPerDay || 6;

  const maxTotalPOIs = Math.min(
    options.topK || intent.tripDays * maxPOIsPerDay,
    intent.tripDays * maxPOIsPerDay
  );

  processLog.push("Parsed user intent from natural language.");
  processLog.push(`Detected trip days: ${intent.tripDays}.`);
  processLog.push(`POI count rule: ${minPOIsPerDay}-${maxPOIsPerDay} POI(s) per day.`);
  processLog.push("Filter mode: remove unreasonable POIs and unsupported route candidates.");

  let result = [...pois];
  const originalCount = result.length;

  const semantic = semanticFilter(result, intent);
  result = semantic.kept;
  removedPOIs.push(...semantic.removed);
  processLog.push(`Semantic filter kept ${result.length}/${originalCount} POI(s).`);

  const afterSemantic = result.length;

  const temporal = temporalFilter(result, intent);
  result = temporal.kept;
  removedPOIs.push(...temporal.removed);
  processLog.push(`Temporal filter kept ${result.length}/${afterSemantic} POI(s).`);

  const afterTemporal = result.length;

  const constraints = constraintFilter(result);
  result = constraints.kept;
  removedPOIs.push(...constraints.removed);
  processLog.push(`Basic validity filter kept ${result.length}/${afterTemporal} POI(s).`);

  result = rankPOIs(result, intent, message);
  processLog.push("Ranked POIs internally by retrieval relevance, intent match, route role, and quality signals.");

  const unique = uniquePOIs(result);
  result = unique.kept;
  removedPOIs.push(...unique.removed);

  processLog.push(
    `Duplicate filter kept ${result.length} unique POI(s), hidden ${unique.duplicates.length} duplicated source item(s).`
  );

  const hierarchy = removeHierarchyConflicts(result, intent, {
    maxSameParentPOIs: options.maxSameParentPOIs ?? 3
  });
  result = hierarchy.kept;
  removedPOIs.push(...hierarchy.removed);
  processLog.push(
    `Hierarchy filter kept ${result.length} POI(s), removed ${hierarchy.removed.length} parent/sub-POI conflict(s).`
  );

  const quota = enforceScenarioQuota(result, intent, {
    maxSupportingCulture: options.maxSupportingCulture ?? 1,
    maxSupportingFood: options.maxSupportingFood ?? 1
  });
  result = quota.kept;
  removedPOIs.push(...quota.removed);
  processLog.push(
    `Scenario quota filter kept ${result.length} POI(s), removed ${quota.removed.length} over-quota POI(s).`
  );

    /**
 * Draft-first selection:
 * 1. Keep verified POIs that appeared in the DeepSeek draft first.
 * 2. Use other RAG POIs only as supplements.
 *
 * This prevents valid draft POIs such as 曾厝垵 from being replaced by
 * related but non-draft POIs such as 大同路老街.
 */
const draftPOIs = result.filter(poi => poi._mentioned_in_draft);
const extraPOIs = result.filter(poi => !poi._mentioned_in_draft);

const draftFirstResult = [...draftPOIs, ...extraPOIs];

const topResult = draftFirstResult.slice(0, maxTotalPOIs);

const selectedKeys = new Set(topResult.map(getCanonicalPOIKey));

const trimmedByTotal = draftFirstResult
  .filter(poi => !selectedKeys.has(getCanonicalPOIKey(poi)))
  .map(poi => ({
    ...poi,
    removed_reason: poi._mentioned_in_draft
      ? `Removed even though it was in the draft because the route reached the maximum of ${maxPOIsPerDay} POIs per day.`
      : `Removed because the route reached the maximum of ${maxPOIsPerDay} POIs per day.`
  }));

removedPOIs.push(...trimmedByTotal);

processLog.push(
  `Draft-first selection kept ${draftPOIs.length} verified draft POI(s) before adding supplementary RAG POIs.`
);

processLog.push(
  `Selected top ${topResult.length} POI(s) before area-based day assignment and route-distance validation.`
);

  

  const split = splitPOIsByDays(topResult, intent, {
    minPOIsPerDay,
    maxPOIsPerDay,
    maxSameAreaPOIsPerDay: options.maxSameAreaPOIsPerDay || null
  });

  const dayPlan = split.dayPlan;
  removedPOIs.push(...split.removed);

  processLog.push("Assigned POIs to days by area to avoid splitting the same travel area across different days.");

  if (split.duplicates?.length) {
    processLog.push(
      `Hidden ${split.duplicates.length} duplicated POI item(s) during day assignment.`
    );
  }

  const finalPOIs = uniquePOIs(dayPlan.flatMap(day => day.pois || [])).kept;

  const distanceRejectedCount = dayPlan.reduce(
    (sum, day) => sum + (day.rejected_by_distance?.length || 0),
    0
  );

  processLog.push(`Removed ${distanceRejectedCount} POI(s) because route distance was unreasonable.`);
  processLog.push("Generated final filtered route plan.");

  return {
    intent,
    filteredPOIs: finalPOIs,
    removedPOIs,
    dayPlan,
    processLog,
    debug: {
      original_count: pois.length,
      after_semantic_filter_count: afterSemantic,
      after_temporal_filter_count: afterTemporal,
      final_count: finalPOIs.length,
      removed_count: removedPOIs.length,
      trip_days: intent.tripDays,
      min_pois_per_day: minPOIsPerDay,
      max_pois_per_day: maxPOIsPerDay,
      max_total_pois: maxTotalPOIs,
      distance_rejected_count: distanceRejectedCount
    }
  };
}

/**
 * =========================
 * Draft answer support checking
 * =========================
 */

function normalizeText(text = "") {
  return String(text || "").toLowerCase();
}

function splitCheckableLines(text = "") {
  return cleanThinkText(text)
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^[-*_]{3,}$/.test(line))
    .flatMap(line => {
      if (/^[-*•]\s*/.test(line)) return [line];
      if (/^(day\s*\d+\s*)?(上午|中午|下午|晚上|早上|傍晚|morning|noon|afternoon|evening|late afternoon)/i.test(line)) return [line];

      return line
        .split(/(?<=[。！？.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);
    });
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
    ...(poi.aliases || []),
    ...(poi.semantic?.tags || []),
    ...(poi.semantic?.scenarios || []),
    ...(poi.EIRE?.entity || []),
    ...(poi.EIRE?.intent || [])
  ])
    .map(x => normalizeText(String(x)))
    .filter(x => x.length >= 2);
}

function sentenceMentionsPOI(sentence, poi) {
  const text = normalizeText(sentence);
  const compactText = normalizeNoSpace(sentence);
  const aliases = buildPOIAliases(poi);

  return aliases.some(alias => {
    const compactAlias = normalizeNoSpace(alias);
    return text.includes(alias) || (compactAlias.length >= 2 && compactText.includes(compactAlias));
  });
}

function findMentionedPOI(sentence, candidatePOIs = []) {
  return candidatePOIs.find(poi => sentenceMentionsPOI(sentence, poi)) || null;
}

function isPOIDetailLine(sentence = "") {
  const text = sentence.trim();

  return (
    /^[-*•]\s*(时间|地址|亮点|注意|门票|预约|交通|建议|开放|时长|游玩|适合|特色|原因|路线|备注|价格|费用|午餐|晚餐|早餐|拍照|停留|开放时间|推荐理由|最佳时间)[:：]/i.test(text) ||
    /^[-*•]\s*(time|address|highlight|note|ticket|reservation|transport|duration|best time|why it fits|estimated stay|open|closed|reason|why included)[:：]/i.test(text) ||
    /^(时间|地址|亮点|注意|门票|预约|交通|建议|开放|时长|游玩|适合|特色|原因|路线|备注|价格|费用|午餐|晚餐|早餐|拍照|停留|开放时间|推荐理由|最佳时间)[:：]/i.test(text) ||
    /^(time|address|highlight|note|ticket|reservation|transport|duration|best time|why it fits|estimated stay|open|closed|reason|why included)[:：]/i.test(text)
  );
}

function isSectionHeader(sentence = "") {
  const text = sentence.trim();

  return (
    /^(上午|中午|下午|晚上|早上|傍晚|上午：|中午：|下午：|晚上：|早上：|傍晚：)$/i.test(text) ||
    /^(day\s*\d+|day\s*one|day\s*two|morning|noon|afternoon|evening|late afternoon)$/i.test(text)
  );
}

function isTimeSlotWithPOI(sentence = "") {
  return /^(day\s*\d+\s*)?(morning|noon|afternoon|evening|late afternoon|上午|中午|下午|晚上|早上|傍晚)\s*[:：]\s*.+/i.test(
    sentence.trim()
  );
}

function isGeneralRouteSentence(sentence = "") {
  const text = normalizeText(sentence);

  return /title|day\s*\d|route|plan|theme|recommended|duration|best time|travel|visit|breakfast|lunch|dinner|路线|推荐|行程|安排|全程|集中|公交|打车|步行|顺路|拍照|记得|如果|若时间/i.test(text);
}

function detectHallucinatedClaims(draftAnswer, candidatePOIs) {
  const lines = splitCheckableLines(draftAnswer);
  const accepted = [];
  const rejected = [];

  let currentPOI = null;

  for (const line of lines) {
    const mentionedPOI = findMentionedPOI(line, candidatePOIs);

    if (mentionedPOI) {
      currentPOI = mentionedPOI;
      accepted.push(line);
      continue;
    }

    if (isTimeSlotWithPOI(line)) {
      rejected.push({
        sentence: line,
        reason: "Removed because the POI in this time-slot line is not verified by local RAG."
      });
      currentPOI = null;
      continue;
    }

    if (isSectionHeader(line)) {
      accepted.push(line);
      continue;
    }

    if (currentPOI && isPOIDetailLine(line)) {
      accepted.push(line);
      continue;
    }

    if (isPOIDetailLine(line) && !currentPOI) {
      rejected.push({
        sentence: line,
        reason: "Removed because this detail line is attached to an unverified POI."
      });
      continue;
    }

    if (isGeneralRouteSentence(line)) {
      accepted.push(line);
      continue;
    }

    rejected.push({
      sentence: line,
      reason: "Removed because this line is not supported by the filtered local RAG POIs."
    });
  }

  const hallucinationRate =
    lines.length === 0 ? 0 : rejected.length / lines.length;

  return {
    accepted,
    rejected,
    hallucinationRate: Number(hallucinationRate.toFixed(3))
  };
}

function calculateIntentMatchRate(candidatePOIs, intent) {
  if (!candidatePOIs.length) return 0;

  let matched = 0;

  for (const poi of candidatePOIs) {
    const types = getPOITypes(poi);

    if (intent.wantsFood && types.isFood) matched++;
    else if (intent.wantsCulture && types.isCulture) matched++;
    else if (intent.wantsScenery && types.isScenery) matched++;
    else if (!intent.wantsFood && !intent.wantsCulture && !intent.wantsScenery) matched++;
  }

  return Number((matched / candidatePOIs.length).toFixed(3));
}

function calculateTemporalFeasibility(candidatePOIs, intent) {
  if (!candidatePOIs.length) return 0;

  let feasible = 0;

  for (const poi of candidatePOIs) {
    const time = poi.time || {};

    if (intent.wantsNight && time.night_available === false) continue;

    if (
      intent.mentionsMonday &&
      time.closed_day &&
      /monday|周一|星期一/i.test(time.closed_day)
    ) {
      continue;
    }

    feasible++;
  }

  return Number((feasible / candidatePOIs.length).toFixed(3));
}

function calculateMetrics(candidatePOIs, intent, hallucination) {
  return {
    intentMatchRate: calculateIntentMatchRate(candidatePOIs, intent),
    hallucinationRate: hallucination.hallucinationRate,
    temporalFeasibility: calculateTemporalFeasibility(candidatePOIs, intent)
  };
}

function buildSelectedPOIReasons(candidatePOIs = []) {
  return candidatePOIs.map(poi => ({
    name: poi.name,
    pinyin: poi.pinyin || null,
    display_name: formatPOIName(poi),
    category: poi.semantic?.main_category || "unknown",
    area: poi.area || null,
    parent_poi: poi.parent_poi || null,
    source_title: poi.source_title,
    open_time: poi.time?.open_time,
    close_time: poi.time?.close_time,
    warning: poi.filter_warning || null
  }));
}

function buildOptimizedDraft(acceptedLines, candidatePOIs, dayPlan) {
    const allowedNames = candidatePOIs
  .map(poi => {
    const draftMark = poi._mentioned_in_draft ? " [draft]" : "";
    return `${formatPOIName(poi)}${draftMark}`;
  })
  .filter(Boolean);

  const routeSummary = dayPlan
    .map(day => {
      const names = (day.pois || []).map(formatPOIName).filter(Boolean);
      const areas = day.areas?.length ? ` [areas: ${day.areas.join(", ")}]` : "";
      return `Day ${day.day}: ${day.theme}${areas} - ${names.join(" → ")}`;
    })
    .join("\n");

  return `
Filtering algorithm output:

Supported content kept from DeepSeek draft:
${acceptedLines.length ? acceptedLines.join("\n") : "No fully supported content was kept."}

Allowed POIs after filtering:
${allowedNames.join(", ") || "None"}

Filtered route structure:
${routeSummary || "No route generated."}
`.trim();
}

function optimizeDraftAnswer({
  userMessage,
  draftAnswer,
  candidatePOIs,
  dayPlan,
  intent
}) {
  const processLog = [];

  processLog.push("Started draft support checking.");
  processLog.push("Split DeepSeek draft into context-aware checkable lines.");

  const hallucination = detectHallucinatedClaims(draftAnswer, candidatePOIs);

  processLog.push(`Removed ${hallucination.rejected.length} unsupported or unreasonable line(s).`);

  const metrics = calculateMetrics(candidatePOIs, intent, hallucination);

 
  processLog.push("Built optimized draft from supported content and filtered POIs.");

  const optimizedDraft = buildOptimizedDraft(
    hallucination.accepted,
    candidatePOIs,
    dayPlan
  );

  return {
    optimizedDraft,
    metrics,
    rejectedClaims: hallucination.rejected,
    selectedPOIReasons: buildSelectedPOIReasons(candidatePOIs),
    processLog
  };
}

module.exports = {
  cleanThinkText,
  extractPOIFromSources,
  parseIntent,
  stcfFilter,
  optimizeDraftAnswer
};