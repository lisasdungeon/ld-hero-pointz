import assert from 'node:assert/strict';
import test from 'node:test';
import { installMocks, restoreGlobals } from './foundry-mock.mjs';

test.afterEach(() => restoreGlobals());

test('registerSettings registers both menus and world settings', async () => {
  const { game, settingsStore } = installMocks();
  const { registerSettings } = await import('../src/settings.js');
  registerSettings();

  assert.ok(settingsStore.has('ld-hero-pointz.menu.reservesMenu'));
  assert.ok(settingsStore.has('ld-hero-pointz.menu.logViewerMenu'));
  assert.equal(game.settings.get('ld-hero-pointz', 'autoAward'), true);
  assert.equal(game.settings.get('ld-hero-pointz', 'targetActorUuid'), '');
  assert.deepEqual(game.settings.get('ld-hero-pointz', 'heroPointsLog'), []);
});

test('lazy management menu constructs the real app on render', async () => {
  installMocks();
  const { registerSettings, createLazyMenu } = await import('../src/settings.js');
  registerSettings();

  let constructed = 0;
  let rendered = 0;
  class FakeApp {
    constructor(...args) {
      constructed += 1;
      this.args = args;
    }
    render(...a) {
      rendered += 1;
      this.renderArgs = a;
      return 'ok';
    }
  }

  const Lazy = createLazyMenu(async () => FakeApp);
  const menu = new Lazy({ opt: 1 });
  const result = await menu.render(true);
  assert.equal(constructed, 1);
  assert.equal(rendered, 1);
  assert.equal(result, 'ok');
});

test('registered menu types lazy-load apps when rendered', async () => {
  const { settingsStore } = installMocks();
  // Ensure foundry apps api exists before importing apps through menus
  const { registerSettings } = await import('../src/settings.js');
  registerSettings();

  const reserves = settingsStore.get('ld-hero-pointz.menu.reservesMenu');
  const logMenu = settingsStore.get('ld-hero-pointz.menu.logViewerMenu');
  assert.equal(typeof reserves.type, 'function');
  assert.equal(typeof logMenu.type, 'function');

  const management = new reserves.type();
  const logViewer = new logMenu.type();

  // render will dynamic-import real apps; with our ApplicationV2 mock they construct
  const mResult = await management.render(true);
  const lResult = await logViewer.render(true);
  assert.ok(mResult);
  assert.ok(lResult);
});
