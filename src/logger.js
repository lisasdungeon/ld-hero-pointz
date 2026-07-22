/**
 * Hero Points Logging System
 * Tracks all hero point spending and updates
 */

const LOG_STORAGE_KEY = 'ld-hero-pointz-log';
const MAX_LOG_ENTRIES = 500;

/**
 * Initialize the logging system
 */
export function initializeLogger() {
  if (!game.user.isGM) return;
  
  // Create game world flag if it doesn't exist
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
export function logHeroPointSpending(actorId, actorName, pointsSpent, pointsRemaining, action, userId = null) {
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
  
  // Keep log size manageable
  const newLog = [entry, ...currentLog].slice(0, MAX_LOG_ENTRIES);
  
  game.settings.set('ld-hero-pointz', 'heroPointsLog', newLog);
  
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

/**
 * Clear the entire log and reset all actor hero points (GM only)
 */
export async function clearHeroPointsLog() {
  if (!game.user.isGM) return;
  await game.settings.set('ld-hero-pointz', 'heroPointsLog', []);

  // Reset hero points on all actors that have them
  for (const actor of game.actors) {
    try {
      await actor.setFlag('ld-hero-pointz', 'heroPoints', 0);
      await actor.setFlag('ld-hero-pointz', 'heroPointsEnabled', false);
    } catch (e) {
      console.warn(game.i18n.format('LDHEROEPOINTZ.Messages.LogResetFailed', { name: actor.name }), e);
    }
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

  // Reset hero points on the actor
  const actor = game.actors.get(actorId);
  if (actor) {
    try {
      await actor.setFlag('ld-hero-pointz', 'heroPoints', 0);
      await actor.setFlag('ld-hero-pointz', 'heroPointsEnabled', false);
    } catch (e) {
      console.warn(game.i18n.format('LDHEROEPOINTZ.Messages.LogResetFailed', { name: actor.name }), e);
    }
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
  
  // Log the reduction
  logHeroPointSpending(
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
  
  // Check all actors
  game.actors.forEach(actor => {
    const heroPoints = actor.getFlag('ld-hero-pointz', 'heroPoints');
    const isEnabled = actor.getFlag('ld-hero-pointz', 'heroPointsEnabled');
    
    // Include if they have points or are explicitly enabled
    if (heroPoints > 0 || isEnabled) {
      summary[actor.id] = {
        id: actor.id,
        name: actor.name,
        type: actor.type,
        heroPoints: Math.max(0, heroPoints),
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
