import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearActorLog,
  clearHeroPointsLog,
  exportLogAsJSON,
  getActorLog,
  getActorsSummary,
  getHeroPointsLog,
  initializeLogger,
  logHeroPointSpending,
  reduceActorHeroPoints
} from '../src/logger.js';

function makeGame({ isGM = true, actors = [] } = {}) {
  const settingsStore = {};
  const actorList = actors.map((a) => makeActor(a));
  return {
    settingsStore,
    actorList,
    user: { id: 'user1', isGM },
    users: { get: (id) => (id === 'user1' ? { id: 'user1', name: 'GM Player' } : null) },
    actors: Object.assign(actorList, { get: (id) => actorList.find((a) => a.id === id) ?? null }),
    settings: {
      get: (moduleId, key) => settingsStore[`${moduleId}.${key}`],
      set: async (moduleId, key, value) => { settingsStore[`${moduleId}.${key}`] = value; }
    },
    i18n: { localize: (key) => key, format: (key) => key }
  };
}

function makeActor({ id, name, flags = {} } = {}) {
  const flagStore = { 'ld-hero-pointz': {}, ...flags };
  return {
    id,
    name,
    calls: { setFlag: [] },
    getFlag: (moduleId, key) => flagStore[moduleId]?.[key],
    setFlag: async function setFlag(moduleId, key, value) {
      this.calls.setFlag.push({ moduleId, key, value });
      flagStore[moduleId] = { ...flagStore[moduleId], [key]: value };
    }
  };
}

// async + awaiting run() inside the try is required, not cosmetic: several
// logger.js functions (clearHeroPointsLog, clearActorLog) touch `game` again
// *after* their first await. Restoring globalThis.game synchronously (as a
// non-async helper returning run() would) pulls the rug out from under those
// later accesses.
let idCounter = 0;

async function withGame(gameStub, run) {
  const originalGame = globalThis.game;
  const originalFoundry = globalThis.foundry;
  const originalConsoleWarn = console.warn;
  globalThis.game = gameStub;
  globalThis.foundry = { utils: { randomID: () => `id-${++idCounter}` } };
  console.warn = () => {};
  try {
    return await run();
  } finally {
    globalThis.game = originalGame;
    globalThis.foundry = originalFoundry;
    console.warn = originalConsoleWarn;
  }
}

test('initializeLogger: seeds an empty log for a GM if one does not exist', async () => {
  const g = makeGame();
  await withGame(g, () => initializeLogger());
  assert.deepEqual(g.settingsStore['ld-hero-pointz.heroPointsLog'], []);
});

test('initializeLogger: does nothing for a non-GM', async () => {
  const g = makeGame({ isGM: false });
  await withGame(g, () => initializeLogger());
  assert.equal('ld-hero-pointz.heroPointsLog' in g.settingsStore, false);
});

test('logHeroPointSpending: prepends an entry and persists it, GM only', async () => {
  const g = makeGame();
  await withGame(g, () => logHeroPointSpending('a1', 'Fighter', 1, 4, 'addD6'));
  const log = g.settingsStore['ld-hero-pointz.heroPointsLog'];
  assert.equal(log.length, 1);
  assert.equal(log[0].actorId, 'a1');
  assert.equal(log[0].actorName, 'Fighter');
  assert.equal(log[0].pointsRemaining, 4);
});

test('logHeroPointSpending: non-GM clients do not write to the log', async () => {
  const g = makeGame({ isGM: false });
  const result = await withGame(g, () => logHeroPointSpending('a1', 'Fighter', 1, 4, 'addD6'));
  assert.equal(result, undefined);
  assert.equal('ld-hero-pointz.heroPointsLog' in g.settingsStore, false);
});

test('logHeroPointSpending: caps the log at 500 entries, dropping the oldest', async () => {
  const g = makeGame();
  g.settingsStore['ld-hero-pointz.heroPointsLog'] = Array.from({ length: 500 }, (_, i) => ({ id: `old-${i}` }));
  await withGame(g, () => logHeroPointSpending('a1', 'Fighter', 1, 4, 'addD6'));
  const log = g.settingsStore['ld-hero-pointz.heroPointsLog'];
  assert.equal(log.length, 500);
  assert.equal(log[0].actorId, 'a1');
});

test('getHeroPointsLog / getActorLog: reads back and filters by actor', async () => {
  const g = makeGame();
  await withGame(g, async () => {
    await logHeroPointSpending('a1', 'Fighter', 1, 4, 'addD6');
    await logHeroPointSpending('a2', 'Rogue', 1, 2, 'addD6');
  });
  assert.equal((await withGame(g, () => getHeroPointsLog())).length, 2);
  const a1Log = await withGame(g, () => getActorLog('a1'));
  assert.equal(a1Log.length, 1);
  assert.equal(a1Log[0].actorId, 'a1');
});

test('clearActorLog: removes only that actor\'s entries and resets their points', async () => {
  const g = makeGame({ actors: [{ id: 'a1', name: 'Fighter', flags: { 'ld-hero-pointz': { heroPoints: 3, heroPointsEnabled: true } } }] });
  await withGame(g, async () => {
    await logHeroPointSpending('a1', 'Fighter', 1, 4, 'addD6');
    await logHeroPointSpending('a2', 'Rogue', 1, 2, 'addD6');
    await clearActorLog('a1');
  });
  const remaining = g.settingsStore['ld-hero-pointz.heroPointsLog'];
  assert.deepEqual(remaining.map((e) => e.actorId), ['a2']);
  const actor = g.actors.get('a1');
  assert.equal(actor.getFlag('ld-hero-pointz', 'heroPoints'), 0);
  assert.equal(actor.getFlag('ld-hero-pointz', 'heroPointsEnabled'), false);
});

test('clearHeroPointsLog: wipes the whole log and resets every actor', async () => {
  const g = makeGame({
    actors: [
      { id: 'a1', name: 'Fighter', flags: { 'ld-hero-pointz': { heroPoints: 3 } } },
      { id: 'a2', name: 'Rogue', flags: { 'ld-hero-pointz': { heroPoints: 5 } } }
    ]
  });
  await withGame(g, async () => {
    await logHeroPointSpending('a1', 'Fighter', 1, 4, 'addD6');
    await clearHeroPointsLog();
  });
  assert.deepEqual(g.settingsStore['ld-hero-pointz.heroPointsLog'], []);
  assert.equal(g.actors.get('a1').getFlag('ld-hero-pointz', 'heroPoints'), 0);
  assert.equal(g.actors.get('a2').getFlag('ld-hero-pointz', 'heroPoints'), 0);
});

test('reduceActorHeroPoints: subtracts, floors at 0, and logs the reduction', async () => {
  const g = makeGame({ actors: [{ id: 'a1', name: 'Fighter', flags: { 'ld-hero-pointz': { heroPoints: 3 } } }] });
  await withGame(g, () => reduceActorHeroPoints('a1', 10));
  assert.equal(g.actors.get('a1').getFlag('ld-hero-pointz', 'heroPoints'), 0);
  const log = g.settingsStore['ld-hero-pointz.heroPointsLog'];
  assert.equal(log.length, 1);
  assert.equal(log[0].action, 'reduce');
});

test('reduceActorHeroPoints: a non-positive amount is a no-op', async () => {
  const g = makeGame({ actors: [{ id: 'a1', name: 'Fighter', flags: { 'ld-hero-pointz': { heroPoints: 3 } } }] });
  await withGame(g, () => reduceActorHeroPoints('a1', 0));
  assert.equal(g.actors.get('a1').calls.setFlag.length, 0);
});

test('getActorsSummary: includes actors with points or explicitly enabled, excludes everyone else', async () => {
  const g = makeGame({
    actors: [
      { id: 'a1', name: 'Has points', flags: { 'ld-hero-pointz': { heroPoints: 3 } } },
      { id: 'a2', name: 'Enabled but zero', flags: { 'ld-hero-pointz': { heroPoints: 0, heroPointsEnabled: true } } },
      { id: 'a3', name: 'Untouched', flags: {} }
    ]
  });
  const summary = await withGame(g, () => getActorsSummary());
  assert.deepEqual(Object.keys(summary).sort(), ['a1', 'a2']);
});

test('exportLogAsJSON: bundles the log, summary, and a count', async () => {
  const g = makeGame({ actors: [{ id: 'a1', name: 'Fighter', flags: { 'ld-hero-pointz': { heroPoints: 4 } } }] });
  await withGame(g, () => logHeroPointSpending('a1', 'Fighter', 1, 4, 'addD6'));
  const exported = await withGame(g, () => exportLogAsJSON());
  assert.equal(exported.totalEntries, 1);
  assert.equal(exported.entries.length, 1);
  assert.ok(exported.summary.a1);
  assert.ok(exported.exported);
});

test('clearHeroPointsLog: logs a warning when setFlag throws for an actor', async () => {
  const g = makeGame({
    actors: [{ id: 'a1', name: 'Broken', flags: { 'ld-hero-pointz': { heroPoints: 2 } } }]
  });
  const actor = g.actors.get('a1');
  actor.setFlag = async () => {
    throw new Error('permission');
  };
  const warnings = [];
  // withGame silences console.warn; capture after it restores by not using withGame's silence
  const originalGame = globalThis.game;
  const originalFoundry = globalThis.foundry;
  globalThis.game = g;
  globalThis.foundry = { utils: { randomID: () => `id-${++idCounter}` } };
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    await clearHeroPointsLog();
  } finally {
    console.warn = originalWarn;
    globalThis.game = originalGame;
    globalThis.foundry = originalFoundry;
  }
  assert.equal(warnings.length, 1);
});

test('clearActorLog: logs a warning when setFlag throws; no-ops for non-GM / missing actor', async () => {
  const g = makeGame({
    actors: [{ id: 'a1', name: 'Broken', flags: { 'ld-hero-pointz': { heroPoints: 2 } } }]
  });
  g.settingsStore['ld-hero-pointz.heroPointsLog'] = [{ actorId: 'a1' }, { actorId: 'a2' }];
  const actor = g.actors.get('a1');
  actor.setFlag = async () => {
    throw new Error('permission');
  };
  const warnings = [];
  const originalGame = globalThis.game;
  const originalFoundry = globalThis.foundry;
  globalThis.game = g;
  globalThis.foundry = { utils: { randomID: () => `id-${++idCounter}` } };
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    await clearActorLog('a1');
  } finally {
    console.warn = originalWarn;
    globalThis.game = originalGame;
    globalThis.foundry = originalFoundry;
  }
  assert.equal(warnings.length, 1);

  const nonGm = makeGame({ isGM: false });
  await withGame(nonGm, () => clearActorLog('a1'));
  assert.equal('ld-hero-pointz.heroPointsLog' in nonGm.settingsStore, false);

  const g2 = makeGame();
  g2.settingsStore['ld-hero-pointz.heroPointsLog'] = [{ actorId: 'a1' }];
  await withGame(g2, () => clearActorLog('missing'));
  // No actor named "missing" — log entries for other actors are untouched.
  assert.deepEqual(g2.settingsStore['ld-hero-pointz.heroPointsLog'], [{ actorId: 'a1' }]);
});

test('clearHeroPointsLog: non-GM is a no-op', async () => {
  const g = makeGame({ isGM: false });
  await withGame(g, () => clearHeroPointsLog());
  assert.equal('ld-hero-pointz.heroPointsLog' in g.settingsStore, false);
});

test('reduceActorHeroPoints: non-GM and missing actor are no-ops', async () => {
  const g = makeGame({ isGM: false, actors: [{ id: 'a1', name: 'Fighter', flags: { 'ld-hero-pointz': { heroPoints: 3 } } }] });
  await withGame(g, () => reduceActorHeroPoints('a1', 1));
  assert.equal(g.actors.get('a1').calls.setFlag.length, 0);

  const g2 = makeGame();
  await withGame(g2, () => reduceActorHeroPoints('missing', 1));
});

test('logHeroPointSpending: uses UnknownUser when the user id is not found', async () => {
  const g = makeGame();
  await withGame(g, () => logHeroPointSpending('a1', 'Fighter', 1, 4, 'addD6', 'ghost'));
  const log = g.settingsStore['ld-hero-pointz.heroPointsLog'];
  assert.equal(log[0].userName, 'LDHEROEPOINTZ.Messages.UnknownUser');
});

test('initializeLogger: does nothing when the log already exists', async () => {
  const g = makeGame();
  g.settingsStore['ld-hero-pointz.heroPointsLog'] = [{ id: 'existing' }];
  await withGame(g, () => initializeLogger());
  assert.deepEqual(g.settingsStore['ld-hero-pointz.heroPointsLog'], [{ id: 'existing' }]);
});

test('getHeroPointsLog returns empty array when setting is falsy', async () => {
  const g = makeGame();
  g.settingsStore['ld-hero-pointz.heroPointsLog'] = null;
  assert.deepEqual(await withGame(g, () => getHeroPointsLog()), []);
});

