/**
 * Copyright 2026 Lisa's Dungeon
 * Settings registration. Management and log-viewer classes load when a menu opens.
 */

/**
 * Thin ApplicationV2 shell used by game.settings.registerMenu.
 * Foundry v13+ requires a FormApplication or ApplicationV2 subclass.
 * The real window class is imported when the menu is opened.
 */
function createLazyMenu(loader) {
  return class LazyMenu extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: 'ld-hero-pointz-lazy-menu',
      window: { title: 'LD Hero Pointz' },
      position: { width: 10, height: 10 }
    };

    constructor(...args) {
      super();
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
}

/** Exposed for unit tests so the lazy menu shell can be exercised without Foundry. */
export { createLazyMenu };
