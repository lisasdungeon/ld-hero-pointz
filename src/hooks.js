import { emitSocketMessage } from './socket.js';
import { logHeroPointSpending } from './logger.js';

/**
 * Get actor from chat message
 */
function getActorFromMessage(message) {
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

/**
 * Add Hero Point buttons to chat messages
 */
function addHeroPointButtons(message, html, data) {
  // Only add if actor has Hero Points
  if (!html || !message) return;
  
  const actor = getActorFromMessage(message);
  if (!actor) return;

  // Skip NPCs unless explicitly enabled
  if (actor.type === 'npc' && !actor.getFlag('rnk-reserves', 'heroPointsEnabled')) return;

  const heroPoints = actor.getFlag('rnk-reserves', 'heroPoints') || 0;
  if (heroPoints <= 0) return;

  // Determine if this is a d20 roll or a death save
  const roll = message.rolls?.[0];
  const isD20 = roll?.terms?.[0]?.faces === 20;
  const isDeathSave = message.getFlag('dnd5e', 'roll')?.type === 'death' || 
                      message.flavor?.toLowerCase().includes('death saving throw');

  if (!isD20 && !isDeathSave) return;

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'rnk-reserves-buttons';
  
  let actionsHtml = '';
  if (isDeathSave) {
    actionsHtml = `<button class="rnk-reserves-btn" data-action="deathSuccess">${game.i18n.localize('RNKRESERVES.Chat.DeathSuccess')}</button>`;
  } else if (isD20) {
    actionsHtml = `<button class="rnk-reserves-btn" data-action="addD6">${game.i18n.localize('RNKRESERVES.Chat.AddD6')}</button>`;
  }

  buttonContainer.innerHTML = `
    <div class="rnk-reserves-header">
      <span>${game.i18n.format('RNKRESERVES.Chat.HeroPoints', { points: heroPoints })}</span>
    </div>
    <div class="rnk-reserves-actions">
      ${actionsHtml}
    </div>
  `;

  // Add to chat message
  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
    messageContent.appendChild(buttonContainer);
  } else {
    html.appendChild(buttonContainer);
  }

  // Add event listeners
  buttonContainer.addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    if (action) {
      handleHeroPointAction(actor, action, message);
    }
  });
}

/**
 * Handle Hero Point spending actions
 */
async function handleHeroPointAction(actor, action, message) {
  const heroPoints = actor.getFlag('rnk-reserves', 'heroPoints') || 0;
  if (heroPoints <= 0) {
    ui.notifications.warn(game.i18n.localize('RNKRESERVES.Chat.NoPoints'));
    return;
  }

  // Confirm spending
  const content = action === 'deathSuccess' 
    ? game.i18n.localize('RNKRESERVES.Chat.SpendDeathSave')
    : game.i18n.localize('RNKRESERVES.Chat.SpendAddD6');
    
  const confirmed = await Dialog.confirm({
    title: game.i18n.localize('RNKRESERVES.Chat.SpendTitle'),
    content: content
  });

  if (!confirmed) return;

  // Spend the point
  const newPoints = heroPoints - 1;
  await actor.setFlag('rnk-reserves', 'heroPoints', newPoints);

  // Log the spending (local client can still log if GM)
  if (game.user.isGM) {
    const actionLabel = action === 'deathSuccess' ? 'Death Save Success' : 'Add 1d6';
    logHeroPointSpending(
      actor.id,
      actor.name,
      1,
      newPoints,
      actionLabel
    );
  }

  // Emit socket to sync to other clients
  emitSocketMessage('spendHeroPoint', {
    actorId: actor.id,
    points: newPoints,
    action,
    userId: game.user.id
  });

  // Apply the action
  switch (action) {
    case 'addD6':
      await handleAddD6(message, actor);
      break;
    case 'deathSuccess':
      await handleDeathSaveSuccess(message, actor);
      break;
  }
}

/**
 * Add 1d6 to a d20 roll
 */
async function handleAddD6(message, actor) {
  const bonusRoll = await new Roll('1d6').evaluate();
  const totalBonus = bonusRoll.total;
  const flavor = message.flavor || game.i18n.localize('RNKRESERVES.Chat.RollDefaultFlavor');

  await bonusRoll.toMessage({
    speaker: ChatMessage.getSpeaker({actor}),
    flavor: game.i18n.format('RNKRESERVES.Chat.AddD6Flavor', { flavor })
  });

  ui.notifications.info(game.i18n.format('RNKRESERVES.Chat.AddD6Success', { bonus: totalBonus }));
}

/**
 * Handle Death Save automatic success
 */
async function handleDeathSaveSuccess(message, actor) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({actor}),
    content: `<div class="dnd5e chat-card"><header class="card-header"><h3>${game.i18n.localize('RNKRESERVES.Chat.DeathSaveTitle')}</h3></header>
              <div class="card-content">${game.i18n.localize('RNKRESERVES.Chat.DeathSaveContent')}</div></div>`,
    flavor: game.i18n.localize('RNKRESERVES.Chat.DeathSaveFlavor')
  });
  
  ui.notifications.info(game.i18n.localize('RNKRESERVES.Chat.DeathSaveSuccess'));
}


export function registerHooks() {
  // Add buttons to chat messages
  Hooks.on('renderChatMessageHTML', (message, html, data) => {
    if (!game || !game.users) return;
    
    // GM always sees, players only if they have points
    if (!game.user.isGM) {
      const actor = getActorFromMessage(message);
      if (!actor) return;
      
      // Verify the user is the owner/controller of this actor
      if (!actor.isOwner) return;

      const heroPoints = actor.getFlag('rnk-reserves', 'heroPoints') || 0;
      if (heroPoints <= 0) return;
    }
    addHeroPointButtons(message, html, data);
  });

  // Level-up detection and refresh
  Hooks.on('preUpdateActor', (actor, updateData, options, userId) => {
    // Respect the autoAward setting
    if (!game.settings.get('rnk-reserves', 'autoAward')) return;

    const newLevel = foundry.utils.getProperty(updateData, 'system.details.level');
    if (newLevel !== undefined) {
      const oldLevel = actor.system.details?.level || 1;
      if (newLevel > oldLevel) {
        // Character leveled up!
        const newMax = 5 + Math.floor(newLevel / 2);
        
        // Unspent points are lost, set to new total
        foundry.utils.setProperty(updateData, 'flags.rnk-reserves.heroPoints', newMax);
        
        // Notify the user
        ui.notifications.info(game.i18n.format('RNKRESERVES.Messages.LeveledUp', {
          name: actor.name,
          level: newLevel,
          max: newMax
        }));
      }
    }
  });

  // Add GM controls to actor sheets
  Hooks.on('renderActorSheet5e', (sheet, html, data) => {
    if (!game.user.isGM) return;
    addGMControls(sheet, html, data);
  });

  // Initialize Hero Points on actors
  Hooks.on('ready', () => {
    // Ensure all actors have Hero Points initialized according to 2024 rules
    game.actors.forEach(actor => {
      initializeHeroPoints(actor);
    });
  });

  // Sync Hero Points when actor updates
  Hooks.on('updateActor', (actor, data, options, userId) => {
    if (foundry.utils.hasProperty(data, 'flags.rnk-reserves.heroPoints')) {
      const points = foundry.utils.getProperty(data, 'flags.rnk-reserves.heroPoints');
      console.log(`RNK™ Reserves | Actor ${actor.name} Hero Points updated to: ${points}`);
    }
  });
}

/**
 * Initialize Hero Points on an actor according to 2024 rules
 */
function initializeHeroPoints(actor) {
  // Skip NPCs — they must be explicitly enabled via the API
  if (actor.type === 'npc') return;

  // Respect the autoAward setting
  if (!game.settings.get('rnk-reserves', 'autoAward')) return;

  const currentPoints = actor.getFlag('rnk-reserves', 'heroPoints');
  if (currentPoints === undefined) {
    const level = actor.system.details?.level || 1;
    const initialPoints = 5 + Math.floor(level / 2);
    actor.setFlag('rnk-reserves', 'heroPoints', initialPoints);
  }
}

/**
 * Add GM controls to actor sheet
 */
function addGMControls(sheet, html, data) {
  const actor = sheet.actor;

  // Skip NPCs unless explicitly enabled
  if (actor.type === 'npc' && !actor.getFlag('rnk-reserves', 'heroPointsEnabled')) return;

  const heroPoints = actor.getFlag('rnk-reserves', 'heroPoints') || 0;
  const level = actor.system.details?.level || 1;
  const maxPoints = 5 + Math.floor(level / 2);

  // Create GM controls container
  const gmControls = document.createElement('div');
  gmControls.className = 'rnk-reserves-gm-controls';
  gmControls.innerHTML = `
    <div class="rnk-reserves-gm-header">
      <span>${game.i18n.format('RNKRESERVES.GM.Header', { current: heroPoints, max: maxPoints })}</span>
    </div>
    <div class="rnk-reserves-gm-actions">
      <button type="button" class="rnk-reserves-gm-btn" data-action="award" title="${game.i18n.localize('RNKRESERVES.GM.AwardTitle')}"><i class="fas fa-plus"></i></button>
      <button type="button" class="rnk-reserves-gm-btn" data-action="subtract" title="${game.i18n.localize('RNKRESERVES.GM.SubtractTitle')}"><i class="fas fa-minus"></i></button>
      <button type="button" class="rnk-reserves-gm-btn" data-action="reset" title="${game.i18n.localize('RNKRESERVES.GM.ResetTitle')}"><i class="fas fa-sync"></i></button>
      <button type="button" class="rnk-reserves-gm-btn" data-action="set-zero" title="${game.i18n.localize('RNKRESERVES.GM.SetZeroTitle')}"><i class="fas fa-times"></i></button>
    </div>
  `;

  // Add to sheet header
  const header = html.find('.window-header');
  if (header.length) {
    header.append(gmControls);
  }

  // Add event listeners
  gmControls.addEventListener('click', async (event) => {
    // Find the button (in case icon was clicked)
    const btn = event.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action) {
      await handleGMAction(actor, action, heroPoints, maxPoints);
    }
  });
}

/**
 * Handle GM actions for awarding/resetting Hero Points
 */
async function handleGMAction(actor, action, currentPoints, maxPoints) {
  let newPoints = currentPoints;

  switch (action) {
    case 'award':
      newPoints = Math.min(currentPoints + 1, maxPoints);
      break;
    case 'subtract':
      newPoints = Math.max(currentPoints - 1, 0);
      break;
    case 'reset':
      newPoints = maxPoints;
      break;
    case 'set-zero':
      newPoints = 0;
      break;
    default:
      return;
  }

  await actor.setFlag('rnk-reserves', 'heroPoints', newPoints);

  // Emit socket to sync
  emitSocketMessage('updateHeroPoints', {
    actorId: actor.id,
    points: newPoints,
    userId: game.user.id
  });

  ui.notifications.info(game.i18n.format('RNKRESERVES.Messages.HeroPointsSet', {
    name: actor.name,
    points: newPoints
  }));
}