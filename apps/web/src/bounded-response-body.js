const CANONICAL_CONTENT_LENGTH = /^(?:0|[1-9][0-9]*)$/u;

export async function readBoundedResponseBody(response, options = {}) {
  return new TextDecoder().decode(await readBoundedResponseBytes(response, options));
}

export async function readBoundedResponseBytes(response, { maxBytes, signal } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error('Invalid response byte limit.');

  const contentLength = response?.headers?.get?.('content-length') ?? null;
  if (contentLength !== null
    && (!CANONICAL_CONTENT_LENGTH.test(contentLength) || BigInt(contentLength) > BigInt(maxBytes))) {
    throw new Error('Invalid response content length.');
  }

  if (typeof response?.body?.getReader !== 'function') throw new Error('Streaming response body required.');
  const reader = response.body.getReader();
  if (typeof reader?.read !== 'function' || typeof reader?.cancel !== 'function') {
    throw new Error('Streaming response reader required.');
  }

  let rejectOnAbort;
  let abortHandler;
  let cancelRequested = false;
  const abortPromise = new Promise((_, reject) => { rejectOnAbort = reject; });
  const cancelReader = (reason) => {
    if (cancelRequested) return;
    cancelRequested = true;
    try {
      Promise.resolve(reader.cancel(reason)).catch(() => {});
    } catch {}
  };
  abortHandler = () => {
    const error = signal?.reason instanceof Error ? signal.reason : new Error('Response body read aborted.');
    rejectOnAbort(error);
    cancelReader(error);
  };
  signal?.addEventListener?.('abort', abortHandler, { once: true });

  const chunks = [];
  let byteLength = 0;
  try {
    if (signal?.aborted) abortHandler();
    while (true) {
      const result = signal
        ? await Promise.race([reader.read(), abortPromise])
        : await reader.read();
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Response body read aborted.');
      if (!result || typeof result.done !== 'boolean') throw new Error('Invalid response stream result.');
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) throw new Error('Invalid response stream chunk.');
      byteLength += result.value.byteLength;
      if (byteLength > maxBytes) {
        throw new Error('Response body exceeds byte limit.');
      }
      chunks.push(result.value);
    }
  } catch (error) {
    cancelReader(error);
    throw error;
  } finally {
    signal?.removeEventListener?.('abort', abortHandler);
    try { reader.releaseLock?.(); } catch {}
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
