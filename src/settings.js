/**
 * Settings registration for LD Hero Pointz
 */
import { LdHeroPointz } from './apps/LdHeroPointz.js';
import { LdHeroPointzLogViewer } from './apps/LogViewer.js';

export function registerSettings() {
  // Register the Settings Menu
  game.settings.registerMenu('ld-hero-pointz', 'reservesMenu', {
    name: 'LDHEROEPOINTZ.Menu.ManagementName',
    label: 'LDHEROEPOINTZ.Menu.ManagementLabel',
    hint: 'LDHEROEPOINTZ.Menu.ManagementHint',
    icon: 'fas fa-shield-alt',
    type: LdHeroPointz,
    restricted: true
  });

  // Register the Log Viewer Menu
  game.settings.registerMenu('ld-hero-pointz', 'logViewerMenu', {
    name: 'LDHEROEPOINTZ.Menu.LogName',
    label: 'LDHEROEPOINTZ.Menu.LogLabel',
    hint: 'LDHEROEPOINTZ.Menu.LogHint',
    icon: 'fas fa-book',
    type: LdHeroPointzLogViewer,
    restricted: true
  });

  // Target Actor UUID for point management
  game.settings.register('ld-hero-pointz', 'targetActorUuid', {
    scope: 'world',
    config: false,
    type: String,
    default: ''
  });

  // Auto-award at session start
  game.settings.register('ld-hero-pointz', 'autoAward', {
    name: 'LDHEROEPOINTZ.Settings.AutoAwardName',
    hint: 'LDHEROEPOINTZ.Settings.AutoAwardHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Hero Points Activity Log (hidden setting for storing log data)
  game.settings.register('ld-hero-pointz', 'heroPointsLog', {
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });
}