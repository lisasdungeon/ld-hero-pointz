import assert from 'node:assert/strict';
import test from 'node:test';
import { installMocks, restoreGlobals, makeActor } from './foundry-mock.mjs';

test.afterEach(() => restoreGlobals());

test('LdHeroPointzModule.init registers settings, hooks, and socket', async () => {
  const { game, Hooks } = installMocks();
  const { LdHeroPointzModule } = await import('../src/main.js');

  LdHeroPointzModule.init();

  assert.equal(game.settings.get('ld-hero-pointz', 'autoAward'), true);
  assert.ok(Hooks._handlers.size > 0);
  assert.equal(typeof game._socketHandler, 'function');
});

test('LdHeroPointzModule.ready initializes the logger for GM', async () => {
  const { game } = installMocks({ user: { id: 'gm1', isGM: true } });
  game.settings.register('ld-hero-pointz', 'heroPointsLog', { default: undefined });
  // force unset
  const { LdHeroPointzModule } = await import('../src/main.js');
  // ensure no log yet
  await game.settings.set('ld-hero-pointz', 'heroPointsLog', null);
  // initializeLogger checks falsy and sets []
  // re-seed: if get returns null, it seeds
  game.settings.get = (m, k) => {
    if (k === 'heroPointsLog') return null;
    return undefined;
  };
  const sets = [];
  game.settings.set = async (m, k, v) => { sets.push({ m, k, v }); };
  LdHeroPointzModule.ready();
  assert.ok(sets.some((s) => s.k === 'heroPointsLog'));
});

test('enableNPC: GM only, actor required, clamps points, sets flags', async () => {
  const actor = makeActor({ id: 'n1', name: 'Goblin', type: 'npc' });
  const { ui } = installMocks({
    actors: [actor],
    user: { id: 'gm1', isGM: true }
  });
  const { LdHeroPointzModule } = await import('../src/main.js');

  await LdHeroPointzModule.enableNPC('n1', 3);
  assert.ok(actor.calls.setFlag.some((c) => c.key === 'heroPointsEnabled' && c.value === true));
  assert.ok(actor.calls.setFlag.some((c) => c.key === 'heroPoints' && c.value === 3));
  assert.ok(ui._info?.length >= 1);

  // non-finite points default to 1
  await LdHeroPointzModule.enableNPC('n1', Number.NaN);
  assert.ok(actor.calls.setFlag.some((c) => c.key === 'heroPoints' && c.value === 1));

  // negative clamps to 0
  await LdHeroPointzModule.enableNPC('n1', -5);
  assert.ok(actor.calls.setFlag.some((c) => c.key === 'heroPoints' && c.value === 0));

  // default points = 1
  await LdHeroPointzModule.enableNPC('n1');
  assert.ok(actor.calls.setFlag.some((c) => c.key === 'heroPoints' && c.value === 1));

  // missing actor
  await LdHeroPointzModule.enableNPC('missing');
  assert.ok(ui._error?.length >= 1);

  // non-GM
  installMocks({ actors: [actor], user: { id: 'p1', isGM: false } });
  const mod = (await import('../src/main.js')).LdHeroPointzModule;
  await mod.enableNPC('n1', 2);
  assert.ok(ui._warn?.length >= 1 || globalThis.ui._warn?.length >= 1);
});

test('disableNPC: GM only, actor required, clears flags', async () => {
  const actor = makeActor({ id: 'n1', name: 'Goblin', type: 'npc', flags: { heroPoints: 2, heroPointsEnabled: true } });
  const { ui } = installMocks({
    actors: [actor],
    user: { id: 'gm1', isGM: true }
  });
  const { LdHeroPointzModule } = await import('../src/main.js');

  await LdHeroPointzModule.disableNPC('n1');
  assert.ok(actor.calls.setFlag.some((c) => c.key === 'heroPointsEnabled' && c.value === false));
  assert.ok(actor.calls.setFlag.some((c) => c.key === 'heroPoints' && c.value === 0));
  assert.ok(ui._info?.length >= 1);

  await LdHeroPointzModule.disableNPC('missing');
  assert.ok(ui._error?.length >= 1);

  installMocks({ actors: [actor], user: { id: 'p1', isGM: false } });
  await (await import('../src/main.js')).LdHeroPointzModule.disableNPC('n1');
  assert.ok(globalThis.ui._warn?.length >= 1);
});

test('registerEntryHooks attaches init and ready once handlers', async () => {
  const { Hooks } = installMocks();
  const main = await import('../src/main.js');
  main.registerEntryHooks();
  assert.ok(Hooks._handlers.get('init')?.length >= 1);
  assert.ok(Hooks._handlers.get('ready')?.length >= 1);
});

test('globalThis.LdHeroPointz is assigned on import', async () => {
  installMocks();
  await import('../src/main.js');
  assert.equal(globalThis.LdHeroPointz?.ID, 'ld-hero-pointz');
});
