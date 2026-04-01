/**
 * RNK Reserves Log Viewer Application
 * Displays hero point spending history to the GM
 */
import { getHeroPointsLog, getActorsSummary, clearHeroPointsLog, clearActorLog, reduceActorHeroPoints } from '../logger.js';

export class RNKReservesLogViewer extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static _getDialogRoot(html) {
    if (html instanceof HTMLElement) return html;
    if (html?.[0] instanceof HTMLElement) return html[0];
    if (html?.element instanceof HTMLElement) return html.element;
    if (html?.element?.[0] instanceof HTMLElement) return html.element[0];
    return null;
  }

  static DEFAULT_OPTIONS = {
    id: 'rnk-reserves-log-viewer',
    tag: 'div',
    window: {
      icon: 'fas fa-book',
      title: 'RNK™ Reserves - Activity Log',
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
      template: 'modules/rnk-reserves/templates/log-viewer.hbs'
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
      const form = htmlEl.querySelector('.rnk-log-viewer') || htmlEl;

      // Export button
      form.querySelector('.rnk-export-log')?.addEventListener('click', () => {
        this._exportLog();
      });

      // Clear log button
      form.querySelector('.rnk-clear-all-log')?.addEventListener('click', async () => {
        const confirmed = await Dialog.confirm({
          title: game.i18n.localize('RNKRESERVES.Log.ClearAllConfirmTitle'),
          content: game.i18n.localize('RNKRESERVES.Log.ClearAllConfirm')
        });

        if (confirmed) {
          await clearHeroPointsLog();
          ui.notifications.info(game.i18n.localize('RNKRESERVES.Log.ClearAllSuccess'));
          this.render(true);
        }
      });

      // Clear actor log buttons
      form.querySelectorAll('.rnk-clear-actor-log').forEach(btn => {
        btn.addEventListener('click', async (event) => {
          const actorId = event.currentTarget.dataset.actorId;
          const actorName = event.currentTarget.dataset.actorName;
          
          const confirmed = await Dialog.confirm({
            title: game.i18n.localize('RNKRESERVES.Log.ClearActorConfirmTitle'),
            content: game.i18n.format('RNKRESERVES.Log.ClearActorConfirm', { actorName })
          });

          if (confirmed) {
            await clearActorLog(actorId);
            ui.notifications.info(game.i18n.format('RNKRESERVES.Log.ClearActorSuccess', { actorName }));
            this.render(true);
          }
        });
      });

      // Reduce actor hero points buttons
      form.querySelectorAll('.rnk-reduce-actor-points').forEach(btn => {
        btn.addEventListener('click', async (event) => {
          const actorId = event.currentTarget.dataset.actorId;
          const actorName = event.currentTarget.dataset.actorName;
          const currentPoints = parseInt(event.currentTarget.dataset.currentPoints) || 0;
          
          const dialog = new Dialog({
            title: game.i18n.format('RNKRESERVES.Log.ReduceTitle', { actorName }),
            content: `<form><div class="form-group"><label>${game.i18n.format('RNKRESERVES.Log.CurrentPointsLabel', { points: currentPoints })}</label></div><div class="form-group"><label>${game.i18n.localize('RNKRESERVES.Log.ReduceBy')}</label><input type="number" id="reduce-amount" min="1" max="${currentPoints}" value="1" style="width:100%"/></div></form>`,
            buttons: {
              reduce: {
                label: game.i18n.localize('RNKRESERVES.Log.ReduceButton'),
                callback: async (html) => {
                  const dialogRoot = RNKReservesLogViewer._getDialogRoot(html);
                  const amountInput = dialogRoot?.querySelector('#reduce-amount');
                  const amount = Number.parseInt(amountInput?.value ?? '1', 10) || 1;

                  if (!amountInput) {
                    ui.notifications.error(game.i18n.localize('RNKRESERVES.Log.ReduceReadError'));
                    return;
                  }

                  if (amount > 0 && amount <= currentPoints) {
                    await reduceActorHeroPoints(actorId, amount);
                    ui.notifications.info(game.i18n.format('RNKRESERVES.Log.ReduceSuccess', { amount, actorName }));
                    this.render(true);
                  }
                }
              },
              cancel: {
                label: game.i18n.localize('RNKRESERVES.Log.CancelButton')
              }
            },
            default: 'reduce'
          });
          dialog.render(true);
        });
      });

      // Filter by actor
      form.querySelector('.rnk-filter-actor')?.addEventListener('change', (event) => {
        const actorId = event.target.value;
        const entries = form.querySelectorAll('[data-actor-id]');
        
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
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `rnk-reserves-log-${new Date().toISOString().split('T')[0]}.json`);
    link.click();
  }
}
