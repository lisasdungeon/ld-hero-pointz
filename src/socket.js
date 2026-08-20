/**
 * Copyright 2026 Lisa's Dungeon
 * Socket routing for GM activity logging. Actor flags sync through Foundry.
 */
import { logHeroPointSpending } from './logger.js';

export function registerSocket() {
  game.socket.on('module.ld-hero-pointz', (data) => {
    handleSocketMessage(data);
  });
}

/**
 * Handle incoming socket messages
 */
export function handleSocketMessage(data) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'updateHeroPoints':
      handleHeroPointsUpdate(data).catch((err) => {
        console.warn('LD Hero Pointz | Failed to log hero point update from socket:', err);
      });
      break;
    case 'spendHeroPoint':
      handleHeroPointSpend(data).catch((err) => {
        console.warn('LD Hero Pointz | Failed to log hero point spend from socket:', err);
      });
      break;
    default:
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

function remainingFrom(data, oldPoints) {
  if (Number.isInteger(data.points)) return data.points;
  return Math.max(oldPoints - 1, 0);
}

/**
 * GM-only activity log for awards and sheet changes made on another client.
 * Does not write actor flags. Foundry already synced the document.
 */
export async function handleHeroPointsUpdate(data) {
  if (!data || data.userId === game.user.id) return;
  if (!game.user.isGM) return;

  const actor = game.actors.get(data.actorId);
  if (!actor) return;

  const oldPoints = Number.isFinite(data.previous)
    ? data.previous
    : (actor.getFlag('ld-hero-pointz', 'heroPoints') || 0);
  const newPoints = remainingFrom(data, oldPoints);

  await logHeroPointSpending(
    data.actorId,
    actor.name,
    Math.abs(oldPoints - newPoints),
    newPoints,
    data.action || 'awarded',
    data.userId
  );
}

/**
 * GM-only activity log for a spend that another client already applied.
 */
export async function handleHeroPointSpend(data) {
  if (!data || data.userId === game.user.id) return;
  if (!game.user.isGM) return;

  const actor = game.actors.get(data.actorId);
  if (!actor) return;

  const oldPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
  const newPoints = remainingFrom(data, oldPoints);

  await logHeroPointSpending(
    data.actorId,
    actor.name,
    1,
    newPoints,
    data.action || 'spent',
    data.userId
  );
}
