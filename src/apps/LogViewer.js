/**
 * Copyright 2026 Lisa's Dungeon
 * GM activity log for hero point awards and spends.
 */
import { getHeroPointsLog, getActorsSummary, clearHeroPointsLog, clearActorLog, reduceActorHeroPoints } from '../logger.js';
import { confirmAction, promptAmount } from '../utils/dialog.js';
import { escapeHtml } from '../utils/html.js';

export class LdHeroPointzLogViewer extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'ld-hero-pointz-log-viewer',
    classes: ['ld-hero-pointz-log-viewer-app'],
    tag: 'div',
    window: {
      icon: 'fas fa-book',
      title: 'LDHEROEPOINTZ.Log.Title',
      resizable: true,
      minimizeable: true
    },
    position: {
      width: 900,
      height: 600
    }
  };

  static PARTS = {
    main: {
      template: 'modules/ld-hero-pointz/templates/log-viewer.hbs'
    }
  };

  async _prepareContext(options = {}) {
    const context = await super._prepareContext(options);
    const log = getHeroPointsLog();
    const summary = getActorsSummary();

    context.entries = log;
    context.summary = Object.values(summary);
    context.totalSpent = log.reduce((sum, entry) => sum + entry.pointsSpent, 0);
    context.totalEntries = log.length;

    return context;
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    if (partId === 'main') {
      const htmlEl = htmlElement instanceof HTMLElement ? htmlElement : htmlElement[0];
      const form = htmlEl.querySelector('.ld-hero-pointz-log-viewer') || htmlEl;

      form.querySelector('.ld-hero-pointz-export-log')?.addEventListener('click', () => {
        this._exportLog();
      });

      form.querySelector('.ld-hero-pointz-clear-all-log')?.addEventListener('click', async () => {
        const confirmed = await confirmAction(
          game.i18n.localize('LDHEROEPOINTZ.Log.ClearAllConfirmTitle'),
          `<p>${game.i18n.localize('LDHEROEPOINTZ.Log.ClearAllConfirm')}</p>`
        );

        if (confirmed) {
          await clearHeroPointsLog();
          ui.notifications.info(game.i18n.localize('LDHEROEPOINTZ.Log.ClearAllSuccess'));
          this.render({ force: true });
        }
      });

      form.querySelectorAll('.ld-hero-pointz-clear-actor-log').forEach(btn => {
        btn.addEventListener('click', async (event) => {
          const actorId = event.currentTarget.dataset.actorId;
          const actorName = event.currentTarget.dataset.actorName;
          const safeName = escapeHtml(actorName);

          const confirmed = await confirmAction(
            game.i18n.localize('LDHEROEPOINTZ.Log.ClearActorConfirmTitle'),
            `<p>${game.i18n.format('LDHEROEPOINTZ.Log.ClearActorConfirm', { actorName: safeName })}</p>`
          );

          if (confirmed) {
            await clearActorLog(actorId);
            ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Log.ClearActorSuccess', { actorName }));
            this.render({ force: true });
          }
        });
      });

      form.querySelectorAll('.ld-hero-pointz-reduce-actor-points').forEach(btn => {
        btn.addEventListener('click', async (event) => {
          const actorId = event.currentTarget.dataset.actorId;
          const actorName = event.currentTarget.dataset.actorName;
          const currentPoints = parseInt(event.currentTarget.dataset.currentPoints, 10) || 0;

          const amount = await promptAmount(
            game.i18n.format('LDHEROEPOINTZ.Log.ReduceTitle', { actorName: escapeHtml(actorName) }),
            `<form><div class="form-group"><label>${game.i18n.format('LDHEROEPOINTZ.Log.CurrentPointsLabel', { points: currentPoints })}</label></div><div class="form-group"><label>${game.i18n.localize('LDHEROEPOINTZ.Log.ReduceBy')}</label><input type="number" name="amount" min="1" max="${currentPoints}" value="1" style="width:100%"/></div></form>`
          );

          if (amount == null) {
            ui.notifications.error(game.i18n.localize('LDHEROEPOINTZ.Log.ReduceReadError'));
            return;
          }

          if (amount > 0 && amount <= currentPoints) {
            await reduceActorHeroPoints(actorId, amount);
            ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Log.ReduceSuccess', { amount, actorName }));
            this.render({ force: true });
          }
        });
      });

      form.querySelector('.ld-hero-pointz-filter-actor')?.addEventListener('change', (event) => {
        const actorId = event.target.value;
        const entries = form.querySelectorAll('.log-entry');

        entries.forEach(entry => {
          if (!actorId || entry.dataset.actorId === actorId) {
            entry.style.display = '';
          } else {
            entry.style.display = 'none';
          }
        });
      });
    }
  }

  _exportLog() {
    const log = getHeroPointsLog();
    const summary = getActorsSummary();

    const exportData = {
      exported: new Date().toISOString(),
      summary: Object.values(summary),
      entries: log
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `ld-hero-pointz-log-${new Date().toISOString().split('T')[0]}.json`);
    link.click();
  }
}
