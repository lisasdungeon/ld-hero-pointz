/**
 * Copyright 2026 Lisa's Dungeon
 * Settings registration. Management and log-viewer classes load when a menu opens.
 */

/**
 * Thin menu shell used by game.settings.registerMenu. Foundry only needs
 * construct + render. The real ApplicationV2 class is imported then.
 */
function createLazyMenu(loader) {
  return class LazyMenu {
    constructor(...args) {
      this._args = args;
    }

    async render(...renderArgs) {
      const App = await loader();
      const app = new App(...this._args);
      return app.render(...renderArgs);
    }
  };
}

export function registerSettings() {
  game.settings.registerMenu('ld-hero-pointz', 'managementMenu', {
    name: 'LDHEROEPOINTZ.Menu.ManagementName',
    label: 'LDHEROEPOINTZ.Menu.ManagementLabel',
    hint: 'LDHEROEPOINTZ.Menu.ManagementHint',
    icon: 'fas fa-shield-alt',
    type: createLazyMenu(async () => {
      const { LdHeroPointz } = await import('./apps/LdHeroPointz.js');
      return LdHeroPointz;
    }),
    restricted: true
  });

  game.settings.registerMenu('ld-hero-pointz', 'logViewerMenu', {
    name: 'LDHEROEPOINTZ.Menu.LogName',
    label: 'LDHEROEPOINTZ.Menu.LogLabel',
    hint: 'LDHEROEPOINTZ.Menu.LogHint',
    icon: 'fas fa-book',
    type: createLazyMenu(async () => {
      const { LdHeroPointzLogViewer } = await import('./apps/LogViewer.js');
      return LdHeroPointzLogViewer;
    }),
    restricted: true
  });

  game.settings.register('ld-hero-pointz', 'targetActorUuid', {
    scope: 'world',
    config: false,
    type: String,
    default: ''
  });

  game.settings.register('ld-hero-pointz', 'autoAward', {
    name: 'LDHEROEPOINTZ.Settings.AutoAwardName',
    hint: 'LDHEROEPOINTZ.Settings.AutoAwardHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register('ld-hero-pointz', 'heroPointsLog', {
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });
}

/** Exposed for unit tests so the lazy menu shell can be exercised without Foundry. */
export { createLazyMenu };
