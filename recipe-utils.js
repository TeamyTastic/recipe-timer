const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;

function detectUrl(text) {
  const match = text.trim().match(URL_REGEX);
  if (!match) return null;
  return match[0].replace(/[.,;:!?)]+$/, '');
}

function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const h = parsed.hostname.toLowerCase();
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(h)) return false;
    if (h === '[::1]' || h === '0.0.0.0') return false;
    return true;
  } catch {
    return false;
  }
}

function getCorsProxyStrategies(url) {
  return [
    {
      name: 'allorigins',
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      extract: (response) => response.json().then((data) => data.contents),
    },
    {
      name: 'corsproxy',
      url: `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
      extract: (response) => response.text(),
    },
  ];
}

async function fetchWithCorsProxy(url, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const AbortControllerImpl = deps.AbortControllerImpl || globalThis.AbortController;
  const setTimeoutImpl = deps.setTimeoutImpl || globalThis.setTimeout;
  const clearTimeoutImpl = deps.clearTimeoutImpl || globalThis.clearTimeout;
  const minLength = deps.minLength || 200;
  const timeoutMs = deps.timeoutMs || 10000;
  const proxies = deps.proxies || getCorsProxyStrategies(url);

  for (const proxy of proxies) {
    try {
      const controller = new AbortControllerImpl();
      const timeout = setTimeoutImpl(() => controller.abort(), timeoutMs);
      const response = await fetchImpl(proxy.url, { signal: controller.signal });

      if (!response.ok) {
        clearTimeoutImpl(timeout);
        continue;
      }

      const html = await proxy.extract(response);
      clearTimeoutImpl(timeout);
      if (html && html.length > minLength) return html;
    } catch {
      continue;
    }
  }

  throw new Error('All CORS proxies failed. Try pasting the recipe text directly.');
}

function extractJsonLdRecipe(html) {
  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      let parsed = JSON.parse(match[1]);

      if (parsed['@graph']) {
        parsed = parsed['@graph'];
      }

      if (Array.isArray(parsed)) {
        const recipe = parsed.find((item) =>
          item['@type'] === 'Recipe' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
        if (recipe) return recipe;
      }

      if (
        parsed['@type'] === 'Recipe' ||
        (Array.isArray(parsed['@type']) && parsed['@type'].includes('Recipe'))
      ) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function formatIsoDuration(iso) {
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const parts = [];
  if (match[1]) parts.push(`${match[1]}h`);
  if (match[2]) parts.push(`${match[2]}m`);
  if (match[3]) parts.push(`${match[3]}s`);
  return parts.join(' ') || iso;
}

function repairJson(str) {
  let repaired = str.replace(/,\s*"[^"]*$/, '');
  repaired = repaired.replace(/:\s*"[^"]*$/, ': ""');
  repaired = repaired.replace(/,\s*([\]}])/g, '$1');
  repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  repaired = repaired.replace(/:\s*'([^']*)'/g, ': "$1"');

  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;
  let jsonEndIdx = -1;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') braces++;
    if (char === '}') braces--;
    if (char === '[') brackets++;
    if (char === ']') brackets--;

    if (braces === 0 && brackets === 0 && i > 0) {
      jsonEndIdx = i + 1;
      break;
    }
  }

  if (jsonEndIdx > 0) {
    repaired = repaired.slice(0, jsonEndIdx);
  } else {
    braces = 0;
    brackets = 0;
    inString = false;
    escaped = false;

    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === '{') braces++;
      if (char === '}') braces--;
      if (char === '[') brackets++;
      if (char === ']') brackets--;
    }

    if (inString) repaired += '"';
    while (brackets > 0) {
      repaired += ']';
      brackets--;
    }
    while (braces > 0) {
      repaired += '}';
      braces--;
    }
  }

  return repaired;
}

function mergeCachedRecipes(existingRecipes, importedRecipes, limit = 10) {
  const merged = [...existingRecipes];
  let restoredCount = 0;

  for (const recipe of importedRecipes || []) {
    if (!merged.some((current) => current.title === recipe.title)) {
      merged.push(recipe);
      restoredCount++;
    }
  }

  return {
    recipes: merged.slice(0, limit),
    restoredCount,
  };
}

function cacheRecentItems(existingItems, newItem, key = 'title', limit = 10) {
  const filtered = existingItems.filter((item) => item[key] !== newItem[key]);
  filtered.unshift(newItem);
  return filtered.slice(0, limit);
}

function applyBackupImport(existingRecipes, backup, hasActiveRecipe, limit = 10) {
  if (!backup.cachedRecipes && !backup.activeRecipe && !backup.libraryRecipes) {
    throw new Error('Invalid backup file — no recipe data found');
  }

  const merged = mergeCachedRecipes(existingRecipes, backup.cachedRecipes || [], limit);
  return {
    cachedRecipes: merged.recipes,
    restoredCount: merged.restoredCount,
    activeRecipe: backup.activeRecipe && !hasActiveRecipe ? backup.activeRecipe : null,
  };
}

function buildGuideSessionState({ title, steps, currentStep, completedSteps }) {
  return {
    title,
    steps,
    currentStep,
    completedSteps: Array.from(completedSteps),
  };
}

function buildDishColorMap(steps) {
  const dishColorMap = {};
  let count = 0;

  for (const step of steps) {
    if (step.dish && !dishColorMap[step.dish]) {
      dishColorMap[step.dish] = count === 0 ? 'dish-a' : 'dish-b';
      count++;
      if (count >= 2) break;
    }
  }

  return dishColorMap;
}

function getLateMinutes(scheduledAt, now = new Date()) {
  if (!scheduledAt) return 0;
  const [sh, sm] = scheduledAt.split(':').map(Number);
  const scheduledMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0, 0).getTime();
  return Math.floor((now.getTime() - scheduledMs) / 60000);
}

function getCurrentStepIndex(steps, elapsed) {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (elapsed >= steps[i].time) return i;
  }
  return 0;
}

function validateGeneratedRecipe(recipe, options = {}) {
  const requireDish = Boolean(options.requireDish);
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('Recipe response must be a JSON object');
  }
  if (typeof recipe.title !== 'string' || !recipe.title.trim()) {
    throw new Error('Recipe title missing from model response');
  }
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    throw new Error('Recipe steps missing from model response');
  }

  let previousTime = -1;
  recipe.steps = recipe.steps.map((step, index) => {
    if (!step || typeof step !== 'object') {
      throw new Error(`Step ${index + 1} is not a valid object`);
    }

    const time = Number(step.time);
    const duration = Number(step.duration);
    const title = typeof step.title === 'string' ? step.title.trim() : '';
    const detail = typeof step.detail === 'string' ? step.detail.trim() : '';
    const scheduledAt = step.scheduledAt == null ? undefined : String(step.scheduledAt).trim();
    const dish = step.dish == null ? undefined : String(step.dish).trim();

    if (!Number.isFinite(time) || time < 0) {
      throw new Error(`Step ${index + 1} has an invalid time`);
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`Step ${index + 1} has an invalid duration`);
    }
    if (!title) {
      throw new Error(`Step ${index + 1} is missing a title`);
    }
    if (!detail) {
      throw new Error(`Step ${index + 1} is missing detail text`);
    }
    if (time < previousTime) {
      throw new Error(`Step ${index + 1} starts before the previous step`);
    }
    if (scheduledAt && !/^\d{2}:\d{2}$/.test(scheduledAt)) {
      throw new Error(`Step ${index + 1} has an invalid scheduledAt value`);
    }
    if (requireDish && !dish) {
      throw new Error(`Step ${index + 1} is missing a dish label`);
    }

    previousTime = time;
    return {
      ...step,
      time,
      duration,
      title,
      detail,
      scheduledAt,
      dish,
    };
  });

  return recipe;
}

const exported = {
  applyBackupImport,
  buildGuideSessionState,
  buildDishColorMap,
  cacheRecentItems,
  detectUrl,
  extractJsonLdRecipe,
  fetchWithCorsProxy,
  formatIsoDuration,
  getCorsProxyStrategies,
  getCurrentStepIndex,
  getLateMinutes,
  isSafeUrl,
  mergeCachedRecipes,
  repairJson,
  validateGeneratedRecipe,
};

if (typeof window !== 'undefined') {
  window.RecipeTimerUtils = exported;
}

if (typeof module !== 'undefined') {
  module.exports = exported;
}
