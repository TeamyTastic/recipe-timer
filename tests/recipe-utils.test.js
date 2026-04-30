const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../recipe-utils.js');

const {
  applyBackupImport,
  buildGuideSessionState,
  buildDishColorMap,
  cacheRecentItems,
  extractJsonLdRecipe,
  fetchWithCorsProxy,
  formatIsoDuration,
  getCurrentStepIndex,
  getLateMinutes,
  isSafeUrl,
  repairJson,
  validateGeneratedRecipe,
} = utils;

test('extractJsonLdRecipe finds a recipe inside @graph', () => {
  const html = `
    <script type="application/ld+json">
      {"@graph":[{"@type":"BreadcrumbList"},{"@type":"Recipe","name":"Lasagne"}]}
    </script>
  `;

  assert.deepEqual(extractJsonLdRecipe(html), { '@type': 'Recipe', name: 'Lasagne' });
});

test('extractJsonLdRecipe skips broken blocks and keeps searching', () => {
  const html = `
    <script type="application/ld+json">{not valid json}</script>
    <script type="application/ld+json">[{"@type":["Thing","Recipe"],"name":"Soup"}]</script>
  `;

  assert.equal(extractJsonLdRecipe(html).name, 'Soup');
});

test('formatIsoDuration renders mixed duration parts', () => {
  assert.equal(formatIsoDuration('PT1H30M5S'), '1h 30m 5s');
  assert.equal(formatIsoDuration('PT45M'), '45m');
});

test('repairJson fixes trailing commas, bare keys, and truncation', () => {
  assert.equal(repairJson('{title: "Toast", steps: [1,2,],}'), '{"title": "Toast", "steps": [1,2]}');
  assert.equal(repairJson('{"title":"Toast","steps":["prep"'), '{"title":"Toast","steps":["prep"]}');
});

test('applyBackupImport deduplicates by title and preserves current active recipe', () => {
  const result = applyBackupImport(
    [{ title: 'Toast' }, { title: 'Soup' }],
    {
      cachedRecipes: [{ title: 'Soup' }, { title: 'Pasta' }],
      activeRecipe: { title: 'Imported active' },
      libraryRecipes: [],
    },
    true
  );

  assert.deepEqual(result.cachedRecipes.map((recipe) => recipe.title), ['Toast', 'Soup', 'Pasta']);
  assert.equal(result.restoredCount, 1);
  assert.equal(result.activeRecipe, null);
});

test('cacheRecentItems keeps newest first and deduplicates by key', () => {
  const result = cacheRecentItems(
    [{ title: 'Guide A' }, { title: 'Guide B' }],
    { title: 'Guide B', steps: [] }
  );

  assert.deepEqual(result.map((item) => item.title), ['Guide B', 'Guide A']);
});

test('buildGuideSessionState serializes set state for storage', () => {
  const state = buildGuideSessionState({
    title: 'Knife Skills',
    steps: [{ title: 'Chop' }],
    currentStep: 0,
    completedSteps: new Set([0, 2]),
  });

  assert.deepEqual(state, {
    title: 'Knife Skills',
    steps: [{ title: 'Chop' }],
    currentStep: 0,
    completedSteps: [0, 2],
  });
});

test('buildDishColorMap only assigns the first two unique dishes', () => {
  const result = buildDishColorMap([
    { dish: 'Rice' },
    { dish: 'Curry' },
    { dish: 'Rice' },
    { dish: 'Salad' },
  ]);

  assert.deepEqual(result, { Rice: 'dish-a', Curry: 'dish-b' });
});

test('getCurrentStepIndex returns the active step for elapsed time', () => {
  const steps = [
    { time: 0, duration: 60 },
    { time: 60, duration: 120 },
    { time: 180, duration: 30 },
  ];

  assert.equal(getCurrentStepIndex(steps, 0), 0);
  assert.equal(getCurrentStepIndex(steps, 75), 1);
  assert.equal(getCurrentStepIndex(steps, 220), 2);
});

test('getLateMinutes returns positive minutes when behind schedule', () => {
  const now = new Date(2026, 3, 5, 12, 7, 0);
  assert.equal(getLateMinutes('12:00', now), 7);
  assert.equal(getLateMinutes('12:15', now), -8);
});

test('isSafeUrl rejects local and private addresses', () => {
  assert.equal(isSafeUrl('https://example.com/recipe'), true);
  assert.equal(isSafeUrl('http://localhost:8000'), false);
  assert.equal(isSafeUrl('http://192.168.1.4/recipe'), false);
  assert.equal(isSafeUrl('ftp://example.com/file'), false);
});

test('fetchWithCorsProxy falls back to the next proxy after failure', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      throw new Error('first proxy failed');
    }
    return {
      ok: true,
      text: async () => 'x'.repeat(250),
    };
  };

  const html = await fetchWithCorsProxy('https://example.com/recipe', {
    fetchImpl,
    AbortControllerImpl: class { constructor() { this.signal = {}; } abort() {} },
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {},
  });

  assert.equal(html.length, 250);
  assert.equal(calls.length, 2);
});

test('validateGeneratedRecipe rejects missing titles and invalid timings', () => {
  assert.throws(
    () => validateGeneratedRecipe({ title: '', steps: [{ time: 0, duration: 1, title: 'x', detail: 'x' }] }),
    /title missing/i
  );
  assert.throws(
    () => validateGeneratedRecipe({ title: 'Toast', steps: [{ time: 0, duration: 0, title: 'x', detail: 'x' }] }),
    /invalid duration/i
  );
});

test('validateGeneratedRecipe normalizes numeric fields and requires dish labels when requested', () => {
  const recipe = validateGeneratedRecipe({
    title: 'Toast',
    steps: [{ time: '0', duration: '60', title: ' Butter ', detail: ' Spread ', scheduledAt: '12:05', dish: 'Toast' }],
  }, { requireDish: true });

  assert.equal(recipe.steps[0].time, 0);
  assert.equal(recipe.steps[0].duration, 60);
  assert.equal(recipe.steps[0].title, 'Butter');
  assert.equal(recipe.steps[0].detail, 'Spread');

  assert.throws(
    () => validateGeneratedRecipe({
      title: 'Toast',
      steps: [{ time: 0, duration: 60, title: 'Butter', detail: 'Spread' }],
    }, { requireDish: true }),
    /missing a dish/i
  );
});
