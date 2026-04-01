/**
 * Settings registration for RNK Reserves
 */
import { RNKReserves } from './apps/RNKReserves.js';
import { RNKReservesLogViewer } from './apps/LogViewer.js';

export function registerSettings() {
  // Register the Settings Menu
  game.settings.registerMenu('rnk-reserves', 'reservesMenu', {
    name: 'RNKRESERVES.Menu.ManagementName',
    label: 'RNKRESERVES.Menu.ManagementLabel',
    hint: 'RNKRESERVES.Menu.ManagementHint',
    icon: 'fas fa-shield-alt',
    type: RNKReserves,
    restricted: true
  });

  // Register the Log Viewer Menu
  game.settings.registerMenu('rnk-reserves', 'logViewerMenu', {
    name: 'RNKRESERVES.Menu.LogName',
    label: 'RNKRESERVES.Menu.LogLabel',
    hint: 'RNKRESERVES.Menu.LogHint',
    icon: 'fas fa-book',
    type: RNKReservesLogViewer,
    restricted: true
  });

  // Target Actor UUID for point management
  game.settings.register('rnk-reserves', 'targetActorUuid', {
    scope: 'world',
    config: false,
    type: String,
    default: ''
  });

  // Auto-award at session start
  game.settings.register('rnk-reserves', 'autoAward', {
    name: 'RNKRESERVES.Settings.AutoAwardName',
    hint: 'RNKRESERVES.Settings.AutoAwardHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Hero Points Activity Log (hidden setting for storing log data)
  game.settings.register('rnk-reserves', 'heroPointsLog', {
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });
}