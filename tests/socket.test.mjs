import assert from 'node:assert/strict';
import test from 'node:test';
import { emitSocketMessage, registerSocket } from '../src/socket.js';

async function withGame(gameStub, run) {
  const originalGame = globalThis.game;
  const originalConsoleWarn = console.warn;
  globalThis.game = gameStub;
  console.warn = () => {};
  try {
    return await run();
  } finally {
    globalThis.game = originalGame;
    console.warn = originalConsoleWarn;
  }
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
    i18n: { localize: (k) => k, format: (k) => k }
  };
  await withGame(g, () => registerSocket());
  // Simulate a broadcast from a different client (originator id !== this client's id).
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

test('a rejected setFlag (e.g. a permission error on a non-owner client) is caught, not an unhandled rejection', async () => {
  // This is the regression test for the original bug: handleSocketMessage
  // called handleHeroPointsUpdate/handleHeroPointSpend without awaiting or
  // catching them, so any client that received a broadcast for an actor it
  // doesn't own (a common case — Foundry's setFlag requires OWNER/GM) would
  // throw an unhandled promise rejection on every single broadcast.
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
    // handleSocketMessage is synchronous and fire-and-forgets the async
    // handler with a .catch() — invoke it directly and give the microtask
    // queue a turn to let that rejection actually surface.
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
