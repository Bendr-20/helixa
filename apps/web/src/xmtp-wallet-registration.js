const XMTP_ENV = 'production';
const ETHEREUM_IDENTIFIER_KIND = 0;
const EMPTY_ACCOUNT_CODE = /^0x(?:0+)?$/i;
const DEFAULT_REGISTRATION_ATTEMPTS = 8;
const DEFAULT_REGISTRATION_DELAY_MS = 500;
const SAFE_REGISTRATION_ERROR = 'XMTP setup did not finish. Sign the wallet prompts, then try again.';

export class XmtpWalletRegistrationError extends Error {
  constructor(message = SAFE_REGISTRATION_ERROR, options = {}) {
    super(message, options);
    this.name = 'XmtpWalletRegistrationError';
    this.code = 'xmtp_registration_required';
  }
}

export async function createXmtpWalletClient({ wallet, signMessage, getAccountCode, getChainId, sdkLoader = () => import('@xmtp/browser-sdk') } = {}) {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet || typeof signMessage !== 'function') throw new XmtpWalletRegistrationError('Connect the Looper owner wallet before opening XMTP.');
  try {
    const { Client } = await sdkLoader();
    if (!Client?.create) throw new Error('XMTP browser client is unavailable.');
    const identifier = { identifier: normalizedWallet, identifierKind: ETHEREUM_IDENTIFIER_KIND };
    const accountCode = typeof getAccountCode === 'function' ? String(await getAccountCode(normalizedWallet) ?? '').trim() : '0x';
    const isSmartContractWallet = accountCode !== '' && !EMPTY_ACCOUNT_CODE.test(accountCode);
    const chainId = isSmartContractWallet ? normalizeChainId(await getChainId?.()) : null;
    if (isSmartContractWallet && chainId == null) throw new Error('XMTP smart-contract wallet chain is unavailable.');
    const signer = {
      type: isSmartContractWallet ? 'SCW' : 'EOA',
      getIdentifier: () => identifier,
      async signMessage(message) { const signed = await signMessage(message); return hexToBytes(typeof signed === 'string' ? signed : signed?.signature); },
      ...(isSmartContractWallet ? { getChainId: () => chainId } : {}),
    };
    return await Client.create(signer, { env: XMTP_ENV, appVersion: 'multipass-swarm-room' });
  } catch (error) {
    if (error instanceof XmtpWalletRegistrationError) throw error;
    throw new XmtpWalletRegistrationError('XMTP room setup did not finish. Sign the wallet prompts, then try again.', { cause: error });
  }
}

export function isXmtpRegistrationRequiredError(error) {
  const message = String(error?.message ?? error ?? '');
  return /AddressNotFound|Addresses not found|not reachable on XMTP|xmtp_registration_required/i.test(message);
}

export async function ensureXmtpWalletRegistration({
  wallet,
  signMessage,
  getAccountCode,
  getChainId,
  sdkLoader = () => import('@xmtp/browser-sdk'),
  registrationAttempts = DEFAULT_REGISTRATION_ATTEMPTS,
  registrationDelayMs = DEFAULT_REGISTRATION_DELAY_MS,
  sleepImpl = sleep,
} = {}) {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet) throw new XmtpWalletRegistrationError('Connect the Looper owner wallet before setting up XMTP.');
  if (typeof signMessage !== 'function') throw new XmtpWalletRegistrationError('This wallet cannot sign the XMTP setup prompts.');

  const identifier = {
    identifier: normalizedWallet,
    identifierKind: ETHEREUM_IDENTIFIER_KIND,
  };

  try {
    const { Client } = await sdkLoader();
    if (!Client?.canMessage || !Client?.create) throw new Error('XMTP browser client is unavailable.');
    if (await canMessage(Client, identifier)) return { registered: true, created: false };

    const accountCode = typeof getAccountCode === 'function'
      ? String(await getAccountCode(normalizedWallet) ?? '').trim()
      : '0x';
    const isSmartContractWallet = accountCode !== '' && !EMPTY_ACCOUNT_CODE.test(accountCode);
    const chainId = isSmartContractWallet
      ? normalizeChainId(await getChainId?.())
      : null;
    if (isSmartContractWallet && chainId == null) {
      throw new Error('XMTP smart-contract wallet chain is unavailable.');
    }

    const signer = {
      type: isSmartContractWallet ? 'SCW' : 'EOA',
      getIdentifier: () => identifier,
      async signMessage(message) {
        const signed = await signMessage(message);
        return hexToBytes(typeof signed === 'string' ? signed : signed?.signature);
      },
      ...(isSmartContractWallet ? { getChainId: () => chainId } : {}),
    };

    const client = await Client.create(signer, {
      env: XMTP_ENV,
      appVersion: 'multipass-console',
    });
    await client?.close?.();

    const attempts = Math.max(1, Number(registrationAttempts) || DEFAULT_REGISTRATION_ATTEMPTS);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (await canMessage(Client, identifier)) return { registered: true, created: true };
      if (attempt < attempts - 1) await sleepImpl(registrationDelayMs);
    }
  } catch (error) {
    if (error instanceof XmtpWalletRegistrationError) throw error;
    throw new XmtpWalletRegistrationError(SAFE_REGISTRATION_ERROR, { cause: error });
  }

  throw new XmtpWalletRegistrationError();
}

async function canMessage(Client, identifier) {
  const result = await Client.canMessage([identifier], XMTP_ENV);
  if (result instanceof Map) return result.get(identifier.identifier) === true;
  return result?.[identifier.identifier] === true;
}

function normalizeWallet(value) {
  const wallet = String(value ?? '').trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(wallet) ? wallet : '';
}

function normalizeChainId(value) {
  try {
    const chainId = typeof value === 'bigint' ? value : BigInt(String(value ?? '').trim());
    return chainId > 0n ? chainId : null;
  } catch {
    return null;
  }
}

function hexToBytes(value) {
  const hex = String(value ?? '').trim().replace(/^0x/i, '');
  if (!hex || hex.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(hex)) {
    throw new XmtpWalletRegistrationError('The wallet returned an invalid XMTP setup signature.');
  }
  return Uint8Array.from(hex.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
