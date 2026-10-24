export function createSwarmDraftRetryState({ createKey } = {}) {
  if (typeof createKey !== 'function') throw new TypeError('Draft key factory is required.');
  let pending = null;
  return Object.freeze({
    keyFor(input = {}) {
      const fingerprint = canonicalFingerprint(input);
      if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, key: validKey(createKey()) };
      return pending.key;
    },
    succeeded() { pending = null; },
  });
}

function canonicalFingerprint(input) {
  const leadTokenId = String(input?.leadTokenId ?? '').trim();
  const inviteeTokenIds = Array.isArray(input?.inviteeTokenIds) ? input.inviteeTokenIds.map((value) => String(value).trim()) : [];
  return JSON.stringify({ leadTokenId, inviteeTokenIds });
}
function validKey(value) { const key=String(value??''); if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(key)) throw new TypeError('Draft key factory returned an invalid key.'); return key; }
