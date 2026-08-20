/**
 * Copyright 2026 Lisa's Dungeon
 * GM management window for targeting an actor and awarding hero points.
 */
import { emitSocketMessage } from '../socket.js';
import { logHeroPointSpending } from '../logger.js';

export class LdHeroPointz extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'ld-hero-pointz-manager',
    classes: ['ld-hero-pointz'],
    tag: 'form',
    window: {
      icon: 'fas fa-shield-alt',
      title: 'LDHEROEPOINTZ.Menu.ManagementName',
      resizable: true
    },
    position: {
      width: 500,
      height: 'auto'
    }
  };

  static PARTS = {
    form: {
      template: 'modules/ld-hero-pointz/templates/settings.html'
    }
  };

  async _prepareContext(options) {
    return {
      targetActorUuid: game.settings.get('ld-hero-pointz', 'targetActorUuid')
    };
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    if (partId === 'form') {
      const root = htmlElement instanceof HTMLElement ? htmlElement : htmlElement[0];

      root.querySelector('input[name="targetActorUuid"]')?.addEventListener('change', event => {
        const value = event.target.value;
        game.settings.set('ld-hero-pointz', 'targetActorUuid', value);
      });

      root.querySelector('.ld-hero-pointz-get-uuid')?.addEventListener('click', event => {
        const tokens = canvas.tokens.controlled;
        if (tokens.length === 0) {
          return ui.notifications.warn(game.i18n.localize('LDHEROEPOINTZ.Messages.NoTokenSelected'));
        }
        const actor = tokens[0].actor;
        if (!actor) return;

        const uuid = actor.uuid;
        const uuidInput = root.querySelector('input[name="targetActorUuid"]');
        uuidInput.value = uuid;
        uuidInput.dispatchEvent(new Event('change', { bubbles: true }));
        ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Messages.TargetSet', { name: actor.name }));
      });

      root.querySelector('.ld-hero-pointz-award-points')?.addEventListener('click', async event => {
        if (!game.user.isGM) {
          return ui.notifications.warn(game.i18n.localize('LDHEROEPOINTZ.Messages.GMOnlyAction'));
        }

        const uuid = game.settings.get('ld-hero-pointz', 'targetActorUuid');
        const raw = parseInt(root.querySelector('input[name="pointsToAdd"]')?.value, 10);
        const pointsToAdd = Number.isFinite(raw) ? raw : 0;

        if (pointsToAdd <= 0) {
          return ui.notifications.warn(game.i18n.localize('LDHEROEPOINTZ.Messages.PointsMustBePositive'));
        }

        if (!uuid) {
          return ui.notifications.error(game.i18n.localize('LDHEROEPOINTZ.Messages.NoTargetUuid'));
        }

        try {
          const actor = await fromUuid(uuid);
          if (!actor || actor.documentName !== 'Actor') {
            return ui.notifications.error(game.i18n.localize('LDHEROEPOINTZ.Messages.InvalidActorUuid'));
          }

          const currentPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
          const newPoints = currentPoints + pointsToAdd;

          await actor.setFlag('ld-hero-pointz', 'heroPoints', newPoints);

          await logHeroPointSpending(
            actor.id,
            actor.name,
            pointsToAdd,
            newPoints,
            'awarded'
          );

          emitSocketMessage('updateHeroPoints', {
            actorId: actor.id,
            points: newPoints,
            previous: currentPoints,
            action: 'awarded',
            userId: game.user.id
          });

          ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Messages.Awarded', {
            points: pointsToAdd,
            name: actor.name,
            total: newPoints
          }));
        } catch (err) {
          ui.notifications.error(game.i18n.localize('LDHEROEPOINTZ.Messages.ActorUpdateError'));
          console.error(err);
        }
      });

      root.querySelector('.ld-hero-pointz-open-log-viewer')?.addEventListener('click', async event => {
        const { LdHeroPointzLogViewer } = await import('./LogViewer.js');
        new LdHeroPointzLogViewer().render({ force: true });
      });
    }
  }
}
