const {
  decodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
} = require('@x402/core/http');

function firstHeader(value) {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : null;
}

function lowerHeaders(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers || {})) out[String(key).toLowerCase()] = value;
  return out;
}

function decodePaymentRequiredFromHeaders(headers = {}) {
  const normalized = lowerHeaders(headers);
  const encoded = firstHeader(normalized['payment-required']);
  if (!encoded) return null;
  try { return decodePaymentRequiredHeader(encoded); }
  catch { return null; }
}

function decodePaymentPayloadFromHeaders(headers = {}) {
  const normalized = lowerHeaders(headers);
  const encoded = firstHeader(normalized['payment-signature']) || firstHeader(normalized.payment) || firstHeader(normalized['x-payment']);
  if (!encoded) return null;
  try { return decodePaymentSignatureHeader(encoded); }
  catch { return null; }
}

function isEmptyJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function display(value) {
  if (value === undefined) return null;
  return value;
}

function normalizeComparable(field, value) {
  if (typeof value !== 'string') return value;
  if (field.endsWith('.asset') || field.endsWith('.payTo')) return value.toLowerCase();
  return value;
}

function addMissing(diagnostics, field, hint) {
  diagnostics.push({ issue: 'missing', field, expected: 'required', received: null, hint });
}

function addMismatch(diagnostics, field, expected, received, hint) {
  diagnostics.push({ issue: 'mismatch', field, expected: display(expected), received: display(received), hint });
}

function compareField(diagnostics, field, expected, received, hint) {
  if (!hasValue(received)) return addMissing(diagnostics, field, hint);
  if (normalizeComparable(field, expected) !== normalizeComparable(field, received)) {
    addMismatch(diagnostics, field, expected, received, hint);
  }
}

function bestAcceptedRequirement(paymentPayload, paymentRequired) {
  const accepts = Array.isArray(paymentRequired?.accepts) ? paymentRequired.accepts : [];
  if (!accepts.length) return null;
  const accepted = paymentPayload?.accepted || {};
  return accepts.find(candidate => (
    (!accepted.scheme || accepted.scheme === candidate.scheme) &&
    (!accepted.network || accepted.network === candidate.network)
  )) || accepts[0];
}

function buildDiagnostics(paymentPayload, paymentRequired) {
  const diagnostics = [];
  const expectedVersion = paymentRequired?.x402Version || 2;

  if (!paymentPayload || typeof paymentPayload !== 'object') {
    addMissing(diagnostics, 'payment-signature', 'Send PAYMENT-SIGNATURE as a base64 encoded x402 PaymentPayload.');
    return diagnostics;
  }

  compareField(diagnostics, 'x402Version', expectedVersion, paymentPayload.x402Version, 'Use the x402Version from PAYMENT-REQUIRED.');

  if (!paymentPayload.accepted || typeof paymentPayload.accepted !== 'object') {
    addMissing(diagnostics, 'accepted', 'Echo one object from PAYMENT-REQUIRED.accepts as accepted.');
  }
  if (!paymentPayload.resource || typeof paymentPayload.resource !== 'object') {
    addMissing(diagnostics, 'resource', 'Echo PAYMENT-REQUIRED.resource in the payment payload.');
  }
  if (!paymentPayload.payload || typeof paymentPayload.payload !== 'object') {
    addMissing(diagnostics, 'payload', 'Include the exact scheme payload, including authorization and signature.');
  } else {
    if (!paymentPayload.payload.authorization || typeof paymentPayload.payload.authorization !== 'object') {
      addMissing(diagnostics, 'payload.authorization', 'Include the EIP-3009 TransferWithAuthorization authorization object.');
    }
    if (!hasValue(paymentPayload.payload.signature)) {
      addMissing(diagnostics, 'payload.signature', 'Include the signature over payload.authorization.');
    }
  }

  const expectedAccepted = bestAcceptedRequirement(paymentPayload, paymentRequired);
  if (expectedAccepted && paymentPayload.accepted && typeof paymentPayload.accepted === 'object') {
    compareField(diagnostics, 'accepted.scheme', expectedAccepted.scheme, paymentPayload.accepted.scheme, 'accepted.scheme must match PAYMENT-REQUIRED.accepts[].scheme.');
    compareField(diagnostics, 'accepted.network', expectedAccepted.network, paymentPayload.accepted.network, 'accepted.network must match PAYMENT-REQUIRED.accepts[].network.');
    compareField(diagnostics, 'accepted.amount', expectedAccepted.amount, paymentPayload.accepted.amount, 'accepted.amount is in base units, not dollars. For $1 USDC use 1000000.');
    compareField(diagnostics, 'accepted.asset', expectedAccepted.asset, paymentPayload.accepted.asset, 'accepted.asset must be the USDC contract from PAYMENT-REQUIRED.');
    compareField(diagnostics, 'accepted.payTo', expectedAccepted.payTo, paymentPayload.accepted.payTo, 'accepted.payTo must match PAYMENT-REQUIRED.accepts[].payTo.');
  }

  if (paymentRequired?.resource && paymentPayload.resource && typeof paymentPayload.resource === 'object') {
    compareField(diagnostics, 'resource.url', paymentRequired.resource.url, paymentPayload.resource.url, 'resource.url must match PAYMENT-REQUIRED.resource.url.');
  }

  return diagnostics;
}

function paymentObject(paymentRequired) {
  if (!paymentRequired) return { header: 'PAYMENT-REQUIRED', instructions: 'Read the PAYMENT-REQUIRED response header and retry with PAYMENT-SIGNATURE.' };
  return {
    x402Version: paymentRequired.x402Version,
    resource: paymentRequired.resource,
    accepts: paymentRequired.accepts,
    instructions: 'Read PAYMENT-REQUIRED, echo resource and one accepts entry as accepted, sign the exact scheme payload, then retry with PAYMENT-SIGNATURE.',
  };
}

function likelyRawSdkError(error) {
  return typeof error === 'string' && /Cannot read properties|undefined|null|TypeError/i.test(error);
}

function summarizeDiagnostics(diagnostics) {
  const fields = diagnostics.map(d => d.field).slice(0, 8).join(', ');
  return fields ? `Payment payload is missing or mismatching required x402 fields: ${fields}.` : 'Payment payload does not match required x402 payment requirements.';
}

function buildX402ErrorBody(response = {}, options = {}) {
  const fallbackError = options.fallbackError || 'payment_required';
  const paymentRequired = decodePaymentRequiredFromHeaders(response.headers || {});
  const paymentPayload = decodePaymentPayloadFromHeaders(options.requestHeaders || {});
  const body = response.body && !isEmptyJsonObject(response.body) ? response.body : null;
  const upstreamError = typeof body?.error === 'string' ? body.error : null;
  const diagnostics = buildDiagnostics(paymentPayload, paymentRequired);

  if (diagnostics.length === 1 && diagnostics[0].field === 'payment-signature') {
    return {
      error: fallbackError,
      detail: paymentRequired?.error || 'Payment required',
      payment: paymentObject(paymentRequired),
    };
  }

  if (diagnostics.length) {
    const hasMissingCore = diagnostics.some(d => d.issue === 'missing' || d.field === 'x402Version');
    const error = likelyRawSdkError(upstreamError)
      ? 'x402_payment_payload_invalid'
      : hasMissingCore
        ? 'x402_payment_payload_invalid'
        : 'x402_payment_requirements_mismatch';
    return {
      error,
      detail: summarizeDiagnostics(diagnostics),
      diagnostics,
      payment: paymentObject(paymentRequired),
    };
  }

  if (body) {
    return {
      error: upstreamError || fallbackError,
      detail: body.detail || upstreamError || 'Payment verification failed',
      payment: paymentObject(paymentRequired),
    };
  }

  return {
    error: fallbackError,
    detail: paymentRequired?.error || 'Use the PAYMENT-REQUIRED header to complete x402 payment in USDC.',
    payment: paymentObject(paymentRequired),
  };
}

module.exports = {
  buildX402ErrorBody,
  buildDiagnostics,
  decodePaymentPayloadFromHeaders,
  decodePaymentRequiredFromHeaders,
};
