'use strict';

const { createHash } = require('node:crypto');
const { canonicalStringify } = require('../cred-shadow/artifact');
const { normalizeCoordinate, coordinateKey } = require('./registry');

const ADAPTER_ID = 'generic-signed-outcome';
const ADAPTER_VERSION = '1.0.0';
const ADAPTER_KEY = ADAPTER_ID + '@' + ADAPTER_VERSION;
const ADAPTER_MANIFEST_HASH_DOMAIN = 'CRED-ADAPTER-MANIFEST-v1\0';
const TRANSFORMATION_HASH_DOMAIN = 'CRED-TRANSFORMATION-v1\0';
const OUTCOME_FIELDS = Object.freeze(['outcome','direction','materialityNative','proofClass','domain','severity','finality','incidentKey','correlationKey','counterpartyCoordinate','relatedParty','proofVerified']);
const OUTCOMES = new Set(['completed','failed','settled','defaulted','accepted','rejected']);
const DIRECTIONS = new Set(['positive','negative']);
const PROOF_CLASSES = new Set(['P1','P2','P3','P4']);
const SEVERITIES = new Set(['minor','material','severe','critical']);
const FINALITY = new Set(['final','pending','reorged','not-applicable']);
const IDENTIFIER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,127}$/u;

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function plain(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object');
  return value;
}
function exact(value, fields, label) {
  plain(value, label);
  const allowed = new Set(fields);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) throw new TypeError(label + ' has unknown field ' + String(key));
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(label + ' fields must be enumerable data properties');
  }
  for (const field of fields) if (!Object.hasOwn(value, field)) throw new TypeError(label + ' is missing field ' + field);
}
function choice(value, allowed, label) { if (!allowed.has(value)) throw new TypeError(label + ' is invalid'); return value; }
function identifier(value, label) { if (typeof value !== 'string' || value.normalize('NFC') !== value || !IDENTIFIER_PATTERN.test(value)) throw new TypeError(label + ' must be a canonical identifier'); return value; }
function domainHash(domain, bytes) { return 'sha256:' + createHash('sha256').update(domain, 'utf8').update(bytes, 'utf8').digest('hex'); }

const GENERIC_MANIFEST = deepFreeze({
  adapterId: ADAPTER_ID,
  adapterVersion: ADAPTER_VERSION,
  inputType: 'generic-signed-outcome-v1',
  outputType: 'cred-normalized-evidence-candidate-v1',
  integerOnly: true,
  networkAccess: false,
  dynamicCode: false,
  fields: [...OUTCOME_FIELDS],
});
const GENERIC_MANIFEST_HASH = domainHash(ADAPTER_MANIFEST_HASH_DOMAIN, canonicalStringify(GENERIC_MANIFEST));

function genericSignedOutcome(payload, context) {
  exact(payload, OUTCOME_FIELDS, 'generic signed outcome');
  const direction = choice(payload.direction, DIRECTIONS, 'direction');
  const proofClass = choice(payload.proofClass, PROOF_CLASSES, 'proofClass');
  const finality = choice(payload.finality, FINALITY, 'finality');
  const severity = payload.severity === null ? null : choice(payload.severity, SEVERITIES, 'severity');
  if (direction === 'positive' && severity !== null) throw new TypeError('positive outcome cannot have severity');
  if (direction === 'negative' && severity === null) throw new TypeError('negative outcome requires severity');
  if (proofClass === 'P4' && direction === 'negative' && (severity === 'severe' || severity === 'critical')) throw new TypeError('P4 cannot support severe or critical negative evidence');
  const materiality = context.schema.materialityMapping.find((item) => item.nativeValue === payload.materialityNative)?.materiality;
  if (!materiality) throw new TypeError('materialityNative is not mapped by schema');
  if (!context.schema.allowedDirections.includes(direction)) throw new TypeError('direction is not authorized by schema');
  if (!context.schema.allowedProofClasses.includes(proofClass)) throw new TypeError('proofClass is not authorized by schema');
  if (!context.schema.allowedDomains.includes(payload.domain)) throw new TypeError('domain is not authorized by schema');
  if (typeof payload.relatedParty !== 'boolean' || typeof payload.proofVerified !== 'boolean') throw new TypeError('relatedParty and proofVerified must be boolean');
  const counterpartyCoordinate = payload.counterpartyCoordinate === null ? null : normalizeCoordinate(payload.counterpartyCoordinate, 'counterpartyCoordinate');
  return deepFreeze({
    outcome: choice(payload.outcome, OUTCOMES, 'outcome'),
    direction,
    materiality,
    proofClass,
    domain: payload.domain,
    severity,
    finality,
    incidentKey: identifier(payload.incidentKey, 'incidentKey'),
    correlationKey: identifier(payload.correlationKey, 'correlationKey'),
    counterpartyCoordinate,
    counterpartyCoordinateKey: counterpartyCoordinate === null ? null : coordinateKey(counterpartyCoordinate),
    relatedParty: payload.relatedParty,
    proofVerified: payload.proofVerified,
  });
}

const LOOPER_ADAPTER_ID = 'looper-base-proof';
const LOOPER_ADAPTER_VERSION = '1.0.0';
const LOOPER_FIELDS = Object.freeze(['proofType','chainId','blockNumber','blockHash','account','owner','collection','tokenId','codeHash','ethWei','liquidCred','stakedCred','direction','materialityNative','proofClass','domain','finality','incidentKey','correlationKey','proofVerified']);
const LOOPER_PROOF_CATEGORIES = Object.freeze({ 'account-binding': 'identity', 'account-callable': 'onchain', 'wallet-balance': 'financial' });
const UINT_PATTERN = /^(0|[1-9]\d*)$/u;
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const BLOCK_HASH_PATTERN = /^0x[0-9a-f]{64}$/u;
function looperUint(value, label) {
  if (typeof value !== 'string' || !UINT_PATTERN.test(value) || BigInt(value) >= (1n << 256n)) throw new TypeError(label + ' must be a canonical uint256 string');
  return value;
}
function looperAddress(value, label) { if (typeof value !== 'string' || !ADDRESS_PATTERN.test(value)) throw new TypeError(label + ' must be a lowercase EVM address'); return value; }
const LOOPER_MANIFEST = deepFreeze({ adapterId: LOOPER_ADAPTER_ID, adapterVersion: LOOPER_ADAPTER_VERSION, inputType: 'looper-base-proof-v1', outputType: 'cred-normalized-evidence-candidate-v1', integerOnly: true, networkAccess: false, dynamicCode: false, fields: [...LOOPER_FIELDS] });
const LOOPER_MANIFEST_HASH = domainHash(ADAPTER_MANIFEST_HASH_DOMAIN, canonicalStringify(LOOPER_MANIFEST));
function looperBaseProof(payload, context) {
  exact(payload, LOOPER_FIELDS, 'Looper Base proof');
  const category = LOOPER_PROOF_CATEGORIES[payload.proofType];
  if (!category) throw new TypeError('proofType is invalid');
  if (context.schema.category !== category) throw new TypeError('Looper proofType does not match schema category');
  if (payload.chainId !== '8453') throw new TypeError('Looper proof must use Base chainId 8453');
  looperUint(payload.blockNumber, 'blockNumber'); looperUint(payload.tokenId, 'tokenId');
  if (!BLOCK_HASH_PATTERN.test(payload.blockHash)) throw new TypeError('blockHash is invalid');
  looperAddress(payload.account, 'account'); looperAddress(payload.owner, 'owner'); looperAddress(payload.collection, 'collection');
  if (!SHA256_PATTERN.test(payload.codeHash)) throw new TypeError('codeHash is invalid');
  const ethWei = looperUint(payload.ethWei, 'ethWei'), liquidCred = looperUint(payload.liquidCred, 'liquidCred'), stakedCred = looperUint(payload.stakedCred, 'stakedCred');
  if (payload.direction !== 'positive') throw new TypeError('Looper evidence must be positive');
  const direction = choice(payload.direction, new Set(context.schema.allowedDirections), 'direction');
  const proofClass = choice(payload.proofClass, new Set(context.schema.allowedProofClasses), 'proofClass');
  const finality = choice(payload.finality, FINALITY, 'finality');
  const domain = choice(payload.domain, new Set(context.schema.allowedDomains), 'domain');
  const materiality = context.schema.materialityMapping.find(item => item.nativeValue === payload.materialityNative)?.materiality;
  if (!materiality) throw new TypeError('materialityNative is not mapped by schema');
  if (typeof payload.proofVerified !== 'boolean' || !payload.proofVerified) throw new TypeError('Looper proof must be verified');
  if (category === 'financial' && BigInt(ethWei) === 0n && BigInt(liquidCred) === 0n && BigInt(stakedCred) === 0n) throw new TypeError('financial evidence requires a nonzero direct balance');
  return deepFreeze({ outcome: 'completed', direction, materiality, proofClass, domain, severity: null, finality, incidentKey: identifier(payload.incidentKey, 'incidentKey'), correlationKey: identifier(payload.correlationKey, 'correlationKey'), counterpartyCoordinate: null, counterpartyCoordinateKey: null, relatedParty: false, proofVerified: true });
}

const ADAPTERS = new Map([
  [ADAPTER_KEY, Object.freeze({ manifest: GENERIC_MANIFEST, manifestHash: GENERIC_MANIFEST_HASH, transform: genericSignedOutcome })],
  [LOOPER_ADAPTER_ID + '@' + LOOPER_ADAPTER_VERSION, Object.freeze({ manifest: LOOPER_MANIFEST, manifestHash: LOOPER_MANIFEST_HASH, transform: looperBaseProof })],
]);

function getAdapter(adapterId, adapterVersion) {
  const adapter = ADAPTERS.get(adapterId + '@' + adapterVersion);
  if (!adapter) throw new Error('adapter is not in the exact allowlist');
  return adapter;
}

module.exports = Object.freeze({
  ADAPTER_ID,
  ADAPTER_VERSION,
  ADAPTER_MANIFEST_HASH_DOMAIN,
  TRANSFORMATION_HASH_DOMAIN,
  GENERIC_MANIFEST,
  GENERIC_MANIFEST_HASH,
  LOOPER_ADAPTER_ID,
  LOOPER_ADAPTER_VERSION,
  LOOPER_MANIFEST,
  LOOPER_MANIFEST_HASH,
  getAdapter,
});
