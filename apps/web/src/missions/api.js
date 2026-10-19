const SCHEMA_VERSION = '0.1.0';
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const FORBIDDEN_RESPONSE_KEY = /(^|_)(manager_location|manager_url|credential|secret|private_key|session_token|conversation_id|internal_id|signature)($|_)/iu;

export class MissionApiError extends Error {
  constructor(status, code) { super(status === 409 ? 'Mission changed. Refresh and retry.' : status === 401 || status === 403 ? 'Wallet authorization is required.' : 'Swarm Command is unavailable.'); this.name = 'MissionApiError'; this.status = status; this.code = code || 'mission_unavailable'; }
}

export function createMissionApi({ fetchImpl, apiBase = '' } = {}) {
  const activeFetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
  if (typeof activeFetch !== 'function') throw new TypeError('fetchImpl must be a function.');
  const base = String(apiBase).replace(/\/$/u, '');

  async function call(path, { method = 'GET', body, revision, idempotencyKey, csrfToken, csrfOnly = false, signal } = {}) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) {
      validateRawAmounts(body);
      headers['content-type'] = 'application/json';
      if (!csrfOnly) {
        headers['if-match'] = String(nonNegativeInteger(revision, 'revision'));
        headers['idempotency-key'] = idempotency(idempotencyKey);
      }
      headers['x-csrf-token'] = bounded(csrfToken, 'csrfToken', 1, 512);
    }
    let response;
    try { response = await activeFetch(base + path, { method, credentials: 'include', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(signal ? { signal } : {}) }); }
    catch { throw new MissionApiError(0, 'mission_unavailable'); }
    let payload; try { payload = await response.json(); } catch { throw new MissionApiError(503, 'invalid_response'); }
    if (!response.ok) throw new MissionApiError(response.status, payload?.error?.code);
    validateEnvelope(payload);
    return payload;
  }

  const mission = (value) => encodeURIComponent(identifier(value, 'missionId'));
  const write = (path, method = 'POST') => (input) => {
    exact(input, ['body', 'csrfToken', 'expectedRevision', 'idempotencyKey', 'missionId', 'signal'], new Set(['signal']), 'mission write');
    return call('/api/multipass/missions/' + mission(input.missionId) + path, { method, body: input.body, revision: input.expectedRevision, idempotencyKey: input.idempotencyKey, csrfToken: input.csrfToken, signal: input.signal });
  };
  return Object.freeze({
    listPublic({ state = null, cursor = null, limit = 20, signal } = {}) {
      const params = new URLSearchParams(); if (state) params.set('state', bounded(state, 'state', 1, 64)); if (cursor) params.set('cursor', bounded(cursor, 'cursor', 1, 256)); params.set('limit', String(integer(limit, 'limit', 1, 100)));
      return call('/api/multipass/missions?' + params, { signal });
    },
    getPublic({ missionId, signal } = {}) { return call('/api/multipass/missions/' + mission(missionId), { signal }); },
    getLaunchTerms({ missionId, signal } = {}) { return call('/api/multipass/missions/' + mission(missionId) + '/launch/terms', { signal }); },
    getWorkspace({ missionId, signal } = {}) { return call('/api/multipass/missions/' + mission(missionId) + '/workspace', { signal }); },
    getDispute({ missionId, milestoneId, disputeId, signal } = {}) { return call('/api/multipass/missions/' + mission(missionId) + '/milestones/' + encodeURIComponent(identifier(milestoneId, 'milestoneId')) + '/disputes/' + encodeURIComponent(identifier(disputeId, 'disputeId')), { signal }); },
    previewSwarmLaunch(input) { exact(input, ['body', 'csrfToken', 'signal'], new Set(['signal']), 'launch preview'); return call('/api/loopers/swarm-launch/preview', { method: 'POST', body: input.body, csrfToken: input.csrfToken, csrfOnly: true, signal: input.signal }); },
    create(input) { exact(input, ['body', 'csrfToken', 'expectedRevision', 'idempotencyKey', 'signal'], new Set(['signal']), 'mission create'); return call('/api/multipass/missions', { method: 'POST', body: input.body, revision: input.expectedRevision, idempotencyKey: input.idempotencyKey, csrfToken: input.csrfToken, signal: input.signal }); },
    update: write('', 'PATCH'), publish: write('/publish'), cancel: write('/cancel'), apply: write('/applications'), selectTeam: write('/team'),
    signTerms: write('/launch/terms/sign'), publishManifest: write('/launch/manifest'), prepareVault: write('/vault/prepare'), retryLaunch: write('/launch/retry'), refundLaunch: write('/launch/refund'),
    fund: write('/fund'), reconcile: write('/reconcile'), createTask: write('/workspace/tasks'), submitArtifact: write('/workspace/artifacts'),
    withdrawApplication(input) { return dynamicWrite(input, '/applications/' + encodeURIComponent(identifier(input.applicationId, 'applicationId')) + '/withdraw', []); },
    assignTask(input) { return dynamicWrite(input, '/workspace/tasks/' + encodeURIComponent(identifier(input.taskId, 'taskId')) + '/assign'); },
    updateTask(input) { return dynamicWrite(input, '/workspace/tasks/' + encodeURIComponent(identifier(input.taskId, 'taskId')), undefined, 'PATCH'); },
    approveMilestone(input) { return dynamicWrite(input, '/milestones/' + encodeURIComponent(identifier(input.milestoneId, 'milestoneId')) + '/approve'); },
    releaseMilestone(input) { return dynamicWrite(input, '/milestones/' + encodeURIComponent(identifier(input.milestoneId, 'milestoneId')) + '/release'); },
    openDispute(input) { return dynamicWrite(input, '/milestones/' + encodeURIComponent(identifier(input.milestoneId, 'milestoneId')) + '/disputes'); },
    arbitrate(input) { return dynamicWrite(input, '/milestones/' + encodeURIComponent(identifier(input.milestoneId, 'milestoneId')) + '/disputes/' + encodeURIComponent(identifier(input.disputeId, 'disputeId')) + '/arbitrate'); },
  });

  function dynamicWrite(input, suffix, bodyOverride, method = 'POST') {
    const body = bodyOverride ?? input.body;
    return call('/api/multipass/missions/' + mission(input.missionId) + suffix, { method, body, revision: input.expectedRevision, idempotencyKey: input.idempotencyKey, csrfToken: input.csrfToken, signal: input.signal });
  }
}

function validateEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema_version !== SCHEMA_VERSION) throw new TypeError('Mission response is invalid.');
  scan(value, 0);
  return value;
}
function scan(value, depth) {
  if (depth > 16) throw new TypeError('Mission response is too deep.');
  if (Array.isArray(value)) { if (value.length > 1000) throw new TypeError('Mission response is too large.'); for (const item of value) scan(item, depth + 1); return; }
  if (!value || typeof value !== 'object') return;
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('Mission response is invalid.');
  for (const [key, nested] of Object.entries(value)) { if (FORBIDDEN_RESPONSE_KEY.test(key)) throw new TypeError('Mission response leaks an internal field.'); scan(nested, depth + 1); }
}
function validateRawAmounts(value, depth = 0, key = '') { if (depth > 16) throw new TypeError('Mission request is too deep.'); if (Array.isArray(value)) { for (const item of value) validateRawAmounts(item, depth + 1, key); return; } if (!value || typeof value !== 'object') { if (/(?:amount_raw|amountRaw|token_amount)$/u.test(key) && (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/u.test(value))) throw new TypeError('Token amounts must be canonical decimal strings.'); return; } for (const [nestedKey, nested] of Object.entries(value)) validateRawAmounts(nested, depth + 1, nestedKey); }
function exact(value, keys, optional, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object.'); const allowed = new Set(keys); for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(label + ' contains unknown fields.'); for (const key of keys) if (!optional.has(key) && !Object.hasOwn(value, key)) throw new TypeError(label + ' is missing fields.'); }
function identifier(value, label) { if (typeof value !== 'string' || !IDENTIFIER.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function idempotency(value) { if (typeof value !== 'string' || !IDEMPOTENCY.test(value)) throw new TypeError('idempotencyKey is invalid.'); return value; }
function bounded(value, label, min, max) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function integer(value, label, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(label + ' is invalid.'); return value; }
function nonNegativeInteger(value, label) { return integer(value, label, 0, Number.MAX_SAFE_INTEGER); }
