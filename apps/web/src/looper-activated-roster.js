import { readBoundedResponseBytes } from './bounded-response-body.js';

// Frozen from commit 500654a recipient reconciliation. Do not edit by hand.
export const ACTIVATED_LOOPER_ROSTER_SOURCE = Object.freeze({
  commit: '500654a',
  reconciliationSha256: '391a7ce20a883254b2164d3296533059750fe8436aa894f72e1df2f08a691b98',
  count: 328,
  observedBlock: 52_313_206,
});

export const ACTIVATED_LOOPER_TOKEN_IDS = Object.freeze([
  '11', '19', '20', '21', '32', '33', '34', '36', '46', '50', '69', '70', '79', '100', '106', '143',
  '149', '178', '191', '194', '198', '199', '201', '210', '222', '226', '227', '228', '229', '230', '235', '236',
  '237', '239', '242', '243', '244', '245', '246', '250', '252', '261', '269', '270', '271', '272', '273', '278',
  '285', '295', '312', '313', '314', '343', '344', '349', '367', '401', '402', '406', '414', '415', '416', '417',
  '418', '420', '480', '481', '491', '492', '493', '517', '524', '525', '548', '550', '558', '612', '641', '642',
  '643', '645', '664', '665', '666', '667', '668', '678', '679', '680', '794', '825', '827', '905', '906', '910',
  '912', '924', '941', '943', '1008', '1077', '1079', '1080', '1090', '1104', '1138', '1169', '1171', '1173', '1204', '1241',
  '1245', '1274', '1300', '1401', '1403', '1414', '1422', '1442', '1562', '1615', '1618', '1619', '1620', '1621', '1633', '1636',
  '1677', '1678', '1687', '1713', '1722', '1750', '1751', '1752', '1756', '1783', '1787', '1789', '1827', '1861', '1888', '1986',
  '1987', '2015', '2017', '2027', '2028', '2029', '2030', '2031', '2087', '2091', '2150', '2177', '2237', '2246', '2250', '2266',
  '2285', '2353', '2377', '2379', '2431', '2437', '2439', '2467', '2620', '2640', '2646', '2647', '2648', '2649', '2653', '2666',
  '2669', '2684', '2713', '2714', '2715', '2716', '2748', '2759', '2784', '2785', '2916', '2932', '2949', '2950', '2970', '3111',
  '3128', '3159', '3164', '3165', '3203', '3224', '3244', '3245', '3252', '3328', '3366', '3428', '3477', '3594', '3683', '3722',
  '3744', '3745', '3756', '3772', '3773', '3793', '3802', '3806', '3807', '3878', '3939', '3955', '4005', '4019', '4042', '4145',
  '4150', '4151', '4166', '4189', '4190', '4215', '4273', '4321', '4324', '4440', '4447', '4515', '4517', '4523', '4524', '4552',
  '4553', '4559', '4560', '4695', '4701', '4704', '4706', '4783', '4849', '4852', '4874', '4990', '4991', '5000', '5006', '5358',
  '5787', '5843', '5956', '5981', '6026', '6029', '6031', '6049', '6069', '6083', '6267', '6362', '6366', '6387', '6404', '6406',
  '6414', '6534', '6638', '6789', '6808', '6855', '6884', '7279', '7441', '7445', '7449', '7453', '7457', '7461', '7465', '7469',
  '7473', '7477', '7478', '7481', '7485', '7489', '7493', '7497', '7499', '7501', '7505', '7509', '7513', '7517', '7519', '7521',
  '7525', '7529', '7533', '7537', '7541', '7545', '7549', '7553', '7557', '7561', '7565', '7569', '7573', '7577', '7581', '7585',
  '7589', '7593', '7597', '7601', '7605', '7609', '7613', '7617',
]);

export function loadPinnedActivatedLooperTokenIds() {
  return { status: 'available', source: 'pinned-verified-snapshot', observedBlock: ACTIVATED_LOOPER_ROSTER_SOURCE.observedBlock, tokenIds: new Set(ACTIVATED_LOOPER_TOKEN_IDS) };
}

const DAILY_ROSTER_PATH = '/multipass/data/looper-activated-roster.json';
const DAILY_ROSTER_MAX_BYTES = 128_000;
const LOOPERS_CONTRACT = '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a';
const RELEASED_IMPLEMENTATION = '0xf192f350427c8F58bC28e78b1e6Af164279F486e';

export async function loadDailyActivatedLooperTokenIds({ fetchImpl = globalThis.fetch, signal } = {}) {
  const unavailable = () => ({ status: 'unavailable', tokenIds: new Set() });
  if (typeof fetchImpl !== 'function' || signal?.aborted) return unavailable();
  try {
    const response = await fetchImpl(DAILY_ROSTER_PATH, {
      method: 'GET', credentials: 'omit', cache: 'no-store', headers: { accept: 'application/json' }, signal,
    });
    if (!response?.ok) return unavailable();
    const bytes = await readBoundedResponseBytes(response, { maxBytes: DAILY_ROSTER_MAX_BYTES, signal });
    const rawSha256 = await sha256Hex(bytes);
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!isExactDailyRoster(value)) return unavailable();
    return {
      status: 'available',
      source: 'daily-onchain-snapshot',
      rawSha256,
      observedBlock: value.observed_block,
      observedAt: value.observed_at,
      tokenIds: new Set(value.token_ids),
    };
  } catch {
    return unavailable();
  }
}

export async function loadVerifiedActivatedLooperFallback(options = {}) {
  const daily = await loadDailyActivatedLooperTokenIds(options);
  return daily.status === 'available' ? daily : loadPinnedActivatedLooperTokenIds();
}

async function sha256Hex(bytes) {
  if (!(bytes instanceof Uint8Array) || !globalThis.crypto?.subtle) throw new Error('Roster hashing unavailable.');
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function isExactDailyRoster(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const expectedKeys = ['chain_id', 'contract', 'count', 'implementation', 'observed_at', 'observed_block', 'schema_version', 'token_ids'];
  if (Object.keys(value).sort().join('\0') !== expectedKeys.join('\0')
    || value.schema_version !== '1.0.0'
    || value.chain_id !== 8453
    || value.contract !== LOOPERS_CONTRACT
    || value.implementation !== RELEASED_IMPLEMENTATION
    || !Number.isSafeInteger(value.observed_block) || value.observed_block < ACTIVATED_LOOPER_ROSTER_SOURCE.observedBlock
    || typeof value.observed_at !== 'string' || Number.isNaN(Date.parse(value.observed_at)) || new Date(value.observed_at).toISOString() !== value.observed_at
    || !Number.isSafeInteger(value.count) || value.count < ACTIVATED_LOOPER_ROSTER_SOURCE.count || value.count > 7_777
    || !Array.isArray(value.token_ids) || value.token_ids.length !== value.count) return false;
  let prior = 0n;
  const tokenIds = new Set();
  for (const tokenId of value.token_ids) {
    if (typeof tokenId !== 'string' || !/^[1-9][0-9]*$/u.test(tokenId)) return false;
    const parsed = BigInt(tokenId);
    if (parsed <= prior || parsed > 7_777n) return false;
    prior = parsed;
    tokenIds.add(tokenId);
  }
  return ACTIVATED_LOOPER_TOKEN_IDS.every((tokenId) => tokenIds.has(tokenId));
}
