import assert from 'node:assert/strict';
import test from 'node:test';
import { installMocks, restoreGlobals, makeActor } from './foundry-mock.mjs';

test.afterEach(() => restoreGlobals());

test('LdHeroPointzLogViewer._getDialogRoot normalizes html roots', async () => {
  installMocks();
  const { LdHeroPointzLogViewer } = await import('../src/apps/LogViewer.js');

  const el = new HTMLElement();
  assert.equal(LdHeroPointzLogViewer._getDialogRoot(el), el);
  assert.equal(LdHeroPointzLogViewer._getDialogRoot([el]), el);
  assert.equal(LdHeroPointzLogViewer._getDialogRoot({ element: el }), el);
  assert.equal(LdHeroPointzLogViewer._getDialogRoot({ element: [el] }), el);
  assert.equal(LdHeroPointzLogViewer._getDialogRoot(null), null);
  assert.equal(LdHeroPointzLogViewer._getDialogRoot({}), null);
});

test('LdHeroPointzLogViewer._prepareContext exposes log summary fields', async () => {
  const actor = makeActor({ id: 'a1', flags: { heroPoints: 2 } });
  const { game } = installMocks({ actors: [actor], user: { id: 'gm1', isGM: true } });
  game.settings.register('ld-hero-pointz', 'heroPointsLog', { default: [] });
  await game.settings.set('ld-hero-pointz', 'heroPointsLog', [
    { actorId: 'a1', pointsSpent: 2 },
    { actorId: 'a1', pointsSpent: 1 }
  ]);

  const { LdHeroPointzLogViewer } = await import('../src/apps/LogViewer.js');
  const app = new LdHeroPointzLogViewer();
  const ctx = await app._prepareContext({});
  assert.equal(ctx.totalEntries, 2);
  assert.equal(ctx.totalSpent, 3);
  assert.equal(ctx.entries.length, 2);
  assert.ok(Array.isArray(ctx.summary));
});

test('LdHeroPointzLogViewer._exportLog builds a download link', async () => {
  const actor = makeActor({ id: 'a1', flags: { heroPoints: 1 } });
  const { game } = installMocks({ actors: [actor], user: { id: 'gm1', isGM: true } });
  game.settings.register('ld-hero-pointz', 'heroPointsLog', { default: [] });
  await game.settings.set('ld-hero-pointz', 'heroPointsLog', [{ actorId: 'a1', pointsSpent: 1 }]);

  const clicks = [];
  const originalCreate = document.createElement;
  document.createElement = (tag) => {
    const el = originalCreate(tag);
    if (tag === 'a') {
      el.click = () => clicks.push(el);
    }
    return el;
  };

  const { LdHeroPointzLogViewer } = await import('../src/apps/LogViewer.js');
  const app = new LdHeroPointzLogViewer();
  app._exportLog();
  assert.equal(clicks.length, 1);
  assert.match(clicks[0].href || clicks[0].getAttribute?.('href') || '', /ld-hero-pointz-log|application\/json|data:/);
});

test('LdHeroPointzLogViewer._attachPartListeners wires export/clear/filter/reduce', async () => {
  const actor = makeActor({ id: 'a1', name: 'Fighter', flags: { heroPoints: 3 } });
  const { game, ui } = installMocks({ actors: [actor], user: { id: 'gm1', isGM: true } });
  game.settings.register('ld-hero-pointz', 'heroPointsLog', { default: [] });
  await game.settings.set('ld-hero-pointz', 'heroPointsLog', [
    { actorId: 'a1', pointsSpent: 1 }
  ]);

  const { LdHeroPointzLogViewer } = await import('../src/apps/LogViewer.js');
  const app = new LdHeroPointzLogViewer();
  app.render = () => { app._rendered = (app._rendered || 0) + 1; };

  const form = document.createElement('div');
  form.className = 'ld-hero-pointz-log-viewer';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'ld-hero-pointz-export-log';
  form.appendChild(exportBtn);

  const clearAll = document.createElement('button');
  clearAll.className = 'ld-hero-pointz-clear-all-log';
  form.appendChild(clearAll);

  const clearActor = document.createElement('button');
  clearActor.className = 'ld-hero-pointz-clear-actor-log';
  clearActor.dataset.actorId = 'a1';
  clearActor.dataset.actorName = 'Fighter';
  form.appendChild(clearActor);

  const reduceBtn = document.createElement('button');
  reduceBtn.className = 'ld-hero-pointz-reduce-actor-points';
  reduceBtn.dataset.actorId = 'a1';
  reduceBtn.dataset.actorName = 'Fighter';
  reduceBtn.dataset.currentPoints = '3';
  form.appendChild(reduceBtn);

  const filter = document.createElement('select');
  filter.className = 'ld-hero-pointz-filter-actor';
  form.appendChild(filter);

  const entryA = document.createElement('div');
  entryA.dataset.actorId = 'a1';
  form.appendChild(entryA);
  const entryB = document.createElement('div');
  entryB.dataset.actorId = 'a2';
  form.appendChild(entryB);

  // Make querySelectorAll return our buttons/entries
  form.querySelector = (sel) => {
    if (sel === '.ld-hero-pointz-log-viewer') return form;
    if (sel === '.ld-hero-pointz-export-log') return exportBtn;
    if (sel === '.ld-hero-pointz-clear-all-log') return clearAll;
    if (sel === '.ld-hero-pointz-filter-actor') return filter;
    return null;
  };
  form.querySelectorAll = (sel) => {
    if (sel === '.ld-hero-pointz-clear-actor-log') return [clearActor];
    if (sel === '.ld-hero-pointz-reduce-actor-points') return [reduceBtn];
    if (sel === '[data-actor-id]') return [entryA, entryB];
    return [];
  };

  // mock Dialog for confirm/cancel paths
  let confirmValue = true;
  globalThis.Dialog = {
    confirm: async () => confirmValue
  };
  class FakeDialog {
    constructor(opts) {
      this.opts = opts;
    }
    render() {
      FakeDialog.last = this;
      return this;
    }
  }
  globalThis.Dialog = Object.assign(function Dialog(opts) {
    return new FakeDialog(opts);
  }, { confirm: async () => confirmValue });

  const originalCreate = document.createElement;
  const clicks = [];
  document.createElement = (tag) => {
    const el = originalCreate(tag);
    if (tag === 'a') el.click = () => clicks.push(el);
    return el;
  };

  // Ensure form is treated as HTMLElement by the app code
  Object.setPrototypeOf(form, HTMLElement.prototype);
  app._attachPartListeners('main', form, {});

  // export
  exportBtn._listeners.click[0]();
  assert.equal(clicks.length, 1);

  // clear all confirmed
  await clearAll._listeners.click[0]();
  assert.ok(app._rendered >= 1);

  // clear all cancelled
  confirmValue = false;
  const renderedBefore = app._rendered;
  await clearAll._listeners.click[0]();
  assert.equal(app._rendered, renderedBefore);

  // clear actor confirmed
  confirmValue = true;
  await clearActor._listeners.click[0]({
    currentTarget: clearActor
  });
  assert.ok(app._rendered >= 2);

  // clear actor cancelled
  confirmValue = false;
  await clearActor._listeners.click[0]({ currentTarget: clearActor });

  // filter
  filter._listeners.change[0]({ target: { value: 'a1' } });
  assert.equal(entryA.style.display, '');
  assert.equal(entryB.style.display, 'none');
  filter._listeners.change[0]({ target: { value: '' } });
  assert.equal(entryB.style.display, '');

  // reduce dialog
  reduceBtn._listeners.click[0]({ currentTarget: reduceBtn });
  assert.ok(FakeDialog.last);

  const amountEl = document.createElement('input');
  amountEl.id = 'reduce-amount';
  amountEl.value = '2';
  const dialogRoot = document.createElement('div');
  dialogRoot.appendChild(amountEl);
  dialogRoot.querySelector = (sel) => (sel === '#reduce-amount' ? amountEl : null);
  Object.setPrototypeOf(dialogRoot, HTMLElement.prototype);

  await FakeDialog.last.opts.buttons.reduce.callback(dialogRoot);
  assert.ok(ui._info?.length >= 1 || actor.calls.setFlag.length >= 1);

  // missing amount input
  const emptyRoot = document.createElement('div');
  emptyRoot.querySelector = () => null;
  Object.setPrototypeOf(emptyRoot, HTMLElement.prototype);
  await FakeDialog.last.opts.buttons.reduce.callback(emptyRoot);
  assert.ok(ui._error?.length >= 1);

  // amount out of range (no-op path)
  amountEl.value = '99';
  await FakeDialog.last.opts.buttons.reduce.callback(dialogRoot);

  // non-main partId early path
  app._attachPartListeners('other', form, {});

  // htmlElement as array-like
  app._attachPartListeners('main', [form], {});
});

test('LdHeroPointz management app prepares context and attaches listeners', async () => {
  const actor = makeActor({ id: 'a1', name: 'Fighter', flags: { heroPoints: 2 } });
  const { game, ui } = installMocks({
    actors: [actor],
    user: { id: 'gm1', isGM: true }
  });
  game.settings.register('ld-hero-pointz', 'targetActorUuid', { default: '' });
  game.settings.register('ld-hero-pointz', 'heroPointsLog', { default: [] });

  const { LdHeroPointz } = await import('../src/apps/LdHeroPointz.js');
  const app = new LdHeroPointz();

  const ctx = await app._prepareContext({});
  assert.equal(ctx.targetActorUuid, '');

  const form = document.createElement('form');
  const uuidInput = document.createElement('input');
  uuidInput.name = 'targetActorUuid';
  uuidInput.value = '';
  const pointsInput = document.createElement('input');
  pointsInput.name = 'pointsToAdd';
  pointsInput.value = '2';

  const getUuidBtn = document.createElement('button');
  getUuidBtn.className = 'ld-hero-pointz-get-uuid';
  const awardBtn = document.createElement('button');
  awardBtn.className = 'ld-hero-pointz-award-points';
  const logBtn = document.createElement('button');
  logBtn.className = 'ld-hero-pointz-open-log-viewer';

  form.appendChild(uuidInput);
  form.appendChild(pointsInput);
  form.appendChild(getUuidBtn);
  form.appendChild(awardBtn);
  form.appendChild(logBtn);

  form.querySelector = (sel) => {
    if (sel === 'input[name="targetActorUuid"]') return uuidInput;
    if (sel === 'input[name="pointsToAdd"]') return pointsInput;
    if (sel === '.ld-hero-pointz-get-uuid') return getUuidBtn;
    if (sel === '.ld-hero-pointz-award-points') return awardBtn;
    if (sel === '.ld-hero-pointz-open-log-viewer') return logBtn;
    return null;
  };

  Object.setPrototypeOf(form, HTMLElement.prototype);
  app._attachPartListeners('form', form, {});

  // change uuid
  uuidInput.value = 'Actor.a1';
  uuidInput._listeners.change[0]({ target: uuidInput });
  assert.equal(await game.settings.get('ld-hero-pointz', 'targetActorUuid'), 'Actor.a1');

  // get uuid: no tokens
  globalThis.canvas.tokens.controlled = [];
  getUuidBtn._listeners.click[0]({});
  assert.ok(ui._warn?.length >= 1);

  // get uuid: token without actor
  globalThis.canvas.tokens.controlled = [{ actor: null }];
  getUuidBtn._listeners.click[0]({});

  // get uuid: success
  globalThis.canvas.tokens.controlled = [{ actor }];
  getUuidBtn._listeners.click[0]({});
  assert.equal(uuidInput.value, actor.uuid);
  assert.ok(ui._info?.length >= 1);

  // award: no uuid
  await game.settings.set('ld-hero-pointz', 'targetActorUuid', '');
  await awardBtn._listeners.click[0]({});
  assert.ok(ui._error?.length >= 1);

  // award: invalid actor
  await game.settings.set('ld-hero-pointz', 'targetActorUuid', 'Actor.a1');
  globalThis.fromUuid = async () => ({ documentName: 'Item' });
  await awardBtn._listeners.click[0]({});
  assert.ok(ui._error?.length >= 2);

  // award: success
  globalThis.fromUuid = async () => actor;
  await awardBtn._listeners.click[0]({});
  assert.ok(actor.calls.setFlag.some((c) => c.key === 'heroPoints'));

  // award: throw
  globalThis.fromUuid = async () => {
    throw new Error('boom');
  };
  const origError = console.error;
  console.error = () => {};
  try {
    await awardBtn._listeners.click[0]({});
  } finally {
    console.error = origError;
  }

  // open log viewer
  logBtn._listeners.click[0]({});

  // non-form part
  app._attachPartListeners('other', form, {});
  // array-like html element
  app._attachPartListeners('form', [form], {});
});
