import { createHash } from 'node:crypto';

const MAX_DEPTH = 64;
const MAX_CONTAINER_ITEMS = 10_000;
const MAX_AMOUNT_DIGITS = 78;

export function canonicalizeMissionJson(value) {
  return encode(value, 0, new Set(), null);
}

export function digestMissionBody(value) {
  return sha256(canonicalizeMissionJson(value));
}

export function digestIdempotencyKey(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256 || value.trim() !== value) {
    throw new TypeError('Idempotency key must be a non-empty bounded string without surrounding whitespace.');
  }
  return sha256(value);
}

export function assertMissionLedgerSafe(value) {
  visitLedgerValue(value, 0, new Set());
  return value;
}

function encode(value, depth, ancestors, fieldName) {
  if (depth > MAX_DEPTH) throw new TypeError('Mission JSON exceeds maximum depth.');
  if (fieldName !== null && isAmountField(fieldName)) assertDecimalAmount(value, fieldName);
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assertValidUnicode(value, 'Mission JSON string');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Mission JSON numbers must be finite.');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new TypeError('Mission JSON contains an unsupported non-JSON value.');
  if (ancestors.has(value)) throw new TypeError('Mission JSON contains a cycle.');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      assertJsonArrayShape(value);
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw new TypeError('Mission JSON arrays must not be sparse.');
        items.push(encode(value[index], depth + 1, ancestors, null));
      }
      return '[' + items.join(',') + ']';
    }
    assertPlainObject(value, 'Mission JSON object');
    assertJsonObjectShape(value);
    const entries = [];
    for (const key of Object.keys(value).sort(compareUtf16)) {
      assertValidUnicode(key, 'Mission JSON object key');
      entries.push(JSON.stringify(key) + ':' + encode(value[key], depth + 1, ancestors, key));
    }
    return '{' + entries.join(',') + '}';
  } finally {
    ancestors.delete(value);
  }
}

function visitLedgerValue(value, depth, ancestors) {
  if (depth > MAX_DEPTH) throw new TypeError('Mission ledger document exceeds maximum depth.');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return;
  if (typeof value !== 'object') throw new TypeError('Mission ledger document contains an unsupported non-JSON value.');
  if (ancestors.has(value)) throw new TypeError('Mission ledger document contains a cycle.');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      assertJsonArrayShape(value);
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw new TypeError('Mission ledger arrays must not be sparse.');
        visitLedgerValue(value[index], depth + 1, ancestors);
      }
      return;
    }
    assertPlainObject(value, 'Mission ledger document');
    assertJsonObjectShape(value);
    for (const key of Object.keys(value)) {
      if (isForbiddenLedgerField(key)) throw new TypeError('Forbidden mission ledger field: ' + key + '.');
      visitLedgerValue(value[key], depth + 1, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

function isAmountField(key) {
  const normalized = key.replace(/[^a-z0-9]/giu, '').toLowerCase();
  return normalized === 'amount' || normalized.endsWith('amount') || normalized.endsWith('amountraw');
}

function assertDecimalAmount(value, fieldName) {
  if (typeof value !== 'string' || !/^[0-9]{1,78}$/u.test(value)) {
    throw new TypeError('Mission token amount field ' + fieldName + ' must be a decimal string of at most ' + MAX_AMOUNT_DIGITS + ' digits.');
  }
}

function isForbiddenLedgerField(key) {
  const normalized = key.replace(/[^a-z0-9]/giu, '').toLowerCase();
  if (normalized.includes('messagebody') || normalized.includes('artifactcontent') || normalized.includes('privatekey')) return true;
  if (normalized === 'prompt' || normalized.endsWith('prompttext') || normalized.endsWith('promptbody')) return true;
  if ((normalized.includes('credential') || normalized.includes('signature')) && !normalized.endsWith('hash')) return true;
  return normalized === 'secret' || normalized.endsWith('secretext');
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function compareUtf16(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertValidUnicode(value, label) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError(label + ' contains a lone surrogate.');
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError(label + ' contains a lone surrogate.');
    }
  }
}

function assertPlainObject(value, label) {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(label + ' must be a plain object.');
}

function assertJsonArrayShape(value) {
  if (value.length > MAX_CONTAINER_ITEMS) throw new TypeError('Mission JSON array is too large.');
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
      throw new TypeError('Mission JSON arrays must contain only JSON indices.');
    }
  }
}

function assertJsonObjectShape(value) {
  const keys = Reflect.ownKeys(value);
  if (keys.length > MAX_CONTAINER_ITEMS) throw new TypeError('Mission JSON object is too large.');
  for (const key of keys) {
    if (typeof key !== 'string') throw new TypeError('Mission JSON objects must not contain symbol keys.');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Mission JSON objects must contain enumerable data properties only.');
  }
}
