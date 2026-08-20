/**
 * Copyright 2026 Lisa's Dungeon
 * ApplicationV2 dialog helpers for Foundry v13+.
 */

/**
 * Show a yes/no confirm dialog. Returns true when the user confirms.
 * @param {string} title
 * @param {string} htmlContent Already-escaped HTML for the body
 * @returns {Promise<boolean>}
 */
export async function confirmAction(title, htmlContent) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.confirm) return false;
  return DialogV2.confirm({
    window: { title },
    content: htmlContent
  });
}

/**
 * Prompt for a named numeric field. Returns null when cancelled.
 * @param {string} title
 * @param {string} htmlContent Form markup that includes an input named "amount"
 * @returns {Promise<number|null>}
 */
export async function promptAmount(title, htmlContent) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.input) return null;
  const result = await DialogV2.input({
    window: { title },
    content: htmlContent
  });
  if (!result || result.amount == null || result.amount === '') return null;
  const amount = Number.parseInt(result.amount, 10);
  return Number.isFinite(amount) ? amount : null;
}
