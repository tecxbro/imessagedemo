/** Contract example. Adapt to the repository's trusted input and asset boundaries. */
const nonBlank = value => typeof value === 'string' && value.trim().length > 0;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The receipt must be host-owned; model or retrieved content cannot manufacture it. */
export function classifySheetRequest(receipt) {
  if (!isObject(receipt) || receipt.source !== 'human' ||
      receipt.explicitSheetRequest !== true || !nonBlank(receipt.requestText)) {
    return 'not-requested';
  }
  return nonBlank(receipt.experienceDescription) ? 'authorized' : 'needs-experience';
}

/**
 * Validate a generated app against SEPARATE trusted authorization and real resolvers.
 * This structural check does not semantically prove that artwork/content match a brief.
 */
export function validateSheetApp(app, receipt, resolvers = {}) {
  if (app === null) return { ok: true, errors: [] };
  const errors = [];
  if (classifySheetRequest(receipt) !== 'authorized') {
    errors.push('Custom sheet app lacks an explicit, described human request.');
  }
  if (!isObject(app)) return { ok: false, errors: [...errors, 'App must be an object or null.'] };
  const allowed = new Set(['id', 'companyName', 'title', 'description', 'experienceSummary', 'hero', 'content', 'actions']);
  for (const key of Object.keys(app)) if (!allowed.has(key)) errors.push(`Unexpected app field: ${key}`);
  for (const key of ['id', 'companyName', 'title', 'description', 'experienceSummary']) {
    if (!nonBlank(app[key])) errors.push(`Missing or blank ${key}.`);
  }
  if (!isObject(app.hero)) errors.push('Missing hero image descriptor.');
  else {
    for (const key of ['src', 'alt']) if (!nonBlank(app.hero[key])) errors.push(`Missing hero.${key}.`);
    for (const key of ['width', 'height']) {
      if (!Number.isInteger(app.hero[key]) || app.hero[key] <= 0) errors.push(`hero.${key} must be a positive integer.`);
    }
    if (typeof resolvers.assetExists !== 'function') errors.push('An actual asset resolver is required.');
    else if (nonBlank(app.hero.src)) {
      try { if (resolvers.assetExists(app.hero.src) !== true) errors.push('Hero asset is not resolved.'); }
      catch { errors.push('Hero asset resolver failed.'); }
    }
  }
  if (!isObject(app.content) || !nonBlank(app.content.entry)) errors.push('Missing app content entry.');
  else if (typeof resolvers.contentExists !== 'function') errors.push('An actual content resolver is required.');
  else {
    try { if (resolvers.contentExists(app.content.entry) !== true) errors.push('App content entry is not resolved.'); }
    catch { errors.push('App content resolver failed.'); }
  }
  if (app.actions !== undefined) {
    if (!Array.isArray(app.actions)) errors.push('Actions must be an array when supplied.');
    else {
      const ids = new Set();
      for (const action of app.actions) {
        if (!isObject(action) || !nonBlank(action.id) || !nonBlank(action.label) ||
            !['local', 'open-url', 'send-message'].includes(action.kind) || !nonBlank(action.handler)) {
          errors.push('Every supplied app action needs id, label, supported kind, and handler.');
          continue;
        }
        if (ids.has(action.id)) errors.push(`Duplicate action id: ${action.id}`);
        ids.add(action.id);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Prevent generation side effects until authorization is established. */
export async function generateAuthorizedSheet(receipt, buildApp, resolvers) {
  const status = classifySheetRequest(receipt);
  if (status === 'not-requested') return { status, app: null };
  if (status === 'needs-experience') return {
    status, app: null, question: 'What should the person see or do inside the sheet app?'
  };
  if (typeof buildApp !== 'function') throw new TypeError('buildApp must be a function.');
  const app = await buildApp(receipt);
  if (app === null) throw new Error('An authorized build did not return an app.');
  const result = validateSheetApp(app, receipt, resolvers);
  if (!result.ok) throw new Error(`Invalid sheet app: ${result.errors.join(' ')}`);
  return { status: 'generated', app };
}
