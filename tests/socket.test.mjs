import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emitSocketMessage,
  registerSocket,
  handleSocketMessage,
  handleHeroPointsUpdate,
  handleHeroPointSpend
} from '../src/socket.js';

async function withGame(gameStub, run) {
  const originalGame = globalThis.game;
  const originalConsoleWarn = console.warn;
  const originalFoundry = globalThis.foundry;
  globalThis.game = gameStub;
  globalThis.foundry = {
    utils: { randomID: () => 'rid' }
  };
  console.warn = () => {};
  try {
    return await run();
  } finally {
    globalThis.game = originalGame;
    globalThis.foundry = originalFoundry;
    console.warn = originalConsoleWarn;
  }
}

function makeActor({ id = 'a1', name = 'Fighter', points = 2 } = {}) {
  const flags = { heroPoints: points };
  return {
    id,
    name,
    getFlag: (_m, key) => flags[key],
    setFlag: async (_m, key, value) => {
      flags[key] = value;
    },
    _flags: flags
  };
}

test('registerSocket: subscribes to the module.ld-hero-pointz channel', async () => {
  const handlers = [];
  const g = { socket: { on: (channel, fn) => handlers.push({ channel, fn }) } };
  await withGame(g, () => registerSocket());
  assert.equal(handlers.length, 1);
  assert.equal(handlers[0].channel, 'module.ld-hero-pointz');
  assert.equal(typeof handlers[0].fn, 'function');
});

test('emitSocketMessage: broadcasts {type, ...data} on the canonical channel', async () => {
  const emitted = [];
  const g = { socket: { emit: (channel, payload) => emitted.push({ channel, payload }) } };
  await withGame(g, () => emitSocketMessage('spendHeroPoint', { actorId: 'a1', points: 3 }));
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].channel, 'module.ld-hero-pointz');
  assert.deepEqual(emitted[0].payload, { type: 'spendHeroPoint', actorId: 'a1', points: 3 });
});

test('an inbound updateHeroPoints message applies the flag on other clients and skips the originator', async () => {
  const setFlagCalls = [];
  const actor = {
    id: 'a1',
    name: 'Fighter',
    getFlag: () => 2,
    setFlag: async (moduleId, key, value) => { setFlagCalls.push({ moduleId, key, value }); }
  };
  const g = {
    user: { id: 'receiver', isGM: false },
    users: { get: () => null },
    actors: { get: (id) => (id === 'a1' ? actor : null) },
    socket: { on: (channel, fn) => { g._handler = fn; } },
    i18n: { localize: (k) => k, format: (k) => k },
    settings: { get: () => [], set: async () => {} }
  };
  await withGame(g, () => registerSocket());
  await withGame(g, () => g._handler({ type: 'updateHeroPoints', actorId: 'a1', points: 5, userId: 'sender' }));
  assert.deepEqual(setFlagCalls, [{ moduleId: 'ld-hero-pointz', key: 'heroPoints', value: 5 }]);
});

test('an inbound message from this same client (the originator) is skipped — already applied locally', async () => {
  const setFlagCalls = [];
  const actor = {
    id: 'a1',
    getFlag: () => 2,
    setFlag: async (moduleId, key, value) => { setFlagCalls.push({ moduleId, key, value }); }
  };
  const g = {
    user: { id: 'me', isGM: false },
    actors: { get: () => actor },
    socket: { on: (channel, fn) => { g._handler = fn; } }
  };
  await withGame(g, () => registerSocket());
  await withGame(g, () => g._handler({ type: 'updateHeroPoints', actorId: 'a1', points: 5, userId: 'me' }));
  assert.equal(setFlagCalls.length, 0);
});

test('a rejected setFlag is caught, not an unhandled rejection', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  const actor = {
    id: 'a1',
    getFlag: () => 2,
    setFlag: async () => { throw new Error('not owner'); }
  };
  const g = {
    user: { id: 'receiver', isGM: false },
    actors: { get: () => actor },
    socket: { on: (channel, fn) => { g._handler = fn; } }
  };

  const unhandledRejections = [];
  const onUnhandled = (reason) => unhandledRejections.push(reason);
  process.on('unhandledRejection', onUnhandled);

  try {
    await withGame(g, () => registerSocket());
    withGame(g, () => g._handler({ type: 'updateHeroPoints', actorId: 'a1', points: 5, userId: 'sender' }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    process.off('unhandledRejection', onUnhandled);
    console.warn = originalWarn;
  }

  assert.deepEqual(unhandledRejections, [], 'the rejection must be caught, not left unhandled');
  assert.equal(warnings.length, 1);
});

test('an unrecognized actorId in an inbound message is a no-op, not a throw', async () => {
  const g = {
    user: { id: 'receiver' },
    actors: { get: () => null },
    socket: { on: (channel, fn) => { g._handler = fn; } }
  };
  await withGame(g, () => registerSocket());
  await assert.doesNotReject(() => withGame(g, () => g._handler({ type: 'updateHeroPoints', actorId: 'missing', points: 5, userId: 'sender' })));
});

test('handleHeroPointsUpdate logs when the receiver is GM', async () => {
  const actor = makeActor({ points: 4 });
  const logSets = [];
  const g = {
    user: { id: 'gm', isGM: true },
    users: { get: () => ({ name: 'GM' }) },
    actors: { get: () => actor },
    settings: {
      get: () => [],
      set: async (_m, _k, v) => { logSets.push(v); }
    },
    i18n: { localize: (k) => k, format: (k) => k }
  };
  await withGame(g, () => handleHeroPointsUpdate({
    actorId: 'a1',
    points: 6,
    userId: 'other'
  }));
  assert.equal(actor._flags.heroPoints, 6);
  assert.equal(logSets.length, 1);
  assert.equal(logSets[0][0].action, 'awarded');
});

test('handleHeroPointSpend applies integer points, falls back when non-integer, logs for GM', async () => {
  const actor = makeActor({ points: 5 });
  const logSets = [];
  const g = {
    user: { id: 'gm', isGM: true },
    users: { get: () => ({ name: 'GM' }) },
    actors: { get: () => actor },
    settings: {
      get: () => [],
      set: async (_m, _k, v) => { logSets.push(v); }
    },
    i18n: { localize: (k) => k, format: (k) => k }
  };

  await withGame(g, () => handleHeroPointSpend({
    actorId: 'a1',
    points: 3,
    action: 'addD6',
    userId: 'player1'
  }));
  assert.equal(actor._flags.heroPoints, 3);
  assert.equal(logSets[0][0].action, 'addD6');

  await withGame(g, () => handleHeroPointSpend({
    actorId: 'a1',
    points: 'x',
    userId: 'player1'
  }));
  assert.equal(actor._flags.heroPoints, 2);
  assert.equal(logSets[1][0].action, 'spent');
});

test('handleHeroPointSpend skips originator and missing actors', async () => {
  const actor = makeActor({ points: 5 });
  const g = {
    user: { id: 'me', isGM: false },
    actors: { get: (id) => (id === 'a1' ? actor : null) }
  };
  await withGame(g, () => handleHeroPointSpend({ actorId: 'a1', points: 1, userId: 'me' }));
  assert.equal(actor._flags.heroPoints, 5);

  await withGame(g, () => handleHeroPointSpend({ actorId: 'missing', points: 1, userId: 'other' }));
});

test('handleSocketMessage routes spend path and ignores unknown types; spend failures are caught', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  const actor = {
    id: 'a1',
    name: 'Fighter',
    getFlag: () => 2,
    setFlag: async () => { throw new Error('fail spend'); }
  };
  const g = {
    user: { id: 'receiver', isGM: false },
    actors: { get: () => actor }
  };

  try {
    await withGame(g, () => {
      handleSocketMessage({ type: 'unknown' });
      handleSocketMessage({ type: 'spendHeroPoint', actorId: 'a1', points: 1, userId: 'sender' });
    });
    await new Promise((r) => setTimeout(r, 10));
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /spend/);
});
