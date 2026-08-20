/**
 * Copyright 2026 Lisa's Dungeon
 * Hero point activity log stored in a world setting.
 */

const MAX_LOG_ENTRIES = 500;

/**
 * Initialize the logging system
 */
export function initializeLogger() {
  if (!game.user.isGM) return;

  if (!game.settings.get('ld-hero-pointz', 'heroPointsLog')) {
    game.settings.set('ld-hero-pointz', 'heroPointsLog', []);
  }
}

/**
 * Add a log entry for hero point spending
 * @param {string} actorId - The actor's ID
 * @param {string} actorName - The actor's name
 * @param {number} pointsSpent - Number of points spent
 * @param {number} pointsRemaining - Points left after spending
 * @param {string} action - Type of action (deathSuccess, addD6, award, etc)
 * @param {string} [userId] - Who triggered the action (defaults to current user)
 */
export async function logHeroPointSpending(actorId, actorName, pointsSpent, pointsRemaining, action, userId = null) {
  if (!game.user.isGM) return;

  const entry = {
    id: foundry.utils.randomID(),
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleString(),
    actorId: actorId,
    actorName: actorName,
    pointsSpent: pointsSpent,
    pointsRemaining: pointsRemaining,
    action: action,
    userId: userId || game.user.id,
    userName: (game.users.get(userId || game.user.id))?.name || game.i18n.localize('LDHEROEPOINTZ.Messages.UnknownUser')
  };

  const currentLog = game.settings.get('ld-hero-pointz', 'heroPointsLog') || [];
  const newLog = [entry, ...currentLog].slice(0, MAX_LOG_ENTRIES);

  await game.settings.set('ld-hero-pointz', 'heroPointsLog', newLog);

  return entry;
}

/**
 * Get all log entries
 */
export function getHeroPointsLog() {
  return game.settings.get('ld-hero-pointz', 'heroPointsLog') || [];
}

/**
 * Get log entries for a specific actor
 */
export function getActorLog(actorId) {
  const fullLog = getHeroPointsLog();
  return fullLog.filter(entry => entry.actorId === actorId);
}

async function resetActorFlags(actor) {
  try {
    await actor.setFlag('ld-hero-pointz', 'heroPoints', 0);
    await actor.setFlag('ld-hero-pointz', 'heroPointsEnabled', false);
  } catch (e) {
    console.warn(game.i18n.format('LDHEROEPOINTZ.Messages.LogResetFailed', { name: actor.name }), e);
  }
}

/**
 * Clear the entire log and reset all actor hero points (GM only)
 */
export async function clearHeroPointsLog() {
  if (!game.user.isGM) return;
  await game.settings.set('ld-hero-pointz', 'heroPointsLog', []);

  for (const actor of game.actors) {
    await resetActorFlags(actor);
  }
}

/**
 * Clear logs for a specific actor and reset their hero points (GM only)
 */
export async function clearActorLog(actorId) {
  if (!game.user.isGM) return;
  const currentLog = game.settings.get('ld-hero-pointz', 'heroPointsLog') || [];
  const filtered = currentLog.filter(entry => entry.actorId !== actorId);
  await game.settings.set('ld-hero-pointz', 'heroPointsLog', filtered);

  const actor = game.actors.get(actorId);
  if (actor) {
    await resetActorFlags(actor);
  }
}

/**
 * Reduce a specific actor's hero points by an amount (GM only)
 * @param {string} actorId - The actor's ID
 * @param {number} amount - Number of points to reduce
 */
export async function reduceActorHeroPoints(actorId, amount) {
  if (!game.user.isGM || !amount || amount < 0) return;

  const actor = game.actors.get(actorId);
  if (!actor) return;

  const currentPoints = actor.getFlag('ld-hero-pointz', 'heroPoints') || 0;
  const newPoints = Math.max(0, currentPoints - amount);

  await actor.setFlag('ld-hero-pointz', 'heroPoints', newPoints);

  await logHeroPointSpending(
    actorId,
    actor.name,
    amount,
    newPoints,
    'reduce',
    game.user.id
  );
}

/**
 * Get summary of current hero points for all actors that have them
 */
export function getActorsSummary() {
  const summary = {};

  game.actors.forEach(actor => {
    const heroPoints = actor.getFlag('ld-hero-pointz', 'heroPoints');
    const isEnabled = actor.getFlag('ld-hero-pointz', 'heroPointsEnabled');

    if (heroPoints > 0 || isEnabled) {
      summary[actor.id] = {
        id: actor.id,
        name: actor.name,
        type: actor.type,
        heroPoints: Math.max(0, heroPoints || 0),
        isEnabled: isEnabled || false,
        lastSpend: getLatestActorAction(actor.id)
      };
    }
  });

  return summary;
}

/**
 * Get the latest log entry for an actor
 */
function getLatestActorAction(actorId) {
  const log = getActorLog(actorId);
  return log.length > 0 ? log[0] : null;
}

/**
 * Export log as JSON
 */
export function exportLogAsJSON() {
  const log = getHeroPointsLog();
  const summary = getActorsSummary();

  return {
    exported: new Date().toISOString(),
    totalEntries: log.length,
    summary: summary,
    entries: log
  };
}
