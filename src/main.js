/**
 * RNK Reserves - Hero Points System for D&D 2024
 * Main entry point for the module
 */

import { RNKReserves } from './apps/RNKReserves.js';
import { registerSettings } from './settings.js';
import { registerHooks } from './hooks.js';
import { registerSocket } from './socket.js';
import { initializeLogger } from './logger.js';

class RNKReservesModule {
  static ID = 'rnk-reserves';

  static init() {
    // Register settings
    registerSettings();

    // Register hooks
    registerHooks();

    // Register socket
    registerSocket();
  }

  static ready() {
    initializeLogger();
  }

  /**
   * Enable Hero Points on a specific NPC by actor ID.
   * Usage (console or macro): RNKReserves.enableNPC("actorId", 3)
   * @param {string} actorId - The actor's ID
   * @param {number} [points=1] - Number of Hero Points to assign
   */
  static async enableNPC(actorId, points = 1) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('RNKRESERVES.Messages.GMOnlyEnableNPC'));
      return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error(game.i18n.format('RNKRESERVES.Messages.ActorNotFound', { actorId }));
      return;
    }

    const clamped = Math.max(points, 0);

    await actor.setFlag('rnk-reserves', 'heroPointsEnabled', true);
    await actor.setFlag('rnk-reserves', 'heroPoints', clamped);

    ui.notifications.info(game.i18n.format('RNKRESERVES.Messages.NpcEnabled', {
      name: actor.name,
      type: actor.type,
      points: clamped
    }));
  }

  /**
   * Disable Hero Points on a specific NPC by actor ID.
   * Usage (console or macro): RNKReserves.disableNPC("actorId")
   * @param {string} actorId - The actor's ID
   */
  static async disableNPC(actorId) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('RNKRESERVES.Messages.GMOnlyDisableNPC'));
      return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error(game.i18n.format('RNKRESERVES.Messages.ActorNotFound', { actorId }));
      return;
    }

    await actor.setFlag('rnk-reserves', 'heroPointsEnabled', false);
    await actor.setFlag('rnk-reserves', 'heroPoints', 0);

    ui.notifications.info(game.i18n.format('RNKRESERVES.Messages.NpcDisabled', { name: actor.name }));
  }
}

// Initialize on Foundry ready
Hooks.once('init', RNKReservesModule.init);
Hooks.once('ready', RNKReservesModule.ready);

// Export for global access
window.RNKReserves = RNKReservesModule;