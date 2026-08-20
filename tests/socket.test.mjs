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

test('inbound updateHeroPoints is logged by the GM and does not rewrite actor flags', async () => {
  const actor = makeActor({ points: 2 });
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
    points: 5,
    previous: 2,
    action: 'award',
    userId: 'sender'
  }));
  assert.equal(actor._flags.heroPoints, 2);
  assert.equal(logSets.length, 1);
  assert.equal(logSets[0][0].action, 'award');
  assert.equal(logSets[0][0].pointsRemaining, 5);
});

test('inbound update from this same client is skipped', async () => {
  const actor = makeActor({ points: 2 });
  const logSets = [];
  const g = {
    user: { id: 'me', isGM: true },
    users: { get: () => ({ name: 'GM' }) },
    actors: { get: () => actor },
    settings: { get: () => [], set: async (_m, _k, v) => { logSets.push(v); } },
    i18n: { localize: (k) => k, format: (k) => k }
  };
  await withGame(g, () => handleHeroPointsUpdate({
    actorId: 'a1',
    points: 5,
    userId: 'me'
  }));
  assert.equal(logSets.length, 0);
});

test('non-GM clients ignore inbound update and spend messages', async () => {
  const actor = makeActor({ points: 4 });
  const g = {
    user: { id: 'p1', isGM: false },
    actors: { get: () => actor },
    settings: { get: () => [], set: async () => { throw new Error('should not write'); } }
  };
  await withGame(g, () => handleHeroPointsUpdate({ actorId: 'a1', points: 9, userId: 'other' }));
  await withGame(g, () => handleHeroPointSpend({ actorId: 'a1', points: 1, userId: 'other' }));
  assert.equal(actor._flags.heroPoints, 4);
});

test('a rejected log write is caught, not an unhandled rejection', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  const actor = makeActor({ points: 2 });
  const g = {
    user: { id: 'gm', isGM: true },
    users: { get: () => ({ name: 'GM' }) },
    actors: { get: () => actor },
    settings: {
      get: () => [],
      set: async () => { throw new Error('cannot write log'); }
    },
    i18n: { localize: (k) => k, format: (k) => k },
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
    user: { id: 'gm', isGM: true },
    actors: { get: () => null }
  };
  await assert.doesNotReject(() => withGame(g, () => handleHeroPointsUpdate({
    actorId: 'missing',
    points: 5,
    userId: 'sender'
  })));
});

test('handleHeroPointsUpdate uses remainingFrom fallback when points is not an integer', async () => {
  const actor = makeActor({ points: 4 });
  const logSets = [];
  const g = {
    user: { id: 'gm', isGM: true },
    users: { get: () => ({ name: 'GM' }) },
    actors: { get: () => actor },
    settings: { get: () => [], set: async (_m, _k, v) => { logSets.push(v); } },
    i18n: { localize: (k) => k, format: (k) => k }
  };
  await withGame(g, () => handleHeroPointsUpdate({
    actorId: 'a1',
    points: 'x',
    userId: 'other'
  }));
  assert.equal(logSets[0][0].pointsRemaining, 3);
  assert.equal(logSets[0][0].action, 'awarded');
});

test('handleHeroPointSpend logs for GM using integer points or a minus-one fallback', async () => {
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
  assert.equal(logSets[0][0].action, 'addD6');
  assert.equal(logSets[0][0].pointsSpent, 1);

  await withGame(g, () => handleHeroPointSpend({
    actorId: 'a1',
    points: 'x',
    userId: 'player1'
  }));
  assert.equal(logSets[1][0].action, 'spent');
  assert.equal(logSets[1][0].pointsRemaining, 4);
});

test('handleHeroPointSpend skips originator and missing actors', async () => {
  const actor = makeActor({ points: 5 });
  const g = {
    user: { id: 'me', isGM: true },
    users: { get: () => ({ name: 'GM' }) },
    actors: { get: (id) => (id === 'a1' ? actor : null) },
    settings: { get: () => [], set: async () => { throw new Error('no'); } },
    i18n: { localize: (k) => k, format: (k) => k }
  };
  await withGame(g, () => handleHeroPointSpend({ actorId: 'a1', points: 1, userId: 'me' }));
  await withGame(g, () => handleHeroPointSpend({ actorId: 'missing', points: 1, userId: 'other' }));
});

test('handleSocketMessage routes spend path, ignores empty/unknown types, and catches spend failures', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  const actor = makeActor({ points: 2 });
  const g = {
    user: { id: 'gm', isGM: true },
    users: { get: () => ({ name: 'GM' }) },
    actors: { get: () => actor },
    settings: {
      get: () => [],
      set: async () => { throw new Error('fail spend'); }
    },
    i18n: { localize: (k) => k, format: (k) => k }
  };

  try {
    await withGame(g, () => {
      handleSocketMessage(null);
      handleSocketMessage({});
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
