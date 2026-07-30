/**
 * Socket communication for LD Hero Pointz
 */
import { logHeroPointSpending } from './logger.js';

export function registerSocket() {
  // Register socket handler
  game.socket.on('module.ld-hero-pointz', (data) => {
    handleSocketMessage(data);
  });
}

/**
 * Handle incoming socket messages
 */
function handleSocketMessage(data) {
  switch (data.type) {
    case 'updateHeroPoints':
      handleHeroPointsUpdate(data).catch((err) => {
        console.warn('LD Hero Pointz | Failed to apply hero point update from socket:', err);
      });
      break;
    case 'spendHeroPoint':
      handleHeroPointSpend(data).catch((err) => {
        console.warn('LD Hero Pointz | Failed to apply hero point spend from socket:', err);
      });
      break;
  }
}

/**
 * Send socket message to all clients
 */
export function emitSocketMessage(type, data) {
  game.socket.emit('module.ld-hero-pointz', {
    type,
    ...data
  });
}

/**
 * Handle Hero Points update from socket
 */
async function handleHeroPointsUpdate(data) {
  const actor = game.actors.get(data.actorId);
  if (!actor) return;

  const oldPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
  const newPoints = data.points;

  if (data.userId === game.user.id) {
    // Originator already updated locally
    return;
  }

  await actor.setFlag('ld-hero-pointz', 'heroPoints', newPoints);

  // Log the update
  if (game.user.isGM) {
    await logHeroPointSpending(
      data.actorId,
      actor.name,
      Math.max(0, oldPoints - newPoints),
      newPoints,
      'awarded',
      data.userId
    );
  }
}

/**
 * Handle Hero Point spend from socket
 */
async function handleHeroPointSpend(data) {
  const actor = game.actors.get(data.actorId);
  if (!actor) return;

  if (data.userId === game.user.id) {
    // Avoid sender double-applying
    return;
  }

  const oldPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
  const newPoints = Number.isInteger(data.points) ? data.points : Math.max(oldPoints - 1, 0);

  await actor.setFlag('ld-hero-pointz', 'heroPoints', newPoints);

  // Log the spending (GM only)
  if (game.user.isGM) {
    await logHeroPointSpending(
      data.actorId,
      actor.name,
      oldPoints - newPoints,
      newPoints,
      data.action || 'spent',
      data.userId
    );
  }
}