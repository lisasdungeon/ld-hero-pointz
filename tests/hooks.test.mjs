import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getHeroPointBaseline,
  toElement,
  getActorFromMessage,
  addHeroPointButtons,
  handleHeroPointAction,
  handleAddD6,
  handleDeathSaveSuccess,
  initializeHeroPoints,
  addGMControls,
  handleGMAction,
  registerHooks
} from '../src/hooks.js';
import { installMocks, restoreGlobals, makeActor, getHookHandlers } from './foundry-mock.mjs';

test.afterEach(() => restoreGlobals());

test('getHeroPointBaseline: 5 + floor(level/2), matching the 2024-rules refresh target', () => {
  assert.equal(getHeroPointBaseline(1), 5);
  assert.equal(getHeroPointBaseline(2), 6);
  assert.equal(getHeroPointBaseline(3), 6);
  assert.equal(getHeroPointBaseline(20), 15);
});

test('getHeroPointBaseline: defaults to level 1 when omitted', () => {
  assert.equal(getHeroPointBaseline(), 5);
});

test('toElement: unwraps jQuery-style collections and HTMLElements', () => {
  installMocks();
  assert.equal(toElement(null), null);
  assert.equal(toElement(undefined), null);
  assert.equal(toElement({ foo: 'bar' }), null);

  const el = new HTMLElement();
  assert.equal(toElement(el), el);

  const fakeEl = { tagName: 'DIV' };
  assert.equal(toElement({ jquery: '3.6.0', 0: fakeEl, length: 1 }), fakeEl);
  assert.equal(toElement({ jquery: '3.6.0', length: 0 }), null);
});

test('getActorFromMessage resolves actor, token, or null', () => {
  const actor = makeActor({ id: 'a1' });
  installMocks({ actors: [actor] });

  assert.equal(getActorFromMessage(null), null);
  assert.equal(getActorFromMessage({}), null);

  assert.equal(getActorFromMessage({ speaker: { actor: 'a1' } }), actor);

  const tokenActor = makeActor({ id: 'a2', name: 'Token' });
  globalThis.canvas.tokens.get = (id) => (id === 't1' ? { actor: tokenActor } : null);
  assert.equal(getActorFromMessage({ speaker: { token: 't1' } }), tokenActor);

  globalThis.canvas.tokens = null;
  assert.equal(getActorFromMessage({ speaker: { token: 't1' } }), null);

  globalThis.canvas.tokens = { get: () => null };
  assert.equal(getActorFromMessage({ speaker: {} }), null);
});

test('addHeroPointButtons: early exits and d20/death-save paths', () => {
  const actor = makeActor({ id: 'a1', flags: { heroPoints: 3 } });
  installMocks({ actors: [actor] });

  addHeroPointButtons(null, {}, {});
  addHeroPointButtons({ speaker: { actor: 'a1' } }, null, {});

  // no actor
  const emptyHtml = document.createElement('div');
  addHeroPointButtons({ speaker: { actor: 'missing' } }, emptyHtml, {});
  assert.equal(emptyHtml.children.length, 0);

  // npc without enable
  const npc = makeActor({ id: 'n1', type: 'npc', flags: { heroPoints: 2 } });
  installMocks({ actors: [npc] });
  addHeroPointButtons({ speaker: { actor: 'n1' }, rolls: [{ terms: [{ faces: 20 }] }], getFlag: () => null }, emptyHtml, {});
  assert.equal(emptyHtml.children.length, 0);

  // zero points
  const zero = makeActor({ id: 'z1', flags: { heroPoints: 0 } });
  installMocks({ actors: [zero] });
  addHeroPointButtons({ speaker: { actor: 'z1' }, rolls: [{ terms: [{ faces: 20 }] }], getFlag: () => null }, emptyHtml, {});
  assert.equal(emptyHtml.children.length, 0);

  // not d20 and not death save
  const pc = makeActor({ id: 'p1', flags: { heroPoints: 2 } });
  installMocks({ actors: [pc] });
  addHeroPointButtons({
    speaker: { actor: 'p1' },
    rolls: [{ terms: [{ faces: 8 }] }],
    flavor: 'damage',
    getFlag: () => null
  }, emptyHtml, {});
  assert.equal(emptyHtml.children.length, 0);

  // d20 with message-content
  const html = document.createElement('div');
  const content = document.createElement('div');
  content.className = 'message-content';
  html.appendChild(content);
  const clicks = [];
  // capture listener via patched createElement path — invoke add then fire
  addHeroPointButtons({
    speaker: { actor: 'p1' },
    rolls: [{ terms: [{ faces: 20 }] }],
    flavor: 'Attack',
    getFlag: () => null
  }, html, {});
  assert.equal(content.children.length, 1);
  assert.equal(content.children[0].className, 'ld-hero-pointz-buttons');

  // death save without message-content (append to root)
  const html2 = document.createElement('div');
  addHeroPointButtons({
    speaker: { actor: 'p1' },
    rolls: [],
    flavor: 'Death Saving Throw',
    getFlag: () => ({ type: 'death' })
  }, html2, {});
  assert.equal(html2.children.length, 1);

  // fire click with and without data-action
  const container = content.children[0];
  container.dispatchEvent({ type: 'click', target: { dataset: {} } });
  // action present triggers handleHeroPointAction (dialog cancels immediately)
  globalThis.Dialog = { confirm: async () => false };
  container.dispatchEvent({ type: 'click', target: { dataset: { action: 'addD6' } } });
});

test('handleHeroPointAction: no points, cancel, spend addD6 and deathSuccess', async () => {
  const actor = makeActor({ id: 'a1', flags: { heroPoints: 0 } });
  installMocks({ actors: [actor], user: { id: 'gm1', isGM: true } });
  game.settings.register('ld-hero-pointz', 'heroPointsLog', { default: [] });

  await handleHeroPointAction(actor, 'addD6', { flavor: 'Attack' });
  assert.ok(ui._warn?.length >= 1);

  actor.setFlag('ld-hero-pointz', 'heroPoints', 2);
  // ensure flag store updated via setFlag
  const actor2 = makeActor({ id: 'a2', name: 'Rogue', flags: { heroPoints: 2 } });
  installMocks({ actors: [actor2], user: { id: 'gm1', isGM: true } });
  game.settings.register('ld-hero-pointz', 'heroPointsLog', { default: [] });

  globalThis.Dialog.confirm = async () => false;
  await handleHeroPointAction(actor2, 'addD6', { flavor: 'Attack' });
  assert.equal(actor2.calls.setFlag.length, 0);

  globalThis.Dialog.confirm = async () => true;
  await handleHeroPointAction(actor2, 'addD6', { flavor: 'Attack' });
  assert.ok(actor2.calls.setFlag.some((c) => c.key === 'heroPoints' && c.value === 1));
  assert.ok(game._emitted?.some((e) => e.payload.type === 'spendHeroPoint'));

  const actor3 = makeActor({ id: 'a3', flags: { heroPoints: 1 } });
  installMocks({ actors: [actor3], user: { id: 'p1', isGM: false } });
  globalThis.Dialog.confirm = async () => true;
  await handleHeroPointAction(actor3, 'deathSuccess', { flavor: 'Death Saving Throw' });
  assert.ok(actor3.calls.setFlag.some((c) => c.value === 0));

  // unknown action after spend still spends points
  const actor4 = makeActor({ id: 'a4', flags: { heroPoints: 1 } });
  installMocks({ actors: [actor4], user: { id: 'gm1', isGM: true } });
  game.settings.register('ld-hero-pointz', 'heroPointsLog', { default: [] });
  globalThis.Dialog.confirm = async () => true;
  await handleHeroPointAction(actor4, 'other', {});
  assert.ok(actor4.calls.setFlag.some((c) => c.value === 0));
});

test('handleAddD6 and handleDeathSaveSuccess notify and create messages', async () => {
  installMocks();
  await handleAddD6({ flavor: 'Attack Roll' }, makeActor());
  assert.ok(ui._info?.length >= 1);

  await handleAddD6({}, makeActor());
  await handleDeathSaveSuccess({}, makeActor());
  assert.ok(ui._info?.length >= 2);
});

test('initializeHeroPoints respects npc, autoAward, and existing flags', () => {
  installMocks();
  game.settings.register('ld-hero-pointz', 'autoAward', { default: true });

  const npc = makeActor({ type: 'npc' });
  initializeHeroPoints(npc);
  assert.equal(npc.calls.setFlag.length, 0);

  game.settings.set('ld-hero-pointz', 'autoAward', false);
  const pc = makeActor();
  initializeHeroPoints(pc);
  assert.equal(pc.calls.setFlag.length, 0);

  game.settings.set('ld-hero-pointz', 'autoAward', true);
  const fresh = makeActor({ id: 'f1', level: 5 });
  initializeHeroPoints(fresh);
  assert.ok(fresh.calls.setFlag.some((c) => c.key === 'heroPoints' && c.value === 7));

  const existing = makeActor({ id: 'e1', flags: { heroPoints: 3 } });
  initializeHeroPoints(existing);
  assert.equal(existing.calls.setFlag.length, 0);
});

test('handleGMAction covers award/subtract/reset/set-zero/default', async () => {
  const actor = makeActor({ id: 'a1', flags: { heroPoints: 3 } });
  installMocks({ actors: [actor], user: { id: 'gm1', isGM: true } });

  await handleGMAction(actor, 'award', 3, 5);
  assert.ok(actor.calls.setFlag.some((c) => c.value === 4));

  await handleGMAction(actor, 'subtract', 1, 5);
  assert.ok(actor.calls.setFlag.some((c) => c.value === 0));

  await handleGMAction(actor, 'reset', 3, 5);
  assert.ok(actor.calls.setFlag.some((c) => c.value === 5));

  await handleGMAction(actor, 'set-zero', 5, 5);
  assert.ok(actor.calls.setFlag.some((c) => c.value === 0));

  const before = actor.calls.setFlag.length;
  await handleGMAction(actor, 'unknown', 5, 5);
  assert.equal(actor.calls.setFlag.length, before);
});

test('addGMControls injects panel and handles clicks', async () => {
  const actor = makeActor({ id: 'a1', type: 'character', flags: { heroPoints: 2 }, level: 3 });
  installMocks({ actors: [actor], user: { id: 'gm1', isGM: true } });

  // npc without enable
  const npc = makeActor({ id: 'n1', type: 'npc' });
  addGMControls({ actor: npc, element: null }, null, {});

  // no header
  addGMControls({ actor, element: document.createElement('div') }, document.createElement('div'), {});

  const header = document.createElement('div');
  header.className = 'window-header';
  const root = document.createElement('div');
  root.appendChild(header);
  // make querySelector find header
  root.querySelector = (sel) => (sel === '.window-header' ? header : null);
  header.querySelector = (sel) => {
    if (sel === '.ld-hero-pointz-gm-controls') {
      return header.children.find((c) => c.className === 'ld-hero-pointz-gm-controls') || null;
    }
    return null;
  };
  header.appendChild = (child) => {
    header.children.push(child);
    return child;
  };
  header.children = header.children || [];

  // HTMLElement path
  Object.setPrototypeOf(root, HTMLElement.prototype);
  addGMControls({ actor, element: null }, root, {});
  assert.ok(header.children.some((c) => c.className === 'ld-hero-pointz-gm-controls'));

  // re-inject removes previous
  addGMControls({ actor, element: null }, root, {});

  const panel = header.children.find((c) => c.className === 'ld-hero-pointz-gm-controls');
  // click without button
  await panel.dispatchEvent({ type: 'click', target: { closest: () => null } });
  // click award
  await panel.dispatchEvent({
    type: 'click',
    target: {
      closest: () => ({ dataset: { action: 'award' } })
    }
  });
  assert.ok(actor.calls.setFlag.some((c) => c.value === 3));

  // click with no action
  await panel.dispatchEvent({
    type: 'click',
    target: { closest: () => ({ dataset: {} }) }
  });
});

test('registerHooks: chat, level-up, sheet, ready, updateActor paths', async () => {
  const actor = makeActor({ id: 'a1', flags: { heroPoints: 2 }, isOwner: true, level: 2 });
  installMocks({ actors: [actor], user: { id: 'gm1', isGM: true } });
  game.settings.register('ld-hero-pointz', 'autoAward', { default: true });

  registerHooks();
  const handlers = getHookHandlers();

  // renderChatMessageHTML: no game.users
  const users = game.users;
  game.users = null;
  handlers.get('renderChatMessageHTML')[0]({}, document.createElement('div'), {});
  game.users = users;

  // GM path
  const html = document.createElement('div');
  handlers.get('renderChatMessageHTML')[0]({
    speaker: { actor: 'a1' },
    rolls: [{ terms: [{ faces: 20 }] }],
    getFlag: () => null
  }, html, {});

  // player path: not owner
  installMocks({
    actors: [makeActor({ id: 'a1', flags: { heroPoints: 2 }, isOwner: false })],
    user: { id: 'p1', isGM: false }
  });
  game.settings.register('ld-hero-pointz', 'autoAward', { default: true });
  registerHooks();
  getHookHandlers().get('renderChatMessageHTML').at(-1)({ speaker: { actor: 'a1' } }, document.createElement('div'), {});

  // player: no actor
  getHookHandlers().get('renderChatMessageHTML').at(-1)({ speaker: { actor: 'missing' } }, document.createElement('div'), {});

  // player: zero points
  installMocks({
    actors: [makeActor({ id: 'a1', flags: { heroPoints: 0 }, isOwner: true })],
    user: { id: 'p1', isGM: false }
  });
  game.settings.register('ld-hero-pointz', 'autoAward', { default: true });
  registerHooks();
  getHookHandlers().get('renderChatMessageHTML').at(-1)({ speaker: { actor: 'a1' } }, document.createElement('div'), {});

  // player with points
  const pc = makeActor({ id: 'a1', flags: { heroPoints: 2 }, isOwner: true });
  installMocks({ actors: [pc], user: { id: 'p1', isGM: false } });
  game.settings.register('ld-hero-pointz', 'autoAward', { default: true });
  registerHooks();
  const htmlP = document.createElement('div');
  getHookHandlers().get('renderChatMessageHTML').at(-1)({
    speaker: { actor: 'a1' },
    rolls: [{ terms: [{ faces: 20 }] }],
    getFlag: () => null
  }, htmlP, {});

  // preUpdateActor: autoAward off
  installMocks({ actors: [actor], user: { id: 'gm1', isGM: true } });
  game.settings.register('ld-hero-pointz', 'autoAward', { default: false });
  registerHooks();
  getHookHandlers().get('preUpdateActor').at(-1)(actor, { system: { details: { level: 5 } } }, {}, 'u1');

  // preUpdateActor: level up
  game.settings.set('ld-hero-pointz', 'autoAward', true);
  const updateData = { system: { details: { level: 5 } } };
  const low = makeActor({ id: 'l1', flags: { heroPoints: 2 }, level: 3 });
  getHookHandlers().get('preUpdateActor').at(-1)(low, updateData, {}, 'u1');
  assert.equal(updateData.flags['ld-hero-pointz'].heroPoints, 7);

  // preUpdateActor: level not increased
  getHookHandlers().get('preUpdateActor').at(-1)(low, { system: { details: { level: 1 } } }, {}, 'u1');
  // preUpdateActor: no level
  getHookHandlers().get('preUpdateActor').at(-1)(low, { name: 'x' }, {}, 'u1');

  // sheet hooks: non-GM skip
  installMocks({ user: { id: 'p1', isGM: false }, actors: [actor] });
  registerHooks();
  getHookHandlers().get('renderActorSheet5e').at(-1)({ actor }, document.createElement('div'), {});

  // sheet hooks: GM
  installMocks({ user: { id: 'gm1', isGM: true }, actors: [actor] });
  registerHooks();
  const sheetRoot = document.createElement('div');
  const hdr = document.createElement('div');
  hdr.className = 'window-header';
  hdr.children = [];
  hdr.querySelector = (sel) => hdr.children.find((c) => c.className === sel.slice(1)) || null;
  hdr.appendChild = (c) => { hdr.children.push(c); return c; };
  sheetRoot.appendChild(hdr);
  sheetRoot.querySelector = (sel) => (sel === '.window-header' ? hdr : null);
  Object.setPrototypeOf(sheetRoot, HTMLElement.prototype);
  getHookHandlers().get('renderActorSheet5eCharacter2').at(-1)({ actor, element: null }, sheetRoot, {});
  getHookHandlers().get('renderActorSheet5eNPC2').at(-1)({ actor, element: null }, sheetRoot, {});

  // ready initializes actors
  installMocks({
    actors: [makeActor({ id: 'init1' })],
    user: { id: 'gm1', isGM: true }
  });
  game.settings.register('ld-hero-pointz', 'autoAward', { default: true });
  registerHooks();
  getHookHandlers().get('ready').at(-1)();

  // updateActor logs when flag present
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    getHookHandlers().get('updateActor').at(-1)(
      { name: 'Fighter' },
      { flags: { 'ld-hero-pointz': { heroPoints: 4 } } },
      {},
      'u1'
    );
    getHookHandlers().get('updateActor').at(-1)({ name: 'Fighter' }, { name: 'x' }, {}, 'u1');
    assert.ok(logs.some((l) => l.includes('Hero Points updated')));
  } finally {
    console.log = origLog;
  }
});
