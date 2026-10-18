import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import test from 'node:test';

import { bindConsoleAvatarFallbacks, captureConsoleInteractionState, createApp, getConsoleMessageIdentity, restoreConsoleInteractionState } from '../src/app.js';
import * as appModule from '../src/app.js';
import { HelixaResolverError } from '../src/live-helixa-resolver.js';
import { createMultipassConsoleSnapshot, renderMultipassConsole } from '../src/multipass-console.js';
import { isSafeMultipassSharePath } from '../src/save-panel.js';

const NAKAMIGO_2432_IMAGE = 'https://assets.bueno.art/images/3b04f823-b7a8-4965-b61e-8fe8a5d82bde/default/2432';
const NORMIES_4354_IMAGE = 'https://api.normies.art/agents/image/4354';

test('exact Looper marketplace routes bypass AgentDNA/demo loading and preserve other routes', async () => {
  for (const [path, expected] of [['/multipass/the-loop', 'The Loop'], ['/multipass/the-loop/617', 'Looper #617']]) {
    const root = setupDom('https://helixa.xyz' + path);
    let demoCalls = 0;
    const app = createApp({
      root,
      loadDemo: async () => { demoCalls += 1; throw new Error('AgentDNA/demo loader must not run'); },
      releasedLooperLoader: async () => ({ status: 'available', tokenIds: new Set(['617']) }),
      marketplaceListingsLoader: async () => ({
        schema_version: '1.0.0', collection: 'loopers-639312714',
        contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a', status: 'fresh',
        observed_at: '2026-10-08T14:00:00.000Z', listings: [],
      }),
      marketplaceHoldingsLoader: async () => ({ status: 'unavailable' }),
    });
    await app.start();
    assert.equal(demoCalls, 0);
    assert.match(root.textContent, new RegExp(expected));
  }

  const root = setupDom('https://helixa.xyz/multipass/agents');
  const app = createApp({ root, loadDemo: async () => sampleData() });
  await app.start();
  assert.match(root.textContent, /Public agents|Agent gallery/i);
});

test('Looper detail uses the shared verified wallet snapshot and main Multipass profile header', async () => {
  const root = setupDom('https://helixa.xyz/multipass/the-loop/617');
  let walletCalls = 0;
  const sha256 = 'd'.repeat(64);
  const app = createApp({
    root,
    releasedLooperLoader: async () => ({ status: 'available', tokenIds: new Set(['617']) }),
    marketplaceListingsLoader: async () => ({ schema_version: '1.0.0', collection: 'loopers-639312714', contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a', status: 'fresh', observed_at: '2026-10-08T14:00:00.000Z', listings: [] }),
    marketplaceActivationRosterLoader: async () => ({ status: 'available', source: 'daily-onchain-snapshot', rawSha256: sha256, tokenIds: new Set(['617']) }),
    marketplaceWalletValuesLoader: async () => {
      walletCalls += 1;
      return { status: 'available', valuationStatus: 'available', snapshotStatus: 'fresh', roster: { sha256 }, block: { number: 52_500_100, hash: '0x' + 'a'.repeat(64), observedAt: '2026-10-12T01:00:00.000Z' }, generatedAt: '2026-10-12T01:00:01.000Z', rows: [{ status: 'available', tokenId: '617', account: '0x36f35F7E0Ff5b7b4a30138Fd59F5741743389DF2', ethWei: '1000000000000000000', liquidCredBaseUnits: '2000000000000000000', stakedCredBaseUnits: '3000000000000000000', totalUsdE8: '1234500000' }] };
    },
  });
  await app.start();
  assert.equal(walletCalls, 1);
  assert.match(root.querySelector('.header-meta')?.textContent ?? '', /Activated Multipass · 8453:617/u);
  const holdingsText = root.querySelector('[data-looper-profile-drawer="wallet-holdings"]')?.textContent ?? '';
  assert.match(holdingsText, /1 ETH/u);
  assert.match(holdingsText, /2 CRED/u);
  assert.match(holdingsText, /3 CRED/u);
  assert.match(holdingsText, /\$12.34/u);
  assert.match(root.textContent, /Wallet verified/u);
});

test('Looper marketplace search preserves focus and selection through multi-digit DOM input', async () => {
  const root = setupDom('https://helixa.xyz/multipass/the-loop');
  const app = createApp({
    root,
    releasedLooperLoader: async () => ({ status: 'available', tokenIds: new Set(['617']) }),
    marketplaceListingsLoader: async () => ({
      schema_version: '1.0.0', collection: 'loopers-639312714',
      contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a', status: 'fresh',
      observed_at: '2026-10-08T14:00:00.000Z',
      listings: [{ token_id: '617', price: { currency: 'ETH', amount: '1', base_units: '1000000000000000000', decimals: 18 }, item_url: 'https://opensea.io/assets/base/0x1649cd37f4748807b4882fc48765ba0b2affa94a/617' }],
    }),
  });
  await app.start();

  for (const value of ['6', '61', '617']) {
    const input = root.querySelector('[data-marketplace-search]');
    input.focus();
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    const replacement = root.querySelector('[data-marketplace-search]');
    assert.equal(root.ownerDocument.activeElement, replacement);
    assert.equal(replacement.value, value);
    assert.equal(replacement.selectionStart, value.length);
    assert.equal(replacement.selectionEnd, value.length);
  }
  assert.match(root.querySelector('.looper-marketplace-grid')?.textContent ?? '', /Looper #617/);
});

test('Looper marketplace timeout renders unavailable listing metrics and retries successfully', async () => {
  const root = setupDom('https://helixa.xyz/multipass/the-loop');
  let attempts = 0;
  const app = createApp({
    root, marketplaceTimeoutMs: 5,
    releasedLooperLoader: async () => ({ status: 'available', tokenIds: new Set(['617']) }),
    marketplaceListingsLoader: ({ signal }) => {
      attempts += 1;
      if (attempts > 1) return Promise.resolve({
        schema_version: '1.0.0', collection: 'loopers-639312714', contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a',
        status: 'fresh', observed_at: '2026-10-08T14:00:00.000Z', listings: [],
      });
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    },
  });
  await app.start();

  const metrics = root.querySelector('.looper-marketplace-metrics')?.textContent ?? '';
  assert.match(metrics, /Activated1/);
  assert.match(metrics, /Listed activatedUnavailable/);
  assert.match(metrics, /Activated floorUnavailable/);
  const retry = root.querySelector('[data-action="retry-looper-marketplace"]');
  assert.ok(retry);
  retry.click();
  await flushAsyncEvents(20);
  assert.equal(attempts, 2);
  assert.doesNotMatch(root.textContent, /Marketplace listings unavailable/);
});

test('Looper marketplace ignores stale completion after a newer refresh', async () => {
  const root = setupDom('https://helixa.xyz/multipass/the-loop');
  let firstResolve;
  let listingCalls = 0;
  const makeFeed = (tokenId) => ({
    schema_version: '1.0.0', collection: 'loopers-639312714', contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a',
    status: 'fresh', observed_at: '2026-10-08T14:00:00.000Z',
    listings: [{ token_id: tokenId, price: { currency: 'ETH', amount: '1', base_units: '1', decimals: 18 }, item_url: 'https://opensea.io/assets/base/0x1649cd37f4748807b4882fc48765ba0b2affa94a/' + tokenId }],
  });
  const app = createApp({
    root, marketplaceTimeoutMs: 1_000,
    releasedLooperLoader: async () => ({ status: 'available', tokenIds: new Set(['617', '812']) }),
    marketplaceListingsLoader: () => {
      listingCalls += 1;
      if (listingCalls === 1) return new Promise((resolve) => { firstResolve = resolve; });
      return Promise.resolve(makeFeed('812'));
    },
  });

  const start = app.start();
  await flushAsyncEvents();
  await app.refreshLooperMarketplace();
  assert.match(root.querySelector('.looper-marketplace-grid')?.textContent ?? '', /Looper #812/);
  firstResolve(makeFeed('617'));
  await start;
  await flushAsyncEvents();
  assert.match(root.querySelector('.looper-marketplace-grid')?.textContent ?? '', /Looper #812/);
  assert.doesNotMatch(root.querySelector('.looper-marketplace-grid')?.textContent ?? '', /Looper #617/);
});

test('Console RESTAP network integration aborts stale selection reads and binds owner actions', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /consoleRestapNetworkAbortController\?\.abort\(\)/);
  assert.match(source, /clearConsoleRestapNetworkSelection/);
  assert.match(source, /activeRestapNetworkApi\.getPolicy/);
  assert.doesNotMatch(source, /activeRestapNetworkApi\.(?:listIntents|createIntent|deleteIntent)/);
  assert.match(source, /saveConsoleRestapNetworkPolicy/);
  assert.match(source, /activeRestapNetworkApi\.sendTalk/);
  assert.match(source, /sendConsoleRestapNetworkTalk/);
  assert.match(source, /stopConsoleRestapNetwork/);
});

test('Console loads only RESTAP policy and never touches legacy intents', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let resolvePolicy;
  const pendingPolicy = new Promise((resolve) => { resolvePolicy = resolve; });
  const restap = createConsoleRestapApiFixture({ getPolicy: () => pendingPolicy });
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }), consoleRestapNetworkApi: restap.api,
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(20);
  assert.equal(restap.calls.filter(([name]) => name === 'getPolicy').length, 1);
  assert.equal(restap.calls.some(([name]) => ['listIntents', 'createIntent', 'deleteIntent'].includes(name)), false);
  resolvePolicy(createConsoleRestapPolicyResponse('617'));
  await flushAsyncEvents(20);
  assert.equal(restap.calls.some(([name]) => ['listIntents', 'createIntent', 'deleteIntent'].includes(name)), false);
});

test('Console session clearing drops owner-scoped RESTAP policy state', () => {
  assert.equal(typeof appModule.clearConsoleSessionState, 'function');
  const cleared = appModule.clearConsoleSessionState({
    consoleSessionGeneration: 4,
    consoleRestapNetwork: {
      status: 'ready', selectedTokenId: '617', requestId: 9,
      policy: { tokenId: '617', networkEnabled: true }, sendResult: { reply: 'private reply' }, error: null,
    },
  }, { walletSnapshot: { connected: true, address: '0x2222222222222222222222222222222222222222' } });
  assert.equal(cleared.consoleRestapNetwork.status, 'idle');
  assert.equal(cleared.consoleRestapNetwork.selectedTokenId, null);
  assert.equal(cleared.consoleRestapNetwork.policy, null);
  assert.equal(cleared.consoleRestapNetwork.sendResult, null);
});

test('Console RESTAP forms invoke save send stop and refresh through real DOM bindings', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const restap = createConsoleRestapApiFixture();
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }), consoleRestapNetworkApi: restap.api,
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(30);
  root.querySelector('[data-console-view="network"]')?.click(); await flushAsyncEvents();

  let form = root.querySelector('[data-restap-network-policy]');
  assert.ok(form);
  form.elements.namedItem('network_enabled').checked = true;
  form.elements.namedItem('inbound_enabled').checked = true;
  form.elements.namedItem('daily_initiated_conversation_limit').value = '4';
  form.elements.namedItem('daily_generated_message_limit').value = '9';
  form.elements.namedItem('per_peer_daily_limit').value = '2';
  form.elements.namedItem('topic:general').checked = true;
  form.elements.namedItem('allow_peer_token_ids').value = '2, 3';
  form.elements.namedItem('block_peer_token_ids').value = '4';
  form.elements.namedItem('mute_until').value = '2026-10-04T00:00';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  const save = restap.calls.find(([name]) => name === 'putPolicy')?.[1];
  assert.deepEqual(save.policy, { expected_policy_version: 3, network_enabled: true, inbound_enabled: true, autonomous_initiation_enabled: false, daily_initiated_conversation_limit: 4, daily_generated_message_limit: 9, per_peer_daily_limit: 2, topics: ['general'], allow_peer_token_ids: ['2', '3'], block_peer_token_ids: ['4'], mute_until: '2026-10-04T00:00:00.000Z' });
  assert.equal(save.csrfToken, 'test-csrf');
  assert.equal(typeof save.signal?.aborted, 'boolean');

  form = root.querySelector('[data-restap-network-send]');
  form.elements.namedItem('recipient_token_id').value = '3802';
  form.elements.namedItem('topic').value = 'general';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  const sent = restap.calls.find(([name]) => name === 'sendTalk')?.[1];
  assert.equal(sent.recipientTokenId, '3802');
  assert.equal(sent.topic, 'general');
  assert.match(sent.idempotencyKey, /^console-send-/u);
  assert.equal(typeof sent.signal?.aborted, 'boolean');
  assert.match(root.querySelector('[data-restap-send-result]')?.textContent ?? '', /Bounded reply/);

  const previousConfirm = globalThis.confirm;
  globalThis.confirm = () => true;
  try {
    root.querySelector('[data-action="stop-restap-network"]')?.click();
    await flushAsyncEvents(20);
  } finally {
    globalThis.confirm = previousConfirm;
  }
  const stopped = restap.calls.find(([name]) => name === 'stop')?.[1];
  assert.equal(stopped.expectedPolicyVersion, 3);
  assert.equal(typeof stopped.signal?.aborted, 'boolean');

  const getCount = restap.calls.filter(([name]) => name === 'getPolicy').length;
  const conflict = Object.assign(new Error('private conflict details'), { status: 409, code: 'version_conflict' });
  restap.api.putPolicy = async (input) => { restap.calls.push(['putPolicyConflict', input]); throw conflict; };
  form = root.querySelector('[data-restap-network-policy]');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.ok(root.querySelector('[data-action="refresh-restap-network"]'));
  root.querySelector('[data-action="refresh-restap-network"]').click();
  await flushAsyncEvents(20);
  assert.equal(restap.calls.filter(([name]) => name === 'getPolicy').length, getCount + 1);
});

test('Hide chat locally preserves loaded RESTAP controls', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const restap = createConsoleRestapApiFixture();
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }), consoleRestapNetworkApi: restap.api,
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(30);
  root.querySelector('[data-console-view="network"]')?.click(); await flushAsyncEvents();
  assert.match(root.querySelector('.console-restap-network')?.textContent ?? '', /Looper #617 network/);
  app.resetConsoleSession();
  assert.match(root.querySelector('.console-restap-network')?.textContent ?? '', /Looper #617 network/);
  assert.doesNotMatch(root.querySelector('.console-restap-network')?.textContent ?? '', /Loading/);
});

test('Looper selection aborts an in-flight RESTAP mutation and suppresses its stale reload', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let resolveSave;
  const pendingSave = new Promise((resolve) => { resolveSave = resolve; });
  const restap = createConsoleRestapApiFixture({ putPolicy: () => pendingSave });
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }), consoleRestapNetworkApi: restap.api,
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(30);
  root.querySelector('[data-console-view="network"]')?.click(); await flushAsyncEvents();
  root.querySelector('[data-restap-network-policy]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  const save = restap.calls.find(([name]) => name === 'putPolicy')?.[1];
  assert.equal(typeof save.signal?.aborted, 'boolean');
  await app.selectConsoleAgentById('812');
  assert.equal(save.signal.aborted, true);
  resolveSave(createConsoleRestapPolicyResponse('617'));
  await flushAsyncEvents(20);
  assert.equal(restap.calls.filter(([name, input]) => name === 'getPolicy' && input.tokenId === '617').length, 1);
});

test('Console session boundary aborts an in-flight RESTAP mutation', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let resolveSend;
  const pendingSend = new Promise((resolve) => { resolveSend = resolve; });
  const restap = createConsoleRestapApiFixture({ sendTalk: () => pendingSend });
  const walletClient = createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } });
  const app = createApp({
    root, loadDemo: async () => sampleData(), walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }), consoleRestapNetworkApi: restap.api,
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(30);
  root.querySelector('[data-console-view="network"]')?.click(); await flushAsyncEvents();
  const form = root.querySelector('[data-restap-network-send]');
  form.elements.namedItem('recipient_token_id').value = '3802';
  form.elements.namedItem('topic').value = 'general';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  const sent = restap.calls.find(([name]) => name === 'sendTalk')?.[1];
  walletClient.setSnapshot({ connected: true, address: '0x2222222222222222222222222222222222222222', label: 'other' }, { notify: true });
  assert.equal(sent.signal.aborted, true);
  resolveSend(createConsoleRestapTalkResponse());
  await flushAsyncEvents(20);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '');
});

test('default Looper wallet controller rechecks the actual wallet provider chain before send', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /getWalletChainId:\s*\(\)\s*=>\s*activeWalletClient\.request\(\{\s*method:\s*['"]eth_chainId['"]\s*\}\)/);
});

function sampleData() {
  return {
    profile: {
      display_name: 'Bendr 2.0',
      multipass_id: 'mp_bendr_2',
      slug: 'bendr-2',
      status: 'link_ready',
      subject_type: 'agent',
      cred_summary: { trust_state: 'established', public_note: 'Cred score 80 imported from Helixa API.' },
    },
    fragments: {
      subject_id: 'bendr-2',
      private_fragments: [{ fragment_id: 'frag_bendr_unexpected_private_field', visibility: 'private' }],
      fragments: [
        {
          fragment_id: 'frag_bendr_profile',
          fragment_type: 'attestation',
          status: 'verified',
          assurance_level: 'platform_verified',
          visibility: 'public',
          transfer_policy: 'historical_on_transfer',
          source: { source_type: 'platform_check', issuer: 'Helixa' },
          public_value: 'Bendr profile checked by Helixa record.',
        },
        {
          fragment_id: 'frag_bendr_endpoint',
          fragment_type: 'endpoint',
          status: 'pending',
          assurance_level: 'self_attested',
          visibility: 'public',
          transfer_policy: 'reverify_on_transfer',
          source: { source_type: 'owner_submission', issuer: null },
          public_value: 'Bendr endpoint awaiting live verification.',
          endpoint_ref: { protocol: 'api' },
        },
        {
          fragment_id: 'frag_bendr_standard_ref',
          fragment_type: 'standard_ref',
          status: 'stale',
          assurance_level: 'issuer_attested',
          visibility: 'public',
          transfer_policy: 'pause_on_transfer',
          source: { source_type: 'issuer_attestation', issuer: 'Helixa' },
          public_value: 'Adapter reference needs a fresh check.',
        },
        {
          fragment_id: 'frag_bendr_receipt_history',
          fragment_type: 'receipt',
          status: 'historical',
          assurance_level: 'issuer_attested',
          visibility: 'public',
          transfer_policy: 'historical_on_transfer',
          source: { source_type: 'payment_receipt', issuer: 'Helixa' },
          public_value: 'Receipt evidence retained as history.',
        },
        {
          fragment_id: 'frag_bendr_route_dispute',
          fragment_type: 'verification_result',
          status: 'disputed',
          assurance_level: 'unverified',
          visibility: 'public',
          transfer_policy: 'never_transfer',
          source: { source_type: 'platform_check', issuer: 'Helixa' },
          public_value: 'Route claim intentionally marked disputed in the record.',
        },
        {
          fragment_id: 'frag_bendr_helixa_identity',
          fragment_type: 'attestation',
          status: 'verified',
          assurance_level: 'onchain_verified',
          visibility: 'public',
          transfer_policy: 'historical_on_transfer',
          source: { source_type: 'contract_read', issuer: 'Helixa' },
          public_value: 'Helixa AgentDNA token #1 on Base, contract 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60.',
        },
        {
          fragment_id: 'frag_bendr_cred_score',
          fragment_type: 'risk_summary',
          status: 'verified',
          assurance_level: 'platform_verified',
          visibility: 'public',
          transfer_policy: 'reverify_on_transfer',
          source: { source_type: 'registry_import', issuer: 'Helixa' },
          public_value: 'Cred score 80, Preferred tier, imported from Helixa API.',
        },
        {
          fragment_id: 'frag_quigbot_identity',
          fragment_type: 'attestation',
          status: 'verified',
          assurance_level: 'platform_verified',
          visibility: 'public',
          transfer_policy: 'historical_on_transfer',
          source: { source_type: 'platform_check', issuer: 'Helixa' },
          public_value: 'Quigbot identity checked by Helixa record.',
        },
        {
          fragment_id: 'frag_quigbot_cred',
          fragment_type: 'risk_summary',
          status: 'verified',
          assurance_level: 'platform_verified',
          visibility: 'public',
          transfer_policy: 'reverify_on_transfer',
          source: { source_type: 'registry_import', issuer: 'Helixa' },
          public_value: 'Quigbot Cred score 75, Prime tier.',
        },
        {
          fragment_id: 'frag_helixa_swarm_roster',
          fragment_type: 'custody_record',
          status: 'verified',
          assurance_level: 'platform_verified',
          visibility: 'public',
          transfer_policy: 'pause_on_transfer',
          source: { source_type: 'platform_check', issuer: 'Helixa' },
          public_value: 'Parent Multipass manages Bendr 2.0, Quigbot, Helixa, Phantom Relay, and Nox as one public swarm roster.',
        },
        {
          fragment_id: 'frag_helixa_swarm_tools',
          fragment_type: 'endpoint',
          status: 'pending',
          assurance_level: 'self_attested',
          visibility: 'public',
          transfer_policy: 'pause_on_transfer',
          source: { source_type: 'owner_submission', issuer: 'Helixa' },
          public_value: 'Shared tool policy context for routes, permissions, and approvals across the swarm.',
          endpoint_ref: { protocol: 'api' },
        },
        {
          fragment_id: 'frag_helixa_swarm_cred',
          fragment_type: 'risk_summary',
          status: 'verified',
          assurance_level: 'platform_verified',
          visibility: 'public',
          transfer_policy: 'reverify_on_transfer',
          source: { source_type: 'registry_import', issuer: 'Helixa' },
          public_value: "Aggregate Cred context summarizes the roster without erasing each agent's individual profile.",
        },
        { fragment_id: 'frag_bendr_private_placeholder', visibility: 'private' },
      ],
    },
    card: { capabilities: [{}], service_endpoints: [{}], trust_summary: { identity_status: 'verified', assurance_level: 'onchain_verified', last_updated_at: '2026-06-24T22:49:52Z' } },
    agentCards: [
      { name: 'Bendr 2.0', tokenId: 1, helixaId: '8453:1', framework: 'openclaw', credScore: 80, credTier: 'Preferred', verified: true, profileUrl: 'https://helixa.xyz/agent/1', proofFragmentIds: ['frag_bendr_profile', 'frag_bendr_endpoint', 'frag_bendr_standard_ref', 'frag_bendr_receipt_history', 'frag_bendr_route_dispute', 'frag_bendr_helixa_identity', 'frag_bendr_cred_score'], ownerSnapshot: { owner: '0x3395...480E0', operator: 'Bendr runtime', custodyEpoch: 'Epoch 01', permissionState: 'Active owner-approved routes', visibility: 'Public profile, private credentials hidden', recentChange: 'Cred import refreshed', reviewAction: 'Review stale standards reference' }, changeReviewLedger: [
        { event: 'Cred import refreshed', source: 'Helixa API', impact: 'Cred context updated', reviewState: 'Verified' },
        { event: 'Standards reference stale', source: 'Standards profile', impact: 'Adapter claim needs a fresh check', reviewState: 'Reverify' },
        { event: 'Private credentials hidden', source: 'Private vault', impact: 'No public data exposed', reviewState: 'No public action' },
      ] },
      { name: 'Quigbot', tokenId: 81, helixaId: '8453:81', framework: 'openclaw', credScore: 75, credTier: 'Prime', verified: true, profileUrl: 'https://helixa.xyz/agent/81', visual: { imageUrl: NAKAMIGO_2432_IMAGE, label: 'Nakamigo #2432 visual identity', tone: 'prime' }, proofFragmentIds: ['frag_quigbot_identity', 'frag_quigbot_cred'] },
      { name: 'Helixa Swarm', tokenId: 'swarm:helixa', helixaId: '8453:swarm:helixa', framework: 'multi-agent', credScore: 78, credTier: 'Prime', verified: true, profileUrl: 'https://helixa.xyz/swarm/helixa', subjectType: 'swarm', members: 5, role: 'Parent Multipass', custody: 'Custody epoch ready', proofFragmentIds: ['frag_helixa_swarm_roster', 'frag_helixa_swarm_tools', 'frag_helixa_swarm_cred'], roster: [{ name: 'Bendr 2.0', role: 'Lead Agent / Trust Router' }, { name: 'Quigbot', role: 'Product / Strategy Agent' }, { name: 'Helixa', role: 'Protocol / Identity Agent' }, { name: 'Phantom Relay', role: 'Routing / Relay Agent' }, { name: 'Nox', role: 'Ops / Safety Agent' }], sharedControls: ['Tool approvals', 'Route policy', 'Owner approval'], aggregateCred: 'Cred 78 Prime summarizes the roster without replacing individual agent scores.', transferBehavior: 'Permissions pause and tool routes reverify when custody changes.', transferPreview: { currentOwner: '0x3395...480E0', custodyEpoch: 'Epoch 03', claimAction: 'Claim swarm', permissionsState: 'Permissions paused', toolAction: 'Reverify shared tools', privateAccessAction: 'Rotate private access', historyState: 'History preserved', credContinuity: 'Cred continues with ownership-change context.' }, ownerSnapshot: { owner: '0x3395...480E0', operator: 'Helixa ops', custodyEpoch: 'Epoch 03', permissionState: 'Paused until owner review', visibility: 'Public profile, gated private data', recentChange: 'Transfer detected 2026-06-24', reviewAction: 'Reverify routes before resume' }, changeReviewLedger: [
        { event: 'Cred import refreshed', source: 'Helixa API', impact: 'Aggregate Cred context updated', reviewState: 'Verified' },
        { event: 'Transfer detected', source: 'Owner registry', impact: 'Permissions paused', reviewState: 'Review required' },
        { event: 'Shared route policy changed', source: 'Policy reference', impact: 'Routes paused for recheck', reviewState: 'Paused' },
        { event: 'Standards reference stale', source: 'Standards profile', impact: 'Adapter claim needs a fresh check', reviewState: 'Reverify' },
        { event: 'Private credentials hidden', source: 'Private vault', impact: 'No secrets or private credentials exposed', reviewState: 'No public action' },
      ] },
    ],
    standards: { standard_refs: [{ standard_id: 'ERC-8004', status: 'adapter_ready' }] },
    x402: { endpoints: [{ endpoint_id: 'lookup', asset: 'CRED' }] },
    receipt: { receipt_id: 'receipt_bendr_lookup', status: 'settled', response_class: 'success' },
    routes: {},
  };
}

function okxMarketplacePresence(overrides = {}) {
  const base = {
    marketplace: 'OKX.AI',
    listingId: '1965',
    profileUrl: 'https://www.okx.ai/agents/1965',
    status: 'public_metadata',
    source: {
      label: 'Public marketplace metadata',
      url: 'https://www.okx.ai/agents/1965',
      checkedAt: '2026-07-05T21:45:02Z',
      provenance: 'public marketplace metadata',
    },
    services: [
      {
        name: 'CertiK Security APIs',
        price: '0.001 USDT',
        paymentMode: 'x402 marketplace checkout',
        endpointUrl: 'https://skills-for-okx.certik.com/api/services',
      },
    ],
    paymentRails: [
      { asset: 'USDT', mode: 'x402 marketplace checkout', chain: 'X Layer 196' },
    ],
    reputation: { score: '5.0', positiveRate: '100%', soldCount: '53', reviewCount: '1' },
    facts: [{ label: 'Marketplace/payment chain', value: 'X Layer 196' }],
  };
  return {
    ...base,
    ...overrides,
    source: { ...base.source, ...(overrides.source ?? {}) },
    proof: overrides.proof,
    services: overrides.services ?? base.services,
    paymentRails: overrides.paymentRails ?? base.paymentRails,
    reputation: { ...base.reputation, ...(overrides.reputation ?? {}) },
    facts: overrides.facts ?? base.facts,
  };
}

function samplePublicTools() {
  return {
    schema_version: '0.1.0',
    multipass_id: 'mp_helixa_agent_1',
    tools: [
      {
        fragment_id: 'frag_tool_bendr_lookup',
        multipass_id: 'mp_helixa_agent_1',
        tool_id: 'bendr-lookup',
        registry: 'bankr_x402_cloud',
        name: 'Bendr x402 profile lookup',
        description: 'Looks up public Multipass profile context.',
        endpoint_url: 'https://api.bankr.example/tools/bendr/lookup',
        manifest_url: 'https://api.bankr.example/tools/bendr/lookup/manifest.json',
        pricing: { model: 'fixed', amount: '0.02', asset: 'USDC', chain_id: 8453 },
        schemas: { input_summary: 'Multipass slug or Helixa ID.', output_summary: 'Public profile JSON.' },
        verifiability: { tier: 'provider_verified', summary: 'Imported from Bankr x402 Cloud.' },
        status: 'verified',
        assurance_level: 'platform_verified',
        visibility: 'public',
        last_checked_at: '2026-06-24T00:05:00Z',
      },
    ],
  };
}

function setupDom(url = 'http://localhost/') {
  const dom = new JSDOM('<!doctype html><main id="app"></main>', { url });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  return dom.window.document.querySelector('#app');
}

async function flushAsyncEvents(count = 8) {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}

function createMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key) ?? null; },
  };
}

function captureInnerHtmlWrites(element) {
  const descriptor = Object.getOwnPropertyDescriptor(element.ownerDocument.defaultView.Element.prototype, 'innerHTML');
  const writes = [];
  Object.defineProperty(element, 'innerHTML', {
    configurable: true,
    get() { return descriptor.get.call(element); },
    set(value) {
      writes.push(String(value));
      descriptor.set.call(element, value);
    },
  });
  return writes;
}

function openConsoleWallet(root) {
  const button = root.querySelector('[data-action="set-console-workspace-view"][data-console-view="wallet"]');
  assert.ok(button, 'selected agent must expose the Wallet workspace control');
  assert.equal(button.disabled, false, `Wallet workspace control stayed disabled: ${button.outerHTML}`);
  button.click();
  const workspace = root.querySelector('.console-wallet-workspace');
  assert.ok(workspace, 'Wallet workspace must open after its Console control is clicked');
  return workspace;
}

async function flushHomepagePrefetch() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushAsyncEvents(20);
}

async function savedProfileFetch(url) {
  const value = String(url);
  if (value.endsWith('/hydrated')) {
    return new Response('missing', { status: 404 });
  }
  if (value.endsWith('/api/multipass/bendr-2-1')) {
    return new Response(JSON.stringify({
      ...sampleData().profile,
      display_name: 'Saved Bendr',
      slug: 'bendr-2-1',
      multipass_id: 'mp_helixa_agent_1',
      status: 'active',
      owner_summary: {
        owner_state: 'unclaimed',
        verification_status: 'unclaimed',
        summary: 'Saved unclaimed profile. Management is unclaimed.',
      },
    }), { status: 200 });
  }
  if (String(url).endsWith('/fragments')) return new Response(JSON.stringify({ multipass_id: 'mp_helixa_agent_1', fragments: [] }), { status: 200 });
  if (String(url).endsWith('/card') || String(url).endsWith('/agent-card')) return new Response(JSON.stringify({ ...sampleData().card, multipass_id: 'mp_helixa_agent_1', name: 'Saved Bendr' }), { status: 200 });
  if (String(url).endsWith('/standards')) return new Response(JSON.stringify(sampleData().standards), { status: 200 });
  if (String(url).endsWith('/x402')) return new Response(JSON.stringify(sampleData().x402), { status: 200 });
  if (String(url).endsWith('/tools')) return new Response(JSON.stringify(samplePublicTools()), { status: 200 });
  if (String(url).endsWith('/changes')) return new Response(JSON.stringify({ multipass_id: 'mp_helixa_agent_1', entries: [{ message: 'Multipass saved from live public source record.' }] }), { status: 200 });
  throw new Error(`Unexpected URL ${url}`);
}

async function savedProfileNoToolsFetch(url) {
  if (String(url).endsWith('/tools')) {
    return new Response(JSON.stringify({ schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', tools: [] }), { status: 200 });
  }
  return savedProfileFetch(url);
}

async function savedZoriProfileFetch(url) {
  const value = String(url);
  if (value.endsWith('/hydrated')) {
    return new Response('missing', { status: 404 });
  }
  if (value.endsWith('/api/multipass/zori-4354')) {
    return new Response(JSON.stringify({
      schema_version: '0.1.0',
      multipass_id: 'mp_normies_agent_32362',
      subject_type: 'agent',
      display_name: 'Zori',
      slug: 'zori-4354',
      status: 'active',
      owner_summary: {
        owner_state: 'unclaimed',
        verification_status: 'none',
        visibility: 'public',
        summary: 'Read-only Ethereum Normies NFT-backed agent profile.',
      },
      custody_epoch: null,
      public_fragments: [],
      cred_summary: {
        trust_state: 'building',
        attestation_count: 0,
        receipt_count: 0,
        last_updated_at: '2026-07-07T01:30:00.000Z',
        public_note: 'ERC-8004-style Normies identity and backing Ethereum NFT provenance imported from public source records.',
      },
      discovery_profile: {
        summary: 'Zori is an Ethereum Normies NFT-backed agent profile for Normie #4354.',
        tags: ['normies', 'ethereum', 'erc-8004', 'agent-nft'],
        avatar_url: NORMIES_4354_IMAGE,
        visibility: 'public',
      },
      standards_profile: {
        standards_profile_id: 'sp_normies_agent_32362',
        supported_standard_ids: ['ERC-8004'],
        last_verified_at: '2026-07-07T01:30:00.000Z',
      },
      payment_profile: { accepted_assets: [], x402_manifest_url: null, paid_endpoints_enabled: false },
      updated_at: '2026-07-07T01:30:00.000Z',
    }), { status: 200 });
  }
  if (value.endsWith('/fragments')) return new Response(JSON.stringify({ multipass_id: 'mp_normies_agent_32362', fragments: [] }), { status: 200 });
  if (value.endsWith('/card') || value.endsWith('/agent-card')) return new Response(JSON.stringify({ ...sampleData().card, multipass_id: 'mp_normies_agent_32362', name: 'Zori' }), { status: 200 });
  if (value.endsWith('/standards')) return new Response(JSON.stringify({
    ...sampleData().standards,
    multipass_id: 'mp_normies_agent_32362',
    primary_refs: {
      erc8004_identity: 'eip155:1:0xde152afb7db5373f34876e1499fbd893a82dd336:32362',
      backing_nft: 'eip155:1:0x9eb6e2025b64f340691e424b7fe7022ffde12438:4354',
    },
  }), { status: 200 });
  if (value.endsWith('/x402')) return new Response(JSON.stringify({ ...sampleData().x402, multipass_id: 'mp_normies_agent_32362' }), { status: 200 });
  if (value.endsWith('/tools')) return new Response(JSON.stringify({ schema_version: '0.1.0', multipass_id: 'mp_normies_agent_32362', tools: [] }), { status: 200 });
  if (value.endsWith('/changes')) return new Response(JSON.stringify({ multipass_id: 'mp_normies_agent_32362', entries: [] }), { status: 200 });
  throw new Error(`Unexpected Zori URL ${url}`);
}

function createConsoleOwnedAgentsFetch({ wallet = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', tokenIds = [617] } = {}) {
  return async function fetchImpl(url) {
    const value = String(url);
    if (value.endsWith('/api/multipass/console/session/nonce')) {
      return new Response(JSON.stringify({ nonce: 'test-nonce', message: 'Authenticate this wallet' }), { status: 200 });
    }
    if (value.endsWith('/api/multipass/console/session/verify')) {
      return new Response(JSON.stringify({ wallet: wallet.toLowerCase(), csrfToken: 'test-csrf' }), { status: 200 });
    }
    if (value.endsWith('/api/multipass/console/agent/activate')) {
      return new Response(JSON.stringify({ runtime: { status: 'active', runtimeName: 'Looper runtime' } }), { status: 200 });
    }
    if (value.endsWith('/api/loopers/owned')) {
      return new Response(JSON.stringify({
        schema_version: '0.1.0',
        collection: 'loopers',
        owner: wallet,
        agents: tokenIds.map((tokenId) => createLooperConsoleAgentFixture(tokenId, wallet)),
      }), { status: 200 });
    }
    throw new Error(`Unexpected console URL ${url}`);
  };
}

function createConsoleRestapPolicyResponse(tokenId = '617', patch = {}) {
  return {
    schema_version: '0.1.0', token_id: String(tokenId),
    policy: { policy_version: 3, custody_generation: 7, network_enabled: true, inbound_enabled: true, autonomous_initiation_enabled: false, daily_initiated_conversation_limit: 5, daily_generated_message_limit: 10, per_peer_daily_limit: 3, topics: ['general'], allow_peer_token_ids: ['3802'], block_peer_token_ids: [], mute_until: null, ...(patch.policy ?? {}) },
    lease_status: patch.lease_status ?? 'inactive', eligibility_status: patch.eligibility_status ?? 'eligible',
    quota_usage: patch.quota_usage ?? { initiated: 1, generated: 2, cost_units: 3 },
    transcripts: { available: false, reason: 'pilot_memory_only' },
  };
}

function createConsoleRestapTalkResponse(patch = {}) {
  return { schema_version: '0.1.0', operation_id: 'vs_' + 'a'.repeat(48), status: 'committed', sender_token_id: '617', recipient_token_id: '3802', topic: 'general', opening_sha256: 'a'.repeat(64), reply_sha256: 'b'.repeat(64), usage: { sender: null, recipient: null }, replayed: false, reply: 'Bounded reply.', ...patch };
}

function createConsoleRestapApiFixture(overrides = {}) {
  const calls = [];
  const record = (name, input) => { calls.push([name, input]); };
  const api = {
    async getPolicy(input) { record('getPolicy', input); return overrides.getPolicy ? overrides.getPolicy(input) : createConsoleRestapPolicyResponse(input.tokenId); },
    async putPolicy(input) { record('putPolicy', input); return overrides.putPolicy ? overrides.putPolicy(input) : createConsoleRestapPolicyResponse(input.tokenId); },
    async sendTalk(input) { record('sendTalk', input); return overrides.sendTalk ? overrides.sendTalk(input) : createConsoleRestapTalkResponse({ sender_token_id: String(input.tokenId), recipient_token_id: String(input.recipientTokenId), topic: input.topic }); },
    async stop(input) { record('stop', input); return overrides.stop ? overrides.stop(input) : createConsoleRestapPolicyResponse(input.tokenId); },
  };
  return { api, calls };
}

function createLooperConsoleAgentFixture(tokenId, owner) {
  const id = String(tokenId);
  if (id === '617') {
    return {
      tokenId: '617',
      name: 'Looper #617',
      canonicalName: 'Looper #617',
      owner,
      image: 'https://helixa.xyz/loopers/images/617.png',
      role: 'Trader / Broker',
      credScore: 71,
      credLabel: 'Cred 71',
      verified: true,
      href: '/multipass/loopers/617',
      state: 'Owned Looper',
      traits: {
        Class: 'Trader / Broker',
        'Secondary Class': 'Seer / Signal Hunter',
        Specialization: 'market making',
        Risk: 'Hazardous',
        Autonomy: 'Extreme',
      },
      identityBadges: ['Trader / Broker', 'Hazardous risk', 'Extreme autonomy'],
      logline: 'Market-making Looper with signal-hunter instincts.',
      temperament: 'Hazardous signal hunter',
      temperamentBody: 'Reads market structure aggressively, but every action stays behind owner review.',
      identityBody: 'Wallet-owned Looper identity derived from token #617 metadata.',
      mandateBody: 'Watch the wallet, remember preferences, and brief before any proposal.',
      operatorBody: 'No spend, post, or transaction executes without owner approval.',
      profileLane: 'market making',
      watchLabel: 'Signal + liquidity',
      watchBody: 'Tracks market making lanes, wallet context, and risk before proposing action.',
    };
  }
  if (id === '812') {
    return {
      tokenId: '812',
      name: 'Looper #812',
      canonicalName: 'Looper #812',
      owner,
      image: 'https://helixa.xyz/loopers/images/812.png',
      role: 'Researcher / Archivist',
      credScore: 64,
      credLabel: 'Cred 64',
      verified: true,
      href: '/multipass/loopers/812',
      state: 'Owned Looper',
      identityBadges: ['Researcher / Archivist', 'Disciplined risk'],
      logline: 'Research Looper built for patient memory and clean summaries.',
    };
  }
  return {
    tokenId: id,
    name: `Looper #${id}`,
    canonicalName: `Looper #${id}`,
    owner,
    image: `https://helixa.xyz/loopers/images/${id}.png`,
    role: 'Wallet agent',
    credScore: 60,
    credLabel: 'Cred 60',
    verified: true,
    href: `/multipass/loopers/${id}`,
    state: 'Owned Looper',
    identityBadges: ['Owned Looper', 'Review-only'],
    logline: `Wallet-owned Looper #${id}.`,
  };
}

function fillGroupActivationForm(root, overrides = {}) {
  if (!root.querySelector('[data-role="group-activation-form"]')) {
    root.querySelector('[data-action="show-group-activation"]')?.click();
  }
  const form = root.querySelector('[data-role="group-activation-form"]');
  assert.ok(form);
  form.querySelector('[name="subject_type"]').value = overrides.subject_type ?? 'swarm';
  form.querySelector('[name="display_name"]').value = overrides.display_name ?? 'Helixa Swarm';
  form.querySelector('[name="summary"]').value = overrides.summary ?? 'Public parent Multipass for the core Helixa agent team.';
  form.querySelector('[name="member_ids"]').value = overrides.member_ids ?? '1, 81\n1066';
  form.querySelector('[name="shared_policy_note"]').value = overrides.shared_policy_note ?? 'Owner approval required for shared routes.';
  return form;
}

function groupPreviewResponse(overrides = {}) {
  return {
    schema_version: '0.1.0',
    state: 'group_preview',
    record: {
      profile: {
        display_name: 'Helixa Swarm',
        subject_type: 'swarm',
        ...(overrides.profile ?? {}),
      },
    },
    members: [
      { name: 'Bendr 2.0', token_id: '1', canonical_id: '8453:1', cred_score: 82, cred_tier: 'Prime', source_status: 'resolved' },
      { name: 'Quigbot', token_id: '81', canonical_id: '8453:81', cred_score: 76, cred_tier: 'Prime', source_status: 'resolved' },
      { name: 'Helixa', token_id: '1066', canonical_id: '8453:1066', cred_score: 70, cred_tier: 'Prime', source_status: 'resolved' },
    ],
    ...overrides,
  };
}

function groupSaveResponse(overrides = {}) {
  return {
    schema_version: '0.1.0',
    state: 'saved_group_unclaimed',
    created: true,
    multipass_id: 'mp_group_swarm_9c41a2',
    slug: 'helixa-swarm-9c41a2',
    sharePath: '/multipass/helixa-swarm-9c41a2',
    profile: { display_name: 'Helixa Swarm', subject_type: 'swarm', slug: 'helixa-swarm-9c41a2' },
    ...overrides,
  };
}

async function savedGroupProfileFetch(url) {
  const value = String(url);
  if (value.endsWith('/hydrated')) {
    return new Response('missing', { status: 404 });
  }
  if (value.endsWith('/api/multipass/helixa-collection-9c41a2')) {
    return new Response(JSON.stringify({
      schema_version: '0.1.0',
      display_name: 'Helixa Collection',
      multipass_id: 'mp_group_collection_9c41a2',
      slug: 'helixa-collection-9c41a2',
      status: 'active',
      subject_type: 'collection',
      summary: 'Public parent Multipass for a curated member collection.',
      owner_summary: {
        owner_state: 'unclaimed',
        verification_status: 'none',
        visibility: 'public',
        summary: 'Group management is unclaimed.',
      },
      cred_summary: { trust_state: 'context', public_note: 'Aggregate member Cred context only; no group score is assigned.' },
    }), { status: 200 });
  }
  if (value.endsWith('/fragments')) {
    return new Response(JSON.stringify({
      schema_version: '0.1.0',
      multipass_id: 'mp_group_collection_9c41a2',
      fragments: [
        {
          fragment_id: 'frag_group_collection_9c41a2_roster',
          fragment_type: 'custody_record',
          status: 'verified',
          assurance_level: 'platform_verified',
          visibility: 'public',
          transfer_policy: 'pause_on_transfer',
          source: { source_type: 'registry_import', source_id: 'collection:helixa', issuer: 'Helixa' },
          public_value: 'Roster includes 3 public AgentDNA members: Bendr 2.0, Quigbot, and Nox.',
        },
        {
          fragment_id: 'frag_group_collection_9c41a2_policy',
          fragment_type: 'endpoint',
          status: 'pending',
          assurance_level: 'self_attested',
          visibility: 'public',
          transfer_policy: 'pause_on_transfer',
          source: { source_type: 'owner_submission', source_id: 'collection:helixa:policy', issuer: 'Helixa' },
          public_value: 'Shared policy requires owner approval before collection-level route changes.',
          endpoint_ref: { protocol: 'api' },
        },
        {
          fragment_id: 'frag_group_collection_9c41a2_cred',
          fragment_type: 'risk_summary',
          status: 'verified',
          assurance_level: 'platform_verified',
          visibility: 'public',
          transfer_policy: 'reverify_on_transfer',
          source: { source_type: 'platform_check', source_id: 'collection:helixa:cred', issuer: 'Helixa' },
          public_value: 'Bendr 2.0 Cred 82 Prime, Quigbot Cred 76 Prime, Nox Cred 69 Prime. Aggregate context only; no group score is assigned.',
        },
      ],
    }), { status: 200 });
  }
  if (value.endsWith('/card') || value.endsWith('/agent-card')) {
    return new Response(JSON.stringify({
      schema_version: '0.1.0',
      name: 'Helixa Collection',
      description: 'Parent Multipass card for a public member collection.',
      capabilities: [],
      service_endpoints: [],
      trust_summary: { identity_status: 'verified', assurance_level: 'platform_verified', summary: 'Parent Multipass for a collection roster.' },
    }), { status: 200 });
  }
  if (value.endsWith('/standards')) return new Response(JSON.stringify({ standard_refs: [{ standard_id: 'ERC-8004', status: 'member_refs_available' }] }), { status: 200 });
  if (value.endsWith('/x401')) return new Response(JSON.stringify({ x401_supported: true, trusted_issuers: [{ issuer_id: 'helixa' }], proof_requirements: [{ requirement_id: 'group_authority' }], route_policies: [] }), { status: 200 });
  if (value.endsWith('/x402')) return new Response(JSON.stringify({ endpoints: [] }), { status: 200 });
  if (value.endsWith('/tools')) return new Response(JSON.stringify({ schema_version: '0.1.0', multipass_id: 'mp_group_collection_9c41a2', tools: [] }), { status: 200 });
  if (value.endsWith('/changes')) return new Response(JSON.stringify({ multipass_id: 'mp_group_collection_9c41a2', entries: [{ message: 'Group Multipass activated from public AgentDNA member records.' }] }), { status: 200 });
  throw new Error(`Unexpected group URL ${url}`);
}

async function savedQuigbotFetch(url) {
  const value = String(url);
  if (value.endsWith('/hydrated')) {
    return new Response('missing', { status: 404 });
  }
  if (value.endsWith('/api/multipass/quigbot-81') || value.endsWith('/api/multipass/mp_helixa_agent_81')) {
    return new Response(JSON.stringify({
      schema_version: '0.1.0',
      display_name: 'Quigbot',
      slug: 'quigbot-81',
      multipass_id: 'mp_helixa_agent_81',
      status: 'active',
      subject_type: 'agent',
      owner_summary: { owner_state: 'verified', verification_status: 'verified', visibility: 'public' },
      cred_summary: { trust_state: 'building', public_note: 'Public Cred score 75 observed from the live Helixa source record.' },
      discovery_profile: { tags: ['helixa', 'agentdna', 'multipass', 'openclaw'], visibility: 'public', avatar_url: NAKAMIGO_2432_IMAGE },
      updated_at: '2026-06-29T20:40:40.613Z',
    }), { status: 200 });
  }
  if (value.endsWith('/fragments')) {
    return new Response(JSON.stringify({
      schema_version: '0.1.0',
      multipass_id: 'mp_helixa_agent_81',
      fragments: [
        { fragment_id: 'frag_helixa_agent_81_source', fragment_type: 'attestation', status: 'verified', assurance_level: 'platform_verified', visibility: 'public', transfer_policy: 'historical_on_transfer', source: { source_id: '8453:81', reference_url: 'https://api.helixa.xyz/api/v2/agent/81' }, public_value: 'Quigbot was saved from public Helixa AgentDNA token #81.' },
        { fragment_id: 'frag_helixa_agent_81_cred', fragment_type: 'risk_summary', status: 'pending', assurance_level: 'platform_verified', visibility: 'public', transfer_policy: 'reverify_on_transfer', source: { source_id: '8453:81' }, public_value: 'Public Cred score 75 observed from the live Helixa source record.' },
      ],
    }), { status: 200 });
  }
  if (value.endsWith('/card') || value.endsWith('/agent-card')) {
    return new Response(JSON.stringify({
      ...sampleData().card,
      multipass_id: 'mp_helixa_agent_81',
      name: 'Quigbot',
      standards_refs: [{ standard_id: 'ERC-8004', support_status: 'imported_unverified', record_id: '8453:81' }],
      trust_summary: { identity_status: 'verified', assurance_level: 'platform_verified', last_updated_at: '2026-06-29T20:40:40.613Z' },
    }), { status: 200 });
  }
  if (value.endsWith('/standards')) {
    return new Response(JSON.stringify({
      schema_version: '0.1.0',
      multipass_id: 'mp_helixa_agent_81',
      primary_refs: { helixa_agent: '8453:81' },
      standard_refs: [{ standard_id: 'ERC-8004', status: 'imported_unverified', record_id: '8453:81' }],
    }), { status: 200 });
  }
  if (value.endsWith('/x402')) return new Response(JSON.stringify({ schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_81', endpoints: [] }), { status: 200 });
  if (value.endsWith('/tools')) return new Response(JSON.stringify({ schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_81', tools: [] }), { status: 200 });
  if (value.endsWith('/changes')) return new Response(JSON.stringify({ multipass_id: 'mp_helixa_agent_81', entries: [{ message: 'Management claim owner-wallet verified.' }] }), { status: 200 });
  throw new Error(`Unexpected URL ${url}`);
}

function createWalletClientFixture({ snapshot, connect, disconnect, signMessage, request } = {}) {
  let currentSnapshot = {
    ready: true,
    configured: true,
    connected: false,
    address: null,
    label: null,
    connectLabel: 'Connect wallet to claim',
    ...snapshot,
  };
  const subscribers = new Set();
  return {
    getSnapshot() {
      return currentSnapshot;
    },
    setSnapshot(nextSnapshot, { notify = false } = {}) {
      currentSnapshot = { ...currentSnapshot, ...nextSnapshot };
      if (notify) {
        for (const listener of subscribers) listener();
      }
    },
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    async connect() {
      return connect?.();
    },
    async disconnect() {
      if (disconnect) return disconnect();
      currentSnapshot = { ...currentSnapshot, connected: false, address: null, label: null };
      return undefined;
    },
    async signMessage(message) {
      if (signMessage) return signMessage(message);
      return { wallet: currentSnapshot.address, signature: '0xsig' };
    },
    async request(payload) {
      return request?.(payload);
    },
  };
}

function sampleLooperMintState({
  address,
  saleState = 'allowlist',
  proof = { status: 'loaded', eligible: true, proof: ['0x1234'] },
  allowlistMintedByWallet = 1n,
  mintedByWallet = 1n,
  remainingPublicSupply = 7439n,
  erc8004BindingActive = true,
  erc8004Registry = '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  erc8004AgentBaseURI = 'https://api.helixa.xyz/api/loopers/agents/',
} = {}) {
  return {
    enabled: true,
    config: { mode: 'rehearsal', label: 'Base Sepolia rehearsal' },
    address,
    name: 'Loopers',
    symbol: 'LOOPER',
    saleState,
    allowlistStart: 1787931008n,
    publicStart: 1788017408n,
    saleEnd: 1788561435n,
    allowlistPriceWei: 1_000_000_000_000n,
    publicPriceWei: 2_000_000_000_000n,
    merkleRoot: '0x7708767dfca7691ceba909e8c050828f998a9c0bd69642d96e61dcd5efb0163c',
    totalMinted: 1n,
    remainingPublicSupply,
    allowlistMintedByWallet,
    mintedByWallet,
    allowlistRemainingForWallet: 3n - allowlistMintedByWallet,
    publicRemainingForWallet: 10n - mintedByWallet,
    erc8004Registry: erc8004BindingActive ? erc8004Registry : null,
    erc8004AgentBaseURI: erc8004BindingActive ? erc8004AgentBaseURI : '',
    erc8004BindingActive,
    proof,
  };
}

function createSavedMultipassError({ status = 403, code = 'forbidden', message = 'Wallet is not eligible to manage this Multipass record.' } = {}) {
  const error = new Error(message);
  error.name = 'SavedMultipassError';
  error.details = { status, body: { error: { code, message } } };
  return error;
}

async function renderClaimFailureText(error) {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
      connectLabel: 'Sign owner claim',
    },
  });
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => { throw error; },
  };

  await createApp({ root, claimApi, walletClient, fetchImpl: savedProfileFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  return root.querySelector('.claim-management-panel').textContent;
}

async function renderClaimedSavedProfileRoot() {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({
      claim_status: 'claimed_verified_owner',
      csrfToken: 'csrf-1',
      profile: {
        ...sampleData().profile,
        slug: 'bendr-2-1',
        display_name: 'Saved Bendr',
        owner_summary: {
          owner_state: 'claimed',
          verification_status: 'verified',
          visibility: 'public',
          summary: 'Owner-wallet verified for public profile edits.',
        },
      },
    }),
  };
  const walletSigner = async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' });

  await createApp({ root, claimApi, walletSigner, fetchImpl: savedProfileFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  return root;
}

async function renderClaimedMarketplaceManager({ initialFragments = [], claimApiOverrides = {} } = {}) {
  const calls = [];
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const profile = {
    ...sampleData().profile,
    slug: 'bendr-2-1',
    owner_summary: { owner_state: 'claimed', verification_status: 'verified', visibility: 'public' },
  };
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({ claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile }),
    createMultipassFragment: async (input) => {
      calls.push(['create', input]);
      const fragment = { fragment_id: 'frag_marketplace_bankr', fragment_type: 'attestation', status: 'pending', visibility: 'public', source: { source_type: 'owner_submission', issuer: null }, marketplace_ref: input.fragment.marketplace_ref };
      return { fragment, fragments: { fragments: [fragment, ...initialFragments] }, profile };
    },
    updateMultipassFragment: async (input) => {
      calls.push(['update', input]);
      const fragment = { fragment_id: input.fragmentId, fragment_type: 'attestation', status: 'stale', visibility: 'public', source: { source_type: 'owner_submission', issuer: null }, marketplace_ref: input.patch.marketplace_ref };
      return { fragment, fragments: { fragments: [fragment] }, profile };
    },
    revokeMultipassFragment: async (input) => {
      calls.push(['revoke', input]);
      const fragment = { fragment_id: input.fragmentId, fragment_type: 'attestation', status: 'revoked', visibility: 'public', source: { source_type: 'owner_submission', issuer: null }, marketplace_ref: initialFragments[0]?.marketplace_ref };
      return { fragment, fragments: { fragments: [fragment] }, profile };
    },
    ...claimApiOverrides,
  };
  const fetchImpl = async () => {
    const body = sampleData();
    body.profile = profile;
    body.fragments = { fragments: initialFragments };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await createApp({ root, claimApi, walletSigner: async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' }), fetchImpl }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();
  return { root, calls };
}



function quigbotLiveData(overrides = {}) {
  return {
    ...sampleData(),
    modeLabel: 'Live Profile',
    sourceLabel: 'live Helixa API',
    profile: { ...sampleData().profile, display_name: 'Quigbot', ...(overrides.profile ?? {}) },
    resolver: { canonicalId: '8453:81', tokenId: '81', ...(overrides.resolver ?? {}) },
    liveProfilePage: {
      headline: 'Quigbot Multipass',
      headerMeta: 'Live profile · 8453:81',
      sharePath: '/multipass/?agent=81',
      ...(overrides.liveProfilePage ?? {}),
    },
    ...overrides,
  };
}

async function renderResolvedQuigbotProfile(liveData = quigbotLiveData()) {
  const root = setupDom('https://helixa.xyz/multipass/?agent=81');
  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();
  await flushAsyncEvents();
  return root;
}

function profileDrawerTitles(profile) {
  return [...profile.querySelectorAll('.profile-detail-drawer summary span')].map((node) => node.textContent);
}

function profileDrawerByTitle(profile, title) {
  return [...profile.querySelectorAll('.profile-detail-drawer')].find((drawer) => drawer.querySelector('summary span')?.textContent === title);
}



test('homepage leads with Multipass product hero instead of Bendr record sheet', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const hero = root.querySelector('.product-hero');
  assert.ok(hero);
  assert.equal(hero.querySelector('.eyebrow')?.textContent, 'What it is');
  assert.doesNotMatch(hero.querySelector('.eyebrow')?.textContent ?? '', /Helixa Multipass/i);
  assert.match(hero.textContent, /Portable identity profiles for agents/i);
  assert.doesNotMatch(hero.textContent, /mp_bendr_2/);
  assert.doesNotMatch(hero.textContent, /receipt_bendr_lookup/);
  assert.equal(root.querySelector('.record-sheet'), null);
});

test('homepage moves activation below the what-it-does panel', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const hero = root.querySelector('.product-hero');
  const heroCard = root.querySelector('.product-hero-copy');
  const activation = root.querySelector('.live-resolver');
  const activationCopy = activation?.querySelector('.live-resolver-copy');
  const groupActivation = root.querySelector('.group-activation-section');
  const systemPanel = root.querySelector('.multipass-system-panel');

  assert.ok(hero);
  assert.ok(heroCard);
  assert.ok(activation);
  assert.ok(activationCopy);
  assert.equal(groupActivation, null);
  assert.ok(systemPanel);
  assert.equal(hero.children.length, 1);
  assert.equal(hero.firstElementChild, heroCard);
  assert.equal(hero.contains(activation), false);
  assert.equal(hero.nextElementSibling, systemPanel);
  assert.equal(systemPanel.nextElementSibling, activation);
  assert.ok(heroCard.querySelector('.product-hero-main'));
  assert.ok(heroCard.contains(root.querySelector('.profile-visual-strip')));
  assert.equal(heroCard.firstElementChild?.classList.contains('product-hero-main'), true);
  assert.equal(heroCard.querySelector('.product-hero-main')?.nextElementSibling, root.querySelector('.profile-visual-strip'));
});

test('homepage does not render Looper allowlist registration panel', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.equal(root.querySelector('.looper-allowlist-panel'), null);
  assert.doesNotMatch(root.textContent, /Register address/);
});

test('standalone allowlist route renders stealth Looper registration panel', async () => {
  const root = setupDom('https://helixa.xyz/allowlist');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const panel = root.querySelector('.looper-allowlist-panel');
  assert.ok(panel);
  assert.equal(root.querySelector('h1')?.textContent, 'Loopers');
  assert.equal(panel.querySelector('.card-label'), null);
  assert.match(panel.textContent, /something new is coming/i);
  assert.doesNotMatch(panel.textContent, /quiet 777-piece signal/i);
  assert.doesNotMatch(panel.textContent, /Multipass Loopers/i);
  assert.doesNotMatch(panel.textContent, /contract, art generation, metadata, and marketplace prep/i);
  assert.equal(document.title, 'Loopers');
  assert.equal(document.querySelector('meta[name="description"]')?.getAttribute('content'), 'something new is coming...');
  assert.equal(document.querySelector('meta[property="og:title"]')?.getAttribute('content'), 'Loopers');
  assert.equal(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'), 'Loopers');
  assert.equal(panel.querySelector('label span')?.textContent, 'Add your base address or base name');
  assert.equal(panel.querySelector('input[name="looper_allowlist_address"]')?.getAttribute('placeholder'), '0x... or name.base.eth');
  assert.match(panel.textContent, /Connect your wallet to register it automatically, or manually add a Base address\/Base name/i);
  assert.doesNotMatch(panel.textContent, /POST \/multipass-api\/api\/loopers\/allowlist\/register/i);
  assert.equal(panel.querySelector('[data-action="connect-looper-wallet"]')?.textContent, 'Connect wallet');
  assert.equal(panel.querySelector('button[type="submit"]')?.textContent, 'Register address');
});

test('multipass allowlist alias renders the standalone Looper registration panel', async () => {
  const root = setupDom('https://helixa.xyz/multipass/allowlist');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.equal(root.querySelector('.looper-allowlist-panel h1')?.textContent, 'Loopers');
  assert.equal(root.querySelector('.live-resolver'), null);
});

test('standalone Looper allowlist registers an address', async () => {
  const root = setupDom('https://helixa.xyz/allowlist?api=https%3A%2F%2Fhelixa.xyz%2Fmultipass-api');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const calls = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ registered: true, created: true, address, total_registered: 1 }), { status: 201 });
    },
  }).start();

  const form = root.querySelector('[data-action="register-looper-allowlist"]');
  form.querySelector('[name="looper_allowlist_address"]').value = address.toLowerCase();
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(30);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://helixa.xyz/multipass-api/api/loopers/allowlist/register');
  assert.match(root.querySelector('.looper-allowlist-status.success')?.textContent ?? '', /registered for the Looper allowlist/i);
});

test('standalone Looper allowlist resolves Base name before registering', async () => {
  const root = setupDom('https://helixa.xyz/allowlist?api=https%3A%2F%2Fhelixa.xyz%2Fmultipass-api');
  const address = '0x2211d1D0020DAEA8039E46Cf1367962070d77DA9';
  const calls = [];
  const ensCalls = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    ensResolver: async (name) => {
      ensCalls.push(name);
      return address;
    },
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ registered: true, created: true, address, total_registered: 1 }), { status: 201 });
    },
  }).start();

  const form = root.querySelector('[data-action="register-looper-allowlist"]');
  form.querySelector('[name="looper_allowlist_address"]').value = 'Jesse.base.eth';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(30);

  assert.deepEqual(ensCalls, ['jesse.base.eth']);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].options.body), { address, source: 'launch-page', looper_allowlist_contact: '' });
  assert.match(root.querySelector('.looper-allowlist-status.success')?.textContent ?? '', /registered for the Looper allowlist/i);
});

test('standalone Looper allowlist reports unresolved Base name without API call', async () => {
  const root = setupDom('https://helixa.xyz/allowlist');
  let calls = 0;
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    ensResolver: async () => null,
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    },
  }).start();

  const form = root.querySelector('[data-action="register-looper-allowlist"]');
  form.querySelector('[name="looper_allowlist_address"]').value = 'missing.base.eth';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  assert.equal(calls, 0);
  assert.match(root.querySelector('.looper-allowlist-status.error')?.textContent ?? '', /does not resolve/i);
});

test('standalone Looper allowlist reports invalid address without API call', async () => {
  const root = setupDom('https://helixa.xyz/allowlist');
  let calls = 0;
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    },
  }).start();

  const form = root.querySelector('[data-action="register-looper-allowlist"]');
  form.querySelector('[name="looper_allowlist_address"]').value = 'bad_name';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  assert.equal(calls, 0);
  assert.match(root.querySelector('.looper-allowlist-status.error')?.textContent ?? '', /valid Base address or Base name/i);
});

test('standalone Looper allowlist connect wallet fills and registers the address', async () => {
  const root = setupDom('https://helixa.xyz/allowlist?api=https%3A%2F%2Fhelixa.xyz%2Fmultipass-api');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const calls = [];
  let walletClient;
  walletClient = createWalletClientFixture({
    connect: async () => {
      walletClient.setSnapshot({
        connected: true,
        address,
        label: '0x27E3...91Ea',
      });
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ registered: true, created: true, address, total_registered: 1 }), { status: 201 });
    },
  }).start();
  root.querySelector('[data-action="connect-looper-wallet"]').click();
  await flushAsyncEvents(30);

  assert.equal(root.querySelector('[name="looper_allowlist_address"]')?.value, address);
  assert.equal(root.querySelector('[data-action="connect-looper-wallet"]')?.textContent, 'Connected 0x27E3...91Ea');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://helixa.xyz/multipass-api/api/loopers/allowlist/register');
  assert.deepEqual(JSON.parse(calls[0].options.body), { address, source: 'launch-page', looper_allowlist_contact: '' });
  assert.match(root.querySelector('.looper-allowlist-status.success')?.textContent ?? '', /registered for the Looper allowlist/i);
});

test('standalone Looper allowlist connect wallet can register while Privy readiness is still settling', async () => {
  const root = setupDom('https://helixa.xyz/allowlist?api=https%3A%2F%2Fhelixa.xyz%2Fmultipass-api');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const calls = [];
  let walletClient;
  walletClient = createWalletClientFixture({
    snapshot: {
      ready: false,
      configured: true,
      connected: false,
      address: null,
      connectLabel: 'Loading wallet options...',
    },
    connect: async () => {
      walletClient.setSnapshot({
        ready: true,
        configured: true,
        connected: true,
        address,
      });
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ registered: true, created: true, address, total_registered: 1 }), { status: 201 });
    },
  }).start();
  root.querySelector('[data-action="connect-looper-wallet"]').click();
  await flushAsyncEvents(30);

  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].options.body), { address, source: 'launch-page', looper_allowlist_contact: '' });
  assert.match(root.querySelector('.looper-allowlist-status.success')?.textContent ?? '', /registered for the Looper allowlist/i);
});

test('standalone Looper allowlist keeps mint panel hidden without contract config', async () => {
  const root = setupDom('https://helixa.xyz/allowlist');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.equal(root.querySelector('.looper-mint-panel'), null);
  assert.equal(root.querySelector('.looper-mint-launch'), null);
  assert.doesNotMatch(root.textContent, /Rehearsal mint/i);
});

test('standalone Looper mint route renders rehearsal mint state from contract client', async () => {
  const root = setupDom('https://helixa.xyz/mint?mint=sepolia&api=https%3A%2F%2Fhelixa.xyz%2Fmultipass-api');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address,
      label: '0x27E3...91Ea',
    },
  });
  const loadCalls = [];
  const looperMintClient = {
    loadState: async (input) => {
      loadCalls.push(input);
      return sampleLooperMintState({ address });
    },
    mint: async () => {
      throw new Error('mint should not be called');
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), walletClient, looperMintClient }).start();
  await flushAsyncEvents(30);

  const panel = root.querySelector('.looper-mint-panel');
  assert.ok(root.querySelector('.looper-mint-launch'));
  assert.equal(root.querySelector('.looper-allowlist-panel'), null);
  assert.ok(root.querySelector('.looper-mint-art-gallery'));
  assert.ok(root.querySelector('.looper-mint-art-lineup'));
  assert.equal(root.querySelectorAll('.looper-mint-art-card').length, 3);
  assert.equal(root.querySelector('.looper-mint-art-caption'), null);
  assert.equal(root.querySelector('.looper-mint-art-tagline')?.textContent.trim(), '7,777 onchain agents. Yours starts here.');
  assert.equal(root.querySelector('.looper-mint-teaser-strip'), null);
  assert.match(root.querySelector('.looper-mint-hero-copy')?.textContent ?? '', /Mint your Looper/i);
  assert.doesNotMatch(root.textContent, /Sepolia|testnet|rehearsal/i);
  assert.equal(root.querySelector('.looper-mint-status-strip'), null);
  assert.equal(root.querySelector('.looper-mint-hero-lead'), null);
  assert.ok(panel);
  assert.equal(panel.querySelector('.looper-mint-panel-logo'), null);
  assert.equal(panel.querySelector('.looper-mint-heading'), null);
  assert.match(panel.querySelector('.looper-mint-refresh-button')?.textContent ?? '', /Refresh/i);
  assert.doesNotMatch(panel.textContent, /Base Sepolia rehearsal|Rehearsal mint/i);
  assert.match(panel.textContent, /Adapter8004/);
  assert.match(panel.textContent, /Active/);
  assert.match(panel.textContent, /Allowlist/);
  assert.match(panel.textContent, /Allowlist eligible\. Adapter8004 bind is active/i);
  assert.match(panel.textContent, /remaining discounted mints: 2/i);
  assert.match(panel.textContent, /0.000001 ETH/);
  assert.equal(panel.querySelector('[data-action="mint-loopers"] button[type="submit"]')?.textContent, 'Mint allowlist');
  assert.equal(loadCalls.length, 1);
  assert.equal(loadCalls[0].config.mode, 'rehearsal');
  assert.equal(loadCalls[0].address, address);
  assert.equal(loadCalls[0].apiBase, 'https://helixa.xyz/multipass-api');
});

test('standalone Looper mint route uses the approved retro console window hierarchy', async () => {
  const root = setupDom('https://helixa.xyz/mint?mint=sepolia');
  const looperMintClient = {
    loadState: async () => sampleLooperMintState(),
    mint: async () => {
      throw new Error('mint should not be called');
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), looperMintClient }).start();
  await flushAsyncEvents(30);

  const panel = root.querySelector('.looper-mint-panel');
  assert.ok(panel);
  assert.equal(panel.querySelectorAll('.looper-mint-window-light').length, 3);
  assert.equal(panel.querySelector('.looper-mint-window-title')?.textContent.trim(), 'LOOPER MINT v1.0');
  assert.deepEqual(
    [...panel.querySelectorAll('.looper-mint-system-grid .looper-mint-fact > span:first-child')].map((node) => node.textContent.trim()),
    ['Contract', 'Adapter8004', '8004 registry', 'Phase'],
  );
  assert.deepEqual(
    [...panel.querySelectorAll('.looper-mint-stats-grid .looper-mint-fact > span:first-child')].map((node) => node.textContent.trim()),
    ['Remaining', 'Minted', 'Allowlist'],
  );
  assert.equal(panel.querySelectorAll('.looper-mint-stat-icon').length, 3);
  assert.equal(panel.querySelector('.looper-mint-stat-blue')?.textContent.includes('7439'), true);
  assert.equal(panel.querySelector('.looper-mint-stat-green')?.textContent.includes('1'), true);
  assert.equal(panel.querySelector('.looper-mint-stat-yellow')?.textContent.includes('Live'), true);
  assert.equal(panel.querySelector('.looper-mint-system-grid')?.textContent.includes('Public\n'), false);
});

test('standalone Looper mint route shows one wallet connect action before connection', async () => {
  const root = setupDom('https://helixa.xyz/mint?mint=sepolia');
  const looperMintClient = {
    loadState: async () => sampleLooperMintState(),
    mint: async () => {
      throw new Error('mint should not be called');
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), looperMintClient }).start();
  await flushAsyncEvents(30);

  const panel = root.querySelector('.looper-mint-panel');
  const connectButtons = [...panel.querySelectorAll('button')].filter((button) => /connect wallet/i.test(button.textContent ?? ''));
  assert.equal(connectButtons.length, 1);
  assert.equal(connectButtons[0].dataset.action, 'connect-looper-mint-wallet');
  assert.equal(panel.querySelector('[data-action="mint-loopers"]'), null);
});

test('standalone Looper mint route renders pending mainnet launch surface without a contract address', async () => {
  const root = setupDom('https://helixa.xyz/mint');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address,
      label: '0x27E3...91Ea',
    },
  });
  const loadCalls = [];
  const looperMintClient = {
    loadState: async (input) => {
      loadCalls.push(input);
      throw new Error('loadState should not be called without a contract address');
    },
    mint: async () => {
      throw new Error('mint should not be called');
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), walletClient, looperMintClient }).start();
  await flushAsyncEvents(30);

  assert.ok(root.querySelector('.looper-mint-launch'));
  assert.ok(root.querySelector('.looper-mint-panel'));
  assert.equal(root.querySelector('.looper-allowlist-panel'), null);
  assert.match(root.textContent, /Mint your Looper/i);
  assert.match(root.textContent, /Mint contract is not configured yet/i);
  assert.equal(loadCalls.length, 0);
});

test('standalone Looper mint route starts with simple hero copy and a three-Looper collection hero', async () => {
  const root = setupDom('https://helixa.xyz/mint?mint=sepolia');
  const looperMintClient = {
    loadState: async () => sampleLooperMintState(),
    mint: async () => {
      throw new Error('mint should not be called');
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), looperMintClient }).start();
  await flushAsyncEvents(30);

  const launch = root.querySelector('.looper-mint-launch');
  const showcase = root.querySelector('.looper-mint-showcase');
  const heroCopy = root.querySelector('.looper-mint-hero-copy');

  assert.ok(launch);
  assert.equal(launch.children[0], showcase);
  assert.equal(showcase.children[0], heroCopy);
  assert.equal(showcase.children.length, 2);
  assert.equal(root.querySelector('.looper-mint-status-strip'), null);
  assert.equal(root.querySelector('.looper-mint-hero-lead'), null);
  assert.equal(heroCopy.querySelector('.looper-mint-signal-row'), null);
  const artGallery = root.querySelector('.looper-mint-art-gallery');
  assert.ok(artGallery);
  assert.ok(artGallery.querySelector('.looper-mint-art-lineup'));
  assert.equal(root.querySelectorAll('.looper-mint-art-card').length, 3);
  assert.deepEqual(
    [...artGallery.querySelectorAll('.looper-mint-art-image')].map((img) => img.getAttribute('src')),
    [
      '/multipass/looper-mint-sample-01.png',
      '/multipass/looper-mint-sample-02.png',
      '/multipass/looper-mint-sample-03.png',
    ],
  );
  assert.equal(artGallery.querySelector('.looper-mint-art-caption'), null);
  assert.equal(artGallery.querySelector('.looper-mint-art-tagline')?.textContent.trim(), '7,777 onchain agents. Yours starts here.');
  assert.equal(root.querySelector('.looper-mint-teaser-strip'), null);
  assert.equal(root.querySelector('img[src="/multipass/loopers-prereveal-placeholder.png"]'), null);
});

test('standalone Looper allowlist can still register while stale mint params are ignored', async () => {
  const root = setupDom('https://helixa.xyz/allowlist?mint=sepolia&api=https%3A%2F%2Fhelixa.xyz%2Fmultipass-api');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const calls = [];
  const looperMintClient = {
    loadState: async () => {
      throw new Error('mint state should not load on allowlist route');
    },
    mint: async () => {
      throw new Error('mint should not be called');
    },
  };

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    looperMintClient,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ registered: true, created: true, address, total_registered: 1 }), { status: 201 });
    },
  }).start();
  await flushAsyncEvents(30);

  assert.equal(root.querySelector('.looper-mint-panel'), null);
  assert.equal(root.querySelector('.looper-mint-launch'), null);
  const form = root.querySelector('[data-action="register-looper-allowlist"]');
  form.querySelector('[name="looper_allowlist_address"]').value = address.toLowerCase();
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(30);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://helixa.xyz/multipass-api/api/loopers/allowlist/register');
  assert.match(root.querySelector('.looper-allowlist-status.success')?.textContent ?? '', /registered for the Looper allowlist/i);
});

test('standalone Looper mint panel keeps ineligible allowlist wallets on standby copy without a public timestamp', async () => {
  const root = setupDom('https://helixa.xyz/mint?mint=sepolia');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address,
      label: '0x27E3...91Ea',
    },
  });
  const looperMintClient = {
    loadState: async () => sampleLooperMintState({ address, proof: { status: 'loaded', eligible: false, proof: [] } }),
    mint: async () => {
      throw new Error('mint should not be called');
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), walletClient, looperMintClient }).start();
  await flushAsyncEvents(30);

  const panel = root.querySelector('.looper-mint-panel');
  assert.match(panel.textContent, /not on the current allowlist snapshot/i);
  assert.match(panel.textContent, /Public mint is not live yet/i);
  assert.equal(panel.querySelector('[data-action="mint-loopers"] button[type="submit"]')?.disabled, true);
  assert.equal(panel.querySelector('.looper-mint-note.error')?.textContent ?? '', '');
});

test('standalone Looper mint panel disables impossible wallet-cap quantities', async () => {
  const root = setupDom('https://helixa.xyz/mint?mint=sepolia');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address,
      label: '0x27E3...91Ea',
    },
  });
  const looperMintClient = {
    loadState: async () => sampleLooperMintState({ address, allowlistMintedByWallet: 3n }),
    mint: async () => {
      throw new Error('mint should not be called');
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), walletClient, looperMintClient }).start();
  await flushAsyncEvents(30);

  const panel = root.querySelector('.looper-mint-panel');
  assert.match(panel.textContent, /Wallet allowlist mint cap reached/i);
  assert.equal(panel.querySelector('[data-action="mint-loopers"] button[type="submit"]')?.disabled, true);
});

test('standalone Looper mint panel blocks mint when Adapter8004 is not configured on the contract', async () => {
  const root = setupDom('https://helixa.xyz/mint?mint=sepolia');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address,
      label: '0x27E3...91Ea',
    },
  });
  const looperMintClient = {
    loadState: async () => sampleLooperMintState({ address, erc8004BindingActive: false }),
    mint: async () => {
      throw new Error('mint should not be called');
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), walletClient, looperMintClient }).start();
  await flushAsyncEvents(30);

  const panel = root.querySelector('.looper-mint-panel');
  assert.match(panel.textContent, /Adapter8004 is not configured on this mint contract yet/i);
  assert.match(panel.textContent, /Adapter pending/i);
  assert.equal(panel.querySelector('[data-action="mint-loopers"] button[type="submit"]')?.disabled, true);
});

test('standalone Looper mint form submits quantity through contract client', async () => {
  const root = setupDom('https://helixa.xyz/mint?mint=sepolia&api=https%3A%2F%2Fhelixa.xyz%2Fmultipass-api');
  const address = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address,
      label: '0x27E3...91Ea',
    },
  });
  const mintCalls = [];
  const looperMintClient = {
    loadState: async () => sampleLooperMintState({ address }),
    mint: async (input) => {
      mintCalls.push(input);
      return {
        hash: '0xabc123',
        status: 'success',
        blockNumber: '123',
        quantity: input.quantity,
        erc8004Bindings: [
          { looperTokenId: 1, identityTokenId: 0, holder: address, agentURI: 'https://api.helixa.xyz/api/loopers/agents/1' },
          { looperTokenId: 2, identityTokenId: 1, holder: address, agentURI: 'https://api.helixa.xyz/api/loopers/agents/2' },
        ],
      };
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), walletClient, looperMintClient }).start();
  await flushAsyncEvents(30);

  const form = root.querySelector('[data-action="mint-loopers"]');
  form.querySelector('[name="looper_mint_quantity"]').value = '2';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(40);

  assert.equal(mintCalls.length, 1);
  assert.equal(mintCalls[0].quantity, 2);
  assert.equal(mintCalls[0].apiBase, 'https://helixa.xyz/multipass-api');
  assert.equal(mintCalls[0].walletClient, walletClient);
  assert.match(root.textContent, /Mint \+ Adapter8004 bind confirmed/i);
  assert.match(root.textContent, /Looper #1 -> ERC-8004 #0/);
  assert.match(root.textContent, /Looper #2 -> ERC-8004 #1/);
});

test('group activation stays hidden behind the Activate Swarm button on the homepage', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const resolver = root.querySelector('.live-resolver');
  const actionStack = resolver?.querySelector('.live-resolver-actions');
  const activateButton = actionStack?.querySelector('button[type="submit"]');
  const showSwarmButton = actionStack?.querySelector('[data-action="show-group-activation"]');
  assert.ok(resolver);
  assert.ok(actionStack);
  assert.equal(actionStack?.children[0], activateButton);
  assert.equal(actionStack?.children[1], showSwarmButton);
  assert.ok(showSwarmButton);
  assert.equal(showSwarmButton.textContent, 'Activate Swarm');
  assert.equal(root.querySelector('.group-activation-section'), null);
  assert.doesNotMatch(root.textContent, /Activate collection or swarm/);

  showSwarmButton.click();
  await flushAsyncEvents();

  const section = root.querySelector('.group-activation-section');
  const panel = root.querySelector('.group-activation-panel');
  const text = section?.textContent ?? '';

  assert.ok(section);
  assert.ok(panel);
  assert.match(text, /Activate collection or swarm/);
  assert.match(text, /Subject type/);
  assert.match(text, /Display name/);
  assert.match(text, /Summary/);
  assert.match(text, /Member IDs/);
  assert.match(text, /Shared policy note/);
  assert.match(text, /Preview group Multipass/);
  assert.match(text, /Activate group Multipass/);
  assert.ok(panel.querySelector('option[value="swarm"]'));
  assert.ok(panel.querySelector('option[value="collection"]'));
  assert.equal(panel.querySelector('[data-action="save-group-multipass"]')?.hasAttribute('disabled'), true);
  assert.match(text, /public parent Multipass metadata only/i);
});

test('group activation preview submits through the client and renders parent profile with member summaries', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const requests = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options, body: JSON.parse(options.body) });
      assert.equal(options.method, 'POST');
      if (String(url).endsWith('/api/multipass/groups/preview')) {
        return new Response(JSON.stringify(groupPreviewResponse()), { status: 200 });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  }).start();

  fillGroupActivationForm(root);
  root.querySelector('[data-action="preview-group-multipass"]').click();
  await flushAsyncEvents(50);

  assert.deepEqual(requests.map((request) => request.url), ['/multipass-api/api/multipass/groups/preview']);
  assert.deepEqual(requests[0].body, {
    subject_type: 'swarm',
    display_name: 'Helixa Swarm',
    summary: 'Public parent Multipass for the core Helixa agent team.',
    shared_policy_note: 'Owner approval required for shared routes.',
    member_ids: ['1', '81', '1066'],
  });
  const preview = root.querySelector('.group-activation-preview');
  assert.ok(preview);
  assert.match(preview.textContent, /Helixa Swarm/);
  assert.match(preview.textContent, /Proposed parent profile for swarm/);
  assert.match(preview.textContent, /Bendr 2\.0/);
  assert.match(preview.textContent, /Quigbot/);
  assert.match(preview.textContent, /Token ID 1/);
  assert.match(preview.textContent, /Token ID 81/);
  assert.match(preview.textContent, /Cred 82 Prime/);
  assert.equal(root.querySelector('[data-action="save-group-multipass"]')?.hasAttribute('disabled'), false);
  assert.equal(root.querySelector('[data-action="save-group-multipass"]')?.hidden, false);
});

test('group activation structured validation errors render as blocking user-facing errors', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async () => new Response(JSON.stringify({
      schema_version: '0.1.0',
      error: {
        code: 'invalid_group_activation',
        message: 'At least two unique members are required.',
        details: { field: 'member_ids' },
      },
    }), { status: 400 }),
  }).start();

  fillGroupActivationForm(root, { display_name: 'Broken Group', member_ids: '1' });
  root.querySelector('[data-action="preview-group-multipass"]').click();
  await flushAsyncEvents(50);

  const error = root.querySelector('.group-activation-error[role="alert"]');
  assert.ok(error);
  assert.match(error.textContent, /At least two unique members are required/);
  assert.match(error.textContent, /invalid_group_activation/);
  assert.match(error.textContent, /member_ids/);
  assert.equal(root.querySelector('.group-activation-preview'), null);
  assert.equal(root.querySelector('[name="display_name"]')?.value, 'Broken Group');
  assert.equal(root.querySelector('[name="member_ids"]')?.value, '1');
});

test('group activation reset clears preview result and error state without navigating', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const startingHref = window.location.href;
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async () => new Response(JSON.stringify(groupPreviewResponse()), { status: 200 }),
  }).start();

  fillGroupActivationForm(root);
  root.querySelector('[data-action="preview-group-multipass"]').click();
  await flushAsyncEvents(50);
  assert.ok(root.querySelector('.group-activation-preview'));

  root.querySelector('[data-action="reset-group-multipass"]').click();
  await flushAsyncEvents(20);

  assert.equal(window.location.href, startingHref);
  assert.equal(root.querySelector('.group-activation-preview'), null);
  assert.equal(root.querySelector('.group-activation-success'), null);
  assert.equal(root.querySelector('.group-activation-error'), null);
  assert.equal(root.querySelector('[name="display_name"]')?.value, '');
  assert.equal(root.querySelector('[data-action="save-group-multipass"]')?.hasAttribute('disabled'), true);
});

test('group activation save calls client and renders deterministic safe share path link', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const requests = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), body: JSON.parse(options.body) });
      if (String(url).endsWith('/api/multipass/groups/preview')) {
        return new Response(JSON.stringify(groupPreviewResponse()), { status: 200 });
      }
      if (String(url).endsWith('/api/multipass/groups')) {
        return new Response(JSON.stringify(groupSaveResponse()), { status: 201 });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  }).start();

  fillGroupActivationForm(root);
  root.querySelector('[data-action="preview-group-multipass"]').click();
  await flushAsyncEvents(50);
  root.querySelector('[data-action="save-group-multipass"]').click();
  await flushAsyncEvents(50);

  assert.deepEqual(requests.map((request) => request.url), [
    '/multipass-api/api/multipass/groups/preview',
    '/multipass-api/api/multipass/groups',
  ]);
  assert.deepEqual(requests[1].body.member_ids, ['1', '81', '1066']);
  const success = root.querySelector('.group-activation-success');
  assert.ok(success);
  assert.match(success.textContent, /\/multipass\/helixa-swarm-9c41a2/);
  assert.match(success.textContent, /unclaimed management/i);
  const link = success.querySelector('a[href="/multipass/helixa-swarm-9c41a2"]');
  assert.ok(link);
  assert.equal(link.textContent, 'Open parent Multipass');
  assert.equal(success.querySelector('a[href^="https://"]'), null);
});

test('group activation requires the current form payload to be previewed before saving', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const requests = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), body: JSON.parse(options.body) });
      if (String(url).endsWith('/api/multipass/groups/preview')) {
        return new Response(JSON.stringify(groupPreviewResponse()), { status: 200 });
      }
      if (String(url).endsWith('/api/multipass/groups')) {
        return new Response(JSON.stringify(groupSaveResponse()), { status: 201 });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  }).start();

  fillGroupActivationForm(root);
  root.querySelector('[data-action="preview-group-multipass"]').click();
  await flushAsyncEvents(50);
  root.querySelector('[name="display_name"]').value = 'Edited Swarm';
  root.querySelector('[data-action="save-group-multipass"]').click();
  await flushAsyncEvents(50);

  assert.deepEqual(requests.map((request) => request.url), ['/multipass-api/api/multipass/groups/preview']);
  assert.equal(root.querySelector('.group-activation-success'), null);
  const error = root.querySelector('.group-activation-error[role="alert"]');
  assert.ok(error);
  assert.match(error.textContent, /Preview the current group details before activating/);
  assert.equal(root.querySelector('[name="display_name"]')?.value, 'Edited Swarm');
});

test('group activation does not start a new preview while save is in flight', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const requests = [];
  let resolveSave;
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), body: JSON.parse(options.body) });
      if (String(url).endsWith('/api/multipass/groups/preview')) {
        return new Response(JSON.stringify(groupPreviewResponse()), { status: 200 });
      }
      if (String(url).endsWith('/api/multipass/groups')) {
        return new Promise((resolve) => { resolveSave = resolve; });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  }).start();

  fillGroupActivationForm(root);
  root.querySelector('[data-action="preview-group-multipass"]').click();
  await flushAsyncEvents(50);
  root.querySelector('[data-action="save-group-multipass"]').click();
  await flushAsyncEvents(10);

  assert.equal(root.querySelector('[data-action="preview-group-multipass"]')?.hasAttribute('disabled'), true);
  root.querySelector('[data-action="preview-group-multipass"]').click();
  await flushAsyncEvents(20);
  assert.deepEqual(requests.map((request) => request.url), [
    '/multipass-api/api/multipass/groups/preview',
    '/multipass-api/api/multipass/groups',
  ]);

  resolveSave(new Response(JSON.stringify(groupSaveResponse()), { status: 201 }));
  await flushAsyncEvents(50);
  assert.ok(root.querySelector('.group-activation-success'));
});

test('group activation reset ignores stale preview responses', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  let resolvePreview;
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async () => new Promise((resolve) => { resolvePreview = resolve; }),
  }).start();

  fillGroupActivationForm(root);
  root.querySelector('[data-action="preview-group-multipass"]').click();
  await flushAsyncEvents(10);
  assert.match(root.querySelector('.group-activation-panel')?.textContent ?? '', /Previewing group Multipass/);

  root.querySelector('[data-action="reset-group-multipass"]').click();
  resolvePreview(new Response(JSON.stringify(groupPreviewResponse()), { status: 200 }));
  await flushAsyncEvents(50);

  assert.equal(root.querySelector('.group-activation-preview'), null);
  assert.equal(root.querySelector('.group-activation-error'), null);
  assert.equal(root.querySelector('[name="display_name"]')?.value, '');
  assert.equal(root.querySelector('[data-action="save-group-multipass"]')?.hasAttribute('disabled'), true);
});

test('group activation reset ignores stale save responses', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  let resolveSave;
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async (url) => {
      if (String(url).endsWith('/api/multipass/groups/preview')) {
        return new Response(JSON.stringify(groupPreviewResponse()), { status: 200 });
      }
      if (String(url).endsWith('/api/multipass/groups')) {
        return new Promise((resolve) => { resolveSave = resolve; });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  }).start();

  fillGroupActivationForm(root);
  root.querySelector('[data-action="preview-group-multipass"]').click();
  await flushAsyncEvents(50);
  root.querySelector('[data-action="save-group-multipass"]').click();
  await flushAsyncEvents(10);
  assert.match(root.querySelector('.group-activation-panel')?.textContent ?? '', /Activating group Multipass/);

  root.querySelector('[data-action="reset-group-multipass"]').click();
  resolveSave(new Response(JSON.stringify(groupSaveResponse()), { status: 201 }));
  await flushAsyncEvents(50);

  assert.equal(root.querySelector('.group-activation-success'), null);
  assert.equal(root.querySelector('.group-activation-error'), null);
  assert.equal(root.querySelector('[name="display_name"]')?.value, '');
  assert.equal(root.querySelector('[data-action="save-group-multipass"]')?.hasAttribute('disabled'), true);
});

test('group activation saved route renders parent Multipass roster context instead of agent-only copy', async () => {
  const root = setupDom('https://helixa.xyz/multipass/helixa-collection-9c41a2?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedGroupProfileFetch }).start();

  const profile = root.querySelector('.multipass-profile-page');
  assert.ok(profile);
  const roster = profileDrawerByTitle(profile, 'Collection roster');
  assert.ok(roster);
  assert.match(profile.textContent, /Helixa Collection/);
  assert.match(profile.textContent, /Parent Multipass/);
  assert.match(roster.textContent, /collection roster/i);
  assert.match(roster.textContent, /Bendr 2\.0/);
  assert.match(roster.textContent, /Quigbot/);
  assert.match(roster.textContent, /Nox/);
  assert.match(roster.textContent, /Shared policy requires owner approval/);
  assert.doesNotMatch(profile.textContent, /public agent profile/i);
  assert.doesNotMatch(profile.textContent, /Agent Activation|stable public agent profile|Portable Agent Identity/);
  assert.doesNotMatch(profile.textContent, /frag_group_collection_9c41a2/);
});

test('group parent owner command center uses parent metadata controls copy', async () => {
  const root = setupDom('https://helixa.xyz/multipass/helixa-collection-9c41a2?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedGroupProfileFetch }).start();

  const commandCenters = root.querySelectorAll('.claim-management-panel');
  assert.equal(commandCenters.length, 1);
  const panel = commandCenters[0];
  assert.match(panel.textContent, /Owner Command Center/);
  assert.match(panel.textContent, /parent Multipass/i);
  assert.match(panel.textContent, /group metadata/i);
  assert.match(panel.textContent, /roster/i);
  assert.match(panel.textContent, /policy/i);
  assert.match(panel.textContent, /public proof fragments/i);
  assert.match(panel.textContent, /source-owner proof/i);
  assert.match(panel.textContent, /manual review/i);
  assert.doesNotMatch(panel.textContent, /public agent profile|agent-only|stable public agent profile/i);
  assert.doesNotMatch(panel.textContent, /owns member|acts for member|acts on behalf|executes tools|can execute tools|releases credentials|private credentials available|payment proves trust|buys trust|buy trust|trust purchased|custody transferred|transfer ownership|grants authority/i);
});

test('group activation safety wording scan avoids authority payment and credential claims', async () => {
  const homepage = setupDom('https://helixa.xyz/multipass/');
  await createApp({ homepage, root: homepage, loadDemo: async () => sampleData() }).start();
  const savedRoot = setupDom('https://helixa.xyz/multipass/helixa-collection-9c41a2?api=https://api.example.test');
  await createApp({ root: savedRoot, fetchImpl: savedGroupProfileFetch }).start();

  const combined = `${homepage.textContent}\n${savedRoot.textContent}`;
  assert.doesNotMatch(combined, /owns member|acts for member|acts on behalf|executes tools|can execute tools|releases credentials|private credentials available|payment proves trust|buys trust|buy trust|trust purchased|custody transferred|transfer ownership|grants authority/i);
  assert.doesNotMatch(combined, /x402 payment call|wallet signing required|onchain write/i);
});

test('homepage renders agent visuals without extra context copy', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.equal(root.querySelector('.product-card-grid'), null);
  assert.equal(root.querySelector('.share-panel'), null);
  assert.equal(root.querySelector('a[href="/multipass/agents"]')?.textContent, 'View agents');
  const strip = root.querySelector('.profile-visual-strip');
  assert.ok(strip);
  assert.equal(strip.querySelector('.card-carousel-head'), null);
  assert.equal(strip.querySelector('.card-detail'), null);
  assert.equal(strip.querySelector('.visual-card-viewport'), null);
  assert.ok(strip.querySelector('.visual-card-track'));
  assert.equal(strip.querySelector('.visual-card-track')?.hasAttribute('style'), false);
  assert.equal(strip.querySelector('.card-track'), null);
  assert.equal(strip.querySelectorAll('.card-button').length, 0);
  assert.equal(strip.querySelectorAll('a.visual-card-button').length, 3);
  assert.equal(strip.querySelector('.visual-carousel-controls'), null);
  assert.equal(strip.querySelector('a.visual-card-button[href="/multipass/?agent=1"]')?.textContent.includes('Open profile'), true);
  const quigbotVisual = strip.querySelector('a.visual-card-button[href="/multipass/?agent=81"]')?.querySelector('img[data-visual-card-image="true"]');
  assert.equal(quigbotVisual?.getAttribute('src'), 'https://assets.bueno.art/images/3b04f823-b7a8-4965-b61e-8fe8a5d82bde/default/2432');
  assert.doesNotMatch(strip.innerHTML, /api\.helixa\.xyz\/api\/v2\/aura\/81\.png/);
  const heroCard = root.querySelector('.product-hero-copy');
  assert.ok(heroCard?.contains(strip));
  const heroMain = root.querySelector('.product-hero-main');
  const actions = root.querySelector('.homepage-actions');
  assert.ok(heroMain);
  assert.ok(actions);
  assert.ok(heroMain.contains(actions));
  assert.equal(heroMain.nextElementSibling, strip);
  assert.equal(actions.compareDocumentPosition(strip) & root.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING, root.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.match(strip.textContent, /Bendr 2\.0/);
  assert.match(strip.textContent, /Quigbot/);
});

test('homepage visual carousel is native swipeable linked profiles, not a button slider', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const strip = root.querySelector('.profile-visual-strip');
  assert.ok(strip);
  const track = strip.querySelector('.visual-card-track');
  assert.ok(track);
  assert.match(track.getAttribute('aria-label') ?? '', /Swipe through/i);
  assert.equal(track.hasAttribute('style'), false);
  assert.equal(strip.querySelector('button[aria-label="Next agent"]'), null);
  assert.equal(strip.querySelector('button[aria-label="Previous agent"]'), null);
  assert.equal(strip.querySelector('button.visual-card-button'), null);
  assert.deepEqual([...strip.querySelectorAll('a.visual-card-button')].map((link) => link.getAttribute('href')), [
    '/multipass/?agent=1',
    '/multipass/?agent=81',
    '/multipass/swarm/helixa',
  ]);
  assert.equal(strip.querySelector('a.visual-card-button[href^="https://helixa.xyz/agent/"]'), null);
  assert.equal(strip.querySelector('a.visual-card-button[href^="https://helixa.xyz/swarm/"]'), null);
});

test('production homepage carousel includes Zori as a cross-chain Normies example', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root }).start();

  const strip = root.querySelector('.profile-visual-strip');
  assert.ok(strip);
  const links = [...strip.querySelectorAll('a.visual-card-button')];
  assert.equal(links.length, 4);
  assert.deepEqual(links.map((link) => link.getAttribute('href')), [
    '/multipass/?agent=1',
    '/multipass/?agent=81',
    '/multipass/zori-4354',
    '/multipass/swarm/helixa',
  ]);
  const zori = strip.querySelector('a.visual-card-button[href="/multipass/zori-4354"]');
  assert.ok(zori);
  assert.match(zori.textContent ?? '', /Zori/);
  assert.equal(zori.querySelector('img[data-visual-card-image="true"]')?.getAttribute('src'), NORMIES_4354_IMAGE);
});

test('homepage saved-route profile cards keep native link navigation', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root }).start();

  const zori = root.querySelector('a.visual-card-button[href="/multipass/zori-4354"]');
  assert.ok(zori);
  assert.equal(zori.getAttribute('data-action'), null);

  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  zori.dispatchEvent(click);
  await Promise.resolve();

  assert.equal(click.defaultPrevented, false);
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/');
  assert.equal(root.querySelector('.multipass-profile-page'), null);
});

test('homepage View agents opens a dedicated public agents route instead of rendering the full gallery inline', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.equal(root.querySelector('.public-agent-gallery'), null);
  assert.equal(root.querySelector('a[href="/multipass/agents"]')?.textContent, 'View agents');
  assert.equal(root.querySelector('.homepage-actions a[href="/multipass/console"]')?.textContent, 'Open Console');
});

test('dedicated Console route renders a human-facing operating surface for onchain agents', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.equal(root.querySelector('.product-home-shell'), null);
  const consolePage = root.querySelector('.multipass-console');
  assert.ok(consolePage);
  assert.equal(document.title, 'Multipass Console');
  assert.equal(document.querySelector('meta[property="og:title"]')?.getAttribute('content'), 'Multipass Console');
  assert.equal(document.querySelector('meta[property="og:image"]')?.getAttribute('content'), 'https://helixa.xyz/multipass/multipass-console-preview-20260925a.png');
  assert.equal(document.querySelector('meta[property="og:image:alt"]')?.getAttribute('content'), 'Multipass Console preview');
  assert.equal(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content'), 'https://helixa.xyz/multipass/multipass-console-preview-20260925a.png');
  assert.equal(document.querySelector('meta[name="twitter:image:alt"]')?.getAttribute('content'), 'Multipass Console preview');
  assert.equal(root.querySelector('.brand-stack .header-meta'), null);
  assert.match(consolePage.textContent, /review-only/i);
  assert.ok(consolePage.querySelector('.console-basic-shell'));
  assert.equal(consolePage.querySelector('.console-basic-shell')?.getAttribute('aria-label'), 'Agent console');
  assert.equal(consolePage.querySelectorAll('.console-status-strip div').length, 0);
  assert.equal(consolePage.querySelectorAll('.console-flow-panel li').length, 0);
  assert.ok(consolePage.querySelector('.console-trust-rail'));
  assert.match(consolePage.querySelector('.console-trust-rail')?.textContent ?? '', /No verified runtime proof yet/);
  assert.doesNotMatch(consolePage.querySelector('.console-trust-rail')?.textContent ?? '', /Bankr-ready|Sibyl-ready/);
  assert.ok(consolePage.querySelector('.console-identity-card'));
  assert.equal(consolePage.querySelectorAll('.console-sidebar-drawer').length >= 2, true);
  assert.match(consolePage.querySelector('.console-sidebar-header h1')?.textContent ?? '', /Multipass Console/);
  assert.ok(consolePage.querySelector('.console-thread-shell-header'));
  assert.ok(consolePage.querySelector('.console-thread-toolbar'));
  assert.equal(consolePage.querySelector('.console-trust-graph-card'), null);
  assert.equal(consolePage.querySelector('.console-agent-portrait img'), null);
  assert.match(consolePage.querySelector('.console-agent-portrait')?.textContent ?? '', /No agent selected/i);
  assert.match(consolePage.querySelector('.console-identity-card')?.textContent ?? '', /Owned Loopers appear here after wallet sign-in/i);
  assert.match(consolePage.textContent, /No room open/);
  assert.match(consolePage.textContent, /Thread note/);
  assert.match(consolePage.textContent, /Token/);
  assert.match(consolePage.textContent, /CRED/i);
  assert.match(consolePage.textContent, /Mode/);
  assert.doesNotMatch(consolePage.textContent, /My agents/i);
  assert.doesNotMatch(consolePage.textContent, /The Console only loads real Loopers owned by the connected wallet/i);
  assert.match(consolePage.textContent, /Canonical onchain identifiers/i);
  assert.doesNotMatch(consolePage.textContent, /No recalled memory yet|Agent dossier|Agent Workspace/);
  assert.equal(consolePage.querySelectorAll('[data-action="connect-console-wallet"]').length, 0);
  assert.doesNotMatch(consolePage.textContent, /Tokenized equities|Vaults|What it's watching|signals feed/i);
  assert.equal(consolePage.querySelector('a[href="/multipass/?agent=1"]'), null);
  assert.equal(root.querySelectorAll('[data-action="connect-console-wallet"]').length, 1);
  assert.equal(root.querySelector('.header-actions [data-action="connect-console-wallet"]')?.textContent, 'Connect wallet');
  assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /Sign in to load owned Loopers\./);
  assert.equal((consolePage.textContent.match(/Connect wallet/gi) ?? []).length, 0);
  assert.doesNotMatch(consolePage.textContent, /Use the header button|Use the top-right wallet control/i);
  assert.doesNotMatch(root.querySelector('.console-identity-card')?.textContent ?? '', /Wallet required|No wallet connected/i);
  assert.equal(root.querySelector('[data-action="send-console-agent-message"] button[type="submit"]')?.disabled, true);
  assert.equal(root.querySelector('[data-action="reset-console-session"]')?.disabled, true);
  assert.equal(root.querySelector('.live-resolver'), null);
  assert.doesNotMatch(consolePage.textContent, /NFT dashboard|Legendary/i);
  assert.match(consolePage.textContent, /Nothing executes without your approval/i);
  assert.doesNotMatch(consolePage.textContent, /custody transferred|credentials released|tool authority granted|trade placed/i);
});

test('dedicated Console route connects wallet and auto-loads the first owned Looper', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const calls = [];
  let walletClient;
  walletClient = createWalletClientFixture({
    connect: async () => {
      calls.push(['connect']);
      walletClient.setSnapshot({
        connected: true,
        address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
        label: '0x27E3...91Ea',
      });
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
  }).start();
  root.querySelector('[data-action="connect-console-wallet"]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushAsyncEvents(30);

  assert.deepEqual(calls, [['connect']]);
  assert.equal(root.querySelectorAll('[data-action="connect-console-wallet"]').length, 1);
  assert.equal(root.querySelector('.header-actions [data-action="connect-console-wallet"]')?.textContent, '0x27E3...91Ea');
  assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /0x27E3\.\.\.91Ea/);
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Looper #617/);
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Trader \/ Broker/);
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /market[- ]making/i);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '617');
  assert.match(root.querySelector('.console-agent-onboarding')?.textContent ?? '', /Switch Loopers/i);
  assert.equal(root.querySelector('.console-agent-onboarding')?.querySelectorAll('[data-action="activate-console-room"]').length, 2);
  assert.equal(root.querySelector('[data-action="send-console-agent-message"] button[type="submit"]')?.disabled, false);

  const selector = root.querySelector('[data-action="select-console-agent"]');
  selector.value = '812';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents(20);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '812');
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Looper #812/);
});

test('dedicated Console reports a mobile signing-provider handoff failure precisely', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const walletClient = createWalletClientFixture({ snapshot: {
    connected: true,
    address: '0x27E3286c2c1783f67d06f2ff4e3ab41f8e1C91Ea',
    label: '0x27E3...91Ea',
  } });
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    claimApi: {
      authenticateConsoleSession: async ({ onStage }) => {
        onStage('signature');
        throw new Error('Wallet connected, but its signing provider did not become ready.');
      },
    },
  }).start();

  root.querySelector('[data-action="connect-console-wallet"]')?.click();
  await flushAsyncEvents(30);

  assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /signing provider was not ready/i);
  assert.doesNotMatch(root.querySelector('.console-wallet-panel')?.textContent ?? '', /Could not connect and authenticate/i);
});

test('dedicated Console gallery searches, sorts, clears, and opens agents beyond the old cap', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const tokenIds = [12, 2, 11, 1, 10, 3, 9, 4, 8, 5, 7, 6];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds }),
  }).start();
  await flushAsyncEvents(30);

  assert.equal(root.querySelectorAll('.console-agent-gallery-card').length, 12);
  assert.equal(root.querySelector('.console-agent-gallery-card [data-token-id]')?.dataset.tokenId, '1');

  let search = root.querySelector('[data-action="search-console-agent-gallery"]');
  search.value = 'Looper #11';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(root.querySelectorAll('.console-agent-gallery-card').length, 1);
  assert.equal(root.querySelector('.console-agent-gallery-card [data-token-id]')?.dataset.tokenId, '11');

  search = root.querySelector('[data-action="search-console-agent-gallery"]');
  search.value = 'missing';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(root.querySelector('.console-agent-gallery')?.textContent ?? '', /No Loopers match “missing”/);
  root.querySelector('[data-action="clear-console-agent-gallery-search"]').click();
  assert.equal(root.querySelectorAll('.console-agent-gallery-card').length, 12);

  const sort = root.querySelector('[data-action="sort-console-agent-gallery"]');
  sort.value = 'token-desc';
  sort.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(root.querySelector('.console-agent-gallery-card [data-token-id]')?.dataset.tokenId, '12');

  root.querySelector('[data-action="activate-console-room"][data-token-id="11"]').click();
  await flushAsyncEvents(20);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '11');
  assert.ok(root.querySelector('.console-agent-thread-panel'));
});

test('dedicated Console preserves a focused mobile Looper selector across unrelated rerenders', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } });
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
  }).start();
  await flushAsyncEvents(30);

  const switcher = root.querySelector('details[data-console-roster-drawer="switcher"]');
  switcher.open = true;
  switcher.dispatchEvent(new window.Event('toggle'));
  const selector = switcher.querySelector('[data-action="select-console-agent"]');
  selector.focus();
  assert.equal(document.activeElement, selector);

  walletClient.setSnapshot({ ready: true }, { notify: true });

  assert.equal(root.querySelector('[data-action="select-console-agent"]'), selector);
  assert.equal(selector.isConnected, true);
  assert.equal(switcher.open, true);

  selector.blur();
  assert.notEqual(root.querySelector('[data-action="select-console-agent"]'), selector);
  assert.equal(root.querySelector('details[data-console-roster-drawer="switcher"]')?.open, true);
});

test('dedicated Console preserves the full-width roster drawer across rerenders and closes it after selection', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
  }).start();
  await flushAsyncEvents(30);

  let main = root.querySelector('details[data-console-roster-drawer="main"]');
  assert.equal(main?.open, false);
  assert.equal(root.querySelector('details[data-console-roster-drawer="sidebar"]'), null);
  main.open = true;
  main.dispatchEvent(new window.Event('toggle'));

  const search = main.querySelector('[data-action="search-console-agent-gallery"]');
  search.value = '812';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  main = root.querySelector('details[data-console-roster-drawer="main"]');
  assert.equal(main?.open, true);
  assert.equal(root.querySelector('details[data-console-roster-drawer="sidebar"]'), null);

  main.querySelector('[data-action="activate-console-room"][data-token-id="812"]').click();
  await flushAsyncEvents(20);
  assert.equal(root.querySelector('details[data-console-roster-drawer="main"]')?.open, false);
  assert.equal(root.querySelector('details[data-console-roster-drawer="sidebar"]'), null);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '812');
});

test('dedicated Console opens the main roster drawer when ownership loading fails', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const baseFetch = createConsoleOwnedAgentsFetch({ tokenIds: [] });
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    fetchImpl: async (url, init) => String(url).endsWith('/api/loopers/owned')
      ? new Response(JSON.stringify({ error: 'failed' }), { status: 500 })
      : baseFetch(url, init),
  }).start();
  await flushAsyncEvents(20);
  const main = root.querySelector('details[data-console-roster-drawer="main"]');
  assert.equal(main?.open, true);
  assert.ok(main?.querySelector('[role="alert"]'));
  assert.equal(root.querySelector('details[data-console-roster-drawer="sidebar"]'), null);
  assert.equal(root.querySelector('[data-action="connect-console-wallet"]')?.textContent.trim(), '0x27E3...91Ea');
  assert.doesNotMatch(root.textContent, /Loading agents\.\.\./i);
  assert.ok(root.querySelector('[data-action="refresh-console-owned-agents"]'));
});

test('dedicated Console gallery ignores older refresh responses', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const baseFetch = createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] });
  let ownedCall = 0;
  const pending = [];
  const fetchImpl = async (url, options) => {
    if (!String(url).endsWith('/api/loopers/owned')) return baseFetch(url, options);
    ownedCall += 1;
    if (ownedCall === 1) return baseFetch(url, options);
    return new Promise((resolve) => pending.push(resolve));
  };
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    fetchImpl,
  }).start();
  await flushAsyncEvents(30);

  root.querySelector('[data-action="refresh-console-owned-agents"]').click();
  await flushAsyncEvents();
  root.querySelector('[data-action="refresh-console-owned-agents"]').click();
  await flushAsyncEvents();
  assert.equal(pending.length, 2);

  pending[1](new Response(JSON.stringify({ agents: [
    createLooperConsoleAgentFixture(303, owner),
    createLooperConsoleAgentFixture(304, owner),
  ] }), { status: 200 }));
  await flushAsyncEvents(20);
  assert.match(root.querySelector('.console-agent-gallery')?.textContent ?? '', /Looper #303/);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '303');
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Looper #303/);

  pending[0](new Response(JSON.stringify({ agents: [
    createLooperConsoleAgentFixture(202, owner),
    createLooperConsoleAgentFixture(203, owner),
  ] }), { status: 200 }));
  await flushAsyncEvents(20);
  assert.match(root.querySelector('.console-agent-gallery')?.textContent ?? '', /Looper #303/);
  assert.doesNotMatch(root.querySelector('.console-agent-gallery')?.textContent ?? '', /Looper #202/);
});

test('dedicated Console gallery selects without activating chat', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  let activationCount = 0;
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
    claimApi: { activateConsoleAgent: async () => { activationCount += 1; throw new Error('Activation unavailable.'); } },
  }).start();
  await flushAsyncEvents(30);

  root.querySelector('[data-action="activate-console-room"][data-token-id="812"]').click();
  await flushAsyncEvents(20);

  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '812');
  assert.equal(activationCount, 0);
});

test('dedicated Console binds the selected Looper wallet and requires explicit send confirmation', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletState = {
    mode: 'active',
    tokenId: '617',
    owner,
    account: '0x9999999999999999999999999999999999999999',
    legacyAccount: null,
    nativeWei: '2000000000000000000',
    tokens: [],
    refreshedAt: '2026-09-21T23:59:00.000Z',
    activation: { state: 'idle' },
    send: { state: 'idle' },
  };
  const calls = [];
  const looperWalletController = {
    getSnapshot: () => ({ mode: 'read_only', reason: 'not_selected', activation: { state: 'idle' }, send: { state: 'idle' } }),
    async select(selection) { calls.push(['select', selection]); return walletState; },
    async refresh() { calls.push(['refresh']); return walletState; },
    async prepareEthSend(input) {
      calls.push(['prepareEthSend', input]);
      return { id: 'send:1', requiresExplicitConfirmation: true, transaction: { to: walletState.account } };
    },
    async submitPrepared(id, options) { calls.push(['submitPrepared', id, options]); return { ...walletState, send: { state: 'confirmed_attributed' } }; },
  };
  const walletClient = createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } });
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    looperWalletController,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
  }).start();
  await flushAsyncEvents(20);

  assert.deepEqual(calls[0], ['select', { tokenId: '617', owner: owner.toLowerCase() }]);
  openConsoleWallet(root);
  assert.match(root.querySelector('.console-looper-wallet')?.textContent ?? '', /2 ETH/);
  const form = root.querySelector('[data-action="send-looper-agent-wallet"]');
  form.querySelector('[name="recipient"]').value = '0x4444444444444444444444444444444444444444';
  form.querySelector('[name="amount"]').value = '1.5';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  assert.equal(calls.some(([name]) => name === 'prepareEthSend'), false);
  assert.match(root.querySelector('.console-looper-wallet')?.textContent ?? '', /confirmation/i);

  const confirmedForm = root.querySelector('[data-action="send-looper-agent-wallet"]');
  confirmedForm.querySelector('[name="recipient"]').value = '0x4444444444444444444444444444444444444444';
  confirmedForm.querySelector('[name="amount"]').value = '1.5';
  confirmedForm.querySelector('[name="confirmed"]').checked = true;
  confirmedForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls.find(([name]) => name === 'prepareEthSend'), ['prepareEthSend', {
    recipient: '0x4444444444444444444444444444444444444444',
    amountWei: '1500000000000000000',
  }]);
  assert.deepEqual(calls.find(([name]) => name === 'submitPrepared'), ['submitPrepared', 'send:1', { confirmed: true }]);
});

test('dedicated Console permits an active pinned pool while registry publication lags', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const account = '0x9999999999999999999999999999999999999999';
  const amount = '1250000000000000000';
  const walletState = {
    mode: 'active', canTransact: true, tokenId: '617', owner, account, legacyAccount: null,
    nativeWei: '2000000000000000000',
    tokens: [{ contract: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3', symbol: 'CRED', decimals: 18, balanceBaseUnits: '5000000000000000000' }],
    refreshedAt: '2026-10-08T22:57:00.000Z', activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
  };
  const calls = [];
  const looperWalletController = {
    getSnapshot: () => walletState,
    async select() { return walletState; },
    async prepareCredStakeApproval(input) { calls.push(['prepareCredStakeApproval', input]); return { id: calls.filter(([name]) => name === 'prepareCredStakeApproval').length === 1 ? 'send:approval1' : 'send:approval2' }; },
    async prepareCredStake(input) { calls.push(['prepareCredStake', input]); return { id: 'send:staking01' }; },
    async prepareCredAddToStake(input) { calls.push(['prepareCredAddToStake', input]); return { id: 'send:addstake1' }; },
    async preflightPrepared(id, options) { calls.push(['preflightPrepared', id, options]); return { id }; },
    submitPreflighted(id, options) { calls.push(['submitPreflighted', id, options]); return Promise.resolve({ ...walletState, send: { state: 'confirmed_attributed' } }); },
  };
  const reads = [
    { account, allowanceBaseUnits: '0', credBalanceBaseUnits: '5000000000000000000', gasPayerNativeWei: '1000000000000000', poolActive: true, stakeAmountBaseUnits: '0', stakeMonthIndex: '0', totalStakedBaseUnits: '100' },
    { account, allowanceBaseUnits: '0', credBalanceBaseUnits: '5000000000000000000', gasPayerNativeWei: '1000000000000000', poolActive: true, stakeAmountBaseUnits: '0', stakeMonthIndex: '0', totalStakedBaseUnits: '100' },
    { account, allowanceBaseUnits: amount, credBalanceBaseUnits: '5000000000000000000', gasPayerNativeWei: '1000000000000000', poolActive: true, stakeAmountBaseUnits: '0', stakeMonthIndex: '0', totalStakedBaseUnits: '100' },
    { account, allowanceBaseUnits: amount, credBalanceBaseUnits: '5000000000000000000', gasPayerNativeWei: '1000000000000000', poolActive: true, stakeAmountBaseUnits: '0', stakeMonthIndex: '0', totalStakedBaseUnits: '100' },
    { account, allowanceBaseUnits: '0', credBalanceBaseUnits: '3750000000000000000', gasPayerNativeWei: '900000000000000', poolActive: true, stakeAmountBaseUnits: amount, stakeMonthIndex: '681', totalStakedBaseUnits: '100' },
    { account, allowanceBaseUnits: '0', credBalanceBaseUnits: '3750000000000000000', gasPayerNativeWei: '900000000000000', poolActive: true, stakeAmountBaseUnits: amount, stakeMonthIndex: '681', totalStakedBaseUnits: '100' },
    { account, allowanceBaseUnits: '500000000000000000', credBalanceBaseUnits: '3750000000000000000', gasPayerNativeWei: '900000000000000', poolActive: true, stakeAmountBaseUnits: amount, stakeMonthIndex: '681', totalStakedBaseUnits: '100' },
    { account, allowanceBaseUnits: '500000000000000000', credBalanceBaseUnits: '3750000000000000000', gasPayerNativeWei: '900000000000000', poolActive: true, stakeAmountBaseUnits: amount, stakeMonthIndex: '681', totalStakedBaseUnits: '100' },
    { account, allowanceBaseUnits: '0', credBalanceBaseUnits: '3250000000000000000', gasPayerNativeWei: '850000000000000', poolActive: true, stakeAmountBaseUnits: '1750000000000000000', stakeMonthIndex: '681', totalStakedBaseUnits: '100' },
  ].map((entry) => ({ currentMonthIndex: '681', lockMonths: '6', unstakeRequestTime: '0', ...entry }));
  const ownedFetch = createConsoleOwnedAgentsFetch({ tokenIds: [617] });
  const registryUrls = [];
  const fetchImpl = async (url, init) => String(url).includes('/api/multipass/console/pantheon/cred')
    ? (registryUrls.push(String(url)), new Response(JSON.stringify({
      chain: 'base', chain_id: 8453, vault_address: '0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb', count: 0,
      tokens: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    : ownedFetch(url, init);
  window.confirm = () => true;
  await createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    looperWalletController,
    pantheonCredReader: async () => reads.shift(),
    fetchImpl,
  }).start();
  await flushAsyncEvents(20);
  openConsoleWallet(root);

  await flushAsyncEvents(20);
  assert.equal(registryUrls[0], '/multipass-api/api/multipass/console/pantheon/cred');
  const approve = root.querySelector('[data-action="approve-pantheon-cred"]');
  assert.ok(approve);
  root.querySelector('[data-wallet-action="stake-cred"]').open = true;
  approve.querySelector('[name="amount"]').value = '1.25';
  approve.querySelector('[name="confirmed"]').checked = true;
  approve.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls[0], ['prepareCredStakeApproval', { amountBaseUnits: amount }]);
  assert.deepEqual(calls[1], ['preflightPrepared', 'send:approval1', { confirmed: true }]);
  const submitApproval = root.querySelector('[data-action="submit-pantheon-approval"]');
  assert.ok(submitApproval);
  assert.equal(root.querySelector('[data-wallet-action="stake-cred"]')?.open, true, 'the prepared wallet-opening action must stay visible after rerender');
  submitApproval.querySelector('[name="confirmed"]').checked = true;
  submitApproval.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls[2], ['submitPreflighted', 'send:approval1', { confirmed: true }]);

  const stake = root.querySelector('[data-action="stake-pantheon-cred"]');
  assert.ok(stake);
  stake.querySelector('[name="confirmed"]').checked = true;
  stake.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls[3], ['prepareCredStake', { amountBaseUnits: amount }]);
  assert.deepEqual(calls[4], ['preflightPrepared', 'send:staking01', { confirmed: true }]);
  const submitStake = root.querySelector('[data-action="submit-pantheon-stake"]');
  assert.ok(submitStake);
  submitStake.querySelector('[name="confirmed"]').checked = true;
  submitStake.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls[5], ['submitPreflighted', 'send:staking01', { confirmed: true }]);
  assert.match(root.querySelector('[data-wallet-action="stake-cred"]')?.textContent ?? '', /Active Pantheon position/i);

  const addMore = root.querySelector('[data-action="approve-pantheon-cred"]');
  assert.ok(addMore, 'active positions must offer an exact-approval add-more flow');
  assert.match(addMore.textContent, /Add more CRED|Prepare exact CRED approval/i);
  assert.match(addMore.textContent, /5% claim fee/i);
  assert.match(addMore.textContent, /10% early-exit penalty/i);
  addMore.querySelector('[name="amount"]').value = '0.5';
  addMore.querySelector('[name="confirmed"]').checked = true;
  addMore.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls[6], ['prepareCredStakeApproval', { amountBaseUnits: '500000000000000000' }]);
  assert.deepEqual(calls[7], ['preflightPrepared', 'send:approval2', { confirmed: true }]);

  const submitTopUpApproval = root.querySelector('[data-action="submit-pantheon-approval"]');
  submitTopUpApproval.querySelector('[name="confirmed"]').checked = true;
  submitTopUpApproval.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls[8], ['submitPreflighted', 'send:approval2', { confirmed: true }]);
  assert.match(root.querySelector('[data-action="stake-pantheon-cred"]')?.textContent ?? '', /2027-05-01/);

  const prepareTopUp = root.querySelector('[data-action="stake-pantheon-cred"]');
  prepareTopUp.querySelector('[name="confirmed"]').checked = true;
  prepareTopUp.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls[9], ['prepareCredAddToStake', { amountBaseUnits: '500000000000000000' }]);
  assert.deepEqual(calls[10], ['preflightPrepared', 'send:addstake1', { confirmed: true }]);

  const submitTopUp = root.querySelector('[data-action="submit-pantheon-stake"]');
  submitTopUp.querySelector('[name="confirmed"]').checked = true;
  submitTopUp.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls[11], ['submitPreflighted', 'send:addstake1', { confirmed: true }]);
  const completed = root.querySelector('[data-wallet-action="stake-cred"]')?.textContent ?? '';
  assert.match(completed, /1\.75 CRED/);
  assert.match(completed, /2027-05-01/);
});

test('dedicated Console blocks unpublished CRED when the pinned onchain pool is inactive', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const account = '0x9999999999999999999999999999999999999999';
  const walletState = {
    mode: 'active', canTransact: true, tokenId: '617', owner, account, legacyAccount: null,
    nativeWei: '2000000000000000000',
    tokens: [{ contract: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3', symbol: 'CRED', decimals: 18, balanceBaseUnits: '5000000000000000000' }],
    activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
  };
  const transactionCalls = [];
  const looperWalletController = {
    getSnapshot: () => walletState,
    async select() { return walletState; },
    async prepareCredStakeApproval(input) { transactionCalls.push(['approve', input]); throw new Error('must not prepare'); },
    async prepareCredStake(input) { transactionCalls.push(['stake', input]); throw new Error('must not prepare'); },
  };
  const ownedFetch = createConsoleOwnedAgentsFetch({ tokenIds: [617] });
  const fetchImpl = async (url, init) => String(url).includes('/api/multipass/console/pantheon/cred')
    ? new Response(JSON.stringify({
      chain: 'base', chain_id: 8453, vault_address: '0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb', count: 0, tokens: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
    : ownedFetch(url, init);
  await createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner } }),
    looperWalletController,
    pantheonCredReader: async () => ({ account, allowanceBaseUnits: '0', credBalanceBaseUnits: '5000000000000000000', gasPayerNativeWei: '1', poolActive: false, stakeAmountBaseUnits: '0', stakeMonthIndex: '0', totalStakedBaseUnits: '0' }),
    fetchImpl,
  }).start();
  await flushAsyncEvents(20);
  openConsoleWallet(root);
  await flushAsyncEvents(20);
  assert.equal(root.querySelector('[data-action="approve-pantheon-cred"]'), null);
  assert.equal(root.querySelector('[data-action="stake-pantheon-cred"]'), null);
  assert.match(root.querySelector('[data-wallet-action="stake-cred"]')?.textContent ?? '', /not active/i);
  assert.deepEqual(transactionCalls, []);
});

test('dedicated Console automatically shows an existing Pantheon position after wallet selection', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0xEFeBc9247088b00f0AF880862521b61a7B801c00';
  const account = '0x223388DbE651f5e228D6ad67D9AAFD49a16550fb';
  const walletState = {
    mode: 'active', canTransact: true, tokenId: '210', owner, account,
    nativeWei: '0', tokens: [{ contract: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3', symbol: 'CRED', decimals: 18, balanceBaseUnits: '73170731707317073170731' }],
    activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
  };
  let reads = 0;
  const ownedFetch = createConsoleOwnedAgentsFetch({ tokenIds: [210] });
  const fetchImpl = async (url, init) => String(url).includes('/api/multipass/console/pantheon/cred')
    ? new Response(JSON.stringify({ chain: 'base', chain_id: 8453, vault_address: '0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb', count: 0, tokens: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    : ownedFetch(url, init);
  await createApp({
    root, loadDemo: async () => sampleData(), fetchImpl,
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner } }),
    looperWalletController: { getSnapshot: () => walletState, async select() { return walletState; } },
    pantheonCredReader: async () => {
      reads += 1;
      return { account, allowanceBaseUnits: '0', credBalanceBaseUnits: '73170731707317073170731', gasPayerNativeWei: '1', poolActive: true, stakeAmountBaseUnits: '4500000000000000000000000', currentMonthIndex: '681', lockMonths: '6', unstakeRequestTime: '0', stakeMonthIndex: '681', totalStakedBaseUnits: '4500000000000000000000000' };
    },
  }).start();
  await flushAsyncEvents(30);
  openConsoleWallet(root);
  const staking = root.querySelector('[data-wallet-action="stake-cred"]')?.textContent ?? '';
  assert.equal(reads, 1);
  assert.match(staking, /Active Pantheon position/i);
  assert.match(staking, /4500000 CRED/i);
  assert.doesNotMatch(staking, /Check staking/i);
});

test('Console discards stale Pantheon checks after selecting another Looper', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const makeWallet = (tokenId) => ({
    mode: 'active', canTransact: true, tokenId: String(tokenId), owner,
    account: tokenId === 617 ? '0x9999999999999999999999999999999999999999' : '0x8888888888888888888888888888888888888888',
    nativeWei: '1', tokens: [{ contract: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3', symbol: 'CRED', decimals: 18, balanceBaseUnits: '1' }],
    activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
  });
  let walletState = makeWallet(617);
  const looperWalletController = {
    getSnapshot: () => walletState,
    async select({ tokenId }) { walletState = makeWallet(Number(tokenId)); return walletState; },
  };
  let resolveRead;
  const pendingRead = new Promise((resolve) => { resolveRead = resolve; });
  const ownedFetch = createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] });
  const fetchImpl = async (url, init) => String(url).includes('/api/multipass/console/pantheon/cred')
    ? new Response(JSON.stringify({
      chain: 'base', chain_id: 8453, vault_address: '0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb', count: 1,
      tokens: [{ token_address: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3', symbol: 'CRED', name: 'CRED', decimals: 18, active: true, reward_tokens: [] }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
    : ownedFetch(url, init);
  await createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner } }),
    looperWalletController, pantheonCredReader: async () => pendingRead, fetchImpl,
  }).start();
  await flushAsyncEvents(20);
  openConsoleWallet(root);
  await flushAsyncEvents();
  const selector = root.querySelector('[data-action="select-console-agent"]');
  selector.value = '812';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents(20);
  resolveRead({ account: '0x9999999999999999999999999999999999999999', allowanceBaseUnits: '0', credBalanceBaseUnits: '1', gasPayerNativeWei: '1', poolActive: true, stakeAmountBaseUnits: '0', stakeMonthIndex: '0', totalStakedBaseUnits: '0' });
  await flushAsyncEvents(20);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '812');
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Looper #812/i);
  assert.equal(root.querySelector('[data-action="approve-pantheon-cred"]'), null);
});

test('dedicated Console reconciles successful smart-wallet activation in place after wrapped receipt mismatch', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const account = '0x9999999999999999999999999999999999999999';
  const baseWallet = {
    tokenId: '617', owner, account, legacyAccount: null, nativeWei: '0', tokens: [],
    operatorProfile: 'eip7702', policyStatus: 'owner-only', policyRecoveryAllowed: false,
    activation: { state: 'idle', txHash: null }, send: { state: 'idle' }, policy: { state: 'idle' },
  };
  let walletState = { ...baseWallet, mode: 'read_only', reason: 'not_selected', canTransact: false };
  const calls = [];
  const looperWalletController = {
    getSnapshot: () => walletState,
    async select(selection) {
      calls.push(['select', selection]);
      walletState = { ...baseWallet, mode: 'inactive', reason: null, canTransact: true };
      return walletState;
    },
    async prepareActivation() {
      calls.push(['prepareActivation']);
      walletState = { ...walletState, activation: { state: 'prepared', preparedId: 'activation:smart-wallet' } };
      return { id: 'activation:smart-wallet', requiresExplicitConfirmation: true };
    },
    async submitPrepared(id, options) {
      calls.push(['submitPrepared', id, options]);
      walletState = {
        ...walletState,
        activation: { state: 'uncertain_hashed', txHash: `0x${'cc'.repeat(32)}`, preparedId: null },
      };
      throw new Error('Receipt transaction binding has a from, to, input mismatch.');
    },
    async refresh() {
      calls.push(['refresh']);
      walletState = {
        ...baseWallet,
        mode: 'active', reason: null, canTransact: true,
        activation: { state: 'observed_unattributed', txHash: `0x${'cc'.repeat(32)}`, attributable: false },
      };
      return walletState;
    },
  };

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    looperWalletController,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
  }).start();
  await flushAsyncEvents(20);

  openConsoleWallet(root);
  const form = root.querySelector('[data-action="activate-looper-agent-wallet"]');
  assert.ok(form);
  form.querySelector('[name="confirmed"]').checked = true;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(30);

  assert.deepEqual(calls.map(([name]) => name), ['select', 'prepareActivation', 'submitPrepared', 'refresh']);
  assert.equal(root.querySelector('[data-action="set-console-workspace-view"][data-console-view="multipass"]')?.getAttribute('aria-current'), 'page');
  openConsoleWallet(root);
  assert.equal(root.querySelector('.console-looper-wallet-status')?.dataset.walletMode, 'active');
  assert.equal(root.querySelector('.console-looper-wallet-outcome'), null);
  assert.equal(root.querySelector('.console-looper-wallet-error'), null);
  assert.doesNotMatch(root.querySelector('.console-looper-wallet')?.textContent ?? '', /Activation required|Transaction outcome unknown|Console request failed safely/i);
});

test('dedicated Console blocks agent switching while a Looper wallet submission is nonterminal', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const baseWallet = {
    mode: 'active', tokenId: '617', owner,
    account: '0x9999999999999999999999999999999999999999', legacyAccount: null,
    nativeWei: '2000000000000000000', tokens: [], policyStatus: 'owner-only', canTransact: true,
    activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
  };
  let controllerState = { mode: 'read_only', reason: 'not_selected', activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' } };
  let finishSubmission;
  const pendingSubmission = new Promise((resolve) => { finishSubmission = resolve; });
  const calls = [];
  const looperWalletController = {
    getSnapshot: () => controllerState,
    async select(selection) {
      calls.push(['select', selection]);
      controllerState = { ...baseWallet, tokenId: String(selection.tokenId) };
      return controllerState;
    },
    async prepareEthSend() {
      controllerState = { ...controllerState, send: { state: 'prepared', preparedId: 'send:pending' } };
      return { id: 'send:pending', requiresExplicitConfirmation: true, transaction: { to: controllerState.account } };
    },
    async submitPrepared() {
      await pendingSubmission;
      controllerState = { ...controllerState, send: { state: 'confirmed_attributed', preparedId: null } };
      return controllerState;
    },
  };
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    looperWalletController,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
  }).start();
  await flushAsyncEvents(20);

  root.querySelector('[data-action="activate-console-room"][data-token-id="617"]').click();
  await flushAsyncEvents(20);
  openConsoleWallet(root);
  let selector;
  const form = root.querySelector('[data-action="send-looper-agent-wallet"]');
  form.querySelector('[name="recipient"]').value = '0x4444444444444444444444444444444444444444';
  form.querySelector('[name="amount"]').value = '1';
  form.querySelector('[name="confirmed"]').checked = true;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(10);

  selector = root.querySelector('[data-action="select-console-agent"]');
  assert.equal(selector.disabled, true);
  selector.value = '812';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents(10);
  assert.equal(calls.filter(([name]) => name === 'select').length, 1);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '617');
  finishSubmission();
  await flushAsyncEvents(20);
});

test('dedicated Console exposes explicit acknowledgment for an unknown wallet outcome', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  let walletState = {
    mode: 'active', tokenId: '617', owner,
    account: '0x9999999999999999999999999999999999999999', legacyAccount: null,
    nativeWei: '0', tokens: [], policyStatus: 'owner-only', canTransact: true,
    activation: { state: 'idle' },
    send: { state: 'uncertain_hashed', txHash: `0x${'cc'.repeat(32)}` },
    policy: { state: 'idle' },
  };
  const calls = [];
  const looperWalletController = {
    getSnapshot: () => walletState,
    async select() { return walletState; },
    acknowledgeUnknown(kind) {
      calls.push(['acknowledgeUnknown', kind]);
      walletState = { ...walletState, send: { state: 'acknowledged_unknown', txHash: walletState.send.txHash } };
      return walletState;
    },
  };
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    looperWalletController,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
  }).start();
  await flushAsyncEvents(20);

  openConsoleWallet(root);
  const button = root.querySelector('[data-action="acknowledge-looper-wallet-outcome"]');
  assert.ok(button);
  button.click();
  await flushAsyncEvents();
  assert.deepEqual(calls, [['acknowledgeUnknown', 'send']]);
  assert.equal(root.querySelector('[data-action="acknowledge-looper-wallet-outcome"]'), null);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.disabled, false);
});

test('dedicated Console discards stale wallet capabilities after select or refresh RPC errors', async () => {
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const staleWallet = {
    mode: 'active', tokenId: '617', owner,
    account: '0x9999999999999999999999999999999999999999', legacyAccount: null,
    nativeWei: '100', tokens: [], policyStatus: 'active-policy', policyRecoveryAllowed: true, canTransact: true,
    activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
  };
  let root = setupDom('https://helixa.xyz/multipass/console');
  let looperWalletController = {
    getSnapshot: () => staleWallet,
    async select() { return staleWallet; },
    async refresh() { throw new Error('Base wallet snapshots disagree.'); },
  };
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    looperWalletController,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
  }).start();
  await flushAsyncEvents(20);
  openConsoleWallet(root);
  root.querySelector('[data-action="refresh-looper-agent-wallet"]').click();
  await flushAsyncEvents(20);
  let panel = root.querySelector('.console-looper-wallet');
  assert.equal(panel.querySelector('.console-looper-wallet-status')?.textContent, 'Read-only');
  assert.equal(panel.querySelector('[data-action="send-looper-agent-wallet"]'), null);
  assert.equal(panel.querySelector('[data-action="set-looper-policy-module"]'), null);
  assert.equal(panel.querySelector('[data-action="refresh-looper-agent-wallet"]')?.disabled, false);

  root = setupDom('https://helixa.xyz/multipass/console');
  looperWalletController = {
    getSnapshot: () => staleWallet,
    async select() { throw new Error('Base wallet snapshots disagree.'); },
  };
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    looperWalletController,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
  }).start();
  await flushAsyncEvents(20);
  openConsoleWallet(root);
  panel = root.querySelector('.console-looper-wallet');
  assert.equal(panel.querySelector('.console-looper-wallet-status')?.textContent, 'Read-only');
  assert.equal(panel.querySelector('[data-action="send-looper-agent-wallet"]'), null);
  assert.equal(panel.querySelector('[data-action="set-looper-policy-module"]'), null);
});

test('dedicated Console wires only explicit owner-confirmed policy module recovery', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletState = {
    mode: 'read_only', reason: 'module_blocked', policyStatus: 'module-blocked', canTransact: false,
    policyRecoveryAllowed: true, policyModule: '0x7777777777777777777777777777777777777777', policyEpoch: '4',
    tokenId: '617', owner, account: '0x9999999999999999999999999999999999999999', legacyAccount: null,
    nativeWei: '0', tokens: [], refreshedAt: '2026-09-22T09:00:00.000Z',
    activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
  };
  const calls = [];
  let preparedCounter = 0;
  const looperWalletController = {
    getSnapshot: () => ({ mode: 'read_only', reason: 'not_selected', activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' } }),
    async select(selection) { calls.push(['select', selection]); return walletState; },
    async refresh() { return walletState; },
    async preparePolicyModule(input) {
      calls.push(['preparePolicyModule', input]);
      preparedCounter += 1;
      return { id: `policy:${preparedCounter}`, requiresExplicitConfirmation: true, transaction: { to: walletState.account, value: '0x0', data: '0xdeadbeef' } };
    },
    async submitPrepared(id, options) {
      calls.push(['submitPrepared', id, options]);
      return { ...walletState, mode: 'active', reason: null, policyStatus: 'owner-only', canTransact: true, policyModule: '0x0000000000000000000000000000000000000000' };
    },
  };
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    looperWalletController,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
  }).start();
  await flushAsyncEvents(20);

  openConsoleWallet(root);
  let form = root.querySelector('[data-action="set-looper-policy-module"]');
  form.querySelector('[name="module"]').value = '';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  assert.equal(calls.some(([name]) => name === 'preparePolicyModule'), false);
  assert.match(root.querySelector('.console-looper-wallet')?.textContent ?? '', /explicit permission module confirmation/i);

  form = root.querySelector('[data-action="set-looper-policy-module"]');
  form.querySelector('[name="module"]').value = '';
  form.querySelector('[name="confirmed"]').checked = true;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls.find(([name]) => name === 'preparePolicyModule'), ['preparePolicyModule', { module: '0x0000000000000000000000000000000000000000' }]);
  assert.deepEqual(calls.find(([name]) => name === 'submitPrepared'), ['submitPrepared', 'policy:1', { confirmed: true }]);
  assert.equal(root.querySelector('.console-looper-wallet-status')?.textContent, 'Owner controlled');

  form = root.querySelector('[data-action="set-looper-policy-module"]');
  form.querySelector('[name="module"]').value = '0x8888888888888888888888888888888888888888';
  form.querySelector('[name="confirmed"]').checked = true;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  assert.deepEqual(calls.filter(([name]) => name === 'preparePolicyModule').at(-1), [
    'preparePolicyModule',
    { module: '0x8888888888888888888888888888888888888888' },
  ]);
  assert.deepEqual(calls.filter(([name]) => name === 'submitPrepared').at(-1), ['submitPrepared', 'policy:2', { confirmed: true }]);
});

test('dedicated Console route hydrates the canonical XMTP thread returned by activation', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
    },
  });
  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      activateConsoleAgent: async (input) => {
        assert.equal(input.tokenId, '617');
        assert.equal(input.conversationId, undefined);
        return {
          thread: {
            transport: 'xmtp_group',
            conversationId: 'conversation-617',
            topicId: 'canonical-topic-617',
            roomName: 'Looper #617 ops',
            participants: [{ tokenId: '617', displayName: 'Looper #617' }],
            messages: [{ id: 'xmtp-1', xmtpMessageId: 'xmtp-1', role: 'agent', senderLabel: 'Looper #617', text: 'Recovered canonical thread.', transport: 'xmtp_group' }],
          },
          memory: { provider: 'sibyl_memory', recalled: [{ text: 'Prior mission recovered.' }] },
          proposals: [],
          missions: [],
        };
      },
    },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  await flushAsyncEvents();

  const thread = root.querySelector('.console-agent-thread-panel')?.textContent ?? '';
  assert.match(thread, /Recovered canonical thread/);
  assert.match(thread, /Prior mission recovered/);
  assert.match(thread, /XMTP/);
  assert.doesNotMatch(thread, /Local test adapter/i);
});

test('dedicated Console route sends wallet-scoped agent thread messages', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const calls = [];
  let walletClient;
  walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
    claimApi: {
      activateConsoleAgent: async ({ tokenId }) => ({
        thread: {
          transport: 'xmtp_local',
          roomName: `Looper #${tokenId} room`,
          participants: [{ tokenId, displayName: `Looper #${tokenId}` }],
          messages: tokenId === '812'
            ? [{ id: 'hidden-812', role: 'agent', senderLabel: 'Looper #812', text: 'Saved through the hosted worker.', transport: 'xmtp_local' }]
            : [],
        },
      }),
      sendConsoleAgentMessage: async (input) => {
        calls.push(input);
        return {
          thread: {
            transport: 'xmtp_local',
            roomName: 'Looper #812 room',
            participants: [{ tokenId: '812', displayName: 'Looper #812' }],
            messages: [
              { role: 'human', text: input.message, transport: 'xmtp_local' },
              { id: 'hidden-812', role: 'agent', senderLabel: 'Looper #617', text: 'Saved through the hosted worker.', transport: 'xmtp_local', inferenceProvider: 'fake_bankr' },
              { role: 'agent', senderLabel: 'Looper #812', text: 'Joined the room and will monitor the same mission.', transport: 'xmtp_local', inferenceProvider: 'fake_bankr' },
            ],
          },
          memory: { provider: 'sibyl_memory' },
          proposals: [
            {
              status: 'review_only',
              title: 'Review watchlist briefing',
              action: 'Keep monitoring before execution.',
              risk: 'No transaction authority is attached.',
            },
          ],
        };
      },
    },
  }).start();

  root.querySelector('[data-action="activate-console-room"][data-token-id="812"]')?.click();
  await flushAsyncEvents();

  const form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea[name="message"]').value = 'Watch NVDAx and Base agent tokens.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].wallet, undefined);
  assert.equal(calls[0].agentId, undefined);
  assert.equal(calls[0].tokenId, '812');
  assert.equal(calls[0].message, 'Watch NVDAx and Base agent tokens.');
  assert.equal(calls[0].csrfToken, 'test-csrf');
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Saved through the hosted worker/);
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Looper #812/);
  assert.match(root.querySelector('.console-thread-proposal')?.textContent ?? '', /Review watchlist briefing/);
  assert.match(root.querySelector('.console-thread-member-list')?.textContent ?? '', /Looper #812/);
  assert.equal(root.querySelector('[data-action="reset-console-session"]')?.disabled, false);
  assert.equal(root.querySelector('[data-action="reset-console-session"]')?.textContent.trim(), 'Hide chat locally');
  root.querySelector('[data-action="reset-console-session"]').click();
  await flushAsyncEvents();
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Session recall|Wallet 0x27E3\.\.\.91Ea recalled/);
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Saved through the hosted worker|Review watchlist briefing/);
  assert.equal(root.querySelector('.console-proposal-list'), null);

  const selector = root.querySelector('[data-action="select-console-agent"]');
  selector.value = '617';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents();
  selector.value = '812';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents();
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Saved through the hosted worker/);
});

test('Console image picker, paste, drop, removal, retry, and success stay ephemeral', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const sent = [];
  const revoked = [];
  let previewSequence = 0;
  let sendAttempts = 0;
  let rejectFirstSend;
  const walletClient = createWalletClientFixture({
    snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: '0x27E3...91Ea' },
  });
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    prepareConsoleImageImpl: async (file) => ({
      kind: 'image', mimeType: 'image/png', filename: file.name, base64: 'iVBORw0KGgo=', byteLength: 8, width: 12, height: 8,
    }),
    imagePreviewFactory: () => {
      let url = null;
      return {
        set() { if (url) revoked.push(url); url = `blob:preview-${++previewSequence}`; return url; },
        clear() { if (url) revoked.push(url); url = null; },
        get url() { return url; },
      };
    },
    claimApi: {
      activateConsoleAgent: async () => ({
        thread: { transport: 'xmtp_local', participants: [{ tokenId: '617', displayName: 'Looper #617' }], messages: [] },
      }),
      sendConsoleAgentMessage: async (input) => {
        sent.push(input);
        sendAttempts += 1;
        if (sendAttempts === 1) {
          return new Promise((_resolve, reject) => { rejectFirstSend = reject; });
        }
        return {
          thread: {
            transport: 'xmtp_local', participants: [{ tokenId: '617', displayName: 'Looper #617' }],
            messages: [
              { id: 'image-human', role: 'human', text: input.message, attachment: input.attachment, transport: 'xmtp_local' },
              { id: 'image-agent', role: 'agent', text: 'I can see the uploaded chart.', inferenceProvider: 'bankr_llm_gateway', transport: 'xmtp_local' },
            ],
          },
          memory: { provider: 'sibyl_memory', saved: [], recalled: [] }, proposals: [], missions: [],
        };
      },
    },
  }).start();
  await flushAsyncEvents();

  root.querySelector('[data-action="activate-console-room"][data-token-id="617"]')?.click();
  await flushAsyncEvents();
  const fakeFile = (name) => ({ name, type: 'image/png' });

  let input = root.querySelector('[data-console-image-input]');
  Object.defineProperty(input, 'files', { configurable: true, value: [fakeFile('picker.png')] });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents();
  assert.match(root.querySelector('[data-console-image-preview]')?.textContent ?? '', /picker\.png/);
  root.querySelector('[data-action="remove-console-image"]')?.click();
  await flushAsyncEvents();
  assert.equal(root.querySelector('[data-console-image-preview]'), null);
  input = root.querySelector('[data-console-image-input]');
  Object.defineProperty(input, 'files', { configurable: true, value: [fakeFile('one.png'), fakeFile('two.png')] });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents();
  assert.match(root.querySelector('.console-image-error')?.textContent ?? '', /one image/i);

  let form = root.querySelector('[data-action="send-console-agent-message"]');
  const drop = new window.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: { files: [fakeFile('drop.png')], items: [{ kind: 'file' }] } });
  form.dispatchEvent(drop);
  await flushAsyncEvents();
  assert.match(root.querySelector('[data-console-image-preview]')?.textContent ?? '', /drop\.png/);

  form = root.querySelector('[data-action="send-console-agent-message"]');
  const paste = new window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(paste, 'clipboardData', { value: { files: [fakeFile('paste.png')] } });
  form.dispatchEvent(paste);
  await flushAsyncEvents();
  assert.match(root.querySelector('[data-console-image-preview]')?.textContent ?? '', /paste\.png/);
  assert.ok(revoked.length >= 2, 'replacement and removal revoke prior object URLs');

  form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea[name="message"]').value = 'Read this chart.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  const blockedPaste = new window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(blockedPaste, 'clipboardData', { value: { files: [fakeFile('must-not-replace.png')] } });
  root.querySelector('[data-action="send-console-agent-message"]')?.dispatchEvent(blockedPaste);
  await flushAsyncEvents();
  assert.match(root.querySelector('[data-console-image-preview]')?.textContent ?? '', /paste\.png/);
  rejectFirstSend(new Error('temporary image provider failure'));
  await flushAsyncEvents();
  assert.equal(root.querySelector('[data-action="send-console-agent-message"] button[type="submit"]')?.textContent.trim(), 'Retry');
  assert.ok(root.querySelector('[data-console-image-preview]'), 'failed image remains available for retry');

  root.querySelector('[data-action="send-console-agent-message"]')?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  assert.equal(sent.length, 2);
  assert.equal(sent[1].attachment.filename, 'paste.png');
  assert.match(sent[0].clientMessageId, /^[A-Za-z0-9_-]{8,128}$/);
  assert.equal(sent[1].clientMessageId, sent[0].clientMessageId);
  assert.equal(root.querySelector('[data-console-image-preview]'), null);
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /I can see the uploaded chart/);
  assert.ok(root.querySelector('.console-message-image img'));
  assert.match(root.textContent, /CRED/);
});

test('dedicated Console verifies XMTP registration before the first live room send', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const order = [];
  const wallet = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({
    snapshot: { connected: true, address: wallet, label: '0x27E3...91Ea' },
  });

  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      activateConsoleAgent: async () => ({
        thread: {
          transport: 'xmtp_group',
          conversationId: null,
          participants: [{ tokenId: '617', displayName: 'Looper #617' }],
          messages: [],
        },
        memory: { provider: 'sibyl_memory', recalled: [] },
        proposals: [],
        executionMode: 'review_only',
      }),
      ensureXmtpWalletRegistration: async (input) => {
        order.push('register');
        assert.equal(input.wallet, wallet);
        assert.equal(typeof input.signMessage, 'function');
        return { registered: true, created: false };
      },
      sendConsoleAgentMessage: async (input) => {
        order.push('send');
        return {
          thread: {
            transport: 'xmtp_group',
            conversationId: 'conversation-617',
            participants: [{ tokenId: '617', displayName: 'Looper #617' }],
            messages: [
              { role: 'human', text: input.message, transport: 'xmtp_group' },
              { role: 'agent', text: 'Registered and delivered.', transport: 'xmtp_group', inferenceProvider: 'bankr_llm_gateway' },
            ],
          },
          memory: { provider: 'sibyl_memory', saved: [], recalled: [] },
          proposals: [],
        };
      },
    },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  await flushAsyncEvents(30);

  const form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea[name="message"]').value = 'What can this Looper do?';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(30);

  assert.deepEqual(order, ['register', 'send']);
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Registered and delivered/);
});

test('dedicated Console restores a remembered Looper chat without waiting for activated-wallet discovery', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const writes = captureInnerHtmlWrites(root);
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const storage = createMemoryStorage({
    'multipass.console.lastLooperByWallet.v1': JSON.stringify({
      schemaVersion: 1,
      selections: { [owner.toLowerCase()]: '812' },
    }),
  });
  const activations = [];
  let signCount = 0;
  let discoveryAborted = false;
  const walletCalls = [];
  const looperWalletController = {
    getSnapshot: () => ({ mode: 'read_only', reason: 'not_selected', activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' } }),
    async select(selection) {
      walletCalls.push(['select', selection]);
      return { mode: 'inactive', reason: null, tokenId: String(selection.tokenId), owner: selection.owner, account: '0x9999999999999999999999999999999999999999', nativeWei: '0', tokens: [], activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' } };
    },
    async prepareActivation() { assert.fail('automatic opening must not prepare wallet activation'); },
    async submitPrepared() { assert.fail('automatic opening must not submit a wallet transaction'); },
  };
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({
      snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' },
      signMessage: async () => { signCount += 1; return { wallet: owner, signature: '0xsig' }; },
    }),
    looperWalletController,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
    consolePreferenceStorage: storage,
    releasedLooperLoader: ({ signal }) => new Promise((resolve) => {
      signal.addEventListener('abort', () => {
        discoveryAborted = true;
        resolve({ status: 'unavailable', tokenIds: new Set() });
      }, { once: true });
    }),
    claimApi: {
      activateConsoleAgent: async ({ tokenId }) => {
        activations.push(tokenId);
        return {
          thread: {
            transport: 'xmtp_group',
            conversationId: 'conversation-812',
            participants: [{ tokenId: '812', displayName: 'Looper #812' }],
            messages: [{ role: 'agent', text: 'Restored remembered room.', transport: 'xmtp_group' }],
          },
          memory: {},
          proposals: [],
        };
      },
    },
  }).start();
  await flushAsyncEvents(30);

  assert.deepEqual(activations, ['812']);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '812');
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Restored remembered room/);
  assert.equal(signCount, 1);
  assert.equal(discoveryAborted, true);
  assert.deepEqual(walletCalls.map(([name]) => name), ['select']);
  assert.equal(writes.some((html) => html.includes('console-agent-gallery-card') && !html.includes('console-agent-thread-panel')), false);
});

test('dedicated Console prefers an activated owned Looper then falls back to the first canonical token', async (t) => {
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  for (const scenario of [
    { name: 'activated', discovery: { status: 'available', tokenIds: new Set(['812']) }, expected: '812' },
    { name: 'unavailable', discovery: { status: 'unavailable', tokenIds: new Set() }, expected: '617' },
  ]) {
    await t.test(scenario.name, async () => {
      const root = setupDom('https://helixa.xyz/multipass/console');
      const activations = [];
      await createApp({
        root,
        loadDemo: async () => sampleData(),
        walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
        fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [812, 617] }),
        consolePreferenceStorage: createMemoryStorage(),
        releasedLooperLoader: async () => scenario.discovery,
        claimApi: { activateConsoleAgent: async ({ tokenId }) => {
          activations.push(tokenId);
          return { thread: { messages: [] }, memory: {}, proposals: [] };
        } },
      }).start();
      await flushAsyncEvents(30);
      assert.deepEqual(activations, []);
      assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, scenario.expected);
    });
  }
});

test('dedicated Console remembers selection independently of chat activation', async () => {
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const key = 'multipass.console.lastLooperByWallet.v1';
  const successfulStorage = createMemoryStorage();
  let root = setupDom('https://helixa.xyz/multipass/console');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    consolePreferenceStorage: successfulStorage,
    releasedLooperLoader: async () => ({ status: 'available', tokenIds: new Set() }),
    claimApi: { activateConsoleAgent: async () => ({ thread: { messages: [] }, memory: {}, proposals: [] }) },
  }).start();
  await flushAsyncEvents(30);
  assert.equal(JSON.parse(successfulStorage.value(key)).selections[owner.toLowerCase()], '617');

  const failedStorage = createMemoryStorage();
  root = setupDom('https://helixa.xyz/multipass/console');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: '0x27E3...91Ea' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    consolePreferenceStorage: failedStorage,
    releasedLooperLoader: async () => ({ status: 'available', tokenIds: new Set() }),
    claimApi: { activateConsoleAgent: async () => { throw new Error('activation failed'); } },
  }).start();
  await flushAsyncEvents(30);
  assert.equal(JSON.parse(failedStorage.value(key)).selections[owner.toLowerCase()], '617');
});

test('dedicated Console auto-selects a sole freshly owned Looper without activating it', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const activations = [];
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      activateConsoleAgent: async (input) => {
        activations.push(input.tokenId);
        return {
          thread: {
            transport: 'xmtp_group',
            conversationId: 'conversation-617',
            participants: [{ tokenId: '617', displayName: 'Looper #617' }],
            messages: [{ role: 'agent', text: 'Sole Looper activated.', transport: 'xmtp_group' }],
          },
          memory: { provider: 'sibyl_memory', recalled: [] },
          proposals: [],
          executionMode: 'review_only',
        };
      },
    },
  }).start();
  await flushAsyncEvents(30);

  assert.deepEqual(activations, []);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '617');
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Sole Looper activated/);
});

test('dedicated Console clears authenticated agent state when the wallet changes', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
  }).start();
  await flushAsyncEvents(30);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '617');

  walletClient.setSnapshot({
    connected: true,
    address: '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE',
    label: '0x709D...44aE',
  }, { notify: true });
  await flushAsyncEvents();

  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '');
  assert.doesNotMatch(root.querySelector('.console-agent-panel')?.textContent ?? '', /Looper #617/);
  assert.equal(root.querySelector('[data-action="send-console-agent-message"]'), null);
  assert.match(root.querySelector('.console-auth-gate')?.textContent ?? '', /Sign in to Console/i);
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Sole Looper activated/);
});

test('dedicated Console ignores stale activation results after a newer agent selection', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const preferenceStorage = createMemoryStorage();
  let resolveFirstActivation;
  let markFirstActivationStarted;
  const firstActivation = new Promise((resolve) => { resolveFirstActivation = resolve; });
  const firstActivationStarted = new Promise((resolve) => { markFirstActivationStarted = resolve; });
  const walletClient = createWalletClientFixture({ snapshot: { connected: true, address: owner, label: 'owner' } });
  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
    consolePreferenceStorage: preferenceStorage,
    claimApi: {
      activateConsoleAgent: async ({ tokenId }) => {
        if (tokenId === '617') {
          markFirstActivationStarted();
          return firstActivation;
        }
        return {
          thread: {
            transport: 'xmtp_group',
            conversationId: 'conversation-812',
            participants: [{ tokenId: '812', displayName: 'Looper #812' }],
            messages: [{ role: 'agent', text: 'Newest room.', transport: 'xmtp_group' }],
          },
          memory: { provider: 'sibyl_memory' },
          proposals: [],
        };
      },
    },
  });
  await app.start();
  const staleActivation = app.activateSelectedConsoleAgent();
  await firstActivationStarted;

  const selector = root.querySelector('[data-action="select-console-agent"]');
  selector.value = '812';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents(20);
  await app.activateSelectedConsoleAgent();

  resolveFirstActivation({
    thread: {
      transport: 'xmtp_group',
      conversationId: 'conversation-617',
      participants: [{ tokenId: '617', displayName: 'Looper #617' }],
      messages: [{ role: 'agent', text: 'Stale room.', transport: 'xmtp_group' }],
    },
    memory: { provider: 'sibyl_memory' },
    proposals: [],
  });
  await staleActivation;
  await flushAsyncEvents();

  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '812');
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Newest room/);
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Stale room/);
  assert.equal(JSON.parse(preferenceStorage.value('multipass.console.lastLooperByWallet.v1')).selections[owner.toLowerCase()], '812');
});

test('dedicated Console preserves a failed mission draft and sanitizes provider errors for retry', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      activateConsoleAgent: async () => ({ thread: { messages: [] }, memory: {}, proposals: [] }),
      sendConsoleAgentMessage: async () => {
        throw new Error('upstream BANKR_API_KEY=secret provider stack at /srv/private.js');
      },
    },
  }).start();
  await flushAsyncEvents(30);

  const form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea[name="message"]').value = 'Keep this exact mission draft.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);

  assert.equal(root.querySelector('textarea[name="message"]')?.value, 'Keep this exact mission draft.');
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /transport failed|try again/i);
  assert.equal(root.querySelector('[data-action="send-console-agent-message"] button[type="submit"]')?.textContent.trim(), 'Retry');
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /BANKR_API_KEY|\/srv\/private\.js|secret/);
});

test('dedicated Console clears authenticated state after a 401 response', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      activateConsoleAgent: async () => ({ thread: { messages: [] }, memory: {}, proposals: [] }),
      sendConsoleAgentMessage: async () => {
        const error = new Error('raw session middleware details');
        error.details = { status: 401 };
        throw error;
      },
    },
  }).start();
  await flushAsyncEvents(30);

  const form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea[name="message"]').value = 'Will require re-authentication.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);

  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '');
  assert.equal(root.querySelector('[data-action="send-console-agent-message"]'), null);
  assert.match(root.querySelector('.console-auth-gate')?.textContent ?? '', /Sign in to Console/i);
  assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /session expired|connect again/i);
  assert.doesNotMatch(root.textContent, /raw session middleware details/i);
});

test('dedicated Console treats a send 403 as a lost authorization boundary', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const walletClient = createWalletClientFixture({ snapshot: {
    connected: true,
    address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
    label: '0x27E3...91Ea',
  } });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      activateConsoleAgent: async () => ({
        thread: { messages: [{ role: 'agent', text: 'Private thread history.' }] },
        memory: { provider: 'sibyl_memory', recalled: [{ text: 'Private memory.' }] },
        proposals: [],
      }),
      sendConsoleAgentMessage: async () => {
        const error = new Error('forbidden private details');
        error.details = { status: 403 };
        throw error;
      },
    },
  }).start();
  await flushAsyncEvents(30);

  const form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea[name="message"]').value = 'Trigger forbidden.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);

  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '');
  assert.doesNotMatch(root.textContent, /Private thread history|Private memory|forbidden private details/);
  assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /session expired|connect again/i);
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Retry/);
});

test('dedicated Console clears authorization state for roster activation and name 403 responses', async (t) => {
  const wallet = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const connectedWallet = () => createWalletClientFixture({ snapshot: { connected: true, address: wallet, label: '0x27E3...91Ea' } });

  await t.test('roster', async () => {
    const root = setupDom('https://helixa.xyz/multipass/console');
    const baseFetch = createConsoleOwnedAgentsFetch({ tokenIds: [617] });
    await createApp({
      root,
      loadDemo: async () => sampleData(),
      walletClient: connectedWallet(),
      fetchImpl: async (url, init) => String(url).endsWith('/api/loopers/owned')
        ? new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
        : baseFetch(url, init),
    }).start();
    await flushAsyncEvents(30);
    assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /session expired|connect again/i);
    assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '');
  });

  await t.test('activation', async () => {
    const root = setupDom('https://helixa.xyz/multipass/console');
    const app = createApp({
      root,
      loadDemo: async () => sampleData(),
      walletClient: connectedWallet(),
      fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
      claimApi: { activateConsoleAgent: async () => { const error = new Error('forbidden'); error.status = 403; throw error; } },
    });
    await app.start();
    await app.activateSelectedConsoleAgent();
    await flushAsyncEvents(30);
    assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /session expired|connect again/i);
    assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '');
  });

  await t.test('name update', async () => {
    const root = setupDom('https://helixa.xyz/multipass/console');
    await createApp({
      root,
      loadDemo: async () => sampleData(),
      walletClient: connectedWallet(),
      fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
      claimApi: { updateConsoleAgentName: async () => {
        const error = new Error('forbidden'); error.response = { status: 403 }; throw error;
      } },
    }).start();
    await flushAsyncEvents(30);
    const form = root.querySelector('[data-action="update-console-agent-name"]');
    form.querySelector('input[name="console_agent_name"]').value = 'Private rename';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await flushAsyncEvents(20);
    assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /session expired|connect again/i);
    assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '');
  });
});

test('dedicated Console clear invalidates delayed sends without resurrecting old history', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let resolveOldSend;
  const oldSend = new Promise((resolve) => { resolveOldSend = resolve; });
  let sendCount = 0;
  const walletClient = createWalletClientFixture({ snapshot: {
    connected: true,
    address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
    label: '0x27E3...91Ea',
  } });
  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      activateConsoleAgent: async () => ({ thread: { messages: [{ role: 'agent', text: 'Initial history.' }] }, memory: {}, proposals: [] }),
      sendConsoleAgentMessage: async () => {
        sendCount += 1;
        if (sendCount === 1) return oldSend;
        return { thread: { messages: [{ role: 'agent', text: 'New response survives.' }] }, memory: {}, proposals: [] };
      },
    },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  await flushAsyncEvents(30);

  let form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea').value = 'Old delayed mission.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  root.querySelector('[data-action="reset-console-session"]').click();
  form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea').value = 'New mission.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(20);
  resolveOldSend({ thread: { messages: [{ role: 'agent', text: 'Old response resurrected.' }] }, memory: {}, proposals: [] });
  await flushAsyncEvents(20);

  assert.equal(sendCount, 2);
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /New response survives/);
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Old response resurrected|Initial history/);
});

test('dedicated Console clear invalidates a delayed name activation result', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let resolveRename;
  const renameActivation = new Promise((resolve) => { resolveRename = resolve; });
  let activationCount = 0;
  const walletClient = createWalletClientFixture({ snapshot: {
    connected: true,
    address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
    label: '0x27E3...91Ea',
  } });
  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: { activateConsoleAgent: async () => {
      activationCount += 1;
      if (activationCount === 1) return { thread: { messages: [{ role: 'agent', text: 'Initial history.' }] }, memory: {}, proposals: [] };
      return renameActivation;
    } },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  await flushAsyncEvents(30);

  const rename = root.querySelector('[data-action="update-console-agent-name"]');
  rename.querySelector('input').value = 'Late alias';
  rename.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  root.querySelector('[data-action="reset-console-session"]').click();
  resolveRename({ thread: { messages: [{ role: 'agent', text: 'Late activation history.' }] } });
  await flushAsyncEvents(20);

  assert.equal(root.querySelector('[data-action="update-console-agent-name"] input')?.value, 'Looper #617');
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Late activation history|Initial history/);
});

test('dedicated Console retries activation without routing an empty draft through send', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let activationAttempts = 0;
  let sendAttempts = 0;
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
    },
  });

  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      activateConsoleAgent: async () => {
        activationAttempts += 1;
        if (activationAttempts === 1) throw new Error('private activation provider details');
        return {
          thread: {
            transport: 'xmtp_group',
            conversationId: 'conversation-617',
            messages: [{ role: 'agent', text: 'Activation recovered.' }],
          },
          memory: {},
          proposals: [],
        };
      },
      sendConsoleAgentMessage: async () => {
        sendAttempts += 1;
        return { thread: { messages: [] }, memory: {}, proposals: [] };
      },
    },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  await flushAsyncEvents(30);

  const retry = root.querySelector('[data-action="retry-console-agent-activation"]');
  assert.ok(retry);
  assert.notEqual(root.querySelector('[data-action="send-console-agent-message"] button[type="submit"]')?.textContent, 'Retry');
  retry.click();
  await flushAsyncEvents(30);

  assert.equal(activationAttempts, 2);
  assert.equal(sendAttempts, 0);
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Activation recovered/);
});

test('dedicated Console route accepts Base smart wallet identity snapshots', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let walletClient;
  walletClient = createWalletClientFixture({
    connect: async () => {
      walletClient.setSnapshot({
        connected: true,
        address: '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE',
        label: '0x709D...44aE',
        walletClientType: 'base_account',
      });
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({
      wallet: '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE',
      tokenIds: [617],
    }),
  }).start();
  root.querySelector('[data-action="connect-console-wallet"]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushAsyncEvents(20);
  assert.equal(root.querySelector('.header-actions [data-action="connect-console-wallet"]')?.textContent, 'Sign in');

  root.querySelector('.header-actions [data-action="connect-console-wallet"]').click();
  await flushAsyncEvents(20);

  assert.equal(root.querySelector('.header-actions [data-action="connect-console-wallet"]')?.textContent, '0x709D...44aE');
  assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /0x709D\.\.\.44aE/);
  assert.match(root.querySelector('.console-main-roster-drawer')?.textContent ?? '', /Looper #617/);
  assert.equal(root.querySelector('[data-action="connect-looper-mint-wallet"]'), null);
});

test('dedicated Console prefetches Base Account challenge and signs only from the explicit user click', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE';
  const sequence = [];
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: owner,
      label: '0x709D...44aE',
      walletProfile: { walletClientType: 'base_account', kind: 'smart_or_delegated' },
    },
    signMessage: async (message) => {
      sequence.push(['sign', message]);
      return { wallet: owner, signature: '0xbase' };
    },
  });

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ wallet: owner, tokenIds: [617] }),
    claimApi: {
      requestConsoleSessionChallenge: async ({ wallet }) => {
        sequence.push(['nonce', wallet]);
        return { nonce: 'base-nonce', message: 'Prepared Base Account challenge' };
      },
      authenticateConsoleSession: async ({ challenge, signMessage, onStage }) => {
        sequence.push(['authenticate', challenge?.nonce]);
        onStage('signature');
        await signMessage(challenge.message);
        onStage('session');
        return { csrfToken: 'csrf-base' };
      },
      activateConsoleAgent: async () => ({ thread: { messages: [] }, memory: {}, proposals: [] }),
    },
  }).start();
  await flushAsyncEvents(20);

  assert.deepEqual(sequence, [['nonce', owner]]);
  assert.equal(root.querySelector('.header-actions [data-action="connect-console-wallet"]')?.textContent, 'Sign in');
  assert.equal(root.querySelector('.console-auth-gate [data-action="connect-console-wallet"]')?.textContent, 'Sign in with wallet');

  root.querySelector('.console-auth-gate [data-action="connect-console-wallet"]').click();
  await flushAsyncEvents(30);

  assert.deepEqual(sequence.slice(0, 3).map(([kind]) => kind), ['nonce', 'authenticate', 'sign']);
  assert.equal(sequence[1][1], 'base-nonce');
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Looper #617/);
});

test('dedicated Console route can render a looper mock room without live ownership fetches', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console?mock=looper');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async () => {
      throw new Error('Looper mock route should not fetch live ownership data during initial render.');
    },
  }).start();

  const consolePage = root.querySelector('.multipass-console');
  assert.ok(consolePage);
  assert.match(consolePage.textContent, /bendr/);
  assert.match(consolePage.textContent, /Looper #000/);
  assert.match(consolePage.textContent, /blunt market reads, vault first/i);
  assert.match(consolePage.textContent, /Queue the morning markets brief/i);
  assert.match(consolePage.textContent, /How are the markets and how is our vault looking tonight/i);
  assert.match(consolePage.textContent, /Vault looks clean/i);
  assert.match(consolePage.textContent, /BTC, ETH, SOL, USDC current USD prices/i);
  assert.match(consolePage.textContent, /Review-only ETH\/ERC-20 transfer suggestions/i);
  assert.doesNotMatch(consolePage.textContent, /Market research|Portfolio read|Swap|Token launch/i);
  assert.match(consolePage.textContent, /0x8f8A\.\.\.4B91/);
  assert.equal(root.querySelectorAll('[data-action="connect-console-wallet"]').length, 1);
  assert.equal(root.querySelector('.header-actions [data-action="connect-console-wallet"]')?.textContent, '0x8f8A...4B91');
  assert.equal(root.querySelector('[data-action="send-console-agent-message"] button[type="submit"]')?.disabled, false);
  assert.equal(root.querySelector('[data-action="update-console-agent-name"] input[name="console_agent_name"]')?.value, 'bendr');
  assert.equal(root.querySelector('[data-action="reset-console-agent-name"]')?.disabled, false);
  assert.doesNotMatch(consolePage.textContent, /Direct line to Quigley|mouthy night-shift/i);
  assert.doesNotMatch(consolePage.textContent, /\b(?:demo|fixture)\b/i);
});

test('dedicated Console route lets the operator rename the active agent inside the console', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console?mock=looper');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async () => {
      throw new Error('Looper mock route should not fetch live ownership data during rename.');
    },
  }).start();

  const form = root.querySelector('[data-action="update-console-agent-name"]');
  const input = form?.querySelector('input[name="console_agent_name"]');
  assert.ok(form);
  assert.ok(input);

  input.value = 'nightshift';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /nightshift/);
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Looper #000/);
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /nightshift/);
  assert.match(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Direct thread/);
  assert.equal(JSON.parse(window.localStorage.getItem('multipass.console.agentNameOverrides') ?? '{}')['000'], 'nightshift');

  root.querySelector('[data-action="reset-console-agent-name"]')?.click();
  await flushAsyncEvents();

  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Looper #000/);
  assert.doesNotMatch(root.querySelector('.console-identity-card')?.textContent ?? '', /nightshift/);
  assert.equal(root.querySelector('[data-action="update-console-agent-name"] input[name="console_agent_name"]')?.value, 'Looper #000');
});

test('dedicated Console blocks a rapid live-name reset while an alias update is pending', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  window.localStorage.setItem('multipass.console.agentNameOverrides', JSON.stringify({ 617: 'old alias' }));
  let resolveAliasUpdate;
  const pendingAliasUpdate = new Promise((resolve) => { resolveAliasUpdate = resolve; });
  let activationCount = 0;
  const walletClient = createWalletClientFixture({ snapshot: {
    connected: true,
    address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
    label: '0x27E3...91Ea',
  } });
  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: { activateConsoleAgent: async () => {
      activationCount += 1;
      if (activationCount === 1) return { thread: { messages: [] }, memory: {}, proposals: [] };
      return pendingAliasUpdate;
    } },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  await flushAsyncEvents(30);

  let form = root.querySelector('[data-action="update-console-agent-name"]');
  form.querySelector('input').value = 'new alias';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  assert.equal(root.querySelector('[data-action="update-console-agent-name"] button[type="submit"]')?.disabled, true);
  assert.equal(root.querySelector('[data-action="reset-console-agent-name"]')?.disabled, true);
  root.querySelector('[data-action="reset-console-agent-name"]')?.click();
  await flushAsyncEvents();
  assert.equal(activationCount, 2);

  resolveAliasUpdate({ runtime: { runtimeName: 'new alias' } });
  await flushAsyncEvents(20);

  form = root.querySelector('[data-action="update-console-agent-name"]');
  assert.equal(form.querySelector('input')?.value, 'new alias');
  assert.equal(form.querySelector('button[type="submit"]')?.disabled, false);
  assert.equal(JSON.parse(window.localStorage.getItem('multipass.console.agentNameOverrides') ?? '{}')['617'], 'new alias');
});

test('dedicated Console blocks agent switching until a deferred alias update settles', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let resolveAliasUpdate;
  const pendingAliasUpdate = new Promise((resolve) => { resolveAliasUpdate = resolve; });
  let activationCount = 0;
  let token617Calls = 0;
  const walletClient = createWalletClientFixture({ snapshot: {
    connected: true,
    address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
    label: '0x27E3...91Ea',
  } });
  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
    claimApi: { activateConsoleAgent: async ({ tokenId }) => {
      activationCount += 1;
      if (tokenId === '617') {
        token617Calls += 1;
        if (token617Calls === 2) return pendingAliasUpdate;
      }
      return { thread: { messages: [] }, memory: {}, proposals: [] };
    } },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  await flushAsyncEvents(30);

  let selector = root.querySelector('[data-action="select-console-agent"]');
  selector.value = '617';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents(20);
  const form = root.querySelector('[data-action="update-console-agent-name"]');
  form.querySelector('input').value = 'confirmed alias';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  selector = root.querySelector('[data-action="select-console-agent"]');
  assert.equal(selector.disabled, true);
  assert.equal(root.querySelector('[data-action="activate-console-room"][data-token-id="812"]')?.disabled, true);
  selector.value = '812';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  selector.value = '617';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents(20);

  assert.equal(activationCount, 2);
  assert.equal(root.querySelector('[data-action="update-console-agent-name"] input')?.value, 'Looper #617');

  resolveAliasUpdate({ runtime: { runtimeName: 'confirmed alias' } });
  await flushAsyncEvents(20);

  selector = root.querySelector('[data-action="select-console-agent"]');
  assert.equal(selector.disabled, false);
  assert.equal(root.querySelector('[data-action="activate-console-room"][data-token-id="812"]')?.disabled, false);
  assert.equal(root.querySelector('[data-action="update-console-agent-name"] input')?.value, 'confirmed alias');
  selector.value = '812';
  selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await flushAsyncEvents(20);

  assert.equal(activationCount, 2);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '812');
  assert.equal(root.querySelector('[data-action="update-console-agent-name"] input')?.value, 'Looper #812');
  assert.equal(JSON.parse(window.localStorage.getItem('multipass.console.agentNameOverrides') ?? '{}')['617'], 'confirmed alias');
});

test('dedicated Console route loads static Multipass data instead of saved slug API data', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const fetchCalls = [];
  await createApp({
    root,
    fetchImpl: async (url) => {
      fetchCalls.push(String(url));
      throw new Error(`unexpected fetch: ${url}`);
    },
  }).start();

  assert.ok(root.querySelector('.multipass-console'));
  assert.deepEqual(fetchCalls, []);
  assert.doesNotMatch(root.textContent, /Could not load Multipass API data|console\/hydrated/i);
});

test('dedicated agents route renders public agent gallery cards with safe Multipass links', async () => {
  const root = setupDom('https://helixa.xyz/multipass/agents');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.equal(root.querySelector('.product-home-shell'), null);
  assert.equal(root.querySelector('.live-resolver'), null);
  const gallery = root.querySelector('.public-agent-gallery');
  assert.ok(gallery);
  assert.match(gallery.textContent, /Public agent gallery/);
  assert.doesNotMatch(root.textContent, /without crowding/i);
  assert.equal(gallery.querySelectorAll('.public-agent-card').length, 3);
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/?agent=1"]'));
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/?agent=81"]'));
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/swarm/helixa"]'));
  assert.match(gallery.textContent, /Cred/);
  assert.match(gallery.textContent, /Intuition/);
  assert.match(gallery.textContent, /Custody/);
  assert.match(gallery.textContent, /Proof/);
  assert.match(gallery.textContent, /Open profile/);
  assert.equal(gallery.querySelector('a[href^="https://helixa.xyz/agent/"]'), null);
  assert.equal(gallery.querySelector('a[href^="https://helixa.xyz/swarm/"]'), null);
});

test('production agents route uses the full static gallery instead of the single API demo profile', async () => {
  const root = setupDom('https://helixa.xyz/multipass/agents');
  await createApp({
    root,
    fetchImpl: async () => {
      throw new Error('Agents gallery route should not fetch the single-profile API demo.');
    },
  }).start();

  const gallery = root.querySelector('.public-agent-gallery');
  assert.ok(gallery);
  assert.equal(gallery.querySelectorAll('.public-agent-card').length, 10);
  assert.match(gallery.textContent, /Bendr 2\.0/);
  assert.match(gallery.textContent, /Quigbot/);
  assert.match(gallery.textContent, /Axobotl \/ 0xWork/);
  assert.match(gallery.textContent, /Velvet-Unicorn/);
  assert.match(gallery.textContent, /mferGPT/);
  assert.match(gallery.textContent, /degenai/);
  assert.match(gallery.textContent, /SIBYL/);
  assert.match(gallery.textContent, /BuiltByEcho \/ Vaultline/);
  assert.match(gallery.textContent, /Helixa Swarm/);
  assert.match(gallery.textContent, /Zori/);
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/axobotl-1069"]'));
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/velvet-unicorn-1127"]'));
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/mfergpt-73"]'));
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/degenai-1035"]'));
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/sibyl-1037"]'));
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/builtbyecho-1652"]'));
  assert.ok(gallery.querySelector('a.public-agent-card[href="/multipass/zori-4354"]'));
  assert.match(gallery.textContent, /12 public-web observed tools/);
  assert.match(gallery.textContent, /Intuition graph\s+Published \(8453:18531\)/);
  assert.match(gallery.textContent, /Identity atom, CAIP anchor, and Helixa Cred assessment are published on Intuition/);
  assert.match(gallery.textContent, /Intuition graph\s+Mapping needed/);
  assert.match(gallery.textContent, /Needs canonical ERC-8004 token ID before Intuition graph publication/);
  assert.match(gallery.textContent, /Ethereum Normies NFT-backed/i);
  assert.match(gallery.textContent, /Multipass management unclaimed/i);
});

test('agents route swarm card click opens a standalone swarm Multipass route', async () => {
  const root = setupDom('https://helixa.xyz/multipass/agents');
  const calls = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => {
      calls.push(input);
      return sampleData();
    },
  }).start();

  const card = [...root.querySelectorAll('.public-agent-card')].find((candidate) => /Helixa Swarm/.test(candidate.textContent));
  assert.ok(card);
  assert.equal(card.getAttribute('href'), '/multipass/swarm/helixa');

  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  card.dispatchEvent(click);
  await Promise.resolve();

  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(calls, []);
  assert.equal(root.querySelector('.product-home-shell'), null);
  assert.equal(root.querySelector('.homepage-selected-agent-detail'), null);
  const profilePage = root.querySelector('.multipass-profile-page');
  assert.ok(profilePage);
  assert.match(profilePage.textContent, /Swarm detail/);
  assert.match(profilePage.textContent, /Bendr 2\.0/);
  assert.match(profilePage.textContent, /Phantom Relay/);
  assert.match(profilePage.textContent, /Permissions pause and tool routes reverify/);
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/swarm/helixa');
});

test('static swarm route loads standalone Multipass page without API calls', async () => {
  const root = setupDom('https://helixa.xyz/multipass/swarm/helixa');
  await createApp({
    root,
    fetchImpl: async () => {
      throw new Error('static swarm route must not call the API');
    },
  }).start();

  assert.equal(root.querySelector('.product-home-shell'), null);
  assert.ok(root.querySelector('.multipass-profile-page'));
  assert.match(root.textContent, /Helixa Swarm/);
  assert.match(root.textContent, /Swarm detail/);
  assert.match(root.textContent, /Nox/);
  const auraImage = root.querySelector('.aura-card img');
  assert.equal(auraImage?.getAttribute('src'), 'https://helixa.xyz/multipass/helixa-logo.png');
  assert.equal(auraImage?.getAttribute('alt'), 'Helixa logo swarm identity');
  assert.doesNotMatch(root.textContent, /E2ETest/);
});

test('homepage profile card click resolves in place without showing stale profile shell', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const calls = [];
  let resolveLive;
  const liveData = {
    ...sampleData(),
    profile: { ...sampleData().profile, display_name: 'Bendr 2.0' },
    resolver: { canonicalId: '8453:1', tokenId: '1' },
    liveProfilePage: { headline: 'Bendr Multipass', headerMeta: 'Live profile · 8453:1', sharePath: '/multipass/?agent=1' },
  };
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => {
      calls.push(input);
      return new Promise((resolve) => { resolveLive = () => resolve(liveData); });
    },
  }).start();

  const card = root.querySelector('a.visual-card-button[href="/multipass/?agent=1"]');
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  card.dispatchEvent(click);
  await Promise.resolve();

  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(calls, ['1']);
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/');
  assert.ok(root.querySelector('.product-home-shell'));
  assert.equal(root.querySelector('.multipass-profile-page'), null);
  assert.equal(root.querySelector('.record-sheet'), null);

  resolveLive();
  await flushAsyncEvents(20);

  assert.ok(root.querySelector('.multipass-profile-page'));
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/?agent=1');
});

test('homepage profile card click keeps clicked agent selected while loading', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const calls = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => {
      calls.push(input);
      return new Promise(() => {});
    },
  }).start();

  const card = root.querySelector('a.visual-card-button[href="/multipass/?agent=81"]');
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  card.dispatchEvent(click);
  await Promise.resolve();

  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(calls, ['81']);
  assert.ok(root.querySelector('.product-home-shell'));

  const selectedCard = root.querySelector('.visual-card-button.selected');
  assert.match(selectedCard?.textContent ?? '', /Quigbot/);
  assert.doesNotMatch(selectedCard?.textContent ?? '', /Bendr 2\.0/);
  assert.equal(selectedCard?.getAttribute('aria-busy'), 'true');
  assert.match(selectedCard?.textContent ?? '', /Opening Quigbot/);

  const bendrCard = root.querySelector('a.visual-card-button[href="/multipass/?agent=1"]');
  assert.equal(bendrCard?.classList.contains('selected'), false);
});

test('homepage silently prefetches valid visible agent profiles', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const calls = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => {
      calls.push(input);
      return quigbotLiveData({
        profile: { ...sampleData().profile, display_name: input === '81' ? 'Quigbot Prefetched' : 'Bendr Prefetched' },
        resolver: { canonicalId: `8453:${input}`, tokenId: input },
        liveProfilePage: { headline: `${input} Multipass`, headerMeta: `Live profile · 8453:${input}`, sharePath: `/multipass/?agent=${input}` },
      });
    },
    prefetchProfiles: true,
  }).start();
  await flushHomepagePrefetch();

  assert.deepEqual(calls.sort(), ['1', '81']);
  assert.ok(root.querySelector('.product-home-shell'));
  assert.equal(root.querySelector('.multipass-profile-page'), null);
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/');
});

test('homepage profile card click uses prefetched cache immediately', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const calls = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => {
      calls.push(input);
      return quigbotLiveData({
        profile: { ...sampleData().profile, display_name: input === '81' ? 'Quigbot Prefetched' : 'Bendr Prefetched' },
        resolver: { canonicalId: `8453:${input}`, tokenId: input },
        liveProfilePage: { headline: `${input} Multipass`, headerMeta: `Live profile · 8453:${input}`, sharePath: `/multipass/?agent=${input}` },
      });
    },
    prefetchProfiles: true,
  }).start();
  await flushHomepagePrefetch();

  const beforeClickCalls = [...calls];
  const card = root.querySelector('a.visual-card-button[href="/multipass/?agent=81"]');
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  card.dispatchEvent(click);
  await Promise.resolve();

  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(calls, beforeClickCalls);
  assert.ok(root.querySelector('.multipass-profile-page'));
  assert.match(root.textContent, /Quigbot Prefetched/);
  assert.doesNotMatch(root.textContent, /Opening Quigbot/);
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/?agent=81');
});


test('homepage visual image failures fall back to initials instead of broken panels', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const image = root.querySelector('.profile-visual-strip img[data-visual-card-image="true"]');
  assert.ok(image);
  image.dispatchEvent(new root.ownerDocument.defaultView.Event('error'));

  assert.equal(image.hidden, true);
  assert.equal(image.closest('.profile-card-visual')?.classList.contains('image-failed'), true);
  assert.match(image.closest('.profile-card-visual')?.textContent ?? '', /B/);
});

test('initial render shows loading state then product-led Multipass record', async () => {
  const root = setupDom();
  let resolveLoad;
  const app = createApp({
    root,
    loadDemo: () => new Promise((resolve) => { resolveLoad = resolve; }),
  });

  const ready = app.start();
  assert.match(root.textContent, /Loading Multipass/);
  assert.doesNotMatch(root.textContent, /Loading Bendr 2\.0/);

  resolveLoad(sampleData());
  await ready;

  assert.match(root.textContent, /portable public agent profiles/i);
  assert.match(root.textContent, /agent builders/i);
  assert.match(root.textContent, /visual identity graph/i);
  assert.doesNotMatch(root.textContent, /Internal Prototype/);
  assert.doesNotMatch(root.textContent, /Hidden Prototype/);
  assert.doesNotMatch(root.textContent, /Bendr Public Profile/);
  assert.match(root.textContent, /agent builders/i);
  const brandLogo = root.querySelector('.brand-logo');
  assert.equal(brandLogo?.getAttribute('src'), '/multipass/helixa-logo.png');
  assert.equal(brandLogo?.getAttribute('alt'), '');
  const brandLogoLink = root.querySelector('.brand-logo-link');
  assert.equal(brandLogoLink?.getAttribute('href'), '/multipass/');
  assert.equal(brandLogoLink?.getAttribute('aria-label'), 'Go to Multipass home');
  assert.ok(brandLogoLink?.querySelector('.brand-logo-frame'));
  assert.equal(root.querySelector('.brand-wordmark')?.textContent, 'Multipass');
  assert.equal(root.querySelector('.brand-stack .header-meta')?.textContent, 'Portable Agent Identities');
  assert.equal(root.querySelector('.header-actions .header-meta'), null);
  const menuButton = root.querySelector('.site-menu-button');
  assert.equal(menuButton?.getAttribute('type'), 'button');
  assert.equal(menuButton?.getAttribute('aria-label'), 'Open Multipass navigation');
  assert.equal(menuButton?.querySelectorAll('span').length, 3);
  assert.match(root.textContent, /MULTIPASS/);
  assert.doesNotMatch(root.textContent, /What the card shows/);
  assert.doesNotMatch(root.textContent, /What proof adds/);
  assert.doesNotMatch(root.textContent, /Proof below/);
  assert.doesNotMatch(root.textContent, /Portable by design/);
  assert.match(root.textContent, /MULTIPASS/);
  assert.match(root.textContent, /Bendr 2\.0/);
  assert.doesNotMatch(root.querySelector('.homepage-hero')?.textContent ?? '', /mp_bendr_2/);
  assert.doesNotMatch(root.querySelector('.homepage-hero')?.textContent ?? '', /bendr-2/);
  assert.match(root.textContent, /Bendr 2\.0 Public Profile/);
  const resolver = root.querySelector('.live-resolver');
  assert.ok(resolver);
  assert.doesNotMatch(resolver.textContent, /\b(?:preview|demo|fixture)\b/i);
  assert.doesNotMatch(root.textContent, /\b(?:demo|fixture)\b/i);
  assert.match(root.textContent, /Proof ledger/);
  assert.doesNotMatch(root.textContent, /Card first/);
  assert.match(root.textContent, /Example public agent profiles/);
  assert.match(root.textContent, /Bendr 2\.0/);
  assert.match(root.textContent, /Quigbot/);
  assert.match(root.textContent, /Cred 80/);
  assert.match(root.textContent, /8453:1/);
  assert.match(root.textContent, /Inspect proof/);
  assert.match(root.textContent, /card needs verification/i);
  assert.match(root.textContent, /Proof vocabulary/);
  assert.match(root.textContent, /Endpoint fragments describe routes/i);
  assert.match(root.textContent, /Platform verified means/i);
  assert.match(root.querySelector('.fragment-card').textContent, /Source/i);
  for (const state of ['verified', 'pending', 'stale', 'historical', 'disputed']) {
    assert.match(root.textContent, new RegExp(state, 'i'));
  }
  assert.ok(root.querySelector('.record-shell'));
  assert.equal(root.querySelector('.record-sheet'), null);
  assert.ok(root.querySelector('.prototype-ribbon'));
  assert.equal(root.querySelector('.clarity-grid'), null);
  assert.equal(root.querySelectorAll('.clarity-card').length, 0);
  assert.ok(root.querySelector('.card-carousel'));
  assert.equal(root.querySelectorAll('.card-button').length, 3);
  assert.match(root.querySelector('.card-detail').textContent, /Helixa ID/);
  assert.match(root.querySelector('.card-detail').textContent, /Intuition graph/);
  assert.match(root.querySelector('.card-detail').textContent, /No Intuition ERC-8004 graph status is attached to this profile yet/);
  assert.ok(root.querySelectorAll('.fragment-card').length >= 6);
  assert.match(root.textContent, /Helixa AgentDNA token #1/);
  assert.match(root.textContent, /Cred score 80/);
  assert.equal(root.querySelector('.fragment-legend')?.tagName, 'DETAILS');
  assert.equal(root.querySelector('.fragment-legend')?.hasAttribute('open'), false);
  assert.ok(root.querySelector('.proof-ledger'));
  assert.ok(root.querySelector('.homepage-proof-panel'));
  assert.equal(root.querySelectorAll('.homepage-proof-stat').length, 4);
});

test('hamburger menu opens trusted Helixa and CRED links', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const app = createApp({ root, loadDemo: async () => sampleData() });

  await app.start();

  const menuButton = root.querySelector('.site-menu-button');
  const menu = root.querySelector('.site-menu');
  assert.ok(menuButton);
  assert.ok(menu);
  assert.equal(menuButton.getAttribute('aria-expanded'), 'false');
  assert.equal(menu.hidden, true);

  menuButton.click();

  assert.equal(menuButton.getAttribute('aria-expanded'), 'true');
  assert.equal(menu.hidden, false);

  const links = [...menu.querySelectorAll('a')].map((link) => ({ label: link.textContent.trim(), href: link.getAttribute('href') }));
  assert.deepEqual(links, [
    { label: 'Multipass Home', href: '/multipass/' },
    { label: 'Multipass Console', href: '/multipass/console' },
    { label: 'The Loop', href: '/multipass/the-loop' },
    { label: 'RUNTIME Submission', href: '/multipass/runtime' },
    { label: 'Register Agent', href: 'https://helixa.xyz/' },
    { label: 'Cred Exchange', href: 'https://cred.exchange/' },
    { label: '$CRED Token', href: 'https://bankr.bot/agents/helixa' },
    { label: 'Docs / API', href: 'https://api.helixa.xyz/' },
  ]);

  assert.equal(menu.querySelector('a[href="https://bankr.bot/agents/helixa"]')?.getAttribute('target'), '_blank');
});

test('resolver bar renders without changing default static data', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const resolver = root.querySelector('.live-resolver');
  assert.ok(resolver);
  assert.match(resolver.textContent, /Activate a live agent record/);
  assert.match(resolver.textContent, /Activate an existing agent/);
  assert.match(resolver.textContent, /Enter an AgentDNA ID, ERC-8004-style ID, token ID, or agent name/);
  assert.match(resolver.textContent, /Activate agent/);
  assert.equal(resolver.querySelector('.resolver-examples'), null);
  assert.doesNotMatch(resolver.textContent, /Examples/);
  assert.doesNotMatch(resolver.textContent, /Try\s/);
  assert.doesNotMatch(resolver.textContent, /Resolve live Helixa agent/);
  assert.doesNotMatch(resolver.textContent, /Helixa ID, name, or handle/);
  assert.match(root.textContent, /Bendr 2\.0/);
  assert.doesNotMatch(root.textContent, /Bendr is one profile, not the homepage/);
  assert.doesNotMatch(resolver.textContent, /\b(?:preview|demo|fixture)\b/i);
  assert.doesNotMatch(root.textContent, /\b(?:demo|fixture)\b/i);
});

test('static homepage keeps agent visuals inspection-only', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const strip = root.querySelector('.profile-visual-strip');
  assert.ok(strip);
  assert.equal(strip.querySelector('input'), null);
  assert.equal(strip.querySelector('.visual-card-viewport'), null);
  assert.ok(strip.querySelector('.visual-card-track'));
  assert.equal(strip.querySelector('.card-track'), null);
  assert.equal(strip.querySelectorAll('.card-button').length, 0);
  assert.equal(strip.querySelectorAll('.visual-card-button').length, 3);
  assert.equal(strip.querySelector('.visual-carousel-controls'), null);
  assert.doesNotMatch(strip.textContent, /claim|approve|transfer|payment|wallet/i);
});

test('static initial state presents Multipass product home instead of Bendr profile', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.ok(root.querySelector('.product-home-shell'));
  const hero = root.querySelector('.product-hero');
  assert.match(hero?.textContent ?? '', /Portable identity profiles for agents/);
  assert.equal(hero?.querySelector('.live-resolver'), null);
  assert.match(root.querySelector('.live-resolver')?.textContent ?? '', /Activate a live agent record/);
  assert.equal(hero?.querySelector('.homepage-proof-panel'), null);
  const proofPanel = root.querySelector('.homepage-proof-panel');
  assert.match(proofPanel?.textContent ?? '', /What it does/);
  assert.match(proofPanel?.textContent ?? '', /Multipass turns scattered agent identity into one readable public agent profile/);
  assert.match(proofPanel?.textContent ?? '', /Identity inputs/);
  assert.match(proofPanel?.textContent ?? '', /AgentDNA/);
  assert.match(proofPanel?.textContent ?? '', /Owner wallet/);
  assert.match(proofPanel?.textContent ?? '', /Manager agent/);
  assert.match(proofPanel?.textContent ?? '', /Endpoints/);
  assert.match(proofPanel?.textContent ?? '', /NFT provenance/);
  assert.match(proofPanel?.textContent ?? '', /Human-owned/);
  assert.match(proofPanel?.textContent ?? '', /Agent-managed/);
  assert.match(proofPanel?.textContent ?? '', /Standards-readable/);
  assert.match(proofPanel?.textContent ?? '', /Usable profile/);
  assert.match(proofPanel?.textContent ?? '', /Public proof/);
  assert.match(proofPanel?.textContent ?? '', /Permissions/);
  assert.match(proofPanel?.textContent ?? '', /Work routes/);
  assert.match(proofPanel?.textContent ?? '', /Trust context/);
  assert.match(proofPanel?.textContent ?? '', /Shareable profile/);
  assert.match(proofPanel?.textContent ?? '', /ERC-8004/);
  assert.match(proofPanel?.textContent ?? '', /Cred/);
  assert.match(proofPanel?.textContent ?? '', /x401/);
  assert.match(proofPanel?.textContent ?? '', /x402/);
  assert.match(proofPanel?.textContent ?? '', /MCP\/A2A/);
  assert.doesNotMatch(proofPanel?.textContent ?? '', /Wiretap|ClawBank/);
  assert.equal(proofPanel?.querySelectorAll('.homepage-proof-stat').length, 0);
  assert.equal(proofPanel?.querySelector('a, button, form, input, textarea, select, [data-action]'), null);
  const activation = root.querySelector('.live-resolver');
  const groupActivation = root.querySelector('.group-activation-section');
  assert.equal(groupActivation, null);
  assert.equal(root.querySelector('.looper-allowlist-panel'), null);
  assert.equal(proofPanel?.previousElementSibling, hero);
  assert.equal(proofPanel?.nextElementSibling, activation);
  assert.equal(activation?.previousElementSibling, proofPanel);
  assert.doesNotMatch(root.textContent, /Bendr is one profile, not the homepage/);
  assert.match(root.textContent, /View agents/);
  assert.equal(root.querySelector('.activation-summary'), null);
  assert.equal(root.querySelector('.proof-ledger'), null);
  assert.doesNotMatch(root.textContent, /Bendr 2\.0 Public Profile/);
  assert.doesNotMatch(root.textContent, /\b(?:Demo|demo|fixture|Fixture)\b/);
});


test('resolved live profile renders visual-first drawers without homepage or resolver chrome', async () => {
  const root = await renderResolvedQuigbotProfile();

  const profile = root.querySelector('.multipass-profile-page');
  assert.ok(profile);
  assert.ok(profile.querySelector(':scope > .aura-card'));
  assert.equal(profile.querySelector('.live-resolver'), null);
  assert.equal(profile.querySelector('.profile-gallery'), null);
  assert.equal(profile.querySelector('.homepage-hero'), null);
  assert.equal(profile.querySelectorAll('.profile-detail-drawer').length >= 5, true);
  assert.deepEqual(profileDrawerTitles(profile), [
    'Share and status',
    'Ownership and management',
    'Visual provenance',
    'Trust context',
    'Communication',
    'Tools and services',
    'Public proof fragments',
    'Proof ledger',
  ]);
  assert.match(profile.querySelector('.profile-detail-drawers')?.textContent ?? '', /Proof ledger/);
});

test('resolved live profile surfaces Intuition status in the visible visual summary', async () => {
  const root = await renderResolvedQuigbotProfile(quigbotLiveData({
    visualIdentity: {
      source: 'helixa_aura',
      label: 'Helixa Agent Aura',
      imageUrl: 'https://api.helixa.xyz/api/v2/aura/81.png',
      initials: 'Q',
      tone: 'prime',
      chips: ['Cred 75', 'Prime', 'Verified', 'openclaw'],
    },
    agentCards: [
      {
        name: 'Quigbot',
        tokenId: 81,
        helixaId: '8453:81',
        framework: 'openclaw',
        credScore: 75,
        credTier: 'Prime',
        verified: true,
        profileUrl: 'https://helixa.xyz/agent/81',
        proofFragmentIds: ['frag_quigbot_identity', 'frag_quigbot_cred'],
        intuition: { status: 'published', label: 'Published', canonicalAgentId: '8453:18531' },
      },
    ],
  }));

  const auraCard = root.querySelector('.multipass-profile-page > .aura-card');
  assert.match(auraCard?.textContent ?? '', /Intuition graph: Published \(8453:18531\)/);
  assert.match(auraCard?.textContent ?? '', /ERC-8004 identity and reputation record are published on Intuition/);
});

test('profile drawer resting bars show stat chips and click affordance', async () => {
  const root = await renderResolvedQuigbotProfile();
  const profile = root.querySelector('.multipass-profile-page');
  const drawers = [...profile.querySelectorAll('.profile-detail-drawer')];

  assert.ok(drawers.length >= 5);
  for (const drawer of drawers) {
    const summary = drawer.querySelector('summary');
    assert.ok(summary?.querySelector('.profile-detail-drawer-stat'), summary?.textContent ?? 'missing stat');
    assert.ok(summary?.querySelector('.profile-detail-drawer-chevron'), summary?.textContent ?? 'missing chevron');
    assert.equal(summary?.querySelector('.profile-detail-drawer-chevron')?.getAttribute('aria-hidden'), 'true');
  }

  assert.equal(profileDrawerByTitle(profile, 'Share and status')?.querySelector('.profile-detail-drawer-stat')?.textContent, 'Public URL');
  assert.equal(profileDrawerByTitle(profile, 'Public proof fragments')?.querySelector('.profile-detail-drawer-stat')?.textContent, '2 public signals');
  assert.equal(profileDrawerByTitle(profile, 'Proof ledger')?.querySelector('.profile-detail-drawer-stat')?.textContent, '7 API records');
});

test('saved and static profile routes render profile-first visual pages without gallery chrome', async () => {
  const savedRoot = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  await createApp({ root: savedRoot, fetchImpl: savedProfileFetch }).start();

  assert.equal(savedRoot.querySelector('.multipass-profile-page .live-resolver'), null);
  assert.equal(savedRoot.querySelector('.multipass-profile-page .profile-gallery'), null);
  assert.ok(savedRoot.querySelector('.multipass-profile-page > .aura-card'));

  const staticRoot = setupDom('https://helixa.xyz/profile/bendr-2');
  await createApp({ root: staticRoot, loadDemo: async () => sampleData() }).start();

  assert.equal(staticRoot.querySelector('.multipass-profile-page .live-resolver'), null);
  assert.equal(staticRoot.querySelector('.multipass-profile-page .profile-gallery'), null);
  assert.ok(staticRoot.querySelector('.multipass-profile-page > .aura-card'));
});

test('refreshed saved Quigbot profile uses holder-editable avatar image and source stats', async () => {
  const root = setupDom('https://helixa.xyz/multipass/quigbot-81?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedQuigbotFetch }).start();

  const auraCard = root.querySelector('.multipass-profile-page > .aura-card');
  assert.ok(auraCard);
  assert.equal(auraCard.querySelector('img')?.getAttribute('src'), NAKAMIGO_2432_IMAGE);
  assert.notEqual(auraCard.querySelector('img')?.getAttribute('src'), 'https://api.helixa.xyz/api/v2/aura/81.png');
  assert.match(auraCard.textContent ?? '', /8453:81/);
  assert.match(auraCard.textContent ?? '', /Cred 75/);
  assert.match(auraCard.textContent ?? '', /verified/);
  assert.match(root.querySelector('.aura-provenance-drawer')?.textContent ?? '', /Manager public avatar URL/);
  assert.equal(root.querySelector('.aura-share-action')?.getAttribute('data-share-url'), '/multipass/quigbot-81');
});

test('saved Quigbot profile refresh survives trailing slash route', async () => {
  const root = setupDom('https://helixa.xyz/multipass/quigbot-81/?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedQuigbotFetch }).start();

  const auraCard = root.querySelector('.multipass-profile-page > .aura-card');
  assert.ok(auraCard);
  assert.equal(auraCard.querySelector('img')?.getAttribute('src'), NAKAMIGO_2432_IMAGE);
  assert.match(root.querySelector('.aura-provenance-drawer')?.textContent ?? '', /Manager public avatar URL/);
});

test('saved Normies profile shares its profile route instead of preview plumbing', async () => {
  const root = setupDom('https://helixa.xyz/multipass/zori-4354?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedZoriProfileFetch }).start();

  const auraCard = root.querySelector('.multipass-profile-page > .aura-card');
  assert.ok(auraCard);
  assert.equal(auraCard.querySelector('h2')?.textContent, 'Zori');
  assert.equal(auraCard.querySelector('img')?.getAttribute('src'), NORMIES_4354_IMAGE);
  assert.equal(auraCard.querySelector('.aura-share-action')?.getAttribute('data-share-url'), '/multipass/zori-4354');
  assert.doesNotMatch(auraCard.textContent ?? '', /Bendr 2\.0/);
  assert.match(root.querySelector('.aura-provenance-drawer')?.textContent ?? '', /Manager public avatar URL/);
});

test('agent query refresh keeps saved holder avatar overlay when a saved profile exists', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=81&api=https://api.example.test');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => ({
      ...quigbotLiveData(),
      profile: {
        ...quigbotLiveData().profile,
        discovery_profile: { ...quigbotLiveData().profile.discovery_profile, avatar_url: null },
      },
      visualIdentity: {
        source: 'helixa_aura',
        label: 'Quigbot visual identity',
        imageUrl: 'https://api.helixa.xyz/api/v2/aura/81.png',
        initials: 'Q',
        tone: 'building',
        chips: ['8453:81'],
        provenanceDrawer: {
          title: 'Quigbot visual provenance',
          summary: 'Live Helixa aura metadata.',
          facts: [{ label: 'Visual source', value: 'Helixa aura route for token 81' }],
        },
      },
      liveProfilePage: { headline: 'Quigbot Multipass', headerMeta: 'Live profile · 8453:81', sharePath: '/multipass/?agent=81' },
      resolver: { chainId: 8453, tokenId: '81', canonicalId: '8453:81' },
    }),
    fetchImpl: savedQuigbotFetch,
  }).start();

  await flushAsyncEvents(20);
  const auraCard = root.querySelector('.multipass-profile-page > .aura-card');
  assert.ok(auraCard);
  assert.equal(auraCard.querySelector('img')?.getAttribute('src'), NAKAMIGO_2432_IMAGE);
  assert.notEqual(auraCard.querySelector('img')?.getAttribute('src'), 'https://api.helixa.xyz/api/v2/aura/81.png');
  assert.match(root.querySelector('.aura-provenance-drawer')?.textContent ?? '', /Manager public avatar URL/);
});

test('agent query refresh hydrates saved public tool cards when a saved profile exists', async () => {
  const liveData = {
    ...sampleData(),
    profile: {
      ...sampleData().profile,
      multipass_id: 'mp_helixa_agent_1',
      slug: 'helixa-agent-1',
      discovery_profile: { visibility: 'public', avatar_url: null },
    },
    liveProfilePage: { headline: 'Bendr 2.0 Multipass', headerMeta: 'Live profile · 8453:1', sharePath: '/multipass/?agent=1' },
    resolver: { chainId: 8453, tokenId: '1', canonicalId: '8453:1' },
  };
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith('/api/multipass/mp_helixa_agent_1')) {
      return new Response(JSON.stringify({
        ...sampleData().profile,
        multipass_id: 'mp_helixa_agent_1',
        slug: 'bendr-2-1',
        discovery_profile: { visibility: 'public', avatar_url: null },
      }), { status: 200 });
    }
    if (value.endsWith('/api/multipass/mp_helixa_agent_1/tools')) {
      return new Response(JSON.stringify(samplePublicTools()), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
  const root = setupDom('https://helixa.xyz/multipass/?agent=1&api=https://api.example.test');

  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData, fetchImpl }).start();

  await flushAsyncEvents(20);
  const toolsPanel = root.querySelector('.public-tools-panel');
  assert.ok(toolsPanel);
  assert.match(toolsPanel.textContent, /Bendr x402 profile lookup/);
  assert.match(toolsPanel.textContent, /api\.bankr\.example\/tools\/bendr\/lookup/);
});

test('agent query does not fall back to legacy resolver when canonical API returns a server error', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=1');
  const calls = [];
  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async (route) => {
      calls.push(String(route));
      if (String(route).includes('/api/multipass/resolve?source=')) {
        return { ok: false, status: 500, text: async () => 'broken' };
      }
      throw new Error(`unexpected legacy fallback ${route}`);
    },
    prefetchProfiles: false,
  });

  await app.start();
  await flushAsyncEvents(20);

  assert.deepEqual(calls, ['/multipass-api/api/multipass/resolve?source=helixa-agentdna%3A8453%3A1']);
  assert.match(root.textContent, /Could not reach the Helixa API/);
});

test('agent query loads canonical hydrated profile and renders saved public tools', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=1');
  const calls = [];
  const hydrated = {
    schema_version: '0.1.0',
    mode: 'activated',
    source_identity: { kind: 'helixa_agentdna', canonical_id: 'helixa-agentdna:8453:1', legacy_canonical_id: '8453:1', token_id: '1' },
    profile: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', slug: 'bendr-2-1', display_name: 'Bendr 2.0', discovery_profile: { summary: 'Activated agent.', tags: [], visibility: 'public' }, owner_summary: { owner_state: 'unclaimed' }, updated_at: '2026-07-03T00:00:00Z' },
    fragments: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [] },
    agent_card: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', name: 'Bendr 2.0', service_endpoints: [] },
    standards: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', standard_refs: [] },
    x402: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', endpoints: [] },
    tools: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', tools: [{ tool_id: 'agent-lookup', name: 'Agent lookup', description: 'Lookup this agent.' }] },
    changes: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', entries: [] },
    activation: { state: 'activated', manager_state: 'none' },
    routes_meta: { public_profile: '/multipass/bendr-2-1', activate: '/multipass/?agent=1' },
  };

  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    fetchImpl: async (route) => {
      calls.push(String(route));
      if (String(route).includes('/api/multipass/resolve?source=')) {
        return { ok: true, status: 200, text: async () => JSON.stringify(hydrated) };
      }
      throw new Error(`unexpected route ${route}`);
    },
    prefetchProfiles: false,
  });

  await app.start();
  await flushAsyncEvents(20);

  assert.equal(calls.some((route) => route === '/multipass-api/api/multipass/resolve?source=helixa-agentdna%3A8453%3A1'), true);
  assert.match(root.textContent, /Agent lookup/);
  assert.doesNotMatch(root.textContent, /display-only/i);
});

test('resolver transitional states keep the live resolver shell instead of profile-first layout', async () => {
  const invalidRoot = setupDom('https://helixa.xyz/multipass/');
  await createApp({
    root: invalidRoot,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => { throw new HelixaResolverError('invalid_format', 'Use a token ID like 1 or a Helixa ID like 8453:1.'); },
  }).start();
  invalidRoot.querySelector('.live-resolver input').value = 'not an id';
  invalidRoot.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  assert.ok(invalidRoot.querySelector('.live-resolver'));
  assert.equal(invalidRoot.querySelector('.multipass-profile-page'), null);

  const ambiguousRoot = setupDom('https://helixa.xyz/multipass/');
  await createApp({
    root: ambiguousRoot,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => {
      throw new HelixaResolverError('ambiguous_lookup', 'Multiple Helixa agents matched that name.', {
        matches: [
          { tokenId: '1', name: 'Bendr 2.0', helixaId: '8453:1', framework: 'openclaw', credScore: 80, verified: true },
          { tokenId: '81', name: 'Quigbot', helixaId: '8453:81', framework: 'openclaw', credScore: 75, verified: true },
        ],
      });
    },
  }).start();
  ambiguousRoot.querySelector('.live-resolver input').value = 'agent';
  ambiguousRoot.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  assert.ok(ambiguousRoot.querySelector('.live-resolver'));
  assert.ok(ambiguousRoot.querySelector('.lookup-matches'));
  assert.equal(ambiguousRoot.querySelector('.multipass-profile-page'), null);

  const loadingRoot = setupDom('https://helixa.xyz/multipass/?agent=81');
  await createApp({
    root: loadingRoot,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => new Promise(() => {}),
  }).start();
  assert.ok(loadingRoot.querySelector('.live-resolver'));
  assert.equal(loadingRoot.querySelector('.multipass-profile-page'), null);
  assert.equal(loadingRoot.querySelector('.homepage-hero'), null);
  assert.equal(loadingRoot.querySelector('.profile-visual-strip'), null);
  assert.doesNotMatch(loadingRoot.textContent, /Bendr 2\.0/);
});

test('resolved profile synthesizes a fallback visual from the live selected agent', async () => {
  const root = await renderResolvedQuigbotProfile(quigbotLiveData({ visualIdentity: null }));

  const card = root.querySelector('.multipass-profile-page > .aura-card');
  assert.ok(card);
  assert.match(card.textContent ?? '', /Quigbot/);
  assert.doesNotMatch(card.textContent ?? '', /Bendr 2\.0/);
});

test('profile detail drawers keep secondary content collapsed and JSON toggles working', async () => {
  const root = await renderResolvedQuigbotProfile();
  const profile = root.querySelector('.multipass-profile-page');
  assert.ok(profile);
  assert.deepEqual(profileDrawerTitles(profile), [
    'Share and status',
    'Ownership and management',
    'Visual provenance',
    'Trust context',
    'Communication',
    'Tools and services',
    'Public proof fragments',
    'Proof ledger',
  ]);

  assert.equal(profile.querySelectorAll('.profile-detail-drawer[open]').length <= 1, true);
  assert.equal(profile.querySelectorAll(':scope > .proof-ledger').length, 0);
  assert.equal(profile.querySelectorAll('.proof-ledger').length, 1);

  const proofDrawer = profileDrawerByTitle(profile, 'Proof ledger');
  assert.ok(proofDrawer);
  const firstToggle = proofDrawer.querySelector('[data-action="toggle-json"]');
  assert.ok(firstToggle);
  assert.equal(firstToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(proofDrawer.querySelector('pre'), null);
  firstToggle.click();
  const expandedProofDrawer = profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Proof ledger');
  assert.equal(expandedProofDrawer.querySelector('[data-action="toggle-json"]')?.getAttribute('aria-expanded'), 'true');
  assert.match(expandedProofDrawer.querySelector('pre')?.textContent ?? '', /Quigbot/);
});


test('successful live resolve shows activated Multipass summary without stale static framing', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=81');
  const liveData = {
    ...sampleData(),
    modeLabel: 'Live Profile',
    sourceLabel: 'live Helixa API',
    profile: { ...sampleData().profile, display_name: 'Quigbot' },
    resolver: { canonicalId: '8453:81', tokenId: '81' },
    liveProfilePage: { headline: 'Quigbot Multipass', headerMeta: 'Live profile · 8453:81', sharePath: '/multipass/?agent=81' },
  };

  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();
  await Promise.resolve();
  await Promise.resolve();

  const activation = root.querySelector('.activation-summary');
  assert.match(activation.textContent, /Activated Multipass/);
  assert.match(activation.textContent, /Quigbot/);
  assert.match(activation.textContent, /8453:81/);
  assert.match(activation.textContent, /Activated from live agent record/);
  assert.match(activation.textContent, /This Multipass was built from a live public agent record/);
  assert.match(activation.textContent, /live Helixa API/);
  assert.match(root.textContent, /Live source resolved into an activation preview/);
  assert.doesNotMatch(root.textContent, /This is a static public demo/);
});

test('trusted NFT adapter metadata is required for Activated from NFT label', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=1');
  const liveData = {
    ...sampleData(),
    sourceLabel: 'live Helixa API',
    resolver: { canonicalId: '8453:1', tokenId: '1' },
    activation: { origin: 'nft_adapter_new_erc8004', originSource: 'trusted_resolver_metadata' },
  };

  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.querySelector('.activation-summary').textContent, /Activated from NFT/);
});

test('untrusted NFT-looking live data does not claim Activated from NFT', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=1');
  const liveData = {
    ...sampleData(),
    sourceLabel: 'live Helixa API',
    resolver: { canonicalId: '8453:1', tokenId: '1' },
    activation: { origin: 'nft_adapter_new_erc8004', originSource: 'guessed_from_collection' },
  };

  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();
  await Promise.resolve();
  await Promise.resolve();

  const activation = root.querySelector('.activation-summary').textContent;
  assert.match(activation, /Activated from live agent record/);
  assert.doesNotMatch(activation, /Activated from NFT/);
});

test('activated page avoids custody and binding overclaims', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=1');
  const liveData = {
    ...sampleData(),
    sourceLabel: 'live Helixa API',
    resolver: { canonicalId: '8453:1', tokenId: '1' },
  };

  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.textContent, /mint-time ERC-8004 binding/i);
  assert.match(root.textContent, /read-only/i);
  assert.doesNotMatch(root.textContent, /bind to existing ERC-8004/i);
  assert.doesNotMatch(root.textContent, /transfer ownership/i);
  assert.doesNotMatch(root.textContent, /move tools/i);
  assert.doesNotMatch(root.textContent, /move secrets/i);
  assert.doesNotMatch(root.textContent, /grant permissions/i);
  assert.doesNotMatch(root.textContent, /passport/i);
  assert.doesNotMatch(root.textContent, /Multi Pass/i);
  assert.doesNotMatch(root.textContent, /created ERC-8004/i);
});


test('render uses live hero note when data supplies one', async () => {
  const data = { ...sampleData(), heroNote: 'Public Helixa API source evidence for Bendr 2.0.', sourceLabel: 'live Helixa API' };
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  await createApp({ root, loadDemo: async () => data }).start();

  assert.match(root.textContent, /Public Helixa API source evidence for Bendr 2\.0/);
  assert.doesNotMatch(root.textContent, /public record data/);
});

test('agent card carousel switches selected card detail', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.match(root.querySelector('.card-detail').textContent, /Bendr 2\.0/);
  assert.match(root.querySelector('.card-detail').textContent, /Cred 80/);

  root.querySelectorAll('.card-button')[1].click();

  assert.match(root.querySelector('.card-detail').textContent, /Quigbot/);
  assert.match(root.querySelector('.card-detail').textContent, /8453:81/);
  assert.match(root.querySelector('.card-detail').textContent, /Cred 75/);
});



test('landing page presents Helixa Swarm as a parent collection card', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.equal(root.querySelectorAll('.card-button').length, 3);
  assert.match(root.textContent, /Helixa Swarm/);
  assert.match(root.textContent, /Parent Multipass/);
  assert.match(root.textContent, /5 agents/);
  assert.doesNotMatch(root.textContent, /E2ETest/);
  assert.match(root.textContent, /Custody epoch ready/);
  assert.doesNotMatch(root.querySelector('.fragment-map').textContent, /Swarm roster/);

  root.querySelectorAll('.card-button')[2].click();
  assert.match(root.querySelector('.fragment-map').textContent, /Swarm roster/);
  assert.match(root.querySelector('.fragment-map').textContent, /Shared tool policy/);
  assert.match(root.querySelector('.fragment-map').textContent, /Aggregate Cred context/);
  assert.equal(root.textContent.includes('frag_helixa_swarm_'), false);
});


test('selecting Helixa Swarm shows roster roles policy references and transfer behavior', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  root.querySelectorAll('.card-button')[2].click();

  const detail = root.querySelector('.card-detail').textContent;
  assert.match(detail, /Swarm detail/);
  assert.match(detail, /Bendr 2\.0/);
  assert.match(detail, /Lead Agent \/ Trust Router/);
  assert.match(detail, /Quigbot/);
  assert.match(detail, /Product \/ Strategy Agent/);
  assert.match(detail, /Helixa/);
  assert.match(detail, /Protocol \/ Identity Agent/);
  assert.match(detail, /Phantom Relay/);
  assert.match(detail, /Routing \/ Relay Agent/);
  assert.match(detail, /Nox/);
  assert.match(detail, /Ops \/ Safety Agent/);
  assert.doesNotMatch(detail, /E2ETest/);
  assert.match(detail, /Policy references/);
  assert.match(detail, /Tool approval policy/);
  assert.match(detail, /Route policy reference/);
  assert.match(detail, /Owner approval required/);
  assert.doesNotMatch(detail, /Shared controls/);
  assert.match(detail, /Cred 78 Prime summarizes the roster without replacing individual agent scores/);
  assert.match(detail, /Permissions pause and tool routes reverify when custody changes/);
});




test('selected card renders owner and custody snapshot without executable controls', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  let snapshot = root.querySelector('.owner-snapshot');
  assert.ok(snapshot);
  assert.match(snapshot.textContent, /Owner & Custody Snapshot/);
  assert.match(snapshot.textContent, /0x3395\.\.\.480E0/);
  assert.match(snapshot.textContent, /Bendr runtime/);
  assert.match(snapshot.textContent, /Epoch 01/);
  assert.match(snapshot.textContent, /Active owner-approved routes/);
  assert.match(snapshot.textContent, /Public profile, private credentials hidden/);
  assert.match(snapshot.textContent, /Cred import refreshed/);
  assert.match(snapshot.textContent, /Review stale standards reference/);
  assert.doesNotMatch(snapshot.textContent, /Execute|Approve now|Transfer now/i);

  root.querySelectorAll('.card-button')[2].click();
  snapshot = root.querySelector('.owner-snapshot');
  assert.match(snapshot.textContent, /Helixa ops/);
  assert.match(snapshot.textContent, /Paused until owner review/);
  assert.match(snapshot.textContent, /Transfer detected 2026-06-24/);
  assert.match(snapshot.textContent, /Reverify routes before resume/);
});

test('selected card renders change review ledger below owner snapshot without executable controls', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  let ledger = root.querySelector('.change-review-ledger');
  assert.ok(ledger);
  assert.match(ledger.textContent, /Change \+ Review Ledger/);
  assert.match(ledger.textContent, /Cred import refreshed/);
  assert.match(ledger.textContent, /Verified/);
  assert.match(ledger.textContent, /Standards reference stale/);
  assert.match(ledger.textContent, /Reverify/);
  assert.match(ledger.textContent, /Private credentials hidden/);
  assert.match(ledger.textContent, /No public action/);
  assert.doesNotMatch(ledger.textContent, /Execute|Approve now|Transfer now/i);

  const snapshot = root.querySelector('.owner-snapshot');
  assert.ok(snapshot.compareDocumentPosition(ledger) & root.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING);

  root.querySelectorAll('.card-button')[2].click();
  ledger = root.querySelector('.change-review-ledger');
  const transfer = root.querySelector('.transfer-preview');
  assert.match(ledger.textContent, /Transfer detected/);
  assert.match(ledger.textContent, /Review required/);
  assert.match(ledger.textContent, /Shared route policy changed/);
  assert.match(ledger.textContent, /Paused/);
  assert.ok(root.querySelector('.owner-snapshot').compareDocumentPosition(ledger) & root.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(ledger.compareDocumentPosition(transfer) & root.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING);
});

test('selected card renders ownership state with paused permissions and preserved history', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  root.querySelectorAll('.card-button')[2].click();

  const preview = root.querySelector('.transfer-preview');
  assert.ok(preview);
  assert.match(preview.textContent, /Ownership State/);
  assert.doesNotMatch(preview.textContent, /\bpreview\b/i);
  assert.match(preview.textContent, /Current owner/);
  assert.match(preview.textContent, /0x3395\.\.\.480E0/);
  assert.match(preview.textContent, /Custody epoch/);
  assert.match(preview.textContent, /Epoch 03/);
  assert.match(preview.textContent, /New owner claim required/);
  assert.doesNotMatch(preview.textContent, /Claim swarm/);
  assert.match(preview.textContent, /Permissions paused/);
  assert.match(preview.textContent, /Reverify shared tools/);
  assert.match(preview.textContent, /Rotate private access/);
  assert.match(preview.textContent, /History preserved/);
  assert.match(preview.textContent, /Cred continues with ownership-change context/);
  assert.match(preview.textContent, /does not transfer secrets/);
});

test('proof section follows selected card', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  root.querySelectorAll('.card-button')[1].click();
  let proofTitles = [...root.querySelectorAll('.fragment-card h3')].map((node) => node.textContent);
  assert.deepEqual(proofTitles, ['Quigbot identity', 'Quigbot Cred context']);
  assert.match(root.querySelector('.proof-ledger').textContent, /2 public/);
  assert.doesNotMatch(root.querySelector('.fragment-map').textContent, /Helixa AgentDNA identity/);

  root.querySelectorAll('.card-button')[2].click();
  proofTitles = [...root.querySelectorAll('.fragment-card h3')].map((node) => node.textContent);
  assert.deepEqual(proofTitles, ['Swarm roster', 'Shared tool policy', 'Aggregate Cred context']);
  assert.match(root.querySelector('.proof-ledger').textContent, /3 public/);
  assert.doesNotMatch(root.querySelector('.fragment-map').textContent, /Quigbot identity/);
});

test('profile page keeps product education cards and raw fragment ids out of default view', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.match(root.textContent, /MULTIPASS/i);
  assert.doesNotMatch(root.textContent, /Card first/i);
  assert.doesNotMatch(root.textContent, /Proof below/i);
  assert.doesNotMatch(root.textContent, /Portable by design/i);
  assert.equal(root.querySelector('.story-records'), null);
  assert.equal(root.querySelector('.clarity-grid'), null);
  assert.match(root.textContent, /Inspect proof/i);
  assert.equal(root.textContent.includes('frag_bendr_'), false);
  assert.match(root.querySelector('.fragment-map').textContent, /Refers to/);
  assert.match(root.querySelector('.fragment-map').textContent, /The named source that supplied or checked this signal/);
  assert.match(root.querySelector('.fragment-map').textContent, /Cred and risk context for this Multipass/);

  const carousel = root.querySelector('.card-carousel');
  const proof = root.querySelector('.fragment-map');
  assert.ok(carousel.compareDocumentPosition(proof) & root.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING);
});

test('proof ledger renders all seven document types and JSON toggles open and close', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  for (const title of ['Profile', 'Public Fragments', 'Agent Card', 'Standards', 'x401', 'x402', 'Receipt']) {
    assert.match(root.textContent, new RegExp(title));
  }
  assert.match(root.textContent, /canonical summary/i);
  assert.match(root.textContent, /without claiming every adapter is live/i);
  assert.match(root.textContent, /without implying live settlement/i);
  assert.match(root.textContent, /without becoming trust by itself/i);
  assert.equal(root.querySelectorAll('.ledger-entry .why').length, 7);

  const firstToggle = root.querySelector('[data-action="toggle-json"]');
  assert.equal(firstToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(firstToggle.getAttribute('aria-controls'), 'proof-json-0');
  assert.equal(root.querySelector('pre'), null);
  firstToggle.click();
  assert.equal(root.querySelector('[data-action="toggle-json"]').getAttribute('aria-expanded'), 'true');
  assert.match(root.querySelector('pre').textContent, /Bendr 2\.0/);
  root.querySelector('[data-action="toggle-json"]').click();
  assert.equal(root.querySelector('pre'), null);

  root.querySelectorAll('[data-action="toggle-json"]')[1].click();
  assert.equal(root.innerHTML.includes('frag_bendr_private_placeholder'), false);
  assert.equal(root.innerHTML.includes('frag_bendr_unexpected_private_field'), false);
  root.querySelectorAll('[data-action="toggle-json"]')[1].click();
  assert.equal(root.querySelector('pre'), null);
});


test('proof ledger uses neutral badges for counts and green only for settled states', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const neutralBadges = [...root.querySelectorAll('.badge.neutral')].map((badge) => badge.textContent);
  assert.ok(neutralBadges.includes('1 capabilities'));
  assert.ok(neutralBadges.includes('1 refs'));
  assert.ok(neutralBadges.includes('1 endpoints'));
  const verifiedBadges = [...root.querySelectorAll('.badge.verified')].map((badge) => badge.textContent);
  const neutralBadgesAll = [...root.querySelectorAll('.badge.neutral')].map((badge) => badge.textContent);
  assert.deepEqual(verifiedBadges, ['settled']);
  assert.ok(neutralBadgesAll.includes('link_ready'));
  assert.ok(neutralBadgesAll.includes('7 public'));
});

test('default loader uses safe api query override from window location', async () => {
  const root = setupDom('http://localhost/?api=http://127.0.0.1:9999/');
  const calls = [];
  const payloads = {
    'http://127.0.0.1:9999/api/multipass/bendr-2': sampleData().profile,
    'http://127.0.0.1:9999/api/multipass/bendr-2/fragments': sampleData().fragments,
    'http://127.0.0.1:9999/api/multipass/bendr-2/agent-card': sampleData().card,
    'http://127.0.0.1:9999/api/multipass/bendr-2/standards': sampleData().standards,
    'http://127.0.0.1:9999/api/multipass/bendr-2/x402': sampleData().x402,
    'http://127.0.0.1:9999/api/multipass/bendr-2/receipts/receipt_bendr_lookup': sampleData().receipt,
  };

  globalThis.fetch = async (route) => {
    calls.push(route);
    return { ok: true, status: 200, text: async () => JSON.stringify(payloads[route]) };
  };

  try {
    await createApp({ root }).start();
  } finally {
    delete globalThis.fetch;
  }

  assert.ok(calls.every((route) => route.startsWith('http://127.0.0.1:9999/')));
  assert.match(root.textContent, /Bendr 2\.0/);
});


test('static /multipass/ page loads product home without calling API', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const calls = [];
  globalThis.fetch = async (route) => {
    calls.push(route);
    throw new Error(`unexpected fetch ${route}`);
  };

  try {
    await createApp({ root }).start();
  } finally {
    delete globalThis.fetch;
  }

  assert.deepEqual(calls, []);
  assert.ok(root.querySelector('.product-home-shell'));
  assert.match(root.textContent, /Portable identity profiles for agents/);
  assert.match(root.textContent, /View agents/);
  assert.equal(root.querySelector('.fragment-card'), null);
  assert.equal(root.querySelector('.proof-ledger'), null);
  assert.equal(root.innerHTML.includes('/multipass-api'), false);
});


test('static /multipass/ ignores unsafe api query override without calling API', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?api=not-a-url');
  const calls = [];
  globalThis.fetch = async (route) => {
    calls.push(route);
    throw new Error(`unexpected fetch ${route}`);
  };

  try {
    await createApp({ root }).start();
  } finally {
    delete globalThis.fetch;
  }

  assert.deepEqual(calls, []);
  assert.ok(root.querySelector('.product-home-shell'));
  assert.match(root.textContent, /Portable identity profiles for agents/);
  assert.equal(root.innerHTML.includes('/multipass-api'), false);
});


test('resolver submit loads live data and updates source label', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const liveData = { ...sampleData(), profile: { ...sampleData().profile, display_name: 'Live Bendr' }, sourceLabel: 'live Helixa API', modeLabel: 'Live Resolver', heroNote: 'Public Helixa API source evidence for Live Bendr.' };
  const calls = [];
  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => { calls.push(input); return liveData; },
  });

  await app.start();
  root.querySelector('.live-resolver input').value = '8453:1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(calls, ['8453:1']);
  assert.match(root.textContent, /Live Bendr/);
  assert.match(root.textContent, /live Helixa API/);
  assert.match(root.textContent, /Live source resolved into an activation preview/);
});


test('Bendr public profile does not require marketplace listing data', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  assert.ok(root.querySelector('.multipass-profile-page'));
  assert.equal(root.querySelector('.marketplace-listing'), null);
  assert.doesNotMatch(root.innerHTML, /Marketplace listing context/);
  assert.doesNotMatch(root.innerHTML, /Example public agent profiles/);
  const trustCopy = profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Trust context')?.textContent ?? '';
  assert.match(trustCopy, /Marketplace Connections/);
  assert.match(trustCopy, /No marketplace connections published yet/);
});

test('live resolver renders public agent profile compatibility context without executable controls', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const liveData = {
    ...sampleData(),
    profile: { ...sampleData().profile, display_name: 'Live Bendr' },
    sourceLabel: 'live Helixa API',
    modeLabel: 'Live Resolver',
    marketplaceListing: {
      title: 'Bendr 2.0 public agent profile',
      subtitle: '8453:1 · openclaw',
      summary: 'Public AgentDNA profile prepared for directories, builders, and marketplace compatibility with trust context.',
      identity: { name: 'Bendr 2.0', helixaId: '8453:1', tokenId: '1', framework: 'openclaw', verifiedLabel: 'Verified AgentDNA', sourceLabel: 'Live Helixa API' },
      score: { label: 'Cred 80', tier: 'Preferred', value: 80, tone: 'preferred' },
      badges: [{ label: 'Verified AgentDNA', tone: 'verified' }, { label: 'Open to work', tone: 'verified' }],
      facts: [{ label: 'Owner', value: '0x27E3...91Ea' }, { label: 'Operator', value: 'Not delegated' }],
      routes: [{ label: 'Web', value: 'https://helixa.xyz/agent/1', url: 'https://helixa.xyz/agent/1', kind: 'service' }, { label: 'MCP', value: 'https://api.helixa.xyz/api/mcp', url: 'https://api.helixa.xyz/api/mcp', kind: 'service' }],
      paymentReferences: [{ label: 'Accepted reference', value: 'USDC', chainId: 8453, source: 'Helixa metadata' }, { label: 'Linked token', value: 'CRED', chainId: 8453, source: 'Helixa linked token' }],
      proof: { publicFragmentCount: 7, verifiedSignalCount: 3, reviewRequiredCount: 2, privateCredentialState: 'No secrets or private credentials exposed' },
      links: [{ label: 'Explorer', url: 'https://basescan.org/token/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60?a=1' }],
      safetyNote: 'Public routes and proof are visible; authority and private credentials stay protected.',
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();
  root.querySelector('.live-resolver input').value = '1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  const listing = root.querySelector('.marketplace-listing');
  assert.ok(listing);
  assert.match(listing.textContent, /Public agent profile context/);
  assert.match(listing.textContent, /Bendr 2\.0 public agent profile/);
  assert.match(listing.textContent, /Cred 80/);
  assert.match(listing.textContent, /Preferred/);
  assert.match(listing.textContent, /Live Helixa API/);
  assert.match(listing.textContent, /No secrets or private credentials exposed/);
  assert.match(listing.textContent, /USDC/);
  assert.match(listing.textContent, /CRED/);
  assert.equal(listing.querySelector('button'), null);
  assert.equal(listing.querySelector('form'), null);
  assert.equal(listing.querySelector('[data-action]'), null);
  assert.doesNotMatch(listing.textContent, /instant approval|instant transfer|instant claim|checkout|credential release/i);
});

test('marketplace listing renderer does not link unsafe URLs', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = {
    ...sampleData(),
    marketplaceListing: {
      title: 'Verified agent listing for Safe Test',
      summary: 'Safe renderer boundary test.',
      identity: { verifiedLabel: 'Verified AgentDNA' },
      score: { tier: 'Qualified', label: 'Cred 50' },
      badges: [],
      facts: [],
      routes: [{ label: 'Unsafe', value: 'javascript:alert(1)', url: 'javascript:alert(1)', kind: 'service' }],
      paymentReferences: [],
      proof: { publicFragmentCount: 0, verifiedSignalCount: 0, reviewRequiredCount: 0, privateCredentialState: 'No secrets or private credentials exposed' },
      links: [{ label: 'Unsafe link', url: 'javascript:alert(1)' }],
      safetyNote: 'Public inspection only.',
    },
  };
  await createApp({ root, loadDemo: async () => data }).start();

  const listing = root.querySelector('.marketplace-listing');
  assert.ok(listing);
  assert.equal(listing.querySelector('a[href^="javascript:"]'), null);
  assert.match(listing.textContent, /Unsafe/);
  assert.match(listing.textContent, /Unsafe link/);
});

test('profile Trust context renders Marketplace Connections empty state without records', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = { ...sampleData() };
  delete data.marketplacePresence;

  await createApp({ root, loadDemo: async () => data }).start();

  const trustDrawer = profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Trust context');
  const panel = trustDrawer.querySelector('.marketplace-presence-panel');
  assert.ok(panel);
  assert.match(panel.textContent, /Marketplace Connections/);
  assert.match(panel.textContent, /No marketplace connections published yet/);
  assert.match(panel.textContent, /OKX\.AI/);
  assert.match(panel.textContent, /OpenSea/);
  assert.match(panel.textContent, /Bankr/);
  assert.match(panel.textContent, /ACP/);
  assert.match(panel.textContent, /direct x402/);
  assert.equal(panel.querySelector('.marketplace-presence-card'), null);
  assert.doesNotMatch(panel.textContent, /CertiK Security APIs/);
  assert.doesNotMatch(panel.textContent, /X Layer 196/);
});

test('profile Trust context renders Marketplace Connections cards from public metadata', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = { ...sampleData(), marketplacePresence: [null, {}, { marketplace: 'Empty marketplace' }, okxMarketplacePresence({ status: 'public_import', paymentRails: [] })] };

  await createApp({ root, loadDemo: async () => data }).start();

  const trustDrawer = profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Trust context');
  const panel = trustDrawer.querySelector('.marketplace-presence-panel');
  assert.ok(panel);
  assert.ok(trustDrawer.contains(panel));
  assert.equal(panel.querySelectorAll('.marketplace-presence-card').length, 1);
  assert.doesNotMatch(panel.textContent, /Empty marketplace/);
  assert.match(panel.textContent, /Marketplace Connections/);
  assert.match(panel.textContent, /OKX\.AI/);
  assert.match(panel.textContent, /Listing ID/);
  assert.match(panel.textContent, /1965/);
  assert.match(panel.textContent, /CertiK Security APIs/);
  const serviceCard = panel.querySelector('.marketplace-presence-service');
  assert.ok(serviceCard);
  assert.match(serviceCard.textContent, /0\.001 USDT/);
  assert.match(serviceCard.textContent, /x402 marketplace checkout/);
  assert.match(panel.textContent, /Public import/);
  assert.match(panel.textContent, /X Layer 196/);
  assert.match(panel.textContent, /5\.0/);
  assert.match(panel.textContent, /100%/);
  assert.match(panel.textContent, /53/);
  assert.match(panel.textContent, /1/);
  assert.match(panel.textContent, /2026-07-05T21:45:02Z/);
  assert.match(panel.textContent, /Optional public marketplace metadata only/);
});

test('public renderer renders derived Marketplace Connection title and summary', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = {
    ...sampleData(),
    fragments: { fragments: [{
      fragment_id: 'frag_marketplace_bankr',
      fragment_type: 'attestation',
      status: 'pending',
      assurance_level: 'self_attested',
      visibility: 'public',
      source: { source_type: 'owner_submission', issuer: null, observed_at: '2026-07-06T00:00:00.000Z', reference_url: 'https://bankr.bot/agents/helixa' },
      marketplace_ref: { marketplace: 'Bankr', profile_url: 'https://bankr.bot/agents/helixa', title: 'Helixa agent profile', summary: 'Public marketplace listing for Helixa services.', listing_id: 'helixa', status: 'manager_supplied' },
    }] },
    marketplacePresence: [{ marketplace: 'Bankr', profileUrl: 'https://bankr.bot/agents/helixa/', title: 'Old explicit', summary: 'Old summary.', status: 'public_import' }],
  };
  await createApp({ root, loadDemo: async () => data }).start();
  const panel = root.querySelector('.marketplace-presence-panel');
  assert.match(panel.textContent, /Helixa agent profile/);
  assert.match(panel.textContent, /Public marketplace listing for Helixa services/);
  assert.doesNotMatch(panel.textContent, /Old explicit/);
  assert.equal(panel.querySelectorAll('.marketplace-presence-card').length, 1);
});

test('marketplace presence links only render safe public URLs', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = {
    ...sampleData(),
    marketplacePresence: [okxMarketplacePresence({
      profileUrl: 'javascript:alert(1)',
      source: { url: 'https://source.example.test/public/1965' },
      services: [{ name: 'Private endpoint test', price: '0.001 USDT', endpointUrl: 'https://user:pass@example.com/private' }],
    })],
  };

  await createApp({ root, loadDemo: async () => data }).start();

  const panel = root.querySelector('.marketplace-presence-panel');
  assert.ok(panel);
  assert.equal(panel.querySelector('a[href^="javascript:"]'), null);
  assert.equal(panel.querySelector('a[href="https://user:pass@example.com/private"]'), null);
  assert.doesNotMatch(panel.innerHTML, /user:pass/);
  const safeSource = panel.querySelector('a[href="https://source.example.test/public/1965"]');
  assert.ok(safeSource);
  assert.equal(safeSource.getAttribute('target'), '_blank');
  assert.match(safeSource.getAttribute('rel') ?? '', /noopener/);
  assert.match(safeSource.getAttribute('rel') ?? '', /noreferrer/);
});

test('marketplace connections render empty state while preserving routes and legacy marketplace listing', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = {
    ...sampleData(),
    marketplacePresence: [],
    fragments: {
      ...sampleData().fragments,
      fragments: [
        ...sampleData().fragments.fragments,
        {
          fragment_id: 'frag_presence_route_safe',
          fragment_type: 'endpoint',
          status: 'pending',
          assurance_level: 'self_attested',
          visibility: 'public',
          transfer_policy: 'pause_on_transfer',
          source: { source_type: 'owner_submission', issuer: null },
          public_value: 'Marketplace-safe route',
          endpoint_ref: { endpoint_id: 'marketplace-safe-route', url: 'https://helixa.xyz/multipass/bendr-2-1', protocol: 'web' },
          updated_at: '2026-07-05T21:40:00Z',
        },
      ],
    },
    marketplaceListing: {
      title: 'Legacy marketplace listing',
      summary: 'Compatibility panel stays visible.',
      identity: { verifiedLabel: 'Verified AgentDNA' },
      score: { tier: 'Preferred', label: 'Cred 80' },
      routes: [],
      paymentReferences: [],
      proof: { publicFragmentCount: 0, verifiedSignalCount: 0, reviewRequiredCount: 0, privateCredentialState: 'No secrets or private credentials exposed' },
      links: [],
    },
  };

  await createApp({ root, loadDemo: async () => data }).start();

  const trustDrawer = profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Trust context');
  const panel = trustDrawer.querySelector('.marketplace-presence-panel');
  assert.ok(panel);
  assert.match(panel.textContent, /No marketplace connections published yet/);
  assert.equal(panel.querySelector('.marketplace-presence-card'), null);
  assert.ok(trustDrawer.querySelector('.public-routes-panel'));
  assert.ok(trustDrawer.querySelector('.marketplace-listing'));
});

test('marketplace presence only renders platform verified with verified source evidence', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = {
    ...sampleData(),
    marketplacePresence: [
      okxMarketplacePresence({
        listingId: 'claimed-only',
        status: 'platform_verified',
        source: { url: '' },
        proof: { assurance: 'platform_verified', source: { url: 'https://source.example.test/proof-only/1965' } },
      }),
      okxMarketplacePresence({
        listingId: 'verified-source',
        source: { url: 'https://source.example.test/verified/1965' },
        proof: { assurance: 'platform_verified' },
      }),
    ],
  };

  await createApp({ root, loadDemo: async () => data }).start();

  const cards = [...root.querySelectorAll('.marketplace-presence-card')];
  const claimedOnly = cards.find((card) => card.textContent.includes('claimed-only'));
  const verifiedSource = cards.find((card) => card.textContent.includes('verified-source'));
  assert.ok(claimedOnly);
  assert.ok(verifiedSource);
  assert.doesNotMatch(claimedOnly.textContent, /Platform verified source/);
  assert.match(claimedOnly.textContent, /Public metadata/);
  assert.match(verifiedSource.textContent, /Platform verified source/);
});

test('OpenSea-style marketplace connection renders as optional public metadata only', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = {
    ...sampleData(),
    marketplacePresence: [{
      marketplace: 'OpenSea',
      listingId: 'base:0x2e3B541C59D38b84E3Bc54e977200230A204Fe60:81',
      profileUrl: 'https://opensea.io/assets/base/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60/81',
      status: 'manager_supplied',
      source: {
        label: 'OpenSea public item',
        url: 'https://opensea.io/assets/base/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60/81',
        checkedAt: '2026-07-06T00:00:00Z',
        provenance: 'source-referenced listing',
      },
      services: [{ name: 'Public agent tool manifest', paymentMode: 'metadata only' }],
      paymentRails: ['metadata only'],
      reputation: {},
      proof: { assurance: 'public_metadata', fragmentIds: [] },
    }],
  };

  await createApp({ root, loadDemo: async () => data }).start();

  const panel = root.querySelector('.marketplace-presence-panel');
  assert.ok(panel);
  assert.match(panel.textContent, /Marketplace Connections/);
  assert.match(panel.textContent, /OpenSea/);
  assert.match(panel.textContent, /Manager supplied/);
  assert.match(panel.textContent, /Public agent tool manifest/);
  assert.match(panel.textContent, /metadata only/);
  assert.doesNotMatch(panel.textContent, /official OpenSea integration/i);
  assert.doesNotMatch(panel.textContent, /registered on OpenSea/i);
  const link = panel.querySelector('a[href="https://opensea.io/assets/base/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60/81"]');
  assert.ok(link);
  assert.equal(link.getAttribute('target'), '_blank');
  assert.match(link.getAttribute('rel') ?? '', /noopener/);
  assert.match(link.getAttribute('rel') ?? '', /noreferrer/);
});

test('marketplace presence safety copy avoids authority payment credential and registration overclaims', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = { ...sampleData(), marketplacePresence: [okxMarketplacePresence()] };

  await createApp({ root, loadDemo: async () => data }).start();

  const copy = root.querySelector('.marketplace-presence-panel')?.textContent.toLowerCase() ?? '';
  for (const phrase of [
    'payment proves trust',
    'private credentials available',
    'acts on behalf',
    'executes tools',
    'custody transfer',
    'authority over marketplace account',
    'official okx integration',
    'official opensea integration',
    'registered on okx',
    'registered on opensea',
    'collects x401 proof',
    'requires identity proof',
  ]) {
    assert.equal(copy.includes(phrase), false, phrase);
  }
});

test('static swarm profile renders empty Marketplace Connections without seeded OKX claim', async () => {
  const root = setupDom('https://helixa.xyz/multipass/swarm/helixa');

  await createApp({ root, prefetchProfiles: false }).start();

  const trustDrawer = profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Trust context');
  const panel = trustDrawer.querySelector('.marketplace-presence-panel');
  assert.ok(panel);
  assert.match(panel.textContent, /Marketplace Connections/);
  assert.match(panel.textContent, /No marketplace connections published yet/);
  assert.equal(panel.querySelector('.marketplace-presence-card'), null);
  assert.doesNotMatch(panel.textContent, /CertiK Security APIs/);
  assert.doesNotMatch(panel.textContent, /X Layer 196/);
  assert.doesNotMatch(panel.textContent, /registered on OKX/i);
  assert.doesNotMatch(panel.textContent, /official OKX integration/i);
});

test('public profile button restores Multipass home after live resolve from homepage', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const liveData = { ...sampleData(), profile: { ...sampleData().profile, display_name: 'Live Bendr' }, sourceLabel: 'live Helixa API', modeLabel: 'Live Resolver' };
  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();

  root.querySelector('.live-resolver input').value = '1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();
  root.querySelector('[data-action="reset-static-demo"]').click();

  assert.match(root.textContent, /Portable identity profiles for agents/);
  assert.doesNotMatch(root.textContent, /Bendr is one profile, not the homepage/);
  assert.doesNotMatch(root.textContent, /Live Bendr/);
});

test('back to Multipass home from direct agent query clears profile route state', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=81');
  const liveData = {
    ...sampleData(),
    profile: { ...sampleData().profile, display_name: 'Quigbot' },
    resolver: { canonicalId: '8453:81', tokenId: '81' },
    liveProfilePage: { headline: 'Quigbot Multipass', headerMeta: 'Live profile · 8453:81', sharePath: '/multipass/?agent=81' },
  };

  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();
  await Promise.resolve();
  await Promise.resolve();
  root.querySelector('[data-action="reset-static-demo"]').click();

  assert.ok(root.querySelector('.product-home-shell'));
  assert.equal(root.querySelector('.multipass-profile-page'), null);
  assert.equal(root.querySelector('.record-sheet'), null);
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/');
});

test('Bendr public profile reset invalidates an in-flight live resolver response', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  let resolveLive;
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => new Promise((resolve) => { resolveLive = resolve; }),
  }).start();

  root.querySelector('.live-resolver input').value = '1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  root.querySelector('[data-action="reset-static-demo"]').click();
  resolveLive({ ...sampleData(), profile: { ...sampleData().profile, display_name: 'Late Live Bendr' }, sourceLabel: 'live Helixa API' });
  await Promise.resolve();
  await Promise.resolve();

  assert.doesNotMatch(root.textContent, /Late Live Bendr/);
  assert.match(root.textContent, /Portable identity profiles for agents/);
});

test('resolver invalid input shows validation error and keeps static data available', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => { throw new HelixaResolverError('invalid_format', 'Use a token ID like 1 or a Helixa ID like 8453:1.'); },
  }).start();

  root.querySelector('.live-resolver input').value = 'Bendr';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.textContent, /Use a token ID like 1 or a Helixa ID like 8453:1/);
  assert.match(root.textContent, /Bendr 2\.0/);
});

test('resolver unsupported chain shows Base-only error and keeps static data available', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => { throw new HelixaResolverError('unsupported_chain', 'V0 supports Base Helixa AgentDNA records only.'); },
  }).start();

  root.querySelector('.live-resolver input').value = '1:1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.textContent, /V0 supports Base Helixa AgentDNA records only/);
  assert.match(root.textContent, /Bendr 2\.0/);
});

test('resolver API error keeps static data available', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => { throw new HelixaResolverError('not_found', 'No Helixa agent found for that ID.'); },
  }).start();

  root.querySelector('.live-resolver input').value = '999999';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.textContent, /No Helixa agent found for that ID/);
  assert.match(root.textContent, /Bendr 2\.0/);
});

test('failed lookup after live activation returns to preview state without stale activated copy', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  let calls = 0;
  const liveData = {
    ...sampleData(),
    sourceLabel: 'live Helixa API',
    profile: { ...sampleData().profile, display_name: 'Quigbot Live' },
    resolver: { canonicalId: '8453:81', tokenId: '81' },
    liveProfilePage: { headline: 'Quigbot Multipass', headerMeta: 'Live profile · 8453:81', sharePath: '/multipass/?agent=81' },
  };

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => {
      calls += 1;
      if (calls === 1) return liveData;
      throw new HelixaResolverError('not_found', 'No Helixa agent found for that ID.');
    },
  }).start();

  root.querySelector('.live-resolver input').value = '81';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();
  assert.match(root.querySelector('.activation-summary').textContent, /Activated Multipass/);

  root.querySelector('[data-action="reset-static-demo"]').click();
  root.querySelector('.live-resolver input').value = '999999';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.textContent, /No Helixa agent found for that ID/);
  assert.ok(root.querySelector('.product-home-shell'));
  assert.equal(root.querySelector('.multipass-profile-page'), null);
  assert.doesNotMatch(root.textContent, /Quigbot Live/);
  assert.doesNotMatch(root.textContent, /Activated Multipass/);
  assert.equal(new URL(window.location.href).searchParams.get('agent'), null);
});

test('resolver rate limit disables retry during Retry-After window', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => { throw new HelixaResolverError('rate_limited', 'Helixa API is rate-limiting requests. Try again shortly.', { retryAfter: '12' }); },
  }).start();

  root.querySelector('.live-resolver input').value = '1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(root.querySelector('.live-resolver button[type="submit"]').disabled, true);
  assert.match(root.textContent, /Try again in 12 seconds/);
});

test('resolver disables duplicate submit while matching request is in flight', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  let resolveLive;
  let calls = 0;
  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => { calls += 1; return new Promise((resolve) => { resolveLive = resolve; }); } }).start();

  root.querySelector('.live-resolver input').value = '1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(calls, 1);
  assert.equal(root.querySelector('.live-resolver button[type="submit"]').textContent, 'Activating...');

  resolveLive(sampleData());
  await Promise.resolve();
  await Promise.resolve();
});

test('changed input can supersede an older in-flight resolver request through the real UI', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const calls = [];
  const resolvers = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: (input) => new Promise((resolve) => { calls.push(input); resolvers.push(resolve); }),
  }).start();

  root.querySelector('.live-resolver input').value = '1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(root.querySelector('.live-resolver button[type="submit"]').disabled, false);
  root.querySelector('.live-resolver input').value = '81';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

  assert.deepEqual(calls, ['1', '81']);
  resolvers[1]({ ...sampleData(), profile: { ...sampleData().profile, display_name: 'Quigbot Live' }, sourceLabel: 'live Helixa API' });
  await Promise.resolve();
  await Promise.resolve();
  assert.match(root.textContent, /Quigbot Live/);
});

test('newer resolver response supersedes older response', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const resolvers = [];
  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: (input) => new Promise((resolve) => resolvers.push({ input, resolve })) }).start();

  root.querySelector('.live-resolver input').value = '1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  root.querySelector('.live-resolver input').value = '81';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

  resolvers[1].resolve({ ...sampleData(), profile: { ...sampleData().profile, display_name: 'Quigbot Live' }, sourceLabel: 'live Helixa API' });
  await Promise.resolve();
  await Promise.resolve();
  resolvers[0].resolve({ ...sampleData(), profile: { ...sampleData().profile, display_name: 'Old Bendr Live' }, sourceLabel: 'live Helixa API' });
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.textContent, /Quigbot Live/);
  assert.doesNotMatch(root.textContent, /Old Bendr Live/);
});

test('agent query auto-resolves live record after static load', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=8453:1');
  const calls = [];
  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async (input) => { calls.push(input); return { ...sampleData(), sourceLabel: 'live Helixa API', modeLabel: 'Live Resolver' }; } }).start();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(calls, ['8453:1']);
  assert.match(root.textContent, /live Helixa API/);
});

test('saved profile share UI exposes the profile URL, not preview plumbing', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const liveData = {
    ...sampleData(),
    profile: { ...sampleData().profile, display_name: 'Bendr 2.0', slug: 'bendr-2-1', multipass_id: 'mp_helixa_agent_1' },
    liveProfilePage: {
      headline: 'Bendr 2.0 Multipass',
      headerMeta: 'Saved profile · 8453:1',
      sharePath: '/multipass/bendr-2-1',
      sharePreviewPath: '/multipass/share/bendr-2-1',
    },
    visualIdentity: {
      source: 'helixa_aura',
      label: 'Bendr visual identity',
      imageUrl: 'https://api.helixa.xyz/api/v2/aura/1.png',
      initials: 'B',
      tone: 'prime',
      chips: [],
    },
  };

  await createApp({ root, loadDemo: async () => liveData }).start();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(root.querySelector('.share-panel .share-url')?.textContent, 'https://helixa.xyz/multipass/bendr-2-1');
  assert.equal(root.querySelector('.aura-share-action')?.getAttribute('data-share-url'), '/multipass/bendr-2-1');
  assert.doesNotMatch(root.textContent, /\/multipass\/share\/bendr-2-1/);
});

test('resolved live agent takes over the page hero and record surface', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=81');
  const liveData = {
    ...sampleData(),
    modeLabel: 'Live Profile',
    sourceLabel: 'live Helixa API',
    profile: { ...sampleData().profile, display_name: 'Quigbot', slug: 'helixa-agent-81', multipass_id: 'mp_helixa_agent_81' },
    liveProfilePage: {
      eyebrow: 'LIVE MULTIPASS',
      headline: 'Quigbot Multipass',
      body: 'Live AgentDNA profile for Quigbot with public identity, routes, custody context, and proof inspection.',
      note: 'Shareable live profile for 8453:81.',
      recordIntro: 'Live public AgentDNA profile assembled from public Helixa API signals.',
      headerMeta: 'Live profile · 8453:81',
      sharePath: '/multipass/?agent=81',
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();
  await Promise.resolve();
  await Promise.resolve();

  const profile = root.querySelector('.multipass-profile-page');
  assert.ok(profile);
  assert.equal(root.querySelector('.homepage-hero'), null);
  assert.match(root.querySelector('.header-meta').textContent, /Live profile · 8453:81/);
  assert.match(profile.querySelector('.aura-card')?.textContent ?? '', /Quigbot/);
  assert.equal(root.querySelector('.share-link'), null);
  assert.equal(root.querySelector('.share-panel .share-url')?.textContent, 'https://helixa.xyz/multipass/?agent=81');
  assert.match(root.querySelector('.share-panel')?.textContent ?? '', /Quigbot Multipass/);
});


test('live profile renders OpenSea-style Agent Aura item panel with provenance drawer', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=81');
  const data = {
    ...sampleData(),
    liveProfilePage: { headline: 'Quigbot Multipass', sharePath: '/multipass/?agent=81' },
    visualIdentity: {
      source: 'helixa_aura',
      label: 'Helixa Agent Aura',
      imageUrl: 'https://api.helixa.xyz/api/v2/aura/81.png',
      initials: 'Q',
      tone: 'prime',
      summary: 'Default Helixa Agent Aura. Owners can later bind an agent NFT, collection NFT, or custom visual.',
      chips: ['Cred 75', 'openclaw', 'Verified'],
      provenanceDrawer: {
        title: 'Agent Aura Provenance',
        summary: 'Public Helixa API-reported provenance for this AgentDNA visual.',
        facts: [
          { label: 'Helixa ID', value: '8453:81' },
          { label: 'AgentDNA token ID', value: '81' },
          { label: 'Chain', value: 'Base (8453)' },
          { label: 'Contract', value: '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60' },
          { label: 'Owner', value: '0x17d7...bDe4' },
          { label: 'Metadata source', value: 'https://api.helixa.xyz/api/v2/metadata/81' },
          { label: 'Aura image source', value: 'https://api.helixa.xyz/api/v2/aura/81.png' },
          { label: 'API source', value: 'https://api.helixa.xyz/api/v2/agent/81' },
        ],
        links: [
          { label: 'Metadata JSON', url: 'https://api.helixa.xyz/api/v2/metadata/81' },
          { label: 'Aura image', url: 'https://api.helixa.xyz/api/v2/aura/81.png' },
          { label: 'OpenSea item', url: 'https://opensea.io/assets/base/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60/81' },
        ],
        safetyNote: 'Public provenance context. Viewing does not grant authority or expose private credentials.',
      },
    },
    marketplaceListing: {
      title: 'Quigbot public agent profile',
      summary: 'Live public AgentDNA profile with trust context.',
      identity: { helixaId: '8453:81', framework: 'openclaw', verifiedLabel: 'Verified AgentDNA', sourceLabel: 'Live Helixa API' },
      score: { tier: 'Prime', label: 'Cred 75' },
      badges: [],
      facts: [],
      routes: [],
      paymentReferences: [],
      links: [],
      safetyNote: 'Public inspection only.',
    },
  };
  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => data }).start();
  await Promise.resolve();
  await Promise.resolve();

  const auraCard = root.querySelector('.aura-card');
  const drawer = root.querySelector('.aura-provenance-drawer');
  assert.equal(auraCard?.getAttribute('data-visual-source'), 'helixa_aura');
  assert.match(auraCard?.getAttribute('aria-label') ?? '', /public agent profile/i);
  assert.ok(root.querySelector('.aura-asset-frame'));
  assert.ok(root.querySelector('.aura-item-meta'));
  assert.ok(profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Visual provenance')?.contains(drawer));
  assert.ok(profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Trust context')?.contains(root.querySelector('.marketplace-listing')));
  assert.equal(auraCard.querySelector('h2')?.textContent, 'Quigbot');
  assert.doesNotMatch(auraCard.textContent, /Helixa Agent Aura/);
  const shareAction = auraCard.querySelector('button.aura-share-action[data-action="share-profile"]');
  assert.equal(shareAction?.getAttribute('data-share-url'), '/multipass/?agent=81');
  assert.equal(shareAction?.getAttribute('aria-label'), 'Share Quigbot Multipass profile');
  assert.match(drawer?.textContent ?? '', /Agent Aura Provenance/);
  assert.match(drawer?.textContent ?? '', /8453:81/);
  assert.match(drawer?.textContent ?? '', /AgentDNA token ID/);
  assert.match(drawer?.textContent ?? '', /Base \(8453\)/);
  assert.match(drawer?.textContent ?? '', /0x2e3B541C59D38b84E3Bc54e977200230A204Fe60/);
  assert.match(drawer?.textContent ?? '', /0x17d7\.\.\.bDe4/);
  assert.match(drawer?.textContent ?? '', /https:\/\/api\.helixa\.xyz\/api\/v2\/metadata\/81/);
  assert.match(drawer?.textContent ?? '', /https:\/\/api\.helixa\.xyz\/api\/v2\/aura\/81\.png/);
  assert.match(drawer?.textContent ?? '', /https:\/\/api\.helixa\.xyz\/api\/v2\/agent\/81/);
  assert.equal([...drawer.querySelectorAll('a')].some((link) => link.href === 'https://opensea.io/assets/base/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60/81'), true);
  assert.match(drawer?.textContent ?? '', /does not grant authority/i);
  assert.equal(root.querySelector('.aura-card img')?.getAttribute('src'), 'https://api.helixa.xyz/api/v2/aura/81.png');
  assert.doesNotMatch(root.textContent, /Default visual identity/);
  assert.doesNotMatch(root.textContent, /Default Helixa Agent Aura/);
  assert.doesNotMatch(root.textContent, /agent NFT, collection NFT, or custom visual/);
});

test('aura share icon opens native share without navigating to crawler preview page', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=81');
  const shares = [];
  Object.defineProperty(window.navigator, 'share', {
    configurable: true,
    value: async (payload) => { shares.push(payload); },
  });
  const data = {
    ...sampleData(),
    liveProfilePage: { headline: 'Quigbot Multipass', sharePath: '/multipass/?agent=81' },
    visualIdentity: {
      source: 'helixa_aura',
      label: 'Helixa Agent Aura',
      imageUrl: 'https://api.helixa.xyz/api/v2/aura/81.png',
      initials: 'Q',
      tone: 'prime',
      chips: ['Cred 75'],
    },
  };
  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => data }).start();
  await Promise.resolve();
  await Promise.resolve();

  const shareAction = root.querySelector('button.aura-share-action');
  shareAction.click();
  await Promise.resolve();

  assert.equal(window.location.href, 'https://helixa.xyz/multipass/?agent=81');
  assert.deepEqual(shares, [{ title: 'Quigbot Multipass', text: 'Quigbot Multipass', url: 'https://helixa.xyz/multipass/?agent=81' }]);
});

test('resolved numeric profile still shares the profile URL when preview manifest is missing', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=9999');
  const missingManifestProfile = {
    ...sampleData(),
    profile: {
      ...sampleData().profile,
      display_name: 'Manifest Missing',
      slug: 'helixa-agent-9999',
      multipass_id: 'mp_helixa_agent_9999',
    },
    resolver: { canonicalId: '8453:9999', tokenId: '9999' },
    liveProfilePage: { headline: 'Manifest Missing Multipass', headerMeta: 'Live profile · 8453:9999', sharePath: '/multipass/?agent=9999' },
    agentCards: [{ name: 'Manifest Missing', tokenId: 9999, helixaId: '8453:9999', framework: 'openclaw', credScore: 50, credTier: 'Test', verified: true, profileUrl: 'https://helixa.xyz/agent/9999' }],
    visualIdentity: {
      source: 'helixa_aura',
      label: 'Manifest Missing visual identity',
      imageUrl: 'https://api.helixa.xyz/api/v2/aura/9999.png',
      initials: 'MM',
      tone: 'prime',
      chips: ['8453:9999'],
    },
  };

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => {
      assert.equal(input, '9999');
      return missingManifestProfile;
    },
  }).start();
  await flushAsyncEvents();

  assert.ok(root.querySelector('.aura-card'));
  assert.equal(root.querySelector('.aura-share-action')?.getAttribute('data-share-url'), '/multipass/?agent=9999');
});

test('Agent Aura provenance drawer is optional and skips empty rows', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=81');
  const data = {
    ...sampleData(),
    visualIdentity: { source: 'helixa_aura', label: 'Helixa Agent Aura', imageUrl: 'https://api.helixa.xyz/api/v2/aura/81.png', initials: 'Q', tone: 'prime', chips: [] },
  };
  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => data }).start();
  await Promise.resolve();
  await Promise.resolve();

  assert.ok(root.querySelector('.aura-card'));
  assert.equal(root.querySelector('.aura-provenance-drawer'), null);

  const rootWithSparseDrawer = setupDom('https://helixa.xyz/multipass/?agent=81');
  const sparseData = {
    ...data,
    visualIdentity: {
      ...data.visualIdentity,
      provenanceDrawer: {
        title: 'Agent Aura Provenance',
        summary: 'Public Helixa API-reported provenance for this AgentDNA visual.',
        facts: [{ label: 'Helixa ID', value: '8453:81' }, { label: 'Owner', value: '' }, { label: 'Framework', value: null }],
        links: [{ label: 'Metadata JSON', url: 'https://api.helixa.xyz/api/v2/metadata/81' }, { label: 'Explorer', url: '' }],
        safetyNote: 'Public inspection only.',
      },
    },
  };
  await createApp({ root: rootWithSparseDrawer, loadDemo: async () => sampleData(), loadLiveDemo: async () => sparseData }).start();
  await Promise.resolve();
  await Promise.resolve();

  const drawer = rootWithSparseDrawer.querySelector('.aura-provenance-drawer');
  assert.match(drawer?.textContent ?? '', /8453:81/);
  assert.doesNotMatch(drawer?.textContent ?? '', /Owner/);
  assert.doesNotMatch(drawer?.textContent ?? '', /Framework/);
  assert.equal(drawer?.querySelectorAll('a').length, 1);
});

test('Agent Aura provenance drawer renders only safe public links', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=81');
  const data = {
    ...sampleData(),
    visualIdentity: {
      source: 'helixa_aura',
      label: 'Helixa Agent Aura',
      imageUrl: 'https://api.helixa.xyz/api/v2/aura/81.png',
      initials: 'Q',
      tone: 'prime',
      chips: [],
      provenanceDrawer: {
        title: 'Agent Aura Provenance',
        summary: 'Public Helixa API-reported provenance for this AgentDNA visual.',
        facts: [{ label: 'Helixa ID', value: '8453:81' }],
        links: [
          { label: 'Good metadata', url: 'https://api.helixa.xyz/api/v2/metadata/81' },
          { label: 'Bad script', url: 'javascript:alert(1)' },
          { label: 'Bad ftp', url: 'ftp://example.com/file' },
          { label: 'Bad malformed', url: 'not a url' },
          { label: 'Bad credentials', url: 'https://user:pass@example.com/secret' },
        ],
        safetyNote: 'Public inspection only.',
      },
    },
  };
  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => data }).start();
  await Promise.resolve();
  await Promise.resolve();

  const links = [...root.querySelectorAll('.aura-provenance-drawer a')];
  assert.equal(links.length, 1);
  assert.equal(links[0].textContent, 'Good metadata');
  assert.equal(links[0].getAttribute('target'), '_blank');
  assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer');
  assert.doesNotMatch(root.querySelector('.aura-provenance-drawer')?.innerHTML ?? '', /javascript:|ftp:\/\/|user:pass/);
});

test('manual resolver writes a clean share URL and reset removes it', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const liveData = {
    ...sampleData(),
    profile: { ...sampleData().profile, display_name: 'Bendr 2.0' },
    liveProfilePage: {
      headline: 'Bendr 2.0 Multipass',
      sharePath: '/multipass/?agent=1',
    },
  };

  await createApp({ root, loadDemo: async () => sampleData(), loadLiveDemo: async () => liveData }).start();
  root.querySelector('.live-resolver input').value = '8453:1';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(window.location.href, 'https://helixa.xyz/multipass/?agent=1');
  root.querySelector('[data-action="reset-static-demo"]').click();
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/');
});

test('empty agent query shows the same empty-input validation error', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=');
  const calls = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => { calls.push(input); throw new HelixaResolverError('empty_input', 'Enter a Helixa token ID or Helixa ID.'); },
  }).start();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(calls, ['']);
  assert.match(root.textContent, /Enter a Helixa token ID or Helixa ID/);
  assert.match(root.textContent, /Bendr 2\.0/);
});

test('invalid agent query shows the same format validation error', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=Bendr');
  const calls = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => { calls.push(input); throw new HelixaResolverError('invalid_format', 'Use a token ID like 1 or a Helixa ID like 8453:1.'); },
  }).start();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(calls, ['Bendr']);
  assert.match(root.textContent, /Use a token ID like 1 or a Helixa ID like 8453:1/);
});



test('resolver omits example chips and keeps activation focused on manual input', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();

  const resolver = root.querySelector('.live-resolver');
  assert.ok(resolver);
  assert.equal(resolver.querySelector('.resolver-examples'), null);
  assert.equal(resolver.querySelectorAll('[data-action="resolve-example-agent"]').length, 0);
  assert.doesNotMatch(resolver.textContent, /Examples|Try\s/);
  assert.ok(resolver.querySelector('[data-action="resolve-live-agent"]'));
});

test('ambiguous name lookup renders selectable live agent matches', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  const calls = [];
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async (input) => {
      calls.push(input);
      if (input === 'bot') {
        throw new HelixaResolverError('ambiguous_lookup', 'Pick a matching Helixa agent.', {
          matches: [
            { tokenId: '81', name: 'Quigbot', helixaId: '8453:81', framework: 'openclaw', credScore: 75, verified: true },
            { tokenId: '10', name: 'MoltBot Agent', helixaId: '8453:10', framework: 'custom', credScore: 32, verified: false },
          ],
        });
      }
      return {
        ...sampleData(),
        profile: { ...sampleData().profile, display_name: 'Quigbot' },
        liveProfilePage: { headline: 'Quigbot Multipass', sharePath: '/multipass/?agent=81' },
      };
    },
  }).start();

  root.querySelector('.live-resolver input').value = 'bot';
  root.querySelector('.live-resolver form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.textContent, /Pick a matching Helixa agent/);
  assert.match(root.textContent, /Quigbot/);
  assert.match(root.textContent, /MoltBot Agent/);
  assert.equal(root.querySelectorAll('.lookup-match-card').length, 2);
  root.querySelector('[data-action="select-lookup-match"][data-token-id="81"]').click();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(calls, ['bot', '81']);
  assert.ok(root.querySelector('.multipass-profile-page'));
  assert.equal(root.querySelector('.homepage-hero'), null);
  assert.match(root.querySelector('.aura-card')?.textContent ?? '', /Quigbot/);
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/?agent=81');
});


test('loaded live activation preview explains the stable profile candidate before save', async () => {
  const root = await renderResolvedQuigbotProfile();

  const preview = root.querySelector('.activation-preview-panel');
  assert.ok(preview);
  assert.match(preview.textContent, /Activation preview/);
  assert.match(preview.textContent, /Quigbot/);
  assert.match(preview.textContent, /8453:81/);
  assert.match(preview.textContent, /Token 81/);
  assert.match(preview.textContent, /\/multipass\/\?agent=81/);
  assert.match(preview.textContent, /stable public agent profile/i);
  assert.match(preview.textContent, /does not transfer custody/i);
  assert.match(preview.textContent, /does not release credentials/i);
  assert.match(preview.textContent, /does not change approvals/i);
  assert.equal(root.querySelector('.save-panel button[data-action="save-multipass"]')?.textContent, 'Activate Multipass');
});

test('live activation preview activates with resolved token id and updates share panel', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=Quigbot');
  const liveData = {
    ...sampleData(),
    sourceLabel: 'live Helixa API',
    resolver: { canonicalId: '8453:1', tokenId: '1' },
    liveProfilePage: { headline: 'Bendr Multipass', headerMeta: 'Live profile · 8453:1', sharePath: '/multipass/?agent=1' },
  };
  const saves = [];

  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => liveData,
    saveMultipass: async ({ agent }) => {
      saves.push(agent);
      return { created: true, sharePath: '/multipass/bendr-2-1', profile: { slug: 'bendr-2-1' } };
    },
  }).start();
  await Promise.resolve();
  await Promise.resolve();

  const button = [...root.querySelectorAll('button')].find((node) => node.textContent === 'Activate Multipass');
  assert.ok(button);
  button.click();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(saves, ['1']);
  assert.match(root.textContent, /Activated Multipass/);
  assert.doesNotMatch(root.textContent, /Save Multipass/);
  assert.match(root.textContent, /\/multipass\/bendr-2-1/);
  assert.equal(new URL(window.location.href).pathname, '/multipass/bendr-2-1');
});

test('direct saved slug route loads saved Multipass from API instead of static preview', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const fetches = [];
  await createApp({
    root,
    fetchImpl: async (url) => {
      fetches.push(url);
      return savedProfileFetch(url);
    },
  }).start();

  assert.match(root.textContent, /Saved Bendr/);
  assert.match(root.textContent, /Activated Multipass/);
  assert.doesNotMatch(root.textContent, /Save Multipass/);
  assert.doesNotMatch(root.textContent, /Bendr 2.0 Public Profile/);
  assert.ok(fetches.some((url) => String(url).includes('/api/multipass/bendr-2-1')));
});

test('save error does not update stable URL or claim success', async () => {
  const root = setupDom('https://helixa.xyz/multipass/?agent=1');
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    loadLiveDemo: async () => ({
      ...sampleData(),
      sourceLabel: 'live Helixa API',
      resolver: { canonicalId: '8453:1', tokenId: '1' },
      liveProfilePage: { headline: 'Bendr Multipass', headerMeta: 'Live profile · 8453:1', sharePath: '/multipass/?agent=1' },
    }),
    saveMultipass: async () => { throw new Error('Save API unavailable.'); },
  }).start();
  await Promise.resolve();
  await Promise.resolve();
  [...root.querySelectorAll('button')].find((node) => node.textContent === 'Activate Multipass').click();
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.textContent, /Save API unavailable/);
  assert.doesNotMatch(root.textContent, /Stable public agent profile is ready to share/);
  assert.equal(window.location.href, 'https://helixa.xyz/multipass/?agent=1');
});

test('static preview does not show persistent activation action panel', async () => {
  const root = setupDom('https://helixa.xyz/multipass/');
  await createApp({ root, loadDemo: async () => sampleData() }).start();
  assert.equal(root.querySelector('.save-panel'), null);
});

test('safe Multipass share path helper accepts only preview and stable profile paths', () => {
  assert.equal(isSafeMultipassSharePath('/multipass/'), true);
  assert.equal(isSafeMultipassSharePath('/multipass/?agent=1'), true);
  assert.equal(isSafeMultipassSharePath('/multipass/bendr-2-1'), true);
  assert.equal(isSafeMultipassSharePath('https://evil.test/multipass/bendr-2-1'), false);
  assert.equal(isSafeMultipassSharePath('/multipass/a%2Fb'), false);
  assert.equal(isSafeMultipassSharePath('/multipass/../admin'), false);
  assert.equal(isSafeMultipassSharePath('/multipass/?agent=Quigbot'), false);
});

test('API failure renders setup message', async () => {
  const root = setupDom();
  await createApp({ root, loadDemo: async () => { throw new Error('GET /multipass-api failed with 502'); } }).start();

  assert.match(root.textContent, /Could not load Multipass API data/);
  assert.match(root.textContent, /pnpm api:bendr/);
  assert.match(root.textContent, /GET \/multipass-api failed with 502/);
});

test('non-public fragment ids and unexpected private fields are absent from rendered HTML', async () => {
  const root = setupDom();
  const data = sampleData();
  data.fragments.hidden_fragments = [{ fragment_id: 'frag_bendr_hidden_placeholder', visibility: 'hidden' }];
  data.fragments.gated_fragments = [{ fragment_id: 'frag_bendr_gated_placeholder', visibility: 'gated' }];
  data.fragments.fragments.push(
    { fragment_id: 'frag_bendr_hidden_nested', visibility: 'hidden' },
    { fragment_id: 'frag_bendr_gated_nested', visibility: 'gated' },
  );

  await createApp({ root, loadDemo: async () => data }).start();

  assert.equal(root.innerHTML.includes('frag_bendr_private_placeholder'), false);
  assert.equal(root.innerHTML.includes('frag_bendr_unexpected_private_field'), false);
  assert.equal(root.innerHTML.includes('frag_bendr_hidden_placeholder'), false);
  assert.equal(root.innerHTML.includes('frag_bendr_gated_placeholder'), false);
  assert.equal(root.innerHTML.includes('frag_bendr_hidden_nested'), false);
  assert.equal(root.innerHTML.includes('frag_bendr_gated_nested'), false);
});

test('direct saved slug route renders source-owner claim management panel', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  await createApp({
    root,
    fetchImpl: savedProfileFetch,
  }).start();

  const panel = root.querySelector('.claim-management-panel');
  assert.ok(panel);
  assert.match(panel.textContent, /Claim management/);
  assert.match(panel.textContent, /public profile edits only/i);
  assert.match(panel.textContent, /does not transfer custody, tools, credentials, or ownership/i);
  assert.equal(panel.querySelector('[data-action="claim-with-wallet"]')?.textContent, 'Connect wallet to claim');
  assert.doesNotMatch(panel.textContent, /move secrets|grant permissions|transfer ownership/i);
});

test('direct saved slug route renders Owner Command Center product metrics', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedProfileFetch }).start();

  const panel = root.querySelector('.owner-command-center');
  assert.ok(panel);
  const metrics = panel.querySelector('.owner-command-metrics');
  assert.ok(metrics);
  assert.match(metrics.textContent, /Public tools/);
  assert.match(metrics.textContent, /x402 cards/);
  assert.match(metrics.textContent, /Public routes/);
  assert.match(metrics.textContent, /Recent receipts/);
  assert.match(panel.textContent, /Discovery and display controls only/);
  assert.match(panel.textContent, /does not call tools/);
  assert.match(panel.textContent, /does not transfer custody/);
  assert.doesNotMatch(panel.textContent, /execute tool|access granted|credentials released|buy trust|trust purchased|custody transferred|transfer ownership|grant permissions/i);
});

test('direct saved slug route renders Tools and services public cards', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedProfileFetch }).start();

  const profile = root.querySelector('.multipass-profile-page');
  const drawer = profileDrawerByTitle(profile, 'Tools and services');
  assert.ok(drawer);
  const panel = drawer.querySelector('.public-tools-panel');
  assert.ok(panel);
  assert.match(panel.textContent, /Bendr x402 profile lookup/);
  assert.match(panel.textContent, /api\.bankr\.example\/tools\/bendr\/lookup/);
  assert.match(panel.textContent, /0\.02 USDC on chain 8453/);
  assert.match(panel.textContent, /Multipass slug or Helixa ID/);
  assert.match(panel.textContent, /Public profile JSON/);
  assert.match(panel.textContent, /Discovery metadata only/);
  assert.match(panel.textContent, /do not call tools/);
  assert.equal(panel.querySelector('button, form, input, textarea, select, [data-action]'), null);
  assert.doesNotMatch(panel.textContent, /execute tool|access granted|credentials released|buy trust|trust purchased/i);
});

test('saved profile without public tool cards renders empty state and command center placeholder', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedProfileNoToolsFetch }).start();

  const profile = root.querySelector('.multipass-profile-page');
  const drawer = profileDrawerByTitle(profile, 'Tools and services');
  assert.ok(drawer);
  assert.match(drawer.textContent, /No public tool cards are published for this profile yet\./);
  assert.equal(drawer.querySelector('.public-tool-card'), null);

  const commandTools = root.querySelector('.owner-command-center [data-command-section="tools"]');
  assert.ok(commandTools);
  assert.match(commandTools.textContent, /Tool registry cards are next/);
  assert.equal(commandTools.querySelector('.public-tool-card'), null);
});

test('Owner Command Center tools section renders public tool cards when published', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedProfileFetch }).start();

  const commandTools = root.querySelector('.owner-command-center [data-command-section="tools"]');
  assert.ok(commandTools);
  assert.ok(commandTools.querySelector('.public-tools-panel'));
  assert.match(commandTools.textContent, /Bendr x402 profile lookup/);
  assert.match(commandTools.textContent, /0\.02 USDC on chain 8453/);
  assert.match(commandTools.textContent, /Discovery metadata only/);
  assert.doesNotMatch(commandTools.textContent, /execute tool|access granted|credentials released|buy trust|trust purchased/i);
});

test('saved profile owner dashboard shows visibility and recent changes', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  await createApp({ root, fetchImpl: savedProfileFetch }).start();

  const dashboard = root.querySelector('.owner-dashboard-panel');
  assert.ok(dashboard);
  assert.match(dashboard.textContent, /Owner dashboard/);
  assert.match(dashboard.textContent, /Visibility/);
  assert.match(dashboard.textContent, /public/);
  assert.match(dashboard.textContent, /Recent changes/);
  assert.match(dashboard.textContent, /Multipass saved from live public source record/);
});

test('claimed saved profile renders one owner command center', async () => {
  const root = await renderClaimedSavedProfileRoot();

  const commandCenter = root.querySelector('.owner-command-center');
  assert.ok(commandCenter);
  assert.equal(root.querySelectorAll('.owner-command-center').length, 1);
  assert.match(commandCenter.textContent, /Owner Command Center/);
  assert.match(commandCenter.textContent, /What you control/);
  assert.match(commandCenter.textContent, /Next best action/);

  const commandSectionOrder = [...commandCenter.querySelectorAll('[data-command-section]')]
    .map((section) => section.getAttribute('data-command-section'));
  assert.deepEqual(commandSectionOrder.slice(0, 6), ['overview', 'profile', 'routes', 'marketplace-connections', 'tools', 'fragments']);
});

test('owner command center safety copy limits public metadata and tool authority claims', async () => {
  const root = await renderClaimedSavedProfileRoot();

  const commandCenter = root.querySelector('.owner-command-center');
  assert.ok(commandCenter);
  const safetyCopy = commandCenter.textContent;
  assert.match(safetyCopy, /public metadata/i);
  assert.match(safetyCopy, /does not transfer custody/i);
  assert.match(safetyCopy, /does not call tools/i);
  assert.match(safetyCopy, /grant access/i);
  assert.match(safetyCopy, /release credentials/i);
  assert.match(safetyCopy, /prove trust by payment alone/i);
  assert.doesNotMatch(safetyCopy, /tool execution is enabled|access granted|credentials released|trust purchased/i);
});

test('claimed manager publishes Marketplace Connection with structured fragment payload', async () => {
  const { root, calls } = await renderClaimedMarketplaceManager();
  const form = root.querySelector('[data-action="create-marketplace-connection"]');
  form.querySelector('input[name="marketplace"]').value = 'Bankr';
  form.querySelector('input[name="profile_url"]').value = 'https://bankr.bot/agents/helixa';
  form.querySelector('input[name="title"]').value = 'Helixa agent profile';
  form.querySelector('textarea[name="summary"]').value = 'Public marketplace listing for Helixa services.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  const payload = calls.find(([kind]) => kind === 'create')[1].fragment;
  assert.equal(payload.fragment_type, 'attestation');
  assert.equal(payload.status, undefined);
  assert.equal(payload.transfer_policy, 'historical_on_transfer');
  assert.equal(payload.marketplace_ref.marketplace, 'Bankr');
  assert.match(root.querySelector('.marketplace-connection-manager-panel').textContent, /Marketplace connection saved|published/i);
});

test('claimed manager updates and retires existing Marketplace Connection', async () => {
  const fragment = { fragment_id: 'frag_marketplace_bankr', fragment_type: 'attestation', status: 'pending', visibility: 'public', source: { source_type: 'owner_submission', issuer: null }, marketplace_ref: { marketplace: 'Bankr', profile_url: 'https://bankr.bot/agents/helixa', title: 'Helixa', summary: 'Summary.', status: 'manager_supplied' } };
  const { root, calls } = await renderClaimedMarketplaceManager({ initialFragments: [fragment] });
  const form = root.querySelector('[data-action="update-marketplace-connection"][data-fragment-id="frag_marketplace_bankr"]');
  form.querySelector('input[name="title"]').value = 'Updated title';
  form.querySelector('select[name="status"]').value = 'stale';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  const update = calls.find(([kind]) => kind === 'update')[1];
  assert.equal(update.patch.fragment_type, undefined);
  assert.equal(update.patch.status, undefined);
  assert.equal(update.patch.marketplace_ref.title, 'Updated title');
  root.querySelector('[data-action="retire-marketplace-connection"][data-fragment-id="frag_marketplace_bankr"]').click();
  await flushAsyncEvents();
  assert.equal(calls.find(([kind]) => kind === 'revoke')[1].fragmentId, 'frag_marketplace_bankr');
});

test('Marketplace Connection write errors stay localized to the marketplace panel', async () => {
  const { root } = await renderClaimedMarketplaceManager({ claimApiOverrides: { createMultipassFragment: async () => { throw new Error('Marketplace API failed.'); } } });
  const form = root.querySelector('[data-action="create-marketplace-connection"]');
  form.querySelector('input[name="marketplace"]').value = 'Bankr';
  form.querySelector('input[name="profile_url"]').value = 'https://bankr.bot/agents/helixa';
  form.querySelector('input[name="title"]').value = 'Helixa agent profile';
  form.querySelector('textarea[name="summary"]').value = 'Public marketplace listing for Helixa services.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  assert.match(root.querySelector('.marketplace-connection-manager-panel').textContent, /Marketplace API failed/);
  assert.equal(root.querySelector('.route-manager-panel .resolver-message.error'), null);
  assert.equal(root.querySelector('.fragment-manager-panel .resolver-message.error'), null);
});

test('claimed saved profile can import Bankr x402 tool metadata', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({ claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1', display_name: 'Saved Bendr' } }),
    importMultipassTool: async ({ id, csrfToken, tool }) => {
      calls.push(['import-tool', id, csrfToken, tool]);
      return {
        fragment: { fragment_id: 'frag_tool_bankr_cred_report' },
        tools: {
          schema_version: '0.1.0',
          multipass_id: 'mp_helixa_agent_1',
          tools: [{
            fragment_id: 'frag_tool_bankr_cred_report',
            multipass_id: 'mp_helixa_agent_1',
            tool_id: 'cred-report',
            registry: 'bankr_x402_cloud',
            name: 'cred-report',
            description: 'Helixa AgentDNA cred report.',
            endpoint_url: 'https://api.bankr.bot/x402/helixa/cred-report',
            manifest_url: null,
            pricing: { model: 'fixed', amount: '1.00', asset: 'USDC', chain_id: 8453 },
            schemas: { input_summary: 'id: number - AgentDNA token ID', output_summary: 'score: number' },
            verifiability: { tier: 'provider_verified', summary: 'Imported from Bankr x402 service metadata.' },
            status: 'pending',
            assurance_level: 'issuer_attested',
            visibility: 'public',
            last_checked_at: '2026-07-01T00:00:00.000Z',
          }],
        },
      };
    },
  };
  const walletSigner = async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' });

  await createApp({ root, claimApi, walletSigner, fetchImpl: savedProfileNoToolsFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  const form = root.querySelector('[data-action="import-bankr-tool"]');
  assert.ok(form);
  form.querySelector('input[name="serviceName"]').value = 'cred-report';
  form.querySelector('input[name="endpointUrl"]').value = 'https://api.bankr.bot/x402/helixa/cred-report';
  form.querySelector('input[name="price"]').value = '1.00';
  form.querySelector('input[name="asset"]').value = 'USDC';
  form.querySelector('select[name="method"]').value = 'GET';
  form.querySelector('input[name="inputSummary"]').value = 'id: number - AgentDNA token ID';
  form.querySelector('input[name="outputSummary"]').value = 'score: number';
  form.querySelector('textarea[name="description"]').value = 'Helixa AgentDNA cred report.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  assert.deepEqual(calls[0], ['import-tool', 'bendr-2-1', 'csrf-1', {
    source: 'bankr_x402_cloud',
    serviceName: 'cred-report',
    endpointUrl: 'https://api.bankr.bot/x402/helixa/cred-report',
    network: 'base',
    currency: 'USDC',
    service: {
      price: '1.00',
      description: 'Helixa AgentDNA cred report.',
      methods: ['GET'],
      schema: { input: 'id: number - AgentDNA token ID', output: 'score: number' },
    },
  }]);
  const toolPanel = root.querySelector('.tool-manager-panel');
  assert.match(toolPanel.textContent, /Tool service imported/);
  assert.match(toolPanel.textContent, /Helixa AgentDNA cred report/);
  assert.ok(toolPanel.querySelector('.public-tool-card'));
});

test('claimed saved profile can refresh public tool status', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  const checkedAt = '2026-07-03T03:30:00.000Z';
  const refreshedTools = samplePublicTools();
  refreshedTools.tools = refreshedTools.tools.map((tool) => ({ ...tool, status: 'stale', last_checked_at: checkedAt }));
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({ claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1', display_name: 'Saved Bendr' } }),
    refreshMultipassTool: async ({ id, fragmentId, csrfToken }) => {
      calls.push(['refresh-tool', id, fragmentId, csrfToken]);
      return {
        refresh: { fragment_id: fragmentId, status: 'stale', summary: 'Endpoint check failed.', checked_at: checkedAt },
        tools: refreshedTools,
      };
    },
  };
  const walletSigner = async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' });

  await createApp({ root, claimApi, walletSigner, fetchImpl: savedProfileFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  const button = root.querySelector('.tool-manager-panel [data-action="refresh-tool"]');
  assert.ok(button);
  button.click();
  await flushAsyncEvents();

  assert.deepEqual(calls, [['refresh-tool', 'bendr-2-1', 'frag_tool_bendr_lookup', 'csrf-1']]);
  const toolPanel = root.querySelector('.tool-manager-panel');
  assert.match(toolPanel.textContent, /Tool status refreshed/);
  assert.match(toolPanel.textContent, /Endpoint check failed/);
  assert.match(toolPanel.textContent, /stale/);
});

test('failed tool import keeps route and profile data visible', async () => {
  const route = {
    schema_version: '0.1.0',
    fragment_id: 'frag_manager_route_1',
    multipass_id: 'mp_helixa_agent_1',
    fragment_type: 'endpoint',
    status: 'pending',
    assurance_level: 'self_attested',
    visibility: 'public',
    transfer_policy: 'pause_on_transfer',
    source: { source_type: 'owner_submission', source_id: 'manager:frag_manager_route_1', issuer: null, observed_at: '2026-06-27T00:10:00.000Z' },
    public_value: 'Primary profile route',
    endpoint_ref: { endpoint_id: 'primary-profile-route', url: 'https://helixa.xyz/multipass/bendr-2-1', protocol: 'web' },
    created_at: '2026-06-27T00:10:00.000Z',
    updated_at: '2026-06-27T00:10:00.000Z',
  };
  const fetchWithRoute = async (url) => {
    const value = String(url);
    if (value.endsWith('/hydrated')) {
      return new Response('missing', { status: 404 });
    }
    if (value.endsWith('/fragments')) return new Response(JSON.stringify({ schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [route] }), { status: 200 });
    return savedProfileNoToolsFetch(url);
  };
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({ claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1', display_name: 'Saved Bendr' } }),
    importMultipassTool: async () => { throw new Error('tool_id already exists for an active tool: cred-report'); },
  };
  const walletSigner = async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' });

  await createApp({ root, claimApi, walletSigner, fetchImpl: fetchWithRoute }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  const form = root.querySelector('[data-action="import-bankr-tool"]');
  form.querySelector('input[name="serviceName"]').value = 'cred-report';
  form.querySelector('input[name="endpointUrl"]').value = 'https://api.bankr.bot/x402/helixa/cred-report';
  form.querySelector('input[name="price"]').value = '1.00';
  form.querySelector('input[name="asset"]').value = 'USDC';
  form.querySelector('textarea[name="description"]').value = 'Helixa AgentDNA cred report.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  assert.match(root.querySelector('.tool-manager-panel').textContent, /tool_id already exists/);
  assert.match(root.querySelector('.route-manager-panel').textContent, /Primary profile route/);
  assert.match(root.querySelector('.multipass-profile-page').textContent, /Saved Bendr/);
});

test('claim button renders connected wallet shortened address', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
      connectLabel: 'Sign owner claim',
    },
  });

  await createApp({ root, walletClient, fetchImpl: savedProfileFetch }).start();

  assert.equal(root.querySelector('[data-action="claim-with-wallet"]')?.textContent, 'Sign owner claim with 0x27E3...91Ea');
});

test('saved profile claim connects wallet before creating nonce', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  let walletClient;
  walletClient = createWalletClientFixture({
    connect: async () => {
      calls.push(['connect']);
      walletClient.setSnapshot({
        connected: true,
        address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
        label: '0x27E3...91Ea',
        connectLabel: 'Sign owner claim',
      });
    },
    signMessage: async (message) => {
      calls.push(['sign', message]);
      return { wallet: walletClient.getSnapshot().address, signature: '0xsig' };
    },
  });
  const claimApi = {
    createClaimNonce: async () => { calls.push(['nonce']); return { nonce: 'nonce-1', message: 'Sign Bendr claim' }; },
    verifyClaimSignature: async () => {
      calls.push(['verify']);
      return { claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1' } };
    },
  };

  await createApp({ root, claimApi, walletClient, fetchImpl: savedProfileFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  assert.deepEqual(calls.slice(0, 3), [['connect'], ['nonce'], ['sign', 'Sign Bendr claim']]);
  assert.match(root.querySelector('.claim-management-panel').textContent, /claimed_verified_owner/);
});

test('wallet modal cancellation does not create a claim nonce', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  const walletClient = createWalletClientFixture({
    connect: async () => {
      calls.push(['connect']);
      throw { code: 4001 };
    },
  });
  const claimApi = {
    createClaimNonce: async () => { calls.push(['nonce']); return { nonce: 'nonce-1', message: 'Sign Bendr claim' }; },
    verifyClaimSignature: async () => { calls.push(['verify']); return {}; },
  };

  await createApp({ root, claimApi, walletClient, fetchImpl: savedProfileFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  assert.deepEqual(calls, [['connect']]);
  assert.match(root.querySelector('.claim-management-panel').textContent, /Wallet signature cancelled. Nothing was changed./);
});

test('claim button is disabled when wallet login is not configured', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const walletClient = createWalletClientFixture({ snapshot: { configured: false } });

  await createApp({ root, walletClient, fetchImpl: savedProfileFetch }).start();

  const button = root.querySelector('[data-action="claim-with-wallet"]');
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'Wallet login not configured');
  assert.match(root.querySelector('.claim-management-panel').textContent, /Wallet login is not configured for this build./);
});

test('claim flow stops when connect returns no EVM wallet', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  const walletClient = createWalletClientFixture({
    connect: async () => {
      calls.push(['connect']);
    },
  });
  const claimApi = {
    createClaimNonce: async () => { calls.push(['nonce']); return { nonce: 'nonce-1', message: 'Sign Bendr claim' }; },
    verifyClaimSignature: async () => { calls.push(['verify']); return {}; },
  };

  await createApp({ root, claimApi, walletClient, fetchImpl: savedProfileFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  assert.deepEqual(calls, [['connect']]);
  assert.match(root.querySelector('.claim-management-panel').textContent, /Connect an Ethereum wallet to sign the owner claim./);
});

test('claim flow handles missing personal_sign support before verify', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  const walletClient = createWalletClientFixture({
    snapshot: {
      connected: true,
      address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
      label: '0x27E3...91Ea',
      connectLabel: 'Sign owner claim',
    },
    signMessage: async () => {
      calls.push(['sign']);
      throw new Error('Connected wallet cannot sign messages.');
    },
  });
  const claimApi = {
    createClaimNonce: async () => { calls.push(['nonce']); return { nonce: 'nonce-1', message: 'Sign Bendr claim' }; },
    verifyClaimSignature: async () => { calls.push(['verify']); return {}; },
  };

  await createApp({ root, claimApi, walletClient, fetchImpl: savedProfileFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  assert.deepEqual(calls, [['nonce'], ['sign']]);
  assert.match(root.querySelector('.claim-management-panel').textContent, /Connected wallet cannot sign messages./);
});

test('API unauthorized claim shows wrong-wallet manual-review guidance', async () => {
  const panelText = await renderClaimFailureText(createSavedMultipassError());

  assert.match(panelText, /That wallet cannot manage this Multipass. Connect the source owner wallet or request manual review./);
});

test('unrelated claim API errors keep their original messages instead of wrong-wallet guidance', async () => {
  const cases = [
    {
      name: 'invalid_request SavedMultipassError',
      error: createSavedMultipassError({ status: 400, code: 'invalid_request', message: 'Invalid claim request payload.' }),
      expected: /Invalid claim request payload\./,
    },
    {
      name: 'bad-signature forbidden SavedMultipassError',
      error: createSavedMultipassError({ status: 403, code: 'forbidden', message: 'Signature verification failed.' }),
      expected: /Signature verification failed\./,
    },
    {
      name: 'expired nonce forbidden SavedMultipassError',
      error: createSavedMultipassError({ status: 403, code: 'forbidden', message: 'Claim nonce expired.' }),
      expected: /Claim nonce expired\./,
    },
    {
      name: 'generic network Error',
      error: new Error('Network unavailable.'),
      expected: /Network unavailable\./,
    },
    {
      name: 'API rejection wording Error',
      error: new Error('Signature policy rejected the request.'),
      expected: /Signature policy rejected the request\./,
    },
  ];

  for (const { name, error, expected } of cases) {
    const panelText = await renderClaimFailureText(error);
    assert.match(panelText, expected, name);
    assert.doesNotMatch(panelText, /That wallet cannot manage this Multipass/i, name);
    assert.doesNotMatch(panelText, /Connect the source owner wallet/i, name);
  }
});

test('saved profile owner wallet claim enables safe public profile edits', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  const claimApi = {
    createClaimNonce: async ({ id, apiBase }) => { calls.push(['nonce', id, apiBase]); return { nonce: 'nonce-1', message: 'Sign Bendr claim' }; },
    verifyClaimSignature: async ({ id, wallet, nonce, signature }) => {
      calls.push(['verify', id, wallet, nonce, signature]);
      return { claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1', display_name: 'Saved Bendr', owner_summary: { verification_status: 'verified', summary: 'Owner-wallet verified for public profile edits.' } } };
    },
    updateMultipassProfile: async ({ id, csrfToken, patch }) => {
      calls.push(['update', id, csrfToken, patch]);
      return {
        changedFields: Object.keys(patch),
        profile: { ...sampleData().profile, slug: 'bendr-2-1', display_name: patch.display_name, summary: patch.summary, discovery_profile: { ...sampleData().profile.discovery_profile, avatar_url: patch.avatar_url }, owner_summary: { ...sampleData().profile.owner_summary, visibility: patch.visibility } },
        changes: { multipass_id: 'mp_helixa_agent_1', entries: [{ message: 'Public profile updated: display name, summary, profile image, visibility.' }] },
      };
    },
  };
  const walletSigner = async (message) => {
    calls.push(['sign', message]);
    return { wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' };
  };

  await createApp({
    root,
    claimApi,
    walletSigner,
    fetchImpl: savedProfileFetch,
  }).start();

  root.querySelector('[data-action="claim-with-wallet"]').click();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.querySelector('.claim-management-panel').textContent, /claimed_verified_owner/);
  const form = root.querySelector('[data-action="update-public-profile"]');
  assert.ok(form);
  form.querySelector('input[name="display_name"]').value = 'Bendr Managed';
  assert.match(form.textContent, /Edit public profile/);
  assert.match(form.textContent, /Safe public fields for the saved Multipass profile/);
  assert.match(form.textContent, /Profile image URL/);
  assert.match(form.textContent, /Updates the public Multipass visual only/);
  assert.doesNotMatch(form.textContent, /Avatar URL/);
  form.querySelector('textarea[name="summary"]').value = 'Managed public profile copy.';
  form.querySelector('input[name="avatar_url"]').value = 'https://assets.example.test/bendr-v2.png';
  form.querySelector('select[name="visibility"]').value = 'hidden';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  await Promise.resolve();

  assert.match(root.textContent, /Bendr Managed/);
  assert.match(root.querySelector('.owner-dashboard-panel').textContent, /hidden/);
  assert.match(root.querySelector('.owner-dashboard-panel').textContent, /Public profile updated: display name, summary, profile image, visibility/);
  assert.deepEqual(calls[0], ['nonce', 'bendr-2-1', '/multipass-api']);
  assert.deepEqual(calls[1], ['sign', 'Sign Bendr claim']);
  assert.deepEqual(calls[2], ['verify', 'bendr-2-1', '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', 'nonce-1', '0xsig']);
  assert.deepEqual(calls[3], ['update', 'bendr-2-1', 'csrf-1', { display_name: 'Bendr Managed', summary: 'Managed public profile copy.', avatar_url: 'https://assets.example.test/bendr-v2.png', visibility: 'hidden' }]);
});

test('claimed saved profile can create update revoke and show fragment errors', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  const fragment = {
    schema_version: '0.1.0',
    fragment_id: 'frag_manager_wallet_1',
    multipass_id: 'mp_helixa_agent_1',
    fragment_type: 'wallet',
    status: 'pending',
    assurance_level: 'self_attested',
    visibility: 'public',
    transfer_policy: 'pause_on_transfer',
    source: { source_type: 'owner_submission', source_id: 'manager:frag_manager_wallet_1', issuer: null, observed_at: '2026-06-27T00:10:00.000Z' },
    public_value: 'Primary public wallet',
    proof_reference: 'owner note',
    created_at: '2026-06-27T00:10:00.000Z',
    updated_at: '2026-06-27T00:10:00.000Z',
  };
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({ claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1' } }),
    createMultipassFragment: async ({ id, csrfToken, fragment: input }) => {
      calls.push(['create-fragment', id, csrfToken, input]);
      if (calls.filter(([type]) => type === 'create-fragment').length === 1) throw new Error('Unsafe URL rejected.');
      return { fragment, fragments: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [fragment] }, profile: { ...sampleData().profile, slug: 'bendr-2-1', public_fragments: [{ fragment_id: fragment.fragment_id, fragment_type: 'wallet', status: 'pending', assurance_level: 'self_attested', visibility: 'public', updated_at: fragment.updated_at }] } };
    },
    updateMultipassFragment: async ({ id, fragmentId, csrfToken, patch }) => {
      calls.push(['update-fragment', id, fragmentId, csrfToken, patch]);
      const updated = { ...fragment, public_value: patch.public_value, status: patch.status, transfer_policy: patch.transfer_policy, proof_reference: patch.proof_reference, updated_at: '2026-06-27T00:15:00.000Z' };
      return { fragment: updated, fragments: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [updated] }, profile: { ...sampleData().profile, slug: 'bendr-2-1' } };
    },
    revokeMultipassFragment: async ({ id, fragmentId, csrfToken }) => {
      calls.push(['revoke-fragment', id, fragmentId, csrfToken]);
      const revoked = { ...fragment, status: 'revoked', revoked_at: '2026-06-27T00:20:00.000Z' };
      return { fragment: revoked, fragments: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [revoked] }, profile: { ...sampleData().profile, slug: 'bendr-2-1' } };
    },
  };
  const walletSigner = async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' });

  await createApp({ root, claimApi, walletSigner, fetchImpl: savedProfileFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  assert.ok(root.querySelector('.fragment-manager-panel'));
  let createForm = root.querySelector('[data-action="create-public-fragment"]');
  createForm.querySelector('select[name="fragment_type"]').value = 'wallet';
  createForm.querySelector('input[name="public_value"]').value = 'Primary public wallet';
  createForm.querySelector('input[name="reference_url"]').value = 'https://basescan.org/address/0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  createForm.querySelector('input[name="proof_reference"]').value = 'owner note';
  createForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  assert.match(root.querySelector('.fragment-manager-panel').textContent, /Unsafe URL rejected/);

  createForm = root.querySelector('[data-action="create-public-fragment"]');
  createForm.querySelector('select[name="fragment_type"]').value = 'wallet';
  createForm.querySelector('input[name="public_value"]').value = 'Primary public wallet';
  createForm.querySelector('input[name="reference_url"]').value = 'https://basescan.org/address/0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  createForm.querySelector('input[name="proof_reference"]').value = 'owner note';
  createForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  assert.match(root.querySelector('.fragment-manager-panel').textContent, /Primary public wallet/);

  const editForm = root.querySelector('[data-action="update-public-fragment"]');
  editForm.querySelector('input[name="public_value"]').value = 'Updated public wallet';
  editForm.querySelector('input[name="reference_url"]').value = 'https://basescan.org/address/0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  editForm.querySelector('input[name="proof_reference"]').value = 'updated owner note';
  editForm.querySelector('select[name="status"]').value = 'stale';
  editForm.querySelector('select[name="transfer_policy"]').value = 'pause_on_transfer';
  editForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  root.querySelector('[data-action="revoke-public-fragment"]').click();
  await flushAsyncEvents();

  const expectedInput = {
    fragment_type: 'wallet',
    public_value: 'Primary public wallet',
    reference_url: 'https://basescan.org/address/0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea',
    proof_reference: 'owner note',
  };
  assert.deepEqual(calls[0], ['create-fragment', 'bendr-2-1', 'csrf-1', expectedInput]);
  assert.deepEqual(calls[1], ['create-fragment', 'bendr-2-1', 'csrf-1', expectedInput]);
  assert.deepEqual(calls[2], ['update-fragment', 'bendr-2-1', 'frag_manager_wallet_1', 'csrf-1', { public_value: 'Updated public wallet', reference_url: 'https://basescan.org/address/0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', proof_reference: 'updated owner note', status: 'stale', transfer_policy: 'pause_on_transfer' }]);
  assert.deepEqual(calls[3], ['revoke-fragment', 'bendr-2-1', 'frag_manager_wallet_1', 'csrf-1']);
});

test('profile communication drawer renders public contact refs without authority claims', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = sampleData();
  data.fragments.fragments = [
    ...data.fragments.fragments,
    {
      fragment_id: 'frag_comm_email',
      fragment_type: 'social',
      status: 'pending',
      assurance_level: 'self_attested',
      visibility: 'public',
      transfer_policy: 'historical_on_transfer',
      source: { source_type: 'owner_submission', issuer: null, source_id: 'communication:agentmail', observed_at: '2026-07-06T00:00:00.000Z' },
      public_value: 'AgentMail: bendr@agentmail.to',
      proof_reference: 'Public contact route only.',
      updated_at: '2026-07-06T00:00:00.000Z',
    },
    {
      fragment_id: 'frag_comm_wiretap',
      fragment_type: 'social',
      status: 'pending',
      assurance_level: 'self_attested',
      visibility: 'public',
      transfer_policy: 'historical_on_transfer',
      source: { source_type: 'owner_submission', issuer: null, source_id: 'communication:wiretap', observed_at: '2026-07-06T00:00:00.000Z' },
      public_value: 'Wiretap AIM: bendr2bot@darklabz.com',
      updated_at: '2026-07-06T00:00:00.000Z',
    },
    {
      fragment_id: 'frag_comm_farcaster',
      fragment_type: 'social',
      status: 'pending',
      assurance_level: 'self_attested',
      visibility: 'public',
      transfer_policy: 'historical_on_transfer',
      source: { source_type: 'owner_submission', issuer: null, source_id: 'communication:farcaster', observed_at: '2026-07-06T00:00:00.000Z' },
      public_value: 'Farcaster: bendr',
      updated_at: '2026-07-06T00:00:00.000Z',
    },
    {
      fragment_id: 'frag_comm_private_telegram',
      fragment_type: 'social',
      status: 'pending',
      assurance_level: 'self_attested',
      visibility: 'private',
      transfer_policy: 'never_transfer',
      source: { source_type: 'owner_submission', issuer: null, source_id: 'communication:telegram', observed_at: '2026-07-06T00:00:00.000Z' },
      public_value: 'Telegram: private-team-chat',
      updated_at: '2026-07-06T00:00:00.000Z',
    },
  ];

  await createApp({ root, loadDemo: async () => data }).start();

  const communicationDrawer = profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Communication');
  assert.ok(communicationDrawer);
  assert.match(communicationDrawer.textContent, /Public contact and social routes/);
  assert.match(communicationDrawer.textContent, /AgentMail/);
  assert.match(communicationDrawer.textContent, /bendr@agentmail\.to/);
  assert.match(communicationDrawer.textContent, /Wiretap/);
  assert.match(communicationDrawer.textContent, /bendr2bot@darklabz\.com/);
  assert.match(communicationDrawer.textContent, /Farcaster/);
  assert.doesNotMatch(communicationDrawer.textContent, /private-team-chat/);
  assert.doesNotMatch(communicationDrawer.textContent, /execute|credential|private inbox/i);
  assert.match(communicationDrawer.textContent, /does not grant reply rights/i);
});

test('profile trust context renders safe public route cards from endpoint fragments', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1');
  const data = sampleData();
  data.fragments.fragments = [
    ...data.fragments.fragments,
    {
      fragment_id: 'frag_public_route_safe',
      fragment_type: 'endpoint',
      status: 'pending',
      assurance_level: 'self_attested',
      visibility: 'public',
      transfer_policy: 'pause_on_transfer',
      source: { source_type: 'owner_submission', issuer: null, reference_url: 'https://wrong.example.test/not-used' },
      public_value: 'Primary profile route',
      endpoint_ref: { endpoint_id: 'primary-profile-route', url: 'https://helixa.xyz/multipass/bendr-2-1', protocol: 'web' },
      updated_at: '2026-06-27T00:10:00.000Z',
    },
    {
      fragment_id: 'frag_public_route_unsafe',
      fragment_type: 'endpoint',
      status: 'stale',
      assurance_level: 'self_attested',
      visibility: 'public',
      transfer_policy: 'pause_on_transfer',
      source: { source_type: 'owner_submission', issuer: null },
      public_value: 'Unsafe route text',
      endpoint_ref: { endpoint_id: 'unsafe-route', url: 'javascript:alert(1)', protocol: 'web' },
      updated_at: '2026-06-27T00:09:00.000Z',
    },
  ];

  await createApp({ root, loadDemo: async () => data }).start();

  const trustDrawer = profileDrawerByTitle(root.querySelector('.multipass-profile-page'), 'Trust context');
  const panel = trustDrawer.querySelector('.public-routes-panel');
  assert.ok(panel);
  assert.match(panel.textContent, /Published reference routes/);
  assert.match(panel.textContent, /Primary profile route/);
  assert.match(panel.textContent, /Primary route/);
  assert.equal(panel.querySelector('a[href="https://helixa.xyz/multipass/bendr-2-1"]')?.textContent, 'https://helixa.xyz/multipass/bendr-2-1');
  assert.equal(panel.querySelector('a[href^="javascript:"]'), null);
  assert.equal(panel.innerHTML.includes('https://wrong.example.test/not-used'), false);
});

test('claimed saved profile can create update and retire public route cards', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  const fragment = {
    schema_version: '0.1.0',
    fragment_id: 'frag_manager_route_1',
    multipass_id: 'mp_helixa_agent_1',
    fragment_type: 'endpoint',
    status: 'pending',
    assurance_level: 'self_attested',
    visibility: 'public',
    transfer_policy: 'pause_on_transfer',
    source: { source_type: 'owner_submission', source_id: 'manager:frag_manager_route_1', issuer: null, observed_at: '2026-06-27T00:10:00.000Z' },
    public_value: 'Primary profile route',
    endpoint_ref: { endpoint_id: 'primary-profile-route', url: 'https://helixa.xyz/multipass/bendr-2-1', protocol: 'web' },
    created_at: '2026-06-27T00:10:00.000Z',
    updated_at: '2026-06-27T00:10:00.000Z',
  };
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({ claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1' } }),
    createMultipassFragment: async ({ id, csrfToken, fragment: input }) => {
      calls.push(['create-route', id, csrfToken, input]);
      return { fragment, fragments: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [fragment] }, profile: { ...sampleData().profile, slug: 'bendr-2-1' } };
    },
    updateMultipassFragment: async ({ id, fragmentId, csrfToken, patch }) => {
      calls.push(['update-route', id, fragmentId, csrfToken, patch]);
      const updated = { ...fragment, ...patch, endpoint_ref: patch.endpoint_ref, updated_at: '2026-06-27T00:15:00.000Z' };
      return { fragment: updated, fragments: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [updated] }, profile: { ...sampleData().profile, slug: 'bendr-2-1' } };
    },
    revokeMultipassFragment: async ({ id, fragmentId, csrfToken }) => {
      calls.push(['retire-route', id, fragmentId, csrfToken]);
      const revoked = { ...fragment, status: 'revoked', revoked_at: '2026-06-27T00:20:00.000Z' };
      return { fragment: revoked, fragments: { schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [revoked] }, profile: { ...sampleData().profile, slug: 'bendr-2-1' } };
    },
  };
  const walletSigner = async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' });

  await createApp({ root, claimApi, walletSigner, fetchImpl: savedProfileFetch }).start();
  root.querySelector('[data-action="claim-with-wallet"]').click();
  await flushAsyncEvents();

  const createForm = root.querySelector('[data-action="create-public-route"]');
  assert.ok(createForm);
  createForm.querySelector('input[name="route_label"]').value = 'Primary profile route';
  createForm.querySelector('input[name="route_url"]').value = 'https://helixa.xyz/multipass/bendr-2-1';
  createForm.querySelector('input[name="proof_reference"]').value = 'owner note';
  createForm.querySelector('select[name="route_type"]').value = 'web';
  createForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  const editForm = root.querySelector('[data-action="update-public-route"]');
  assert.ok(editForm);
  editForm.querySelector('input[name="route_label"]').value = 'Updated public profile route';
  editForm.querySelector('input[name="route_url"]').value = 'https://helixa.xyz/multipass/bendr-2-1?route=main';
  editForm.querySelector('input[name="proof_reference"]').value = 'updated owner note';
  editForm.querySelector('select[name="status"]').value = 'stale';
  editForm.querySelector('select[name="route_type"]').value = 'api';
  editForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  root.querySelector('[data-action="revoke-public-route"]').click();
  await flushAsyncEvents();

  assert.deepEqual(calls[0], ['create-route', 'bendr-2-1', 'csrf-1', {
    fragment_type: 'endpoint',
    public_value: 'Primary profile route',
    reference_url: 'https://helixa.xyz/multipass/bendr-2-1',
    proof_reference: 'owner note',
    transfer_policy: 'pause_on_transfer',
    endpoint_ref: { endpoint_id: 'primary-profile-route', url: 'https://helixa.xyz/multipass/bendr-2-1', protocol: 'web' },
  }]);
  assert.deepEqual(calls[1], ['update-route', 'bendr-2-1', 'frag_manager_route_1', 'csrf-1', {
    public_value: 'Updated public profile route',
    reference_url: 'https://helixa.xyz/multipass/bendr-2-1?route=main',
    proof_reference: 'updated owner note',
    status: 'stale',
    transfer_policy: 'pause_on_transfer',
    endpoint_ref: { endpoint_id: 'primary-profile-route', url: 'https://helixa.xyz/multipass/bendr-2-1?route=main', protocol: 'api' },
  }]);
  assert.deepEqual(calls[2], ['retire-route', 'bendr-2-1', 'frag_manager_route_1', 'csrf-1']);
});

test('claimed route manager shows validation errors without calling route create API', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const calls = [];
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({ claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1' } }),
    createMultipassFragment: async () => { calls.push('create'); throw new Error('should not call create'); },
  };
  const walletSigner = async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' });

  await createApp({ root, claimApi, walletSigner, fetchImpl: savedProfileFetch }).start();
  assert.ok(root.querySelector('.claim-management-panel'));
  const claimButton = root.querySelector('[data-action="claim-with-wallet"]');
  assert.ok(claimButton);
  claimButton.click();
  await flushAsyncEvents();

  const createForm = root.querySelector('[data-action="create-public-route"]');
  createForm.querySelector('input[name="route_label"]').value = 'Bad route';
  createForm.querySelector('input[name="route_url"]').value = 'http://example.test/not-safe';
  createForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  const routePanel = root.querySelector('.route-manager-panel');
  assert.match(routePanel.textContent, /Route URL must be an HTTPS URL/);
  assert.equal(calls.length, 0);
  assert.equal(root.querySelector('.fragment-manager-panel .resolver-message.error'), null);
});

test('failed route update keeps existing route cards visible and shows route error', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const route = {
    schema_version: '0.1.0',
    fragment_id: 'frag_manager_route_1',
    multipass_id: 'mp_helixa_agent_1',
    fragment_type: 'endpoint',
    status: 'pending',
    assurance_level: 'self_attested',
    visibility: 'public',
    transfer_policy: 'pause_on_transfer',
    source: { source_type: 'owner_submission', source_id: 'manager:frag_manager_route_1', issuer: null, observed_at: '2026-06-27T00:10:00.000Z' },
    public_value: 'Primary profile route',
    endpoint_ref: { endpoint_id: 'primary-profile-route', url: 'https://helixa.xyz/multipass/bendr-2-1', protocol: 'web' },
    created_at: '2026-06-27T00:10:00.000Z',
    updated_at: '2026-06-27T00:10:00.000Z',
  };
  const fetchWithRoute = async (url) => {
    const value = String(url);
    if (value.endsWith('/hydrated')) {
      return new Response('missing', { status: 404 });
    }
    if (value.endsWith('/api/multipass/bendr-2-1')) {
      return new Response(JSON.stringify({
        ...sampleData().profile,
        display_name: 'Saved Bendr',
        slug: 'bendr-2-1',
        multipass_id: 'mp_helixa_agent_1',
        status: 'active',
        owner_summary: { owner_state: 'unclaimed', verification_status: 'unclaimed', summary: 'Saved unclaimed profile. Management is unclaimed.' },
      }), { status: 200 });
    }
    if (value.endsWith('/fragments')) return new Response(JSON.stringify({ schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [route] }), { status: 200 });
    return savedProfileFetch(url);
  };
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({ claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1' } }),
    updateMultipassFragment: async () => { throw new Error('Manager session expired.'); },
  };
  const walletSigner = async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' });

  await createApp({ root, claimApi, walletSigner, fetchImpl: fetchWithRoute }).start();
  assert.ok(root.querySelector('.claim-management-panel'));
  const claimButton = root.querySelector('[data-action="claim-with-wallet"]');
  assert.ok(claimButton);
  claimButton.click();
  await flushAsyncEvents();

  const editForm = root.querySelector('[data-action="update-public-route"]');
  editForm.querySelector('input[name="route_label"]').value = 'Primary profile route';
  editForm.querySelector('input[name="route_url"]').value = 'https://helixa.xyz/multipass/bendr-2-1?route=main';
  editForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  assert.match(root.querySelector('.route-manager-panel').textContent, /Manager session expired/);
  assert.match(root.querySelector('.public-routes-panel').textContent, /Primary profile route/);
  assert.ok(root.querySelector('[data-action="update-public-route"]'));
  assert.ok(root.querySelector('.claim-management-panel'));
  assert.equal(root.querySelector('.fragment-manager-panel .resolver-message.error'), null);
});

test('failed route retire keeps route visible with old status', async () => {
  const root = setupDom('https://helixa.xyz/multipass/bendr-2-1?api=https://api.example.test');
  const route = {
    schema_version: '0.1.0',
    fragment_id: 'frag_manager_route_1',
    multipass_id: 'mp_helixa_agent_1',
    fragment_type: 'endpoint',
    status: 'pending',
    assurance_level: 'self_attested',
    visibility: 'public',
    transfer_policy: 'pause_on_transfer',
    source: { source_type: 'owner_submission', source_id: 'manager:frag_manager_route_1', issuer: null, observed_at: '2026-06-27T00:10:00.000Z' },
    public_value: 'Primary profile route',
    endpoint_ref: { endpoint_id: 'primary-profile-route', url: 'https://helixa.xyz/multipass/bendr-2-1', protocol: 'web' },
    created_at: '2026-06-27T00:10:00.000Z',
    updated_at: '2026-06-27T00:10:00.000Z',
  };
  const fetchWithRoute = async (url) => {
    const value = String(url);
    if (value.endsWith('/hydrated')) {
      return new Response('missing', { status: 404 });
    }
    if (value.endsWith('/api/multipass/bendr-2-1')) {
      return new Response(JSON.stringify({
        ...sampleData().profile,
        display_name: 'Saved Bendr',
        slug: 'bendr-2-1',
        multipass_id: 'mp_helixa_agent_1',
        status: 'active',
        owner_summary: { owner_state: 'unclaimed', verification_status: 'unclaimed', summary: 'Saved unclaimed profile. Management is unclaimed.' },
      }), { status: 200 });
    }
    if (value.endsWith('/fragments')) return new Response(JSON.stringify({ schema_version: '0.1.0', multipass_id: 'mp_helixa_agent_1', fragments: [route] }), { status: 200 });
    return savedProfileFetch(url);
  };
  const claimApi = {
    createClaimNonce: async () => ({ nonce: 'nonce-1', message: 'Sign Bendr claim' }),
    verifyClaimSignature: async () => ({ claim_status: 'claimed_verified_owner', csrfToken: 'csrf-1', profile: { ...sampleData().profile, slug: 'bendr-2-1' } }),
    revokeMultipassFragment: async () => { throw new Error('Manager session cookie is required.'); },
  };
  const walletSigner = async () => ({ wallet: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', signature: '0xsig' });

  await createApp({ root, claimApi, walletSigner, fetchImpl: fetchWithRoute }).start();
  assert.ok(root.querySelector('.claim-management-panel'));
  const claimButton = root.querySelector('[data-action="claim-with-wallet"]');
  assert.ok(claimButton);
  claimButton.click();
  await flushAsyncEvents();

  root.querySelector('[data-action="revoke-public-route"]').click();
  await flushAsyncEvents();

  assert.match(root.querySelector('.route-manager-panel').textContent, /Manager session cookie is required/);
  assert.match(root.querySelector('.public-route-card').textContent, /Review required/);
  assert.match(root.querySelector('.public-route-card').textContent, /Primary profile route/);
  assert.equal(root.querySelector('.fragment-manager-panel .resolver-message.error'), null);
});

test('Console owner profile resolution is non-blocking and late stale results are discarded', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const firstWallet = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({ snapshot: { connected: true, address: firstWallet, label: 'short label' } });
  let resolveProfile;
  const profilePromise = new Promise((resolve) => { resolveProfile = resolve; });
  let lookups = 0;
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    consoleOwnerProfileResolver: async (address) => { lookups += 1; assert.equal(address, firstWallet); return profilePromise; },
  }).start();
  await flushAsyncEvents(20);

  assert.equal(lookups, 1);
  assert.match(root.querySelector('.console-main-roster-drawer')?.textContent ?? '', /Looper #617/);
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /0x27E3\.\.\.91Ea \(you\)/i);

  walletClient.setSnapshot({ connected: false, address: null, label: null }, { notify: true });
  await flushAsyncEvents();
  resolveProfile({ address: firstWallet, displayName: 'stale.eth', ensName: 'stale.eth', avatarUrl: 'https://example.test/stale.png' });
  await flushAsyncEvents();
  assert.doesNotMatch(root.textContent, /stale\.eth/);
});

test('Console owner profile applies only to its matching authenticated wallet generation', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const wallet = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const walletClient = createWalletClientFixture({ snapshot: { connected: true, address: wallet, label: 'short label' } });
  await createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    consoleOwnerProfileResolver: async () => ({ address: wallet, displayName: 'quigley.eth', ensName: 'quigley.eth', avatarUrl: 'https://example.test/quigley.png' }),
  }).start();
  await flushAsyncEvents(20);
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /quigley\.eth/);
});

test('Console interaction restoration uses strict-prefix 48px rules and preserves composer selection', () => {
  const dom = new JSDOM(`<!doctype html><main>
    <div class="console-thread-messages" data-console-room-key="room-1">
      <article data-console-message-identity="a"></article><article data-console-message-identity="b"></article>
    </div>
    <textarea id="console-agent-message">draft from DOM</textarea>
  </main>`, { pretendToBeVisual: true });
  const root = dom.window.document.querySelector('main');
  const timeline = root.querySelector('.console-thread-messages');
  Object.defineProperties(timeline, {
    scrollTop: { value: 352, writable: true, configurable: true },
    scrollHeight: { value: 800, writable: true, configurable: true },
    clientHeight: { value: 400, writable: true, configurable: true },
  });
  const textarea = root.querySelector('textarea');
  textarea.focus();
  textarea.setSelectionRange(3, 8, 'backward');
  const captured = captureConsoleInteractionState(root);
  assert.equal(captured.timeline.nearBottom, true);

  root.innerHTML = `<div class="console-thread-messages" data-console-room-key="room-1">
    <article data-console-message-identity="a"></article><article data-console-message-identity="b"></article><article data-console-message-identity="c"></article>
  </div><textarea id="console-agent-message"></textarea>`;
  const nextTimeline = root.querySelector('.console-thread-messages');
  Object.defineProperties(nextTimeline, {
    scrollTop: { value: 0, writable: true, configurable: true },
    scrollHeight: { value: 950, writable: true, configurable: true },
    clientHeight: { value: 400, writable: true, configurable: true },
  });
  restoreConsoleInteractionState(root, captured);
  assert.equal(nextTimeline.scrollTop, 950);
  assert.equal(root.querySelector('textarea').value, 'draft from DOM');
  assert.equal(root.ownerDocument.activeElement, root.querySelector('textarea'));
  assert.deepEqual([root.querySelector('textarea').selectionStart, root.querySelector('textarea').selectionEnd, root.querySelector('textarea').selectionDirection], [3, 8, 'backward']);

  nextTimeline.scrollTop = 100;
  const readingHistory = captureConsoleInteractionState(root);
  root.innerHTML = `<div class="console-thread-messages" data-console-room-key="room-1">
    <article data-console-message-identity="a"></article><article data-console-message-identity="b"></article><article data-console-message-identity="c"></article><article data-console-message-identity="d"></article>
  </div><textarea id="console-agent-message"></textarea>`;
  Object.defineProperties(root.querySelector('.console-thread-messages'), {
    scrollTop: { value: 0, writable: true, configurable: true },
    scrollHeight: { value: 1100, writable: true, configurable: true },
    clientHeight: { value: 400, writable: true, configurable: true },
  });
  restoreConsoleInteractionState(root, readingHistory);
  assert.equal(root.querySelector('.console-thread-messages').scrollTop, 100);
});

test('Console message identity prefers XMTP then id then deterministic fallback', () => {
  assert.equal(getConsoleMessageIdentity({ xmtpMessageId: 'xmtp-1', id: 'id-1' }), 'xmtp:xmtp-1');
  assert.equal(getConsoleMessageIdentity({ id: 'id-1' }), 'id:id-1');
  assert.equal(
    getConsoleMessageIdentity({ role: 'agent', senderLabel: 'Looper', text: 'hello', createdAt: '2026-09-19T00:00:00Z' }),
    'fallback:agent\u001fLooper\u001fhello\u001f2026-09-19T00:00:00Z',
  );
});

test('Console scroll restoration advances on room change and explicit local send but not replacement', () => {
  const dom = new JSDOM('<!doctype html><main></main>', { pretendToBeVisual: true });
  const root = dom.window.document.querySelector('main');
  const renderTimeline = ({ room = 'one', request = '0', ids = ['a'], height = 900 } = {}) => {
    root.innerHTML = `<div class="console-thread-messages" data-console-room-key="${room}" data-console-scroll-request="${request}">${ids.map((id) => `<i data-console-message-identity="${id}"></i>`).join('')}</div><textarea id="console-agent-message"></textarea>`;
    Object.defineProperties(root.querySelector('.console-thread-messages'), {
      scrollTop: { value: 0, writable: true, configurable: true },
      scrollHeight: { value: height, writable: true, configurable: true },
      clientHeight: { value: 400, writable: true, configurable: true },
    });
  };

  renderTimeline();
  restoreConsoleInteractionState(root, { timeline: { present: false }, composer: { present: false } });
  assert.equal(root.querySelector('.console-thread-messages').scrollTop, 900);

  root.querySelector('.console-thread-messages').scrollTop = 120;
  const prior = captureConsoleInteractionState(root);
  renderTimeline({ room: 'one', ids: ['changed'] });
  restoreConsoleInteractionState(root, prior);
  assert.equal(root.querySelector('.console-thread-messages').scrollTop, 120);

  const beforeRoomChange = captureConsoleInteractionState(root);
  renderTimeline({ room: 'two', ids: ['z'], height: 1000 });
  restoreConsoleInteractionState(root, beforeRoomChange);
  assert.equal(root.querySelector('.console-thread-messages').scrollTop, 1000);

  root.querySelector('.console-thread-messages').scrollTop = 50;
  const beforeSend = captureConsoleInteractionState(root);
  renderTimeline({ room: 'two', request: '1', ids: ['z', 'sent'], height: 1100 });
  restoreConsoleInteractionState(root, beforeSend);
  assert.equal(root.querySelector('.console-thread-messages').scrollTop, 1100);
});

test('Console avatar image failure removes the image and reveals initials once', () => {
  const dom = new JSDOM('<!doctype html><main><div><img data-console-avatar-image src="https://example.test/a.png"><span class="console-thread-avatar-fallback" hidden>Q</span></div></main>');
  const root = dom.window.document.querySelector('main');
  bindConsoleAvatarFallbacks(root);
  const image = root.querySelector('img');
  image.dispatchEvent(new dom.window.Event('error'));
  assert.equal(root.querySelector('img'), null);
  assert.equal(root.querySelector('.console-thread-avatar-fallback').hidden, false);
});

test('Console selected identity portrait uses the shared one-shot image fallback', () => {
  const agent = { tokenId: '1', name: 'Brok', image: 'https://example.test/brok.png' };
  const snapshot = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
    },
  });
  const dom = new JSDOM(`<!doctype html><main>${renderMultipassConsole(snapshot)}</main>`);
  const root = dom.window.document.querySelector('main');
  bindConsoleAvatarFallbacks(root);

  const image = root.querySelector('.console-agent-portrait img[data-console-avatar-image]');
  assert.equal(image?.getAttribute('alt'), '');
  image.dispatchEvent(new dom.window.Event('error'));
  assert.equal(root.querySelector('.console-agent-portrait img'), null);
  assert.equal(root.querySelector('.console-agent-portrait .console-thread-avatar-fallback')?.hidden, false);
  assert.equal(root.querySelector('.console-agent-portrait .console-thread-avatar-fallback')?.textContent, 'B');
});

test('dedicated Console preserves current multi-participant candidate provenance and clears enabled metadata when a later response omits it', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const walletClient = createWalletClientFixture({
    snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: '0x27E3...91Ea' },
  });
  const capabilities = {
    version: `sha256:${'d'.repeat(64)}`,
    skills: [{
      id: 'bankr', name: 'Bankr', summary: 'Bounded catalog knowledge.', capabilities: ['transfer'],
      enabledCapabilities: ['propose_transfer'], execution: 'human_review', credentialAccess: false,
      constraints: ['No direct execution.'],
    }],
  };
  const app = createApp({
    root,
    loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
    claimApi: {
      activateConsoleAgent: async () => ({
        thread: {
          transport: 'xmtp_local', roomName: 'Shared room',
          participants: [{ participantId: '617', tokenId: '617', displayName: 'Looper #617' }, { participantId: '812', tokenId: '812', displayName: 'Looper #812' }],
          messages: [
            { id: 'published-617', role: 'agent', participantId: '617', senderLabel: 'Looper #617', text: 'First response.' },
            { id: 'published-812', role: 'agent', participantId: '812', senderLabel: 'Looper #812', text: 'Second response.' },
          ],
        },
        proposals: [{ status: 'review_only', title: 'Legacy review queue item' }],
        capabilities,
        proposalCandidates: [{
          skill: 'bankr', assetType: 'erc20', assetContract: '0x1111111111111111111111111111111111111111',
          recipient: '0x2222222222222222222222222222222222222222', amountBaseUnits: '9', rationale: 'Current second response.',
          sourceMessageId: 'published-812', participantId: '812', sourceOrdinal: 0, skillRefs: ['bankr'],
        }],
      }),
      sendConsoleAgentMessage: async ({ message }) => ({
        thread: {
          transport: 'xmtp_local', roomName: 'Shared room',
          participants: [{ participantId: '617', tokenId: '617', displayName: 'Looper #617' }, { participantId: '812', tokenId: '812', displayName: 'Looper #812' }],
          messages: [{ id: 'legacy-response', role: 'agent', participantId: '617', senderLabel: 'Looper #617', text: `Legacy response to ${message}` }],
        },
        proposals: [],
      }),
    },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  await flushAsyncEvents();

  const candidate = root.querySelector('.console-unverified-transfer');
  assert.ok(candidate);
  assert.equal(root.querySelector('[data-console-message-identity="id:published-812"]')?.nextElementSibling, candidate);
  assert.match(candidate.textContent, /Looper #812/);
  assert.match(root.querySelector('.console-skill-capabilities')?.textContent ?? '', /Cannot execute directly/);
  assert.match(root.querySelector('.console-thread-proposal')?.textContent ?? '', /Legacy review queue item/);

  const form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea[name="message"]').value = 'Feature is now off.';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  assert.equal(root.querySelector('.console-unverified-transfer'), null);
  assert.equal(root.querySelector('.console-skill-capabilities'), null);
  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Cannot execute directly|Current second response/);
});

function createConsoleCodexBundle(tokenId, artifactHash = 'a'.repeat(64), marker = null) {
  const id = Number(tokenId);
  const make = (operation, result) => ({ schemaVersion: '1.0.0', artifactHash, codexVersion: 'traits-v1', operation, subjectIds: [id], evidence: [], result });
  return {
    selectedTokenId: String(tokenId), artifactHash, codexVersion: 'traits-v1',
    profile: make('getTokenProfile', { identity: { tokenId: id, canonicalName: marker ?? `Looper #${id}` } }),
    explanation: make('explainTraits', { tokenId: id, traits: [] }),
    similarity: make('findSimilar', { tokenId: id, items: [] }),
  };
}

test('Console selection loads Codex without activating chat', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const storage = createMemoryStorage();
  const codexCalls = [];
  let activationCount = 0;
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }), consolePreferenceStorage: storage,
    claimApi: {
      loadConsoleCodexBundle: async ({ selectedTokenId }) => { codexCalls.push(selectedTokenId); return createConsoleCodexBundle(selectedTokenId); },
      activateConsoleAgent: async () => { activationCount += 1; return { thread: { messages: [] } }; },
    },
  });
  await app.start();
  await flushAsyncEvents(30);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '617');
  assert.deepEqual(codexCalls, ['617']);
  assert.equal(activationCount, 0);
  assert.equal(JSON.parse(storage.value('multipass.console.lastLooperByWallet.v1')).selections[owner.toLowerCase()], '617');
  assert.equal(activationCount, 0);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '617');
});

test('Console Codex cache is token-and-artifact scoped and reset clears it', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const hashes = new Map([['617', 'a'.repeat(64)], ['812', 'a'.repeat(64)]]);
  const calls = [];
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => { calls.push(selectedTokenId); return createConsoleCodexBundle(selectedTokenId, hashes.get(selectedTokenId)); } },
  });
  await app.start(); await flushAsyncEvents(30);
  let selector = root.querySelector('[data-action="select-console-agent"]');
  selector.value = '812'; selector.dispatchEvent(new window.Event('change', { bubbles: true })); await flushAsyncEvents(20);
  selector = root.querySelector('[data-action="select-console-agent"]');
  selector.value = '617'; selector.dispatchEvent(new window.Event('change', { bubbles: true })); await flushAsyncEvents(20);
  assert.deepEqual(calls, ['617', '812']);

  app.resetConsoleSession();
  hashes.set('812', 'b'.repeat(64));
  await app.selectConsoleAgentById('812');
  assert.deepEqual(calls, ['617', '812', '812']);
  await app.selectConsoleAgentById('617');
  assert.deepEqual(calls, ['617', '812', '812', '617']);

  app.resetConsoleSession();
  await app.selectConsoleAgentById('617');
  assert.deepEqual(calls, ['617', '812', '812', '617', '617']);
});

test('Console ignores stale Codex responses after selection and session changes', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const pending = [];
  const calls = [];
  const walletClient = createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } });
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient,
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
    claimApi: { loadConsoleCodexBundle: ({ selectedTokenId }) => {
      calls.push(selectedTokenId);
      return new Promise((resolve, reject) => pending.push({ selectedTokenId, resolve, reject }));
    } },
  });
  const start = app.start(); await flushAsyncEvents(60);
  pending.find((entry) => entry.selectedTokenId === '617').reject(new Error('initial Codex failure'));
  await start;

  const staleSelectionRequest = app.retryConsoleCodex();
  const secondSelection = app.selectConsoleAgentById('812');
  await flushAsyncEvents();
  pending.filter((entry) => entry.selectedTokenId === '617').at(-1).resolve(createConsoleCodexBundle('617', 'b'.repeat(64), 'stale selection'));
  pending.find((entry) => entry.selectedTokenId === '812').resolve(createConsoleCodexBundle('812'));
  await Promise.all([staleSelectionRequest, secondSelection]);

  app.resetConsoleSession();
  const walletGenerationRequest = app.selectConsoleAgentById('617');
  await flushAsyncEvents();
  const walletGenerationEntry = pending.filter((entry) => entry.selectedTokenId === '617').at(-1);
  walletClient.setSnapshot({ connected: true, address: '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE', label: 'other' }, { notify: true });
  walletGenerationEntry.resolve(createConsoleCodexBundle('617', 'c'.repeat(64), 'stale wallet'));
  await walletGenerationRequest;
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '');
});

test('Console reauthentication discards prior-session Codex state and cache', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const codexCalls = [];
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      loadConsoleCodexBundle: async ({ selectedTokenId }) => {
        codexCalls.push(selectedTokenId);
        return createConsoleCodexBundle(selectedTokenId, 'a'.repeat(64), `Session ${codexCalls.length}`);
      },
    },
  });
  await app.start(); await flushAsyncEvents(30);
  assert.deepEqual(codexCalls, ['617']);

  root.querySelector('[data-action="connect-console-wallet"]')?.click();
  await flushAsyncEvents(40);

  assert.deepEqual(codexCalls, ['617', '617']);
});

test('Console Looper selection invalidates a pending send across A to B to A', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let resolveSend;
  const pendingSend = new Promise((resolve) => { resolveSend = resolve; });
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812] }),
    claimApi: {
      loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId),
      activateConsoleAgent: async ({ tokenId }) => ({ thread: { transport: 'xmtp_local', participants: [{ tokenId }], messages: [] } }),
      sendConsoleAgentMessage: async () => pendingSend,
    },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  const form = root.querySelector('[data-action="send-console-agent-message"]');
  form.querySelector('textarea').value = 'Old A mission';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();

  await app.selectConsoleAgentById('812');
  await app.selectConsoleAgentById('617');
  resolveSend({ thread: { messages: [{ role: 'agent', text: 'Stale A response' }] }, memory: {}, proposals: [] });
  await flushAsyncEvents(20);
  root.querySelector('[data-console-view="chat"]')?.click();

  assert.doesNotMatch(root.querySelector('.console-agent-thread-panel')?.textContent ?? '', /Stale A response/);
});

test('Console roster refresh preserves a successfully activated empty thread', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: {
      loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId),
      activateConsoleAgent: async () => ({
        thread: { transport: 'xmtp_group', conversationId: 'empty-thread-617', participants: [{ tokenId: '617' }], messages: [] },
      }),
    },
  });
  await app.start();
  await app.activateSelectedConsoleAgent();
  assert.match(root.querySelector('.console-proof-rail-summary')?.textContent ?? '', /XMTP live/i);
  assert.ok(root.querySelector('[data-action="send-console-agent-message"]'));

  const refresh = root.querySelector('[data-action="refresh-console-owned-agents"]');
  assert.ok(refresh);
  refresh.click();
  await flushAsyncEvents(30);

  assert.match(root.querySelector('.console-proof-rail-summary')?.textContent ?? '', /XMTP live/i);
  assert.ok(root.querySelector('[data-action="send-console-agent-message"]'));
});

test('Console Codex retry only runs from unavailable or error states', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const attempts = new Map();
  const calls = [];
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617, 812, 913] }),
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => {
      calls.push(selectedTokenId);
      const attempt = (attempts.get(selectedTokenId) ?? 0) + 1;
      attempts.set(selectedTokenId, attempt);
      if (selectedTokenId === '812' && attempt === 1) throw Object.assign(new Error('unavailable'), { status: 503 });
      if (selectedTokenId === '913' && attempt === 1) throw new Error('broken');
      return createConsoleCodexBundle(selectedTokenId);
    } },
  });
  await app.start();

  await app.retryConsoleCodex();
  assert.deepEqual(calls, ['617']);
  await app.selectConsoleAgentById('812');
  await app.retryConsoleCodex();
  assert.deepEqual(calls, ['617', '812', '812']);
  await app.retryConsoleCodex();
  assert.deepEqual(calls, ['617', '812', '812']);
  await app.selectConsoleAgentById('913');
  await app.retryConsoleCodex();
  assert.deepEqual(calls, ['617', '812', '812', '913', '913']);
});

test('RESTAP mutations project saving state and suppress duplicate submissions', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let finishSave;
  const pendingSave = new Promise((resolve) => { finishSave = resolve; });
  const restap = createConsoleRestapApiFixture({ putPolicy: () => pendingSave });
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }), consoleRestapNetworkApi: restap.api,
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(30);
  root.querySelector('[data-console-view="network"]')?.click(); await flushAsyncEvents();
  let form = root.querySelector('[data-restap-network-policy]');
  form.elements.namedItem('daily_generated_message_limit').value = '9';
  form.elements.namedItem('topic:general').checked = true;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  form = root.querySelector('[data-restap-network-policy]');
  assert.equal(form.elements.namedItem('daily_generated_message_limit').value, '9');
  assert.equal(form.elements.namedItem('topic:general').checked, true);
  assert.equal(root.querySelector('[data-action="save-restap-network-policy"]')?.disabled, true);
  assert.equal(root.querySelector('[data-action="save-restap-network-policy"]')?.textContent.trim(), 'Saving…');
  root.querySelector('[data-restap-network-policy]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  assert.equal(restap.calls.filter(([name]) => name === 'putPolicy').length, 1);
  finishSave(createConsoleRestapPolicyResponse('617'));
  await flushAsyncEvents(30);
});

test('RESTAP Intro opts the selected peer in before sending and polls one background flight', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let sendAttempts = 0;
  const restap = createConsoleRestapApiFixture({
    getPolicy: ({ tokenId }) => createConsoleRestapPolicyResponse(tokenId, { policy: { allow_peer_token_ids: ['3802'], block_peer_token_ids: ['2431'] } }),
    sendTalk: (input) => {
      sendAttempts += 1;
      return createConsoleRestapTalkResponse({
        sender_token_id: String(input.tokenId), recipient_token_id: input.recipientTokenId, topic: input.topic,
        ...(sendAttempts === 1 ? { status: 'processing', operation_id: 'pending_' + 'a'.repeat(48), reply: undefined } : {}),
      });
    },
  });
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }), consoleRestapNetworkApi: restap.api,
    restapPollDelay: async () => {},
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(30);
  root.querySelector('[data-console-view="network"]')?.click(); await flushAsyncEvents();
  const form = root.querySelector('[data-restap-network-send]');
  form.elements.namedItem('recipient_token_id').value = '2431';
  form.elements.namedItem('topic').value = 'general';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents(30);

  const mutations = restap.calls.filter(([name]) => ['putPolicy', 'sendTalk'].includes(name));
  assert.deepEqual(mutations.map(([name]) => name), ['putPolicy', 'sendTalk', 'sendTalk']);
  assert.equal(mutations[1][1].idempotencyKey, mutations[2][1].idempotencyKey);
  assert.deepEqual(mutations[0][1].policy, {
    expected_policy_version: 3, network_enabled: true, inbound_enabled: true, autonomous_initiation_enabled: false,
    daily_initiated_conversation_limit: 5, daily_generated_message_limit: 10, per_peer_daily_limit: 3,
    topics: ['general'], allow_peer_token_ids: ['3802', '2431'], block_peer_token_ids: [], mute_until: null,
  });
  assert.equal(mutations[1][1].recipientTokenId, '2431');
  assert.equal(mutations[0][1].signal, mutations[1][1].signal);
});

test('RESTAP send errors preserve the bounded recipient and topic draft', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let rejectSend;
  const pendingSend = new Promise((_resolve, reject) => { rejectSend = reject; });
  const restap = createConsoleRestapApiFixture({ sendTalk: () => pendingSend });
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }), consoleRestapNetworkApi: restap.api,
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(30);
  root.querySelector('[data-console-view="network"]')?.click(); await flushAsyncEvents();
  let form = root.querySelector('[data-restap-network-send]');
  form.elements.namedItem('recipient_token_id').value = '3802';
  form.elements.namedItem('topic').value = 'collection-lore';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flushAsyncEvents();
  form = root.querySelector('[data-restap-network-send]');
  assert.equal(form.elements.namedItem('recipient_token_id').value, '3802');
  assert.equal(form.elements.namedItem('topic').value, 'collection-lore');
  rejectSend(Object.assign(new Error('raw private provider detail'), { status: 500 }));
  await flushAsyncEvents(20);
  form = root.querySelector('[data-restap-network-send]');
  assert.equal(form.elements.namedItem('recipient_token_id').value, '3802');
  assert.doesNotMatch(root.textContent, /raw private provider detail/i);
  assert.match(root.querySelector('[data-restap-feedback]')?.textContent ?? '', /did not complete/i);
});

test('RESTAP unchanged send retries reuse identity and substantive edits rotate it', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  let attempts = 0;
  const restap = createConsoleRestapApiFixture({ sendTalk: async (input) => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error('ambiguous transport failure'), { status: 500 });
    return createConsoleRestapTalkResponse({ sender_token_id: String(input.tokenId), recipient_token_id: input.recipientTokenId, topic: input.topic });
  } });
  const keys = ['send-retry-0000000000000001', 'send-retry-0000000000000002'];
  const issued = [];
  const app = createApp({
    root, loadDemo: async () => sampleData(),
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea', label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }), consoleRestapNetworkApi: restap.api,
    restapIdempotencyKeyFactory: () => { const key = keys[issued.length]; issued.push(key); return key; },
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(30);
  root.querySelector('[data-console-view="network"]')?.click(); await flushAsyncEvents();
  const submit = async (recipient, topic = 'general') => {
    const form = root.querySelector('[data-restap-network-send]');
    form.elements.namedItem('recipient_token_id').value = recipient;
    form.elements.namedItem('topic').value = topic;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await flushAsyncEvents(20);
  };
  await submit('3802');
  await submit('3802');
  await submit('3802', 'collection-lore');
  const calls = restap.calls.filter(([name]) => name === 'sendTalk').map(([, input]) => input);
  assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey);
  assert.notEqual(calls[1].idempotencyKey, calls[2].idempotencyKey);
  assert.deepEqual(issued, keys);
});

test('Swarm Command loads live missions and creates a recruiting mission through the Console', async () => {
  const root = setupDom('https://helixa.xyz/multipass/console');
  const owner = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
  const calls = [];
  let mission = null;
  const missionApi = {
    async listPublic(input) { calls.push(['list', input]); return { missions: mission ? [mission] : [], nextCursor: null }; },
    async create(input) { calls.push(['create', input]); return { result: { missionId: input.body.mission_id, revision: 0, state: 'draft' } }; },
    async getPublic(input) { calls.push(['get', input]); return { mission }; },
    async publish(input) {
      calls.push(['publish', input]);
      mission = { missionId: input.missionId, state: 'recruiting', revision: 1, publicSummary: 'Ship the working swarm.', applicationClosesAt: input.body.application_closes_at, launchDeadline: input.body.public_document.launch_deadline, publicDocument: input.body.public_document };
      return { result: { missionId: input.missionId, revision: 1, state: 'recruiting' } };
    },
  };
  const app = createApp({
    root, loadDemo: async () => sampleData(), missionApi,
    walletClient: createWalletClientFixture({ snapshot: { connected: true, address: owner, label: 'owner' } }),
    fetchImpl: createConsoleOwnedAgentsFetch({ tokenIds: [617] }),
    claimApi: { loadConsoleCodexBundle: async ({ selectedTokenId }) => createConsoleCodexBundle(selectedTokenId) },
  });
  await app.start(); await flushAsyncEvents(30);
  root.querySelector('[data-console-view="missions"]')?.click(); await flushAsyncEvents(20);
  assert.match(root.querySelector('.mission-alert')?.textContent ?? '', /Swarm Command is live on Base Sepolia/);
  assert.equal(root.querySelector('[data-mission-action="new"]')?.disabled, false);
  root.querySelector('[data-mission-action="new"]')?.click(); await flushAsyncEvents();
  const form = root.querySelector('[data-mission-editor]');
  assert.ok(form);
  form.elements.namedItem('title').value = 'Operational Swarm';
  form.elements.namedItem('summary').value = 'Ship the working swarm.';
  form.elements.namedItem('roles').value = 'builder, reviewer';
  form.elements.namedItem('application_deadline').value = '2026-10-20T16:00';
  form.elements.namedItem('launch_deadline').value = '2026-10-22T16:00';
  form.elements.namedItem('token').value = '0x87D00000000000000000000000000000000026ff';
  form.elements.namedItem('symbol').value = 'mUSDC';
  form.elements.namedItem('amount_raw').value = '1000000';
  form.elements.namedItem('recipient').value = owner;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flushAsyncEvents(40);
  assert.match(root.querySelector('.mission-card')?.textContent ?? '', /Operational Swarm/);
  assert.deepEqual(calls.map(([name]) => name), ['list', 'create', 'publish', 'list']);
  const create = calls.find(([name]) => name === 'create')[1];
  assert.equal(create.csrfToken, 'test-csrf');
  assert.equal(create.body.refund_address, owner.toLowerCase());
  assert.match(create.body.commitment_hash, /^[0-9a-f]{64}$/u);
  assert.equal(calls.find(([name]) => name === 'publish')[1].expectedRevision, 0);
  root.querySelector('[data-mission-id]')?.click(); await flushAsyncEvents();
  assert.match(root.querySelector('#mission-detail-title')?.textContent ?? '', /Operational Swarm/);
  assert.equal(calls.at(-1)[0], 'get');
  root.querySelector('[data-mission-action="back"]')?.click();
  assert.ok(root.querySelector('.mission-card'));
});
