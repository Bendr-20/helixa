import { open } from 'node:fs/promises';

const CANONICAL_LENGTH = /^(?:0|[1-9]\d*)$/u;

export async function readBoundedResponseBytes(response, { maxBytes, signal } = {}) {
  assertLimit(maxBytes);
  if (signal?.aborted) throw abortError(signal);
  const declared = response?.headers?.get?.('content-length') ?? null;
  if (declared !== null && (!CANONICAL_LENGTH.test(declared) || BigInt(declared) > BigInt(maxBytes))) {
    throw new Error('Response content length exceeds byte limit.');
  }
  if (typeof response?.body?.getReader !== 'function') throw new Error('Streaming response body required.');
  const reader = response.body.getReader();
  if (typeof reader?.read !== 'function' || typeof reader?.cancel !== 'function') throw new Error('Streaming response reader required.');

  const chunks = [];
  let length = 0;
  let aborted;
  const abortPromise = new Promise((_, reject) => { aborted = reject; });
  const onAbort = () => {
    const error = abortError(signal);
    aborted(error);
    try { Promise.resolve(reader.cancel(error)).catch(() => {}); } catch {}
  };
  signal?.addEventListener?.('abort', onAbort, { once: true });
  try {
    while (true) {
      const result = signal ? await Promise.race([reader.read(), abortPromise]) : await reader.read();
      if (!result || typeof result.done !== 'boolean') throw new Error('Invalid response stream result.');
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) throw new Error('Invalid response stream chunk.');
      length += result.value.byteLength;
      if (length > maxBytes) {
        try { await reader.cancel(new Error('Response body exceeds byte limit.')); } catch {}
        throw new Error('Response body exceeds byte limit.');
      }
      chunks.push(result.value);
    }
  } finally {
    signal?.removeEventListener?.('abort', onAbort);
    try { reader.releaseLock?.(); } catch {}
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readBoundedFileBytes(path, { maxBytes, signal, onOpen } = {}) {
  assertLimit(maxBytes);
  if (signal?.aborted) throw abortError(signal);
  const handle = await open(path, 'r');
  try {
    if (typeof onOpen === 'function') await onOpen(handle);
    if (signal?.aborted) throw abortError(signal);
    const output = new Uint8Array(maxBytes + 1);
    let offset = 0;
    while (offset <= maxBytes) {
      if (signal?.aborted) throw abortError(signal);
      const remaining = output.byteLength - offset;
      const { bytesRead } = await handle.read(output, offset, remaining, null);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > remaining) throw new Error('Invalid file read result.');
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maxBytes) throw new Error('File exceeds byte limit.');
    return output.slice(0, offset);
  } finally {
    await handle.close();
  }
}

function assertLimit(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 64 * 1024 * 1024) throw new TypeError('Invalid byte limit.');
}

function abortError(signal) {
  return signal?.reason instanceof Error ? signal.reason : new Error('Read aborted.');
}
