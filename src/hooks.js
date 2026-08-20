/**
 * Copyright 2026 Lisa's Dungeon
 * Chat buttons, level-up refresh, and GM actor-sheet controls.
 */
import { emitSocketMessage } from './socket.js';
import { logHeroPointSpending } from './logger.js';
import { confirmAction } from './utils/dialog.js';
import { escapeHtml } from './utils/html.js';

const SHEET_HOOKS = [
  'renderActorSheet5eCharacter2',
  'renderActorSheet5eNPC2',
  'renderActorSheet5e',
  'renderActorSheetV2'
];

/**
 * Get actor from chat message
 */
export function getActorFromMessage(message) {
  if (!game?.actors || !message?.speaker) return null;

  if (message.speaker.actor) {
    return game.actors.get(message.speaker.actor);
  }
  if (message.speaker.token && canvas?.tokens) {
    const token = canvas.tokens.get(message.speaker.token);
    return token?.actor;
  }
  return null;
}

function resolveMount(html) {
  const root = toElement(html) ?? html;
  if (!root) return null;
  const messageContent = root.querySelector?.('.message-content');
  return messageContent || root;
}

/**
 * Add Hero Point buttons to chat messages
 */
export function addHeroPointButtons(message, html, data) {
  if (!html || !message) return;

  const actor = getActorFromMessage(message);
  if (!actor) return;

  if (actor.type === 'npc' && !actor.getFlag('ld-hero-pointz', 'heroPointsEnabled')) return;

  const heroPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
  if (heroPoints <= 0) return;

  const roll = message.rolls?.[0];
  const isD20 = roll?.terms?.[0]?.faces === 20;
  const isDeathSave = message.getFlag?.('dnd5e', 'roll')?.type === 'death' ||
                      message.flavor?.toLowerCase().includes('death saving throw');

  if (!isD20 && !isDeathSave) return;

  const mount = resolveMount(html);
  if (!mount?.appendChild) return;
  if (mount.querySelector?.('.ld-hero-pointz-buttons')) return;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'ld-hero-pointz-buttons';

  let actionsHtml = '';
  if (isDeathSave) {
    actionsHtml = `<button type="button" class="ld-hero-pointz-btn" data-action="deathSuccess">${game.i18n.localize('LDHEROEPOINTZ.Chat.DeathSuccess')}</button>`;
  } else if (isD20) {
    actionsHtml = `<button type="button" class="ld-hero-pointz-btn" data-action="addD6">${game.i18n.localize('LDHEROEPOINTZ.Chat.AddD6')}</button>`;
  }

  buttonContainer.innerHTML = `
    <div class="ld-hero-pointz-header">
      <span>${game.i18n.format('LDHEROEPOINTZ.Chat.HeroPoints', { points: heroPoints })}</span>
    </div>
    <div class="ld-hero-pointz-actions">
      ${actionsHtml}
    </div>
  `;

  mount.appendChild(buttonContainer);

  buttonContainer.addEventListener('click', (event) => {
    const action = event.target?.closest?.('[data-action]')?.dataset?.action
      ?? event.target?.dataset?.action;
    if (action) {
      handleHeroPointAction(actor, action, message);
    }
  });
}

/**
 * Get the current level-based hero point baseline.
 * This is used as a refresh target, not a cap.
 */
export function getHeroPointBaseline(level = 1) {
  return 5 + Math.floor(level / 2);
}

export function canSpendHeroPoints(actor) {
  if (!actor) return false;
  if (game.user.isGM) return true;
  return Boolean(actor.isOwner);
}

/**
 * Handle Hero Point spending actions
 */
export async function handleHeroPointAction(actor, action, message) {
  if (!canSpendHeroPoints(actor)) {
    ui.notifications.warn(game.i18n.localize('LDHEROEPOINTZ.Chat.NotOwner'));
    return;
  }

  const heroPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
  if (heroPoints <= 0) {
    ui.notifications.warn(game.i18n.localize('LDHEROEPOINTZ.Chat.NoPoints'));
    return;
  }

  const content = action === 'deathSuccess'
    ? game.i18n.localize('LDHEROEPOINTZ.Chat.SpendDeathSave')
    : game.i18n.localize('LDHEROEPOINTZ.Chat.SpendAddD6');

  const confirmed = await confirmAction(
    game.i18n.localize('LDHEROEPOINTZ.Chat.SpendTitle'),
    `<p>${content}</p>`
  );

  if (!confirmed) return;

  const currentPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
  const newPoints = Math.max(currentPoints - 1, 0);
  await actor.setFlag('ld-hero-pointz', 'heroPoints', newPoints);

  const actionLabel = action === 'deathSuccess' ? 'Death Save Success' : 'Add 1d6';
  if (game.user.isGM) {
    await logHeroPointSpending(
      actor.id,
      actor.name,
      1,
      newPoints,
      actionLabel
    );
  }

  emitSocketMessage('spendHeroPoint', {
    actorId: actor.id,
    points: newPoints,
    action,
    userId: game.user.id
  });

  switch (action) {
    case 'addD6':
      await handleAddD6(message, actor);
      break;
    case 'deathSuccess':
      await handleDeathSaveSuccess(message, actor);
      break;
    default:
      break;
  }
}

/**
 * Add 1d6 to a d20 roll
 */
export async function handleAddD6(message, actor) {
  const bonusRoll = await new Roll('1d6').evaluate();
  const totalBonus = bonusRoll.total;
  const flavor = message.flavor || game.i18n.localize('LDHEROEPOINTZ.Chat.RollDefaultFlavor');

  await bonusRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game.i18n.format('LDHEROEPOINTZ.Chat.AddD6Flavor', { flavor })
  });

  ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Chat.AddD6Success', { bonus: totalBonus }));
}

function deathFailuresToUndo(message, currentFail) {
  const rollTotal = Number(message?.rolls?.[0]?.total);
  const undo = rollTotal === 1 ? 2 : 1;
  return Math.min(undo, currentFail);
}

/**
 * Handle Death Save automatic success
 */
export async function handleDeathSaveSuccess(message, actor) {
  const death = actor.system?.attributes?.death ?? {};
  const currentFail = Number(death.failure) || 0;
  const currentSuccess = Number(death.success) || 0;

  if (typeof actor.update === 'function') {
    await actor.update({
      'system.attributes.death.failure': Math.max(0, currentFail - deathFailuresToUndo(message, currentFail)),
      'system.attributes.death.success': Math.min(3, currentSuccess + 1)
    });
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dnd5e chat-card"><header class="card-header"><h3>${game.i18n.localize('LDHEROEPOINTZ.Chat.DeathSaveTitle')}</h3></header>
              <div class="card-content">${game.i18n.localize('LDHEROEPOINTZ.Chat.DeathSaveContent')}</div></div>`,
    flavor: game.i18n.localize('LDHEROEPOINTZ.Chat.DeathSaveFlavor')
  });

  ui.notifications.info(game.i18n.localize('LDHEROEPOINTZ.Chat.DeathSaveSuccess'));
}

export function registerHooks() {
  Hooks.on('renderChatMessageHTML', (message, html, data) => {
    if (!game || !game.users) return;

    if (!game.user.isGM) {
      const actor = getActorFromMessage(message);
      if (!actor) return;
      if (!actor.isOwner) return;
      const heroPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
      if (heroPoints <= 0) return;
    }
    addHeroPointButtons(message, html, data);
  });

  Hooks.on('preUpdateActor', (actor, updateData, options, userId) => {
    if (!game.settings.get('ld-hero-pointz', 'autoAward')) return;
    if (!actor || actor.type !== 'character') return;

    const newLevel = foundry.utils.getProperty(updateData, 'system.details.level');
    if (newLevel !== undefined) {
      const oldLevel = actor.system.details?.level || 1;
      if (newLevel > oldLevel) {
        const currentPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
        const baselinePoints = getHeroPointBaseline(newLevel);
        const refreshedPoints = Math.max(currentPoints, baselinePoints);

        foundry.utils.setProperty(updateData, 'flags.ld-hero-pointz.heroPoints', refreshedPoints);

        ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Messages.LeveledUp', {
          name: actor.name,
          level: newLevel,
          points: refreshedPoints
        }));
      }
    }
  });

  for (const hookName of SHEET_HOOKS) {
    Hooks.on(hookName, (sheet, html, data) => {
      if (!game.user.isGM) return;
      addGMControls(sheet, html, data);
    });
  }

  Hooks.on('ready', () => {
    game.actors.forEach(actor => {
      initializeHeroPoints(actor);
    });
  });

  Hooks.on('createActor', (actor) => {
    initializeHeroPoints(actor);
  });
}

/**
 * Initialize Hero Points on an actor according to 2024 rules
 */
export function initializeHeroPoints(actor) {
  if (!actor || actor.type !== 'character') return;

  if (!game.settings.get('ld-hero-pointz', 'autoAward')) return;

  const currentPoints = actor.getFlag('ld-hero-pointz', 'heroPoints');
  if (currentPoints === undefined) {
    const level = actor.system.details?.level || 1;
    actor.setFlag('ld-hero-pointz', 'heroPoints', getHeroPointBaseline(level));
  }
}

/**
 * Normalize a hook's `html` argument to a plain HTMLElement, whether Foundry
 * handed us a raw element (ApplicationV2) or a jQuery-wrapped one (legacy V1).
 */
export function toElement(html) {
  if (!html) return null;
  if (typeof HTMLElement !== 'undefined' && html instanceof HTMLElement) return html;
  if (html.jquery) return html[0] ?? null;
  return null;
}

/**
 * Add GM controls to actor sheet.
 */
export function addGMControls(sheet, html, data) {
  const actor = sheet.actor;

  if (actor.type === 'npc' && !actor.getFlag('ld-hero-pointz', 'heroPointsEnabled')) return;

  const root = toElement(html) ?? sheet.element ?? null;
  const header = root?.querySelector?.('.window-header');
  if (!header) return;

  header.querySelector('.ld-hero-pointz-gm-controls')?.remove();

  const heroPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
  const level = actor.system.details?.level || 1;
  const baselinePoints = getHeroPointBaseline(level);

  const gmControls = document.createElement('div');
  gmControls.className = 'ld-hero-pointz-gm-controls';
  gmControls.innerHTML = `
    <div class="ld-hero-pointz-gm-header">
      <span>${game.i18n.format('LDHEROEPOINTZ.GM.Header', { current: heroPoints })}</span>
    </div>
    <div class="ld-hero-pointz-gm-actions">
      <button type="button" class="ld-hero-pointz-gm-btn" data-action="award" title="${game.i18n.localize('LDHEROEPOINTZ.GM.AwardTitle')}"><i class="fas fa-plus"></i></button>
      <button type="button" class="ld-hero-pointz-gm-btn" data-action="subtract" title="${game.i18n.localize('LDHEROEPOINTZ.GM.SubtractTitle')}"><i class="fas fa-minus"></i></button>
      <button type="button" class="ld-hero-pointz-gm-btn" data-action="reset" title="${game.i18n.localize('LDHEROEPOINTZ.GM.ResetTitle')}"><i class="fas fa-sync"></i></button>
      <button type="button" class="ld-hero-pointz-gm-btn" data-action="set-zero" title="${game.i18n.localize('LDHEROEPOINTZ.GM.SetZeroTitle')}"><i class="fas fa-times"></i></button>
    </div>
  `;

  header.appendChild(gmControls);

  gmControls.addEventListener('click', async (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action) {
      await handleGMAction(actor, action, heroPoints, baselinePoints);
    }
  });
}

/**
 * Handle GM actions for awarding/resetting Hero Points
 */
export async function handleGMAction(actor, action, currentPoints, baselinePoints) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize('LDHEROEPOINTZ.Messages.GMOnlyAction'));
    return;
  }

  let newPoints = currentPoints;

  switch (action) {
    case 'award':
      newPoints = currentPoints + 1;
      break;
    case 'subtract':
      newPoints = Math.max(currentPoints - 1, 0);
      break;
    case 'reset':
      newPoints = Math.max(currentPoints, baselinePoints);
      break;
    case 'set-zero':
      newPoints = 0;
      break;
    default:
      return;
  }

  await actor.setFlag('ld-hero-pointz', 'heroPoints', newPoints);

  await logHeroPointSpending(
    actor.id,
    actor.name,
    Math.abs(newPoints - currentPoints),
    newPoints,
    action
  );

  emitSocketMessage('updateHeroPoints', {
    actorId: actor.id,
    points: newPoints,
    previous: currentPoints,
    action,
    userId: game.user.id
  });

  ui.notifications.info(game.i18n.format('LDHEROEPOINTZ.Messages.HeroPointsSet', {
    name: actor.name,
    points: newPoints
  }));
}
