import {
  concatHex,
  encodeAbiParameters,
  getAddress,
  getCreate2Address,
  keccak256,
  sha256,
} from 'viem';

const ZERO_ADDRESS = getAddress('0x0000000000000000000000000000000000000000');
const ZERO_HASH = '0x' + '00'.repeat(32);
const CREATION_PREFIX = '0x3d60ad80600a3d3981f3';
const RUNTIME_PREFIX = '0x363d3d373d3d3d363d73';
const RUNTIME_SUFFIX = '0x5af43d82803e903d91602b57fd5bf3';

export const RESTAP_NETWORK_ACCOUNT_RELEASE = deepFreeze({
  chainId: 8453,
  collection: getAddress('0x1649CD37f4748807b4882FC48765bA0B2aFfa94a'),
  registry: getAddress('0x000000006551c19487814612e58FE06813775758'),
  implementation: getAddress('0xf192f350427c8F58bC28e78b1e6Af164279F486e'),
  salt: '0xff28549509272e76f1d1c6ef7d6976d848c5ff6cb5068b2183c8d52f4cbe2bee',
  implementationRuntimeBytes: 6096,
  implementationRuntimeSha256: '0x85adc244e07b43ac687b1ac9f4f245089678fa787adb4fdcb95d4402b0d8a43c',
  moduleRegistry: getAddress('0x4e4df0DEa80e389802f819D95AAEe4CB004D3E1a'),
  moduleRegistryRuntimeBytes: 1234,
  moduleRegistryRuntimeSha256: '0xc94fcea5df503e97852633cbe76e0ee76260595f3f25c2fdbbf99ef6aec253bb',
  controllerSource: getAddress('0x270d25D2c59A8bcA1B0f40ad95fF7806c0025c27'),
  controllerModel: 'erc721_owner',
  policy: {
    registryPaused: true,
    module: ZERO_ADDRESS,
    moduleOwner: ZERO_ADDRESS,
    epoch: '0',
    moduleRuntimeBytes: 0,
    moduleRuntimeSha256: null,
    moduleCodehash: ZERO_HASH,
    approvedModuleCodehash: ZERO_HASH,
  },
});

export function deriveReleasedAccount({ tokenId, release = RESTAP_NETWORK_ACCOUNT_RELEASE } = {}) {
  const normalizedTokenId = normalizeTokenId(tokenId);
  const creationCode = concatHex([
    CREATION_PREFIX,
    RUNTIME_PREFIX,
    getAddress(release.implementation),
    RUNTIME_SUFFIX,
    accountFooter({ tokenId: normalizedTokenId, release }),
  ]);
  return getCreate2Address({
    from: getAddress(release.registry),
    salt: release.salt,
    bytecodeHash: keccak256(creationCode),
  });
}

export function buildReleasedAccountRuntime({ tokenId, release = RESTAP_NETWORK_ACCOUNT_RELEASE } = {}) {
  return concatHex([
    RUNTIME_PREFIX,
    getAddress(release.implementation),
    RUNTIME_SUFFIX,
    accountFooter({ tokenId: normalizeTokenId(tokenId), release }),
  ]).toLowerCase();
}

export function createAccountIntegrityReader({
  providers,
  release = RESTAP_NETWORK_ACCOUNT_RELEASE,
  timeoutMs = 5_000,
  allowUndeployedAccount = false,
  maxSafeBlockSkew = 0,
  providerStaggerMs = 0,
} = {}) {
  if (!Array.isArray(providers) || providers.length < 2 || providers.some((provider) => typeof provider?.readAccountIntegrity !== 'function')) {
    throw new TypeError('Account integrity requires at least two approved providers.');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new TypeError('Account integrity timeout is invalid.');
  if (typeof allowUndeployedAccount !== 'boolean') throw new TypeError('Undeployed account policy is invalid.');
  if (!Number.isSafeInteger(maxSafeBlockSkew) || maxSafeBlockSkew < 0 || maxSafeBlockSkew > 256) throw new TypeError('Safe block skew bound is invalid.');
  if (!Number.isSafeInteger(providerStaggerMs) || providerStaggerMs < 0 || providerStaggerMs > 5_000) throw new TypeError('Provider stagger is invalid.');
  const pinnedRelease = normalizeRelease(release);

  return Object.freeze({
    async read(request = {}) {
      if (!isPlainObject(request) || Object.keys(request).length !== 1 || !Object.hasOwn(request, 'tokenId')) {
        throw new TypeError('Account integrity accepts an exact server-side request with tokenId only.');
      }
      const tokenId = normalizeTokenId(request.tokenId).toString();
      let safeBlockNumber = null;
      if (providers.every((provider) => typeof provider.readFinalizedHead === 'function')) {
        const heads = await readProviders(providers, providerStaggerMs, (provider) => timedRead(() => provider.readFinalizedHead(), timeoutMs));
        if (heads.some((outcome) => outcome.timeout)) return failure('provider_timeout');
        if (heads.some((outcome) => outcome.error)) return failure('provider_unavailable');
        try { safeBlockNumber = Math.min(...heads.map((outcome) => normalizeHead(outcome.value).number)); }
        catch { return failure('provider_unavailable'); }
      }
      const providerRequest = safeBlockNumber === null ? deepFreeze({ tokenId }) : deepFreeze({ tokenId, safeBlockNumber });
      const outcomes = await readProviders(providers, providerStaggerMs, (provider) => timedRead(
        () => provider.readAccountIntegrity(providerRequest), timeoutMs,
      ));
      if (outcomes.some((outcome) => outcome.timeout)) return failure('provider_timeout');
      if (outcomes.some((outcome) => outcome.error)) return failure('provider_unavailable');

      const normalized = [];
      for (const outcome of outcomes) {
        const checked = validateObservation(outcome.value, { tokenId, release: pinnedRelease, allowUndeployedAccount });
        if (!checked.ok) return failure(checked.status);
        normalized.push(checked.value);
      }
      const firstSafe = canonical(normalized[0].safeBlock);
      const safeDisagreement = normalized.some((value) => canonical(value.safeBlock) !== firstSafe);
      const sameSafeNumber = normalized.every((value) => value.safeBlock.number === normalized[0].safeBlock.number);
      const safeNumbers = normalized.map((value) => value.safeBlock.number);
      const safeBlockSkew = Math.max(...safeNumbers) - Math.min(...safeNumbers);
      if (safeDisagreement && (sameSafeNumber || safeBlockSkew > maxSafeBlockSkew)) return failure('safe_block_disagreement');
      const first = canonical({ ...normalized[0], safeBlock: null });
      if (normalized.some((value) => canonical({ ...value, safeBlock: null }) !== first)) return failure('provider_disagreement');
      const proof = safeDisagreement
        ? normalized.reduce((older, value) => value.safeBlock.number < older.safeBlock.number ? value : older)
        : normalized[0];
      return deepFreeze({ eligible: true, status: 'ready', proof });
    },
  });
}

function validateObservation(value, { tokenId, release, allowUndeployedAccount }) {
  try {
    if (!isPlainObject(value)) return invalid('provider_unavailable');
    const safeBlock = {
      number: normalizeBlockNumber(value.safeBlock?.number),
      hash: normalizeHash(value.safeBlock?.hash),
    };
    const expectedAccount = deriveReleasedAccount({ tokenId, release });
    const account = getAddress(value.account);
    if (account !== expectedAccount
      || getAddress(value.registryAccount) !== expectedAccount
      || getAddress(value.collectionAccount) !== expectedAccount
      || getAddress(value.collectionRegistry) !== release.registry
      || getAddress(value.collectionImplementation) !== release.implementation
      || String(value.collectionSalt).toLowerCase() !== release.salt) return invalid('binding_mismatch');

    const accountCode = normalizeCode(value.accountCode, { allowEmpty: true });
    const accountDeployed = accountCode !== '0x';
    if (!accountDeployed && !allowUndeployedAccount) return invalid('account_missing');
    if (accountDeployed) {
      const expectedAccountCode = buildReleasedAccountRuntime({ tokenId, release });
      if (accountCode !== expectedAccountCode) return invalid('proxy_mismatch');
    }

    const implementationCode = normalizeCode(value.implementationCode);
    if (byteLength(implementationCode) !== release.implementationRuntimeBytes
      || sha256(implementationCode) !== release.implementationRuntimeSha256) return invalid('implementation_mismatch');

    const accountToken = {
      chainId: normalizeChainId(value.accountToken?.chainId),
      collection: getAddress(value.accountToken?.collection),
      tokenId: normalizeTokenId(value.accountToken?.tokenId).toString(),
    };
    if (accountToken.chainId !== release.chainId || accountToken.collection !== release.collection || accountToken.tokenId !== tokenId) {
      return invalid('binding_mismatch');
    }
    const owner = getAddress(value.owner);
    const erc8004AgentId = normalizeUint(value.erc8004AgentId);
    if (erc8004AgentId === '0') return invalid('binding_mismatch');
    const accountOwner = getAddress(value.accountOwner);
    const controller = getAddress(value.controller);
    if (accountOwner !== owner) return invalid('ownership_mismatch');

    const moduleRegistry = getAddress(value.moduleRegistry);
    const moduleRegistryCode = normalizeCode(value.moduleRegistryCode);
    if (moduleRegistry !== release.moduleRegistry
      || byteLength(moduleRegistryCode) !== release.moduleRegistryRuntimeBytes
      || sha256(moduleRegistryCode) !== release.moduleRegistryRuntimeSha256) return invalid('registry_mismatch');

    const policyModule = getAddress(value.policyModule);
    const policyModuleOwner = getAddress(value.policyModuleOwner);
    const policyEpoch = normalizeUint(value.policyEpoch);
    const policyModuleCode = normalizeCode(value.policyModuleCode, { allowEmpty: true });
    const policyModuleCodehash = normalizeHash(value.policyModuleCodehash);
    const approvedModuleCodehash = normalizeHash(value.approvedModuleCodehash);
    const pinnedPolicy = release.policy;
    const moduleRuntimeSha256 = policyModuleCode === '0x' ? null : sha256(policyModuleCode);
    if (value.registryPaused !== pinnedPolicy.registryPaused
      || policyModule !== pinnedPolicy.module
      || policyModuleOwner !== pinnedPolicy.moduleOwner
      || policyEpoch !== pinnedPolicy.epoch
      || byteLength(policyModuleCode) !== pinnedPolicy.moduleRuntimeBytes
      || moduleRuntimeSha256 !== pinnedPolicy.moduleRuntimeSha256
      || policyModuleCodehash !== pinnedPolicy.moduleCodehash
      || approvedModuleCodehash !== pinnedPolicy.approvedModuleCodehash
      || (policyModule !== ZERO_ADDRESS && keccak256(policyModuleCode) !== policyModuleCodehash)) return invalid('policy_mismatch');

    const latest = { owner: getAddress(value.latest?.owner), controller: getAddress(value.latest?.controller) };
    if (latest.owner !== owner || latest.controller !== controller) return invalid('latest_authority_mismatch');

    return {
      ok: true,
      value: deepFreeze({
        chainId: release.chainId,
        collection: release.collection,
        tokenId,
        safeBlock,
        account,
        accountDeployed,
        accountCode,
        accountRuntimeSha256: accountDeployed ? sha256(accountCode) : null,
        implementation: release.implementation,
        implementationCode,
        implementationRuntimeSha256: sha256(implementationCode),
        accountToken,
        owner,
        erc8004AgentId,
        accountOwner,
        controller,
        moduleRegistry,
        moduleRegistryCode,
        moduleRegistryRuntimeSha256: sha256(moduleRegistryCode),
        policy: {
          registryPaused: value.registryPaused,
          module: policyModule,
          owner: policyModuleOwner,
          epoch: policyEpoch,
          code: policyModuleCode,
          codehash: policyModuleCodehash,
          approvedCodehash: approvedModuleCodehash,
        },
        latest,
      }),
    };
  } catch {
    return invalid('provider_unavailable');
  }
}

function normalizeRelease(release) {
  if (!isPlainObject(release)) throw new TypeError('Account release descriptor is invalid.');
  const normalized = {
    chainId: normalizeChainId(release.chainId),
    collection: getAddress(release.collection),
    registry: getAddress(release.registry),
    implementation: getAddress(release.implementation),
    salt: normalizeHash(release.salt),
    implementationRuntimeBytes: normalizePositiveInteger(release.implementationRuntimeBytes),
    implementationRuntimeSha256: normalizeHash(release.implementationRuntimeSha256),
    moduleRegistry: getAddress(release.moduleRegistry),
    moduleRegistryRuntimeBytes: normalizePositiveInteger(release.moduleRegistryRuntimeBytes),
    moduleRegistryRuntimeSha256: normalizeHash(release.moduleRegistryRuntimeSha256),
    controllerSource: getAddress(release.controllerSource),
    controllerModel: normalizeControllerModel(release.controllerModel),
    policy: normalizePolicyRelease(release.policy),
  };
  return deepFreeze(normalized);
}

function normalizeControllerModel(value) {
  if (value !== 'erc721_owner') throw new TypeError('Account controller model is invalid.');
  return value;
}

function normalizePolicyRelease(policy) {
  if (!isPlainObject(policy)) throw new TypeError('Account policy release descriptor is invalid.');
  if (typeof policy.registryPaused !== 'boolean') throw new TypeError('Policy registry pause constraint is invalid.');
  const moduleRuntimeBytes = Number(policy.moduleRuntimeBytes);
  if (!Number.isSafeInteger(moduleRuntimeBytes) || moduleRuntimeBytes < 0) throw new TypeError('Policy module runtime length is invalid.');
  const moduleRuntimeSha256 = policy.moduleRuntimeSha256 === null ? null : normalizeHash(policy.moduleRuntimeSha256);
  return deepFreeze({
    registryPaused: policy.registryPaused,
    module: getAddress(policy.module),
    moduleOwner: getAddress(policy.moduleOwner),
    epoch: normalizeUint(policy.epoch),
    moduleRuntimeBytes,
    moduleRuntimeSha256,
    moduleCodehash: normalizeHash(policy.moduleCodehash),
    approvedModuleCodehash: normalizeHash(policy.approvedModuleCodehash),
  });
}

function accountFooter({ tokenId, release }) {
  return encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }],
    [release.salt, BigInt(release.chainId), getAddress(release.collection), tokenId],
  );
}

async function readProviders(providers, staggerMs, readProvider) {
  if (staggerMs === 0) return Promise.all(providers.map(readProvider));
  const outcomes = [];
  for (const provider of providers) {
    if (outcomes.length) await new Promise((resolve) => setTimeout(resolve, staggerMs));
    outcomes.push(await readProvider(provider));
  }
  return outcomes;
}

async function timedRead(read, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(read).then((value) => ({ value }), (error) => ({ error })),
      new Promise((resolve) => { timer = setTimeout(() => resolve({ timeout: true }), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeHead(value) {
  if (!isPlainObject(value)) throw new TypeError('Invalid finalized head.');
  return { number: normalizeBlockNumber(value.number), hash: normalizeHash(value.hash) };
}

function invalid(status) { return { ok: false, status }; }
function failure(status) { return deepFreeze({ eligible: false, status, proof: null }); }
function canonical(value) { return JSON.stringify(value); }
function byteLength(code) { return (code.length - 2) / 2; }
function normalizeCode(value, { allowEmpty = false } = {}) {
  const code = String(value ?? '').toLowerCase();
  if (!/^0x(?:[0-9a-f]{2})*$/u.test(code) || (!allowEmpty && code === '0x')) throw new TypeError('Invalid runtime code.');
  return code;
}
function normalizeHash(value) {
  const hash = String(value ?? '').toLowerCase();
  if (!/^0x[0-9a-f]{64}$/u.test(hash)) throw new TypeError('Invalid hash.');
  return hash;
}
function normalizeBlockNumber(value) {
  const number = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new TypeError('Invalid block number.');
  return number;
}
function normalizePositiveInteger(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Invalid positive integer.');
  return value;
}
function normalizeChainId(value) {
  const chainId = Number(value);
  if (!Number.isSafeInteger(chainId) || chainId < 1) throw new TypeError('Invalid chain ID.');
  return chainId;
}
function normalizeUint(value) {
  const text = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  if (!/^(0|[1-9]\d*)$/u.test(text)) throw new TypeError('Invalid uint.');
  return text;
}
function normalizeTokenId(value) {
  const text = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  if (!/^[1-9]\d*$/u.test(text)) throw new TypeError('Invalid token ID.');
  const tokenId = BigInt(text);
  if (tokenId > ((1n << 256n) - 1n)) throw new TypeError('Invalid token ID.');
  return tokenId;
}
function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
