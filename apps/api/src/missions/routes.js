import { MissionServiceError } from './service.js';
import { parseStrictJsonObject } from '../strict-json-envelope.js';

export const MISSION_REQUEST_MAX_BYTES = 16 * 1024;
const JSON_HEADERS = Object.freeze({ 'content-type': 'application/json; charset=utf-8' });
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

export async function handleMissionRequest(request, { service, authenticate } = {}) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean).map(safeDecode);
  if (parts[0] !== 'api' || parts[1] !== 'multipass' || parts[2] !== 'missions') return null;
  if (!service) return errorResponse(404, 'not_found', 'Route not found.');
  const method = request.method.toUpperCase();

  try {
    if (method === 'GET' && parts.length === 3) {
      const query = parseListQuery(url.searchParams);
      return jsonResponse({ schema_version: '0.1.0', ...(await service.listPublicMissions(query)) });
    }
    if (method === 'GET' && parts.length === 4) {
      return jsonResponse({ schema_version: '0.1.0', mission: await service.getPublicMission({ missionId: routeId(parts[3], 'missionId') }) });
    }

    if (method === 'GET') {
      const session = authenticateRequest(authenticate, request, false);
      const common = { missionId: routeId(parts[3], 'missionId'), actorAddress: session.wallet };
      if (parts.length === 6 && parts[4] === 'launch' && parts[5] === 'terms') {
        return jsonResponse({ schema_version: '0.1.0', terms: await service.readLaunchTerms(common) });
      }
      if (parts.length === 5 && parts[4] === 'workspace') {
        return jsonResponse({ schema_version: '0.1.0', workspace: await service.readWorkspace(common) });
      }
      if (parts.length === 8 && parts[4] === 'milestones' && parts[6] === 'disputes') {
        return jsonResponse({ schema_version: '0.1.0', dispute: await service.readDispute({
          ...common, milestoneId: routeId(parts[5], 'milestoneId'), disputeId: routeId(parts[7], 'disputeId'),
        }) });
      }
      return errorResponse(404, 'not_found', 'Route not found.');
    }

    if (!['POST', 'PATCH'].includes(method)) return errorResponse(405, 'method_not_allowed', 'Method not allowed.');
    const route = matchWriteRoute(method, parts);
    if (!route) return errorResponse(404, 'not_found', 'Route not found.');
    const session = authenticateRequest(authenticate, request, true);
    const metadata = readMutationHeaders(request);
    const body = await readMissionJson(request);
    requireExactKeys(body, route.keys);
    const input = route.normalize(body);
    const command = {
      ...metadata,
      actorAddress: session.wallet,
      ...(route.missionId ? { missionId: routeId(parts[3], 'missionId') } : {}),
      ...(route.applicationId ? { applicationId: routeId(parts[5], 'applicationId') } : {}),
      ...(route.milestoneId ? { milestoneId: routeId(parts[5], 'milestoneId') } : {}),
      ...(route.taskId ? { taskId: routeId(parts[6], 'taskId') } : {}),
      ...(route.disputeId ? { disputeId: routeId(parts[7], 'disputeId') } : {}),
      input,
    };
    const result = await service[route.method](command);
    return jsonResponse({ schema_version: '0.1.0', result }, route.status);
  } catch (error) {
    return mapMissionError(error);
  }
}

function matchWriteRoute(method, parts) {
  if (method === 'POST' && parts.length === 3) return route('createMission', 201, false,
    ['commitment_hash', 'mission_id', 'private_document', 'private_spec_hash', 'public_document', 'public_summary', 'refund_address', 'terms_hash'],
    (body) => ({ missionId: body.mission_id, refundAddress: body.refund_address, publicSummary: body.public_summary, publicDocument: body.public_document, privateDocument: body.private_document, privateSpecHash: body.private_spec_hash, termsHash: body.terms_hash, commitmentHash: body.commitment_hash }));
  if (parts.length < 4) return null;
  if (method === 'PATCH' && parts.length === 4) return route('updateMission', 200, true,
    ['commitment_hash', 'patch', 'private_document', 'public_document'],
    (body) => ({ patch: body.patch, publicDocument: body.public_document, privateDocument: body.private_document, commitmentHash: body.commitment_hash }));
  if (method === 'PATCH' && parts.length === 7 && parts[4] === 'workspace' && parts[5] === 'tasks') {
    return { ...route('updateTask', 200, true, ['patch'], (body) => body), taskId: true };
  }
  if (method !== 'POST') return null;
  if (parts.length === 5 && parts[4] === 'publish') return route('publishMission', 200, true,
    ['application_closes_at', 'commitment_hash', 'private_document', 'public_document'],
    (body) => ({ applicationClosesAt: body.application_closes_at, publicDocument: body.public_document, privateDocument: body.private_document, commitmentHash: body.commitment_hash }));
  if (parts.length === 5 && parts[4] === 'cancel') return route('cancelMission', 200, true,
    ['commitment_hash', 'private_document', 'public_document'],
    (body) => ({ publicDocument: body.public_document, privateDocument: body.private_document, commitmentHash: body.commitment_hash }));
  if (parts.length === 5 && parts[4] === 'applications') return route('applyToMission', 201, true, ['application'], (body) => body);
  if (parts.length === 7 && parts[4] === 'applications' && parts[6] === 'withdraw') return { ...route('withdrawApplication', 200, true, [], (body) => body), applicationId: true };
  if (parts.length === 5 && parts[4] === 'team') return route('selectTeam', 200, true, ['selection'], (body) => body);
  if (parts.length === 7 && parts[4] === 'launch' && parts[5] === 'terms' && parts[6] === 'sign') return route('signLaunchTerms', 200, true, ['signature'], (body) => body);
  if (parts.length === 6 && parts[4] === 'launch' && parts[5] === 'manifest') return route('publishLaunchManifest', 202, true, ['manifest'], (body) => body);
  if (parts.length === 6 && parts[4] === 'vault' && parts[5] === 'prepare') return route('prepareVault', 202, true, ['vault'], (body) => body);
  if (parts.length === 6 && parts[4] === 'launch' && parts[5] === 'retry') return route('retryLaunch', 202, true, ['launch'], (body) => body);
  if (parts.length === 6 && parts[4] === 'launch' && parts[5] === 'refund') return route('refundLaunch', 202, true, ['refund'], (body) => body);
  if (parts.length === 5 && parts[4] === 'fund') return route('fundMission', 202, true, ['funding'], (body) => body);
  if (parts.length === 5 && parts[4] === 'reconcile') return route('reconcileMission', 202, true, ['transaction'], (body) => body);
  if (parts.length === 6 && parts[4] === 'workspace' && parts[5] === 'tasks') return route('createTask', 201, true, ['task'], (body) => body);
  if (parts.length === 8 && parts[4] === 'workspace' && parts[5] === 'tasks' && parts[7] === 'assign') return { ...route('assignTask', 200, true, ['assignment'], (body) => body), taskId: true };
  if (parts.length === 6 && parts[4] === 'workspace' && parts[5] === 'artifacts') return route('submitArtifact', 201, true, ['artifact'], (body) => body);
  if (parts.length === 7 && parts[4] === 'milestones' && parts[6] === 'approve') return { ...route('approveMilestone', 200, true, ['approval'], (body) => body), milestoneId: true };
  if (parts.length === 7 && parts[4] === 'milestones' && parts[6] === 'release') return { ...route('releaseMilestone', 202, true, ['release'], (body) => body), milestoneId: true };
  if (parts.length === 7 && parts[4] === 'milestones' && parts[6] === 'disputes') return { ...route('openDispute', 201, true, ['dispute'], (body) => body), milestoneId: true };
  if (parts.length === 9 && parts[4] === 'milestones' && parts[6] === 'disputes' && parts[8] === 'arbitrate') {
    return { ...route('prepareArbitration', 202, true, ['resolution'], (body) => body), milestoneId: true, disputeId: true };
  }
  return null;
}

function route(method, status, missionId, keys, normalize) {
  return Object.freeze({ method, status, missionId, keys: Object.freeze(keys), normalize });
}

function parseListQuery(searchParams) {
  for (const key of searchParams.keys()) if (!['cursor', 'limit', 'state'].includes(key)) throw inputError('Unknown mission list query field.');
  for (const key of ['cursor', 'limit', 'state']) if (searchParams.getAll(key).length > 1) throw inputError('Duplicate mission list query field.');
  const rawLimit = searchParams.get('limit');
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw inputError('Mission list limit is invalid.');
  const state = searchParams.get('state');
  const cursor = searchParams.get('cursor');
  if (state !== null && (!state || state.length > 64)) throw inputError('Mission state filter is invalid.');
  if (cursor !== null && (!cursor || cursor.length > 256)) throw inputError('Mission cursor is invalid.');
  return { state, cursor, limit };
}

function authenticateRequest(authenticate, request, requireCsrf) {
  if (typeof authenticate !== 'function') throw new RouteError(503, 'mission_unavailable', 'Mission authentication is unavailable.');
  const session = authenticate(request, { requireCsrf });
  if (!session || typeof session.wallet !== 'string') throw new RouteError(401, 'unauthorized', 'Authenticated Console wallet session is required.');
  return session;
}

function readMutationHeaders(request) {
  const revisionHeader = request.headers.get('if-match');
  if (revisionHeader === null) throw new RouteError(428, 'revision_required', 'If-Match mission revision is required.');
  const match = /^(?:(?:W\/)?"(0|[1-9][0-9]*)"|(0|[1-9][0-9]*))$/u.exec(revisionHeader);
  const unquoted = match?.[1] ?? match?.[2];
  if (unquoted === undefined || !Number.isSafeInteger(Number(unquoted))) throw inputError('If-Match mission revision is invalid.');
  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey === null) throw new RouteError(428, 'idempotency_required', 'Idempotency-Key is required.');
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) throw inputError('Idempotency-Key is invalid.');
  return { expectedRevision: Number(unquoted), idempotencyKey };
}

async function readMissionJson(request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') throw new RouteError(415, 'unsupported_media_type', 'Mission writes require application/json.');
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MISSION_REQUEST_MAX_BYTES)) throw tooLarge();
  if (!request.body) return Object.freeze({});
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MISSION_REQUEST_MAX_BYTES) { await reader.cancel().catch(() => {}); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw inputError('Mission request must be valid UTF-8 JSON.'); }
  try { return parseStrictJsonObject(text); }
  catch (error) { throw inputError('Mission request JSON is invalid: ' + error.message); }
}

function requireExactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw inputError('Mission request fields are invalid.');
}

function routeId(value, label) { if (typeof value !== 'string' || !IDENTIFIER.test(value)) throw inputError(label + ' is invalid.'); return value; }
function safeDecode(value) { try { return decodeURIComponent(value); } catch { throw inputError('Mission route encoding is invalid.'); } }
function inputError(message) { return new RouteError(400, 'invalid_request', message); }
function tooLarge() { return new RouteError(413, 'payload_too_large', 'Mission request body is too large.'); }

function mapMissionError(error) {
  if (error instanceof RouteError) return errorResponse(error.status, error.code, error.message);
  if (error instanceof MissionServiceError) return errorResponse(error.status, error.code, error.message);
  if (error?.name === 'ApiUnauthorizedError') return errorResponse(401, 'unauthorized', error.message);
  if (error?.name === 'ApiForbiddenError') return errorResponse(403, 'forbidden', error.message);
  if (error instanceof TypeError || error instanceof SyntaxError) return errorResponse(400, 'invalid_request', error.message);
  if (/revision conflict|idempotency key/iu.test(error?.message ?? '')) return errorResponse(409, 'mission_conflict', 'Mission state changed or idempotency key was reused.');
  return errorResponse(503, 'mission_unavailable', 'Mission service is temporarily unavailable.');
}

class RouteError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
function jsonResponse(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }); }
function errorResponse(status, code, message) { return jsonResponse({ schema_version: '0.1.0', error: { code, message } }, status); }
