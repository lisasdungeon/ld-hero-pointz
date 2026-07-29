/**
 * LD Hero Pointz Application Class
 * Placeholder for future GM controls or additional UI
 */
import { emitSocketMessage } from '../socket.js';
import { logHeroPointSpending } from '../logger.js';
import { LdHeroPointzLogViewer } from './LogViewer.js';

export class LdHeroPointz extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'ld-hero-pointz',
    tag: 'form',
    window: {
      icon: 'fas fa-shield-alt',
      title: 'LD Hero Pointz',
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

  _onSubmit(formData) {
    // Handle form submission if needed
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    if (partId === 'form') {
      const htmlElement_obj = htmlElement instanceof HTMLElement ? htmlElement : htmlElement[0];

      // Save UUID on change
      htmlElement_obj.querySelector('input[name="targetActorUuid"]')?.addEventListener('change', event => {
        const value = event.target.value;
        game.settings.set('ld-hero-pointz', 'targetActorUuid', value);
      });

      // Get UUID from selection
      htmlElement_obj.querySelector('.ld-hero-pointz-get-uuid')?.addEventListener('click', event => {
        const tokens = canvas.tokens.controlled;
        if (tokens.length === 0) {
          return ui.notifications.warn(game.i18n.localize('LDHEROEPOINTZ.Messages.NoTokenSelected'));
        }
        const actor = tokens[0].actor;
        if (!actor) return;
        
        const uuid = actor.uuid;
        const uuidInput = htmlElement_obj.querySelector('input[name="targetActorUuid"]');
        uuidInput.value = uuid;
        uuidInput.dispatchEvent(new Event('change', { bubbles: true }));
        ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Messages.TargetSet', { name: actor.name }));
      });

      // Award points
      htmlElement_obj.querySelector('.ld-hero-pointz-award-points')?.addEventListener('click', async event => {
        const uuid = game.settings.get('ld-hero-pointz', 'targetActorUuid');
        const pointsToAdd = parseInt(htmlElement_obj.querySelector('input[name="pointsToAdd"]').value) || 0;

        if (!uuid) {
          return ui.notifications.error(game.i18n.localize('LDHEROEPOINTZ.Messages.NoTargetUuid'));
        }

        try {
          const actor = await fromUuid(uuid);
          if (!actor || actor.documentName !== "Actor") {
            return ui.notifications.error(game.i18n.localize('LDHEROEPOINTZ.Messages.InvalidActorUuid'));
          }

          const currentPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
          const newPoints = currentPoints + pointsToAdd;

          await actor.setFlag('ld-hero-pointz', 'heroPoints', newPoints);
          
          // Log the award
          logHeroPointSpending(
            actor.id,
            actor.name,
            pointsToAdd,
            newPoints,
            'awarded'
          );
          
          // Emit socket to sync
          emitSocketMessage('updateHeroPoints', {
            actorId: actor.id,
            points: newPoints,
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

      // Open Activity Log
      htmlElement_obj.querySelector('.ld-hero-pointz-open-log-viewer')?.addEventListener('click', event => {
        new LdHeroPointzLogViewer().render(true);
      });
    }
  }
}
