/**
 * LD Hero Pointz System for D&D 2024
 * Main entry point — registers settings/hooks/socket on init; logger on ready.
 * Heavy Application classes load only when a settings menu is opened.
 */

import { registerSettings } from './settings.js';
import { registerHooks } from './hooks.js';
import { registerSocket } from './socket.js';
import { initializeLogger } from './logger.js';

export class LdHeroPointzModule {
  static ID = 'ld-hero-pointz';

  static init() {
    registerSettings();
    registerHooks();
    registerSocket();
  }

  static ready() {
    initializeLogger();
  }

  /**
   * Enable Hero Points on a specific NPC by actor ID.
   * Usage (console or macro): LdHeroPointz.enableNPC("actorId", 3)
   * @param {string} actorId - The actor's ID
   * @param {number} [points=1] - Number of Hero Points to assign
   */
  static async enableNPC(actorId, points = 1) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('LDHEROEPOINTZ.Messages.GMOnlyEnableNPC'));
      return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error(game.i18n.format('LDHEROEPOINTZ.Messages.ActorNotFound', { actorId }));
      return;
    }

    const clamped = Math.max(Number.isFinite(points) ? points : 1, 0);

    await actor.setFlag('ld-hero-pointz', 'heroPointsEnabled', true);
    await actor.setFlag('ld-hero-pointz', 'heroPoints', clamped);

    ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Messages.NpcEnabled', {
      name: actor.name,
      type: actor.type,
      points: clamped
    }));
  }

  /**
   * Disable Hero Points on a specific NPC by actor ID.
   * Usage (console or macro): LdHeroPointz.disableNPC("actorId")
   * @param {string} actorId - The actor's ID
   */
  static async disableNPC(actorId) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('LDHEROEPOINTZ.Messages.GMOnlyDisableNPC'));
      return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error(game.i18n.format('LDHEROEPOINTZ.Messages.ActorNotFound', { actorId }));
      return;
    }

    await actor.setFlag('ld-hero-pointz', 'heroPointsEnabled', false);
    await actor.setFlag('ld-hero-pointz', 'heroPoints', 0);

    ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Messages.NpcDisabled', { name: actor.name }));
  }
}

export function registerEntryHooks() {
  Hooks.once('init', LdHeroPointzModule.init);
  Hooks.once('ready', LdHeroPointzModule.ready);
}

registerEntryHooks();

// Export for global access (macros / console)
if (typeof globalThis !== 'undefined') {
  globalThis.LdHeroPointz = LdHeroPointzModule;
}
if (typeof window !== 'undefined') {
  window.LdHeroPointz = LdHeroPointzModule;
}
