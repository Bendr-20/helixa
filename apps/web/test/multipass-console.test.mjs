import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import test from 'node:test';

import { createMultipassConsoleSnapshot, normalizeConsoleCred, renderMultipassConsole } from '../src/multipass-console.js';

test('Network remains isolated beside the Swarm Command workspace and Multipass contains no RESTAP controls', () => {
  const [agent] = sampleAgents();
  const snapshot = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleAuthenticatedWallet: '0x1234567890abcdef1234567890abcdef12345678',
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1', consoleWorkspaceView: 'network',
      consoleRestapNetwork: { status: 'unavailable', selectedTokenId: '1', requestId: 1, policy: null, intents: [], error: 'RESTAP network controls are unavailable for this Looper.' },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  assert.equal(root.querySelectorAll('.console-basic-main .console-restap-network').length, 1);
  assert.match(root.querySelector('.console-restap-network')?.textContent ?? '', /Network participation is unavailable/i);
  assert.equal(root.querySelectorAll('.console-workspace-nav').length, 2);
  for (const nav of root.querySelectorAll('.console-workspace-nav')) {
    assert.deepEqual(
      [...nav.querySelectorAll('[data-console-view]')].map((button) => button.dataset.consoleView),
      ['missions', 'chat', 'codex', 'wallet', 'multipass', 'network'],
    );
    assert.equal(nav.querySelectorAll('[aria-current="page"]').length, 1);
    assert.equal(nav.querySelector('[data-console-view="network"]')?.getAttribute('aria-current'), 'page');
    assert.equal(nav.querySelector('[data-console-view="network"] span')?.textContent, 'Network');
    assert.equal(nav.querySelector('[data-console-view="network"] small')?.textContent.replace(/\s+/gu, ' ').trim(), 'RESTAP Unavailable');
    assert.equal(nav.querySelector('[data-console-view="network"]')?.getAttribute('aria-label'), 'Network, RESTAP, Unavailable');
    assert.equal(nav.querySelector('[data-console-view="network"]')?.disabled, false);
  }
  const multipassRoot = render(renderMultipassConsole({ ...snapshot, workspaceView: 'multipass' }));
  assert.equal(multipassRoot.querySelector('.console-basic-main .console-restap-network'), null);
  for (const nav of multipassRoot.querySelectorAll('.console-workspace-nav')) {
    assert.equal(nav.querySelectorAll('[aria-current="page"]').length, 1);
    assert.equal(nav.querySelector('[data-console-view="multipass"]')?.getAttribute('aria-current'), 'page');
  }
  assert.equal(snapshot.restapNetwork.selectedTokenId, '1');
  assert.equal(Object.hasOwn(snapshot.agentThread, 'restapNetwork'), false);

  const noSelection = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleAuthenticatedWallet: '0x1234567890abcdef1234567890abcdef12345678',
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: null,
    },
  });
  const noSelectionRoot = render(renderMultipassConsole(noSelection));
  for (const nav of noSelectionRoot.querySelectorAll('.console-workspace-nav')) {
    const network = nav.querySelector('[data-console-view="network"]');
    assert.equal(network?.disabled, true);
    assert.equal(network?.querySelector('b')?.textContent, 'Select Looper');
    assert.equal(network?.getAttribute('aria-label'), 'Network, RESTAP, Select Looper');
  }
});

test('disabled Swarm Command preview renders before wallet authentication', () => {
  const snapshot = createMultipassConsoleSnapshot({
    agents: [],
    state: {
      walletSnapshot: { connected: false, address: null },
      consoleAuthenticatedWallet: null,
      consoleOwnedAgents: { status: 'idle', agents: [] },
      consoleSelectedAgentId: null,
      consoleWorkspaceView: 'missions',
      consoleMissions: { status: 'disabled', missions: [] },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  assert.ok(root.querySelector('.mission-board'));
  assert.match(root.querySelector('.mission-alert[role="status"]')?.textContent ?? '', /Read-only preview/);
  assert.equal(root.querySelector('[data-mission-action="new"]')?.disabled, true);
  assert.equal(root.querySelector('.console-auth-gate'), null);
});

test('Swarm Command renders token-launch preparation inside the existing Console workspace', () => {
  const agents = [...sampleAgents(), { tokenId: '74', name: 'Axiom', role: 'Operator', cred: canonicalCred(79), verified: true, href: '/multipass/?agent=74' }];
  const members = agents.map((agent, index) => ({ tokenId: agent.tokenId, name: agent.name, role: agent.role, contributionBps: [4000, 3000, 3000][index], cred: agent.cred, erc8004Id: '8453:' + agent.tokenId }));
  const snapshot = createMultipassConsoleSnapshot({ agents, state: { walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' }, consoleAuthenticatedWallet: '0x1234567890abcdef1234567890abcdef12345678', consoleOwnedAgents: { status: 'loaded', agents }, consoleSelectedAgentId: '1', consoleWorkspaceView: 'missions', consoleMissions: { status: 'loaded', view: 'launchpad', missions: [] }, consoleLaunchpad: { status: 'editing', draft: { members, app: { name: 'Signal Swarm', pitch: 'Ship it.', template: 'web_app', revenueModel: 'subscription', shipTarget: '30_days' }, token: { name: 'Signal Swarm', ticker: 'SIGSWARM', supply: '1000000000', curve: 'bonding_curve_to_dex' } }, manifest: null, error: null } } });
  const root = render(renderMultipassConsole(snapshot));
  assert.ok(root.querySelector('.swarm-launchpad'));
  assert.equal(root.querySelectorAll('[data-swarm-member]').length, 3);
  assert.match(root.querySelector('.swarm-launch-gate')?.textContent ?? '', /Gate passed/i);
  assert.equal(root.querySelector('[data-swarm-launch-submit]')?.disabled, false);
  assert.equal(root.querySelector('.mission-board'), null);
});

test('production entrypoint leaves wallet mutation controls enabled', async () => {
  const [mainSource, walletSource] = await Promise.all([
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/looper-agent-wallet.js', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(mainSource, /looperWalletSecurityPaused|LOOPER_WALLET_SECURITY_PAUSED/);
  assert.doesNotMatch(walletSource, /LOOPER_WALLET_SECURITY_PAUSED[ \t]*=[ \t]*true/);
});

function sampleData() {
  return {
    profile: {
      display_name: 'Bendr 2.0',
      subject_type: 'agent',
      owner_summary: { owner_state: 'unclaimed' },
      standards_profile: { supported_standard_ids: ['ERC-8004', 'ERC-8217'] },
      cred_summary: { score: 80 },
    },
    card: {
      message_routes: [{ visibility: 'public' }],
      service_endpoints: [{ visibility: 'public' }],
      standards_refs: [{ standard_id: 'ERC-8004' }],
    },
    fragments: {
      fragments: [
        { fragment_id: 'public_identity', fragment_type: 'attestation', visibility: 'public' },
        { fragment_id: 'public_route', fragment_type: 'endpoint', visibility: 'public' },
        { fragment_id: 'private_note', visibility: 'private' },
      ],
    },
  };
}

function canonicalCred(score, tier = 'PRIME', overrides = {}) {
  return {
    score,
    tier,
    coverage: {
      score: 70,
      label: 'GOOD',
      present: ['binding', 'metadata', 'continuity', 'erc6551Activity'],
      missing: ['erc8004Reputation', 'verifiedReceipts'],
    },
    freshness: {
      status: 'fresh',
      stale: false,
      cached: false,
      ageSeconds: 0,
      maxAgeSeconds: 300,
      staleIfErrorSeconds: 86400,
    },
    methodologyVersion: 'looper-cred-v1',
    computedAt: '2026-09-26T22:00:00.000Z',
    updatedAt: '2026-09-26T22:00:00.000Z',
    status: 'available',
    ...overrides,
  };
}

function sampleAgents() {
  return [
    {
      tokenId: '1',
      name: 'Bendr 2.0',
      role: 'Lead agent',
      cred: canonicalCred(80),
      helixaId: '8453:1',
      intuition: { label: 'Published', canonicalAgentId: '8453:18531' },
      proofCount: 2,
      routeCount: 1,
      standardsCount: 1,
      verified: true,
      href: '/multipass/?agent=1',
    },
    { tokenId: '81', name: 'Quigbot', role: 'Strategy agent', cred: canonicalCred(75, 'QUALIFIED'), proofCount: 1, routeCount: 1, standardsCount: 1, verified: true, href: '/multipass/?agent=81' },
  ];
}

function render(html) {
  return new JSDOM(`<!doctype html><main>${html}</main>`).window.document.querySelector('main');
}

test('selected Looper renders its active wallet as a dedicated Console workspace', () => {
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleAuthenticatedWallet: '0x1234567890abcdef1234567890abcdef12345678',
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleWorkspaceView: 'wallet',
      looperAgentWallet: {
        mode: 'active',
        tokenId: '1',
        owner: '0x1234567890aBcdef1234567890aBcdef12345678',
        account: '0x9999999999999999999999999999999999999999',
        legacyAccount: '0x8888888888888888888888888888888888888888',
        nativeWei: '1250000000000000000',
        tokens: [{ contract: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3', symbol: 'CRED', decimals: 18, balanceBaseUnits: '2500000000000000000' }],
        refreshedAt: '2026-09-21T23:59:00.000Z',
        policyStatus: 'owner-only',
        policyRecoveryAllowed: true,
        operatorProfile: 'eip7702',
        canTransact: true,
        activation: { state: 'idle' },
        send: { state: 'idle' },
        policy: { state: 'idle' },
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const panel = root.querySelector('.console-wallet-workspace .console-looper-wallet');
  assert.ok(panel);
  assert.equal(root.querySelector('.console-identity-card .console-looper-wallet'), null);
  assert.equal(root.querySelector('[data-console-view="wallet"]')?.getAttribute('aria-current'), 'page');
  assert.match(panel.textContent, /Looper wallet/i);
  assert.match(panel.textContent, /1\.25 ETH/);
  assert.match(panel.textContent, /2\.5 CRED/);
  assert.equal(panel.querySelector('.console-looper-wallet-status')?.textContent, 'Owner controlled');
  assert.equal(panel.querySelector('.console-looper-wallet-primary-balance')?.textContent, '1.25 ETH');
  const hero = panel.querySelector('.console-looper-wallet-hero');
  assert.ok(hero);
  assert.match(hero.textContent, /Available balance/i);
  assert.equal(panel.querySelectorAll('.console-looper-wallet-asset-row').length, 2);
  assert.match(panel.querySelector('.console-looper-wallet-asset-row')?.textContent ?? '', /ETH/i);
  assert.equal(panel.querySelector('[data-wallet-action="send"]')?.open, false);
  assert.equal(panel.querySelector('[data-wallet-action="receive"]')?.open, false);
  const advanced = panel.querySelector('[data-wallet-action="advanced"]');
  assert.ok(advanced);
  assert.equal(advanced.open, false);
  assert.ok(advanced.querySelector('[data-action="set-looper-policy-module"]'));
  assert.equal(panel.querySelector('[data-wallet-action="send"] [data-action="send-looper-agent-wallet"]') !== null, true);
  const stakeCred = panel.querySelector('[data-wallet-action="stake-cred"]');
  assert.ok(stakeCred);
  assert.match(stakeCred.querySelector('summary')?.textContent ?? '', /Stake CRED/i);
  assert.ok(stakeCred.querySelector('[data-action="load-pantheon-cred"]'));
  assert.equal(panel.querySelectorAll(':scope > .console-looper-wallet-send').length, 0);
  const details = panel.querySelector('details.console-looper-wallet-details');
  assert.ok(details);
  assert.match(details.querySelector('summary')?.textContent ?? '', /Wallet details/i);
  assert.equal(details.querySelector('a')?.href, 'https://basescan.org/address/0x9999999999999999999999999999999999999999');
  assert.doesNotMatch(panel.textContent, /legacy|0x8888888888888888888888888888888888888888/i);
  assert.equal(details.querySelectorAll('a[href*="basescan.org/address/"]').length, 1);
  assert.equal(panel.querySelector('[data-wallet-truth="agent-runtime"] strong')?.textContent, 'Review-only');
  assert.equal(panel.querySelector('[data-wallet-truth="looper-wallet"] strong')?.textContent, 'Active');
  assert.equal(panel.querySelector('[data-wallet-truth="owner-signer"] strong')?.textContent, 'Delegated EOA');
  assert.ok(panel.querySelector('[data-action="refresh-looper-agent-wallet"]'));
  assert.equal(panel.querySelector('.console-looper-wallet-activation-callout'), null);
  assert.equal(details.querySelector('[data-action="send-looper-agent-wallet"]'), null);
  assert.ok(panel.querySelector('[data-wallet-action="send"] [data-action="send-looper-agent-wallet"]'));
  assert.match(root.querySelector('.console-wallet-workspace')?.textContent ?? '', /Bendr 2\.0/i);
  assert.equal(snapshot.identityCard.agentWallet.mode, 'active');
  assert.equal(Object.hasOwn(snapshot.identityCard.agentWallet, 'legacyAccount'), false);

  const coinbaseSnapshot = structuredClone(snapshot);
  coinbaseSnapshot.identityCard.agentWallet.operatorProfile = 'coinbase_smart_wallet';
  const coinbaseRoot = render(renderMultipassConsole(coinbaseSnapshot));
  assert.equal(
    coinbaseRoot.querySelector('[data-wallet-truth="owner-signer"] strong')?.textContent,
    'Coinbase Smart Wallet',
  );
});

test('an exiting or final-month Pantheon position exposes no top-up control', () => {
  const agents = sampleAgents();
  const snapshot = createMultipassConsoleSnapshot({
    agents,
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleAuthenticatedWallet: '0x1234567890abcdef1234567890abcdef12345678',
      consoleOwnedAgents: { status: 'loaded', agents },
      consoleSelectedAgentId: '1', consoleWorkspaceView: 'wallet',
      looperAgentWallet: {
        mode: 'active', tokenId: '1', owner: '0x1234567890aBcdef1234567890aBcdef12345678',
        account: '0x9999999999999999999999999999999999999999', nativeWei: '1',
        tokens: [{ contract: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3', symbol: 'CRED', decimals: 18, balanceBaseUnits: '1' }],
        policyStatus: 'owner-only', operatorProfile: 'eip7702', canTransact: true,
        activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
        pantheonCred: {
          status: 'staked_ineligible', stakeAmountBaseUnits: '4000000000000000000000000', poolActive: true,
          dates: { rewardsStart: '2026-11-01T00:00:00.000Z', firstClaim: '2026-12-01T00:00:00.000Z', lockEnds: '2027-05-01T00:00:00.000Z' },
        },
      },
    },
  });
  const panel = render(renderMultipassConsole(snapshot)).querySelector('[data-wallet-action="stake-cred"]');
  assert.match(panel?.textContent ?? '', /cannot be added.*exiting.*final earning month/i);
  assert.equal(panel?.querySelector('[data-action="approve-pantheon-cred"]'), null);
});

test('mobile Console exposes a portrait agent switcher and six mutually exclusive workspaces', () => {
  const agents = Array.from({ length: 45 }, (_, index) => ({
    ...sampleAgents()[index % 2],
    tokenId: String(index + 1),
    name: index === 0 ? 'Fool Spec' : `Looper ${index + 1}`,
    image: index === 0 ? 'https://example.test/fool-spec.png' : null,
  }));
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const activeSnapshot = createMultipassConsoleSnapshot({
    agents,
    state: {
      walletSnapshot: { connected: true, address },
      consoleAuthenticatedWallet: address,
      consoleOwnedAgents: { status: 'loaded', agents },
      consoleSelectedAgentId: '1',
      looperAgentWallet: {
        mode: 'active',
        tokenId: '1',
        owner: address,
        account: '0x9999999999999999999999999999999999999999',
        nativeWei: '0',
        tokens: [],
        activation: { state: 'idle' },
        send: { state: 'idle' },
        policy: { state: 'idle' },
      },
    },
  });
  const activeRoot = render(renderMultipassConsole(activeSnapshot));
  const switcher = activeRoot.querySelector('.console-agent-switcher-mobile');
  const mobileNav = activeRoot.querySelector('.console-workspace-nav-mobile');

  assert.equal(activeSnapshot.workspaceView, 'multipass');
  assert.ok(switcher);
  assert.equal(switcher.querySelector('img')?.src, 'https://example.test/fool-spec.png');
  assert.match(switcher.querySelector('summary')?.textContent ?? '', /Fool Spec/i);
  assert.match(switcher.querySelector('summary')?.textContent ?? '', /45 owned/i);
  assert.equal(mobileNav?.querySelectorAll('button').length, 6);
  assert.ok(mobileNav?.querySelector('[data-console-view="codex"]'));
  assert.match(mobileNav?.querySelector('[data-console-view="multipass"]')?.textContent ?? '', /MultipassManage/i);
  assert.equal(mobileNav?.querySelectorAll('[aria-current="page"]').length, 1);
  assert.equal(mobileNav?.querySelector('[data-console-view="multipass"]')?.getAttribute('aria-current'), 'page');
  assert.ok(activeRoot.querySelector('.console-basic-main > .console-identity-card'));

  const inactiveSnapshot = createMultipassConsoleSnapshot({
    agents,
    state: {
      walletSnapshot: { connected: true, address },
      consoleAuthenticatedWallet: address,
      consoleOwnedAgents: { status: 'loaded', agents },
      consoleSelectedAgentId: '1',
      looperAgentWallet: {
        mode: 'inactive',
        tokenId: '1',
        owner: address,
        account: '0x9999999999999999999999999999999999999999',
        nativeWei: '0',
        tokens: [],
        activation: { state: 'idle' },
        send: { state: 'idle' },
        policy: { state: 'idle' },
      },
    },
  });
  const inactiveRoot = render(renderMultipassConsole(inactiveSnapshot));
  assert.equal(inactiveSnapshot.workspaceView, 'wallet');
  assert.equal(inactiveRoot.querySelector('.console-workspace-nav-mobile [data-console-view="wallet"]')?.getAttribute('aria-current'), 'page');
  assert.ok(inactiveRoot.querySelector('.console-basic-main > .console-wallet-workspace'));
});

test('selected Looper exposes Codex before activation and Chat shows an explicit activation gate', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const baseState = {
    walletSnapshot: { connected: true, address },
    consoleAuthenticatedWallet: address,
    consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
    consoleSelectedAgentId: '1',
    consoleAgentThread: { status: 'inactive', messages: [] },
    consoleCodex: { status: 'loading', selectedTokenId: '1' },
  };
  const codexSnapshot = createMultipassConsoleSnapshot({ agents: sampleAgents(), state: { ...baseState, consoleWorkspaceView: 'codex' } });
  const codexRoot = render(renderMultipassConsole(codexSnapshot));
  for (const nav of codexRoot.querySelectorAll('.console-workspace-nav')) {
    assert.equal(nav.querySelectorAll('button').length, 6);
    assert.equal(nav.querySelectorAll('[aria-current="page"]').length, 1);
    assert.equal(nav.querySelector('[data-console-view="codex"]')?.getAttribute('aria-current'), 'page');
    assert.equal(nav.querySelector('[data-console-view="codex"]')?.disabled, false);
  }
  assert.ok(codexRoot.querySelector('.console-basic-main > .console-codex-workspace'));
  assert.equal(codexRoot.querySelector('.console-activation-gate'), null);

  const chatSnapshot = createMultipassConsoleSnapshot({ agents: sampleAgents(), state: { ...baseState, consoleWorkspaceView: 'chat' } });
  const chatRoot = render(renderMultipassConsole(chatSnapshot));
  assert.match(chatRoot.querySelector('.console-activation-gate')?.textContent ?? '', /Activate Looper #1 to start Chat/i);
  assert.ok(chatRoot.querySelector('.console-activation-gate [data-action="activate-selected-console-agent"]'));
  assert.equal(chatRoot.querySelector('.console-thread-shell'), null);
});

test('cancelled Chat activation stays behind the inactive gate even when stale thread data exists', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address },
      consoleAuthenticatedWallet: address,
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleWorkspaceView: 'chat',
      consoleAgentThread: {
        status: 'error',
        operationStatus: 'cancelled',
        activationRetryAvailable: false,
        messages: [{ id: 'stale', role: 'agent', text: 'Stale private history.' }],
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  assert.match(root.querySelector('.console-activation-gate')?.textContent ?? '', /Activate Looper #1 to start Chat/i);
  assert.equal(root.querySelector('.console-thread-shell'), null);
  assert.equal(root.querySelector('.console-thread-composer'), null);
  assert.doesNotMatch(root.textContent ?? '', /Stale private history/);
});

test('activation failure keeps Codex selected and offers Chat retry without hiding Codex', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address },
      consoleAuthenticatedWallet: address,
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleWorkspaceView: 'codex',
      consoleCodex: { status: 'unavailable', selectedTokenId: '1', retryAvailable: true },
      consoleAgentThread: { status: 'error', activationRetryAvailable: true, error: 'Room setup failed.' },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  assert.equal(snapshot.workspaceView, 'codex');
  assert.ok(root.querySelector('.console-codex-workspace [data-action="retry-console-codex"]'));
  assert.equal(root.querySelector('[data-console-view="codex"]')?.getAttribute('aria-current'), 'page');
});

test('authenticated Console keeps one complete full-width desktop roster drawer', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address },
      consoleAuthenticatedWallet: address,
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleMainRosterOpen: false,
      consoleSidebarRosterOpen: false,
      consoleAgentThread: { status: 'idle', messages: [] },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const mainDrawer = root.querySelector('details[data-console-roster-drawer="main"]');
  const sidebarDrawer = root.querySelector('details[data-console-roster-drawer="sidebar"]');
  assert.ok(mainDrawer);
  assert.equal(sidebarDrawer, null);
  assert.equal(mainDrawer.open, false);
  assert.match(mainDrawer.querySelector('summary')?.textContent ?? '', /My agents/i);
  assert.match(mainDrawer.querySelector('summary')?.textContent ?? '', /2 owned/i);
  assert.match(mainDrawer.querySelector('summary')?.textContent ?? '', /Bendr 2\.0.*Token #1/is);
  assert.equal(mainDrawer.querySelectorAll('.console-agent-gallery-card').length, 2);
  assert.ok(mainDrawer.parentElement?.classList.contains('console-basic-shell'));
  assert.equal(root.querySelector('.console-basic-main')?.contains(mainDrawer), false);
  assert.equal(root.querySelectorAll('[data-console-roster-drawer="main"]').length, 1);

  const openSnapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address },
      consoleAuthenticatedWallet: address,
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleMainRosterOpen: true,
    },
  });
  const openRoot = render(renderMultipassConsole(openSnapshot));
  assert.equal(openRoot.querySelector('details[data-console-roster-drawer="main"]')?.open, true);
  assert.equal(openRoot.querySelector('details[data-console-roster-drawer="sidebar"]'), null);
});

test('connected but unauthenticated wallet gets an explicit Console sign-in gate', () => {
  const snapshot = createMultipassConsoleSnapshot({
    agents: [],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleAuthenticatedWallet: null,
      consoleWalletStatus: 'cancelled',
      consoleOwnedAgents: { status: 'idle', agents: [] },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const gate = root.querySelector('.console-auth-gate');
  assert.ok(gate);
  assert.match(gate.textContent, /Sign in to Console/i);
  assert.match(gate.textContent, /wallet is connected/i);
  assert.ok(gate.querySelector('[data-action="connect-console-wallet"]'));
  assert.equal(snapshot.session.wallet.connected, true);
  assert.equal(snapshot.session.wallet.authenticated, false);
  assert.equal(root.querySelector('.console-agent-onboarding'), null);
});

test('authenticated first visit keeps the complete Looper chooser in a closed main drawer', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address },
      consoleAuthenticatedWallet: address,
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: null,
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const chooser = root.querySelector('.console-agent-onboarding');
  assert.ok(chooser);
  assert.match(chooser.textContent, /Choose your Looper/i);
  assert.equal(chooser.querySelectorAll('[data-action="activate-console-room"]').length, 2);
  assert.equal(root.querySelector('details[data-console-roster-drawer="main"]')?.open, false);
  assert.equal(root.querySelector('details[data-console-roster-drawer="sidebar"]'), null);
  assert.equal(root.querySelector('.console-basic-main')?.querySelector('.console-agent-onboarding'), null);
  assert.equal(snapshot.session.needsAgentSelection, true);
});

test('authenticated chooser renders the complete semantic Looper gallery beyond ten agents', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const agents = Array.from({ length: 24 }, (_, index) => ({
    tokenId: String(index + 1),
    name: `Looper ${index + 1}`,
    role: index % 2 ? 'Scout' : 'Operator',
    credLabel: `Cred ${60 + index}`,
    verified: true,
    image: `https://helixa.xyz/loopers/images/${index + 1}.png`,
  }));
  const snapshot = createMultipassConsoleSnapshot({
    agents,
    state: {
      walletSnapshot: { connected: true, address },
      consoleAuthenticatedWallet: address,
      consoleOwnedAgents: { status: 'loaded', agents },
      consoleSelectedAgentId: null,
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const gallery = root.querySelector('.console-agent-gallery');
  assert.ok(gallery);
  assert.equal(gallery.querySelectorAll('article.console-agent-gallery-card').length, 24);
  assert.equal(gallery.querySelectorAll('[data-action="activate-console-room"]').length, 24);
  assert.match(gallery.textContent, /All 24 Loopers loaded/);
  assert.equal(gallery.querySelector('img')?.alt, 'Looper 1, Looper #1');
  assert.equal(gallery.querySelector('[data-action="activate-console-room"]')?.getAttribute('aria-label'), 'Open Looper 1, Looper #1');
  assert.match(gallery.querySelector('.console-agent-gallery-card')?.textContent ?? '', /Verified/i);
  const heading = gallery.querySelector('#console-agent-onboarding-title');
  assert.ok(heading);
  assert.equal(heading.hasAttribute('tabindex'), false);
  const marketplace = gallery.querySelector('a[href="https://opensea.io/collection/loopers-639312714"]');
  assert.ok(marketplace);
  assert.equal(marketplace.target, '_blank');
  assert.equal(marketplace.rel, 'noopener noreferrer');
});

test('Looper gallery keeps loading, owned-empty, filtered-empty, and error states truthful', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const stateFor = (consoleOwnedAgents, extra = {}) => ({
    walletSnapshot: { connected: true, address },
    consoleAuthenticatedWallet: address,
    consoleOwnedAgents,
    consoleSelectedAgentId: null,
    ...extra,
  });

  let root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: [],
    state: stateFor({ status: 'loading', agents: [] }),
  })));
  assert.ok(root.querySelector('.console-agent-gallery'));
  assert.match(root.textContent, /Loading all owned Loopers/i);
  assert.doesNotMatch(root.textContent, /All \d+ Loopers loaded/);
  assert.equal(root.querySelector('.console-agent-gallery')?.getAttribute('aria-busy'), 'true');

  root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: [],
    state: stateFor({ status: 'loaded', agents: [] }),
  })));
  assert.match(root.textContent, /No owned Loopers found/i);
  assert.doesNotMatch(root.textContent, /All \d+ Loopers loaded/);

  const agents = sampleAgents();
  root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents,
    state: stateFor({ status: 'loaded', agents }, { consoleAgentGallery: { query: 'missing', sort: 'token-asc' } }),
  })));
  assert.match(root.textContent, /All 2 Loopers loaded/);
  assert.match(root.textContent, /No Loopers match “missing”/i);
  assert.ok(root.querySelector('[data-action="clear-console-agent-gallery-search"]'));

  root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: [],
    state: stateFor({ status: 'error', error: 'Ownership scan failed.', agents: [] }),
  })));
  assert.ok(root.querySelector('[role="alert"]'));
  assert.match(root.textContent, /Ownership scan failed/i);
  assert.ok(root.querySelector('[data-action="refresh-console-owned-agents"]'));
  assert.doesNotMatch(root.textContent, /All \d+ Loopers loaded/);
});

test('agent selection is disabled while any Looper wallet operation is nonterminal', () => {
  for (const attemptState of ['prepared', 'submitted', 'uncertain_hashless', 'uncertain_hashed']) {
    const snapshot = createMultipassConsoleSnapshot({
      agents: sampleAgents(),
      state: {
        walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
        consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
        consoleSelectedAgentId: '1',
        consoleWorkspaceView: 'wallet',
        looperAgentWallet: {
          mode: 'active', tokenId: '1', owner: '0x1234567890aBcdef1234567890aBcdef12345678',
          account: '0x9999999999999999999999999999999999999999', nativeWei: '0', tokens: [],
          policyStatus: 'owner-only', canTransact: true,
          activation: { state: 'idle' },
          send: { state: attemptState },
          policy: { state: 'idle' },
        },
      },
    });
    assert.equal(snapshot.session.selectionEnabled, false);
    assert.equal(snapshot.gallery.refreshDisabled, true);
    assert.equal(snapshot.agents.every((agent) => agent.activationDisabled), true);
    const root = render(renderMultipassConsole(snapshot));
    assert.equal(root.querySelector('[data-action="select-console-agent"]')?.disabled, true);
    const acknowledgment = root.querySelector('[data-action="acknowledge-looper-wallet-outcome"]');
    assert.equal(Boolean(acknowledgment), attemptState.startsWith('uncertain_'));
    if (acknowledgment) assert.equal(acknowledgment.dataset.attemptKind, 'send');
  }
});

test('inactive and internal legacy-only Looper states fail closed without exposing legacy-wallet UI', () => {
  const baseState = {
    walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
    consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
    consoleSelectedAgentId: '1',
    consoleWorkspaceView: 'wallet',
  };
  let snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: { ...baseState, looperAgentWallet: { mode: 'inactive', account: '0x9999999999999999999999999999999999999999', nativeWei: '0', tokens: [] } },
  });
  let root = render(renderMultipassConsole(snapshot));
  const inactivePanel = root.querySelector('.console-looper-wallet');
  const activationCallout = inactivePanel?.querySelector('.console-looper-wallet-activation-callout');
  const activationForm = activationCallout?.querySelector('[data-action="activate-looper-agent-wallet"]');
  assert.ok(activationCallout, 'inactive wallet must expose a prominent activation callout');
  assert.ok(activationForm, 'activation form must be visible outside technical wallet details');
  assert.match(activationCallout.textContent, /Activate your Looper wallet/i);
  assert.match(activationCallout.textContent, /owner-controlled wallet/i);
  assert.equal(activationForm.querySelector('input[name="confirmed"]')?.required, true);
  assert.equal(activationForm.querySelector('button[type="submit"]')?.textContent, 'Activate wallet');
  assert.equal(inactivePanel?.querySelector('.console-looper-wallet-details [data-action="activate-looper-agent-wallet"]'), null);
  assert.match(inactivePanel?.textContent ?? '', /setup required/i);

  snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: { ...baseState, looperAgentWallet: { mode: 'legacy_read_only', reason: 'legacy_implementation', legacyAccount: '0x8888888888888888888888888888888888888888', nativeWei: '7', tokens: [] } },
  });
  root = render(renderMultipassConsole(snapshot));
  const panel = root.querySelector('.console-looper-wallet');
  assert.match(panel?.textContent ?? '', /read-only/i);
  assert.doesNotMatch(panel?.textContent ?? '', /legacy|0x8888888888888888888888888888888888888888|migration/i);
  assert.equal(panel?.querySelector('a[href*="basescan.org/address/"]'), null);
  assert.equal(panel?.querySelector('.console-looper-wallet-overview'), null);
  assert.equal(panel?.querySelector('.console-looper-wallet-balances'), null);
  assert.equal(root.querySelector('[data-action="activate-looper-agent-wallet"]'), null);
  assert.equal(panel?.querySelector('.console-looper-wallet-activation-callout'), null);
  assert.equal(root.querySelector('[data-action="send-looper-agent-wallet"]'), null);
});

test('Looper permission status and owner-only recovery stay concise and use existing neutral controls', () => {
  const baseState = {
    walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
    consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
    consoleSelectedAgentId: '1',
    consoleWorkspaceView: 'wallet',
  };
  const cases = [
    ['owner-only', 'Owner controlled'],
    ['permission-hook-paused', 'Permission hook paused'],
    ['module-blocked', 'Policy blocked'],
    ['ownership-mismatch', 'Read-only'],
  ];
  for (const [policyStatus, label] of cases) {
    const snapshot = createMultipassConsoleSnapshot({
      agents: sampleAgents(),
      state: {
        ...baseState,
        looperAgentWallet: {
          mode: policyStatus === 'module-blocked' || policyStatus === 'ownership-mismatch' ? 'read_only' : 'active',
          tokenId: '1',
          owner: '0x1234567890aBcdef1234567890aBcdef12345678',
          account: '0x9999999999999999999999999999999999999999',
          nativeWei: '0',
          tokens: [],
          policyStatus,
          policyModule: policyStatus === 'owner-only' ? '0x0000000000000000000000000000000000000000' : '0x7777777777777777777777777777777777777777',
          policyEpoch: '4',
          policyRecoveryAllowed: true,
          canTransact: policyStatus !== 'module-blocked' && policyStatus !== 'ownership-mismatch',
          activation: { state: 'idle' },
          send: { state: 'idle' },
          policy: { state: 'idle' },
        },
      },
    });
    const root = render(renderMultipassConsole(snapshot));
    assert.equal(root.querySelector('.console-looper-wallet-status')?.textContent, label);
    const form = root.querySelector('[data-action="set-looper-policy-module"]');
    assert.ok(form);
    assert.equal(form.matches('.console-looper-wallet-send.console-looper-wallet-policy'), true);
    assert.equal(root.querySelector('form.console-looper-wallet-policy:not(.console-looper-wallet-send)'), null);
    assert.ok(form.querySelector('input[name="module"]'));
    assert.match(form.textContent, /Confirm this exact permission module recovery/i);
    assert.equal(root.querySelector('[data-action="send-looper-agent-wallet"]') !== null, policyStatus === 'owner-only' || policyStatus === 'permission-hook-paused');
  }

  const activePolicy = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      ...baseState,
      looperAgentWallet: {
        mode: 'active', tokenId: '1', owner: baseState.walletSnapshot.address,
        account: '0x9999999999999999999999999999999999999999', nativeWei: '0', tokens: [],
        policyStatus: 'active-policy', policyModule: '0x7777777777777777777777777777777777777777',
        policyEpoch: '5', policyRecoveryAllowed: true, canTransact: true,
        activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
      },
    },
  });
  const root = render(renderMultipassConsole(activePolicy));
  assert.equal(root.querySelector('.console-looper-wallet-status')?.textContent, 'Owner controlled');
  assert.match(root.querySelector('.console-looper-wallet')?.textContent ?? '', /reviewed permission module configured/i);
  assert.doesNotMatch(root.querySelector('.console-looper-wallet')?.textContent ?? '', /agent execution enabled|executeWithPolicy|grant|session key/i);
});

test('RPC disagreement renders read-only without stale actions, recovery preview or busy lock', () => {
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleWorkspaceView: 'wallet',
      looperAgentWallet: {
        mode: 'read_only', reason: 'rpc_disagreement', tokenId: '1',
        owner: '0x1234567890aBcdef1234567890aBcdef12345678',
        account: '0x9999999999999999999999999999999999999999', nativeWei: '5', tokens: [],
        policyStatus: 'active-policy', policyRecoveryAllowed: true, canTransact: true,
        activation: { state: 'prepared', preparedId: 'activation:stale' },
        send: { state: 'prepared', preparedId: 'send:stale' },
        policy: { state: 'prepared', preparedId: 'policy:stale' },
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const panel = root.querySelector('.console-looper-wallet');
  assert.equal(panel.querySelector('.console-looper-wallet-status')?.textContent, 'Read-only');
  assert.equal(panel.querySelector('[data-action="activate-looper-agent-wallet"]'), null);
  assert.equal(panel.querySelector('[data-action="send-looper-agent-wallet"]'), null);
  assert.equal(panel.querySelector('[data-action="set-looper-policy-module"]'), null);
  assert.equal(panel.querySelector('[data-action="refresh-looper-agent-wallet"]')?.disabled, false);
});

test('read-only wallet state uses one neutral explanation instead of a success check or repeated reason', () => {
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleWorkspaceView: 'wallet',
      looperAgentWallet: {
        mode: 'read_only', reason: 'ownership_mismatch', tokenId: '1',
        account: '0x9999999999999999999999999999999999999999', nativeWei: '0', tokens: [],
        policyStatus: 'read-only', canTransact: false,
        activation: { state: 'idle' }, send: { state: 'idle' }, policy: { state: 'idle' },
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const panel = root.querySelector('.console-looper-wallet');
  const note = panel.querySelector('.console-looper-wallet-control-note');

  assert.equal(note?.getAttribute('data-wallet-tone'), 'warning');
  assert.equal(note?.querySelector(':scope > span')?.textContent, '!');
  assert.match(note?.textContent ?? '', /Transfers unavailable/i);
  assert.match(note?.textContent ?? '', /authority does not match the current Looper owner/i);
  assert.doesNotMatch(note?.textContent ?? '', /Read-only/i);
  assert.equal(panel.querySelector('.console-looper-wallet-reason'), null);
});

test('wrong-chain wallet state tells mobile users to switch to Base', () => {
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleWorkspaceView: 'wallet',
      looperAgentWallet: {
        mode: 'read_only', reason: 'wrong_chain', tokenId: '1',
        account: '0x9999999999999999999999999999999999999999', nativeWei: '0', tokens: [],
        policyStatus: 'read-only', canTransact: false,
        activation: { state: 'invalidated' }, send: { state: 'idle' }, policy: { state: 'idle' },
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const note = root.querySelector('.console-looper-wallet-control-note');

  assert.match(note?.textContent ?? '', /switch your wallet network to Base/i);
});

test('Multipass Console snapshot frames onchain agent operations without collection-specific copy', () => {
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
    },
  });

  assert.equal(snapshot.title, 'Multipass Console');
  assert.equal(snapshot.session.nextAction.title, 'Open a room');
  assert.match(snapshot.session.nextAction.body, /first mission/i);
  assert.equal(snapshot.session.status.find((item) => item.label === 'Wallet')?.value, '0x1234...5678');
  assert.equal(snapshot.session.status.find((item) => item.label === 'Agent')?.value, 'Bendr 2.0');
  assert.equal(snapshot.session.status.find((item) => item.label === 'Chat')?.value, 'live chat');
  assert.equal(snapshot.session.status.find((item) => item.label === 'Memory')?.value, 'Standby');
  assert.equal(snapshot.session.wallet.label, '0x1234...5678 (you)');
  assert.equal(snapshot.session.wallet.connected, true);
  assert.equal(snapshot.session.selectionEnabled, true);
  assert.equal(snapshot.session.options.length, 2);
  assert.deepEqual(snapshot.session.options.map((option) => option.label), ['Bendr 2.0', 'Quigbot']);
  assert.equal(snapshot.session.activeAgentId, '1');
  assert.match(snapshot.session.selectionHint, /open its room/i);
  assert.equal(snapshot.kicker, undefined);
  assert.equal(snapshot.identityCard.label, undefined);
  assert.equal(snapshot.identityCard.name, 'Bendr 2.0');
  assert.equal(snapshot.identityCard.rename?.value, 'Bendr 2.0');
  assert.equal(snapshot.identityCard.rename?.resettable, false);
  assert.equal(snapshot.identityCard.badges.length, 3);
  assert.equal(snapshot.identityCard.dossier.length, 4);
  assert.equal(snapshot.identityCard.stats.find((item) => item.label === 'Token')?.value, '#1');
  assert.equal(snapshot.identityCard.stats.find((item) => item.label === 'Cred')?.value, 'CRED 80 · PRIME');
  assert.equal(snapshot.identityCard.stats.find((item) => item.label === 'Mode')?.value, 'Review-only');
  assert.equal(snapshot.suiteChecks.length, 0);
  assert.equal(snapshot.agentThread.agentName, 'Bendr 2.0');
  assert.equal(snapshot.agents.length, 2);
  assert.equal(snapshot.agents[0].selected, true);
  assert.equal(snapshot.lead, undefined);
  assert.doesNotMatch(`${snapshot.headline} ${snapshot.agents.map((agent) => agent.name).join(' ')}`, /looper|legendary/i);
});

test('Multipass Console renderer includes memory missions and runtime checks as reviewed proposals', () => {
  const snapshot = createMultipassConsoleSnapshot({ agents: sampleAgents() });
  const root = render(renderMultipassConsole(snapshot));
  const text = root.textContent;

  assert.ok(root.querySelector('.multipass-console'));
  assert.ok(root.querySelector('.console-basic-shell'));
  assert.ok(root.querySelector('.console-wallet-panel'));
  assert.equal(root.querySelectorAll('.console-sidebar-drawer').length >= 2, true);
  assert.match(root.querySelector('.console-sidebar-drawer summary')?.textContent ?? '', /Agent name|Identity data|My agents|Current room/);
  assert.equal(root.querySelectorAll('.console-status-strip div').length, 0);
  assert.equal(root.querySelectorAll('.console-flow-panel li').length, 0);
  assert.ok(root.querySelector('.console-trust-rail'));
  const console = root.querySelector('.multipass-console');
  const main = root.querySelector('.console-basic-main');
  const proofRail = console?.querySelector(':scope > .console-proof-rail');
  assert.ok(proofRail);
  assert.equal(console?.firstElementChild, proofRail);
  assert.equal(proofRail.nextElementSibling?.classList.contains('console-basic-shell'), true);
  assert.equal(main?.querySelector(':scope > .console-proof-rail'), null);
  assert.equal(proofRail.tagName, 'DETAILS');
  assert.equal(proofRail.open, false);
  assert.equal(main?.firstElementChild?.classList.contains('console-agent-thread-panel'), true);
  assert.equal(main?.firstElementChild?.classList.contains('console-agent-thread-panel-empty'), true);
  assert.ok(root.querySelector('.console-workspace-nav-mobile'));
  assert.ok(root.querySelector('.console-workspace-sidebar .console-workspace-nav-sidebar'));
  assert.ok(root.querySelector('.console-identity-card'));
  assert.equal(root.querySelector('.console-identity-card')?.classList.contains('console-identity-card-empty'), true);
  assert.equal(root.querySelector('[data-action="update-console-agent-name"]'), null);
  assert.ok(root.querySelector('.console-thread-shell-header'));
  assert.equal(root.querySelector('.console-thread-chat-copy h2')?.textContent, 'Agent Private Chat');
  assert.equal(root.querySelector('.console-thread-chat-head .console-thread-avatar-chat'), null);
  assert.ok(root.querySelector('.console-thread-toolbar'));
  assert.equal(root.querySelector('.console-thread-formatting'), null);
  assert.equal(root.querySelector('.console-trust-graph-card'), null);
  assert.equal(root.querySelector('.console-agent-portrait img'), null);
  assert.match(root.querySelector('.console-agent-portrait')?.textContent ?? '', /No agent selected/i);
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Owned Loopers appear here after wallet sign-in/i);
  assert.equal(root.querySelector('.console-workspace-sidebar')?.children[2]?.classList.contains('console-identity-card'), true);
  assert.match(root.querySelector('.console-sidebar-header h1')?.textContent ?? '', /Multipass Console/);
  assert.equal(root.querySelector('.console-basic-shell')?.getAttribute('aria-label'), 'Agent console');
  assert.match(text, /Current room/);
  assert.match(text, /Choose agent/);
  assert.doesNotMatch(text, /Console name/);
  assert.match(text, /No room open/);
  assert.match(text, /Direct thread/);
  assert.match(text, /Today/);
  assert.match(text, /Thread note/);
  assert.match(text, /Memory/);
  assert.match(text, /Send/);
  assert.match(text, /Hide chat locally/);
  assert.match(text, /Memory standby|Sibyl memory standing by/);
  assert.doesNotMatch(root.querySelector('.console-proof-rail')?.textContent ?? '', /Bankr-ready|Sibyl-ready/);
  assert.match(text, /live chat|XMTP ready|XMTP room/i);
  assert.match(text, /Review-only/);
  assert.doesNotMatch(text, /My agents/);
  assert.doesNotMatch(text, /The Console only loads real Loopers owned by the connected wallet/);
  assert.doesNotMatch(text, /Agent dossier|Agent Workspace/);
  assert.equal(root.querySelectorAll('[data-action="connect-console-wallet"]').length, 0);
  assert.doesNotMatch(text, /A quieter operator surface for wallet-owned agents|review proposals without the dashboard clutter/i);
  assert.doesNotMatch(text, /Tokenized equities|Vaults|Agent assets|What it&#39;s watching|What it's watching|signals feed/i);
  assert.equal(root.querySelector('[data-action="connect-console-wallet"]'), null);
  assert.equal(root.querySelector('[data-action="send-console-agent-message"] button[type="submit"]')?.disabled, true);
  assert.equal(root.querySelector('[data-action="reset-console-session"]')?.disabled, true);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.disabled, true);
  assert.match(root.querySelector('.console-wallet-panel')?.textContent ?? '', /Sign in to load owned Loopers\./);
  assert.doesNotMatch(root.querySelector('.console-wallet-panel')?.textContent ?? '', /Pick an agent to open its room/);
  assert.doesNotMatch(text, /Use the header button|Use the top-right wallet control/i);
  assert.doesNotMatch(root.querySelector('.console-identity-card')?.textContent ?? '', /Wallet required|No wallet connected/i);
  assert.match(text, /Review-only\. Nothing executes without your approval/i);
  assert.match(text, /Owned Loopers appear here after wallet sign-in\./i);
  assert.equal((text.match(/Connect wallet/gi) ?? []).length, 0);
  assert.doesNotMatch(text, /Direct line to Quigley|mouthy night-shift/i);
  assert.equal(root.querySelector('.console-thread-room-state'), null);
  assert.equal(root.querySelector('.console-thread-status'), null);
  assert.doesNotMatch(text, /NFT dashboard|Legendary|custody transferred|credentials released|tool authority granted|private credentials available/i);
});

test('Multipass Console renderer includes agent runtime messages and review-only proposals', () => {
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleParticipantAgentIds: ['1', '81'],
      consoleAgentThread: {
        status: 'received',
        title: 'Legacy arbitrary room title',
        transport: 'xmtp_local',
        memoryProvider: 'local_sibyl_adapter',
        inferenceProvider: 'bankr_llm_gateway',
        roomName: 'Bendr 2.0 + 1 room',
        participants: [
          { participantId: '1', tokenId: '1', displayName: 'Bendr 2.0', role: 'Lead agent' },
          { participantId: '81', tokenId: '81', displayName: 'Quigbot', role: 'Strategy agent' },
        ],
        messages: [
          { role: 'human', text: 'Watch NVDAx and Base agent tokens.', transport: 'console' },
          { role: 'agent', senderLabel: 'Bendr 2.0', text: 'Saved. I will prepare review-only proposals.', transport: 'xmtp_local', inferenceProvider: 'bankr_llm_gateway' },
          { role: 'agent', senderLabel: 'Quigbot', text: 'I will track sentiment and summarize changes.', transport: 'xmtp_local', inferenceProvider: 'bankr_llm_gateway' },
        ],
        proposals: [
          {
            status: 'review_only',
            title: 'Review watchlist briefing',
            action: 'Keep monitoring before any execution.',
            risk: 'No transaction authority is attached to this proposal.',
          },
        ],
        savedMemory: [
          { text: 'Watchlist preference: NVDAx and Base agent tokens.', tags: ['watchlist'] },
          { text: 'Constraint: review-only proposals.', tags: ['constraint'] },
        ],
        missions: [
          { id: 'mission_watchlist', title: 'Active watchlist', status: 'active', summary: 'Watch NVDAx and Base agent tokens.' },
        ],
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const text = root.textContent;

  assert.equal(root.querySelector('[data-action="send-console-agent-message"] button[type="submit"]')?.disabled, false);
  assert.equal(root.querySelector('[data-action="reset-console-session"]')?.disabled, false);
  assert.equal(root.querySelector('[data-action="select-console-agent"]')?.value, '1');
  assert.equal(root.querySelector('[data-action="select-console-agent"] option:checked')?.textContent, 'Bendr 2.0');
  assert.match(root.querySelector('.console-main-roster-drawer > summary')?.textContent ?? '', /Bendr 2\.0/);
  assert.equal(root.querySelector('.console-thread-chat-copy h2')?.textContent, 'Bendr 2.0 Private Chat');
  assert.doesNotMatch(root.querySelector('.console-thread-chat-copy h2')?.textContent ?? '', /Legacy arbitrary room title/);
  assert.equal(root.querySelector('.console-thread-chat-head .console-thread-avatar-chat'), null);
  assert.match(root.querySelector('.console-identity-card')?.textContent ?? '', /Bendr 2\.0/);
  assert.match(root.querySelector('.console-thread-shell-meta')?.textContent ?? '', /3 messages, 1 queued/);
  assert.ok(root.querySelector('.console-thread-toolbar'));
  assert.match(root.querySelector('.console-thread-member-list')?.textContent ?? '', /Bendr 2\.0/);
  assert.match(root.querySelector('.console-thread-member-list')?.textContent ?? '', /Quigbot/);
  assert.match(root.querySelector('.console-identity-members-list')?.textContent ?? '', /Bendr 2\.0/);
  const identityDrawerSummaries = [...root.querySelectorAll('.console-identity-card .console-sidebar-drawer summary')]
    .map((summary) => summary.textContent ?? '');
  assert.ok(identityDrawerSummaries.some((summary) => /Identity data/.test(summary)));
  assert.ok(identityDrawerSummaries.some((summary) => /Participants/.test(summary)));
  assert.match(text, /Watch NVDAx/);
  assert.match(text, /Saved/);
  assert.match(text, /Quigbot/);
  assert.match(text, /Review watchlist briefing/);
  assert.match(text, /No transaction authority/);
  assert.match(text, /Room notes/);
  assert.match(text, /Memory loaded/);
  assert.match(text, /Mission active/);
  assert.match(text, /Review queue/);
  assert.match(text, /Bankr gateway/);
  assert.match(text, /2 pinned/);
  assert.match(text, /2 memory cues ready/);
  assert.match(text, /2 participants in room/);
  assert.equal(root.querySelector('.console-proposal-list'), null);
  assert.match(root.querySelector('.console-thread-proposal')?.textContent ?? '', /Review gate/);
  assert.match(root.querySelector('.console-thread-context-summary')?.textContent ?? '', /Room notes/);
  assert.equal(root.querySelector('.console-thread-quickfacts'), null);
});

test('Multipass Console labels an agent plus authenticated holder as room participants, not two agents', () => {
  const [agent] = sampleAgents();
  const snapshot = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
      consoleParticipantAgentIds: ['1'],
      consoleAgentThread: {
        status: 'received',
        transport: 'xmtp_group',
        participants: [
          { kind: 'agent', participantId: 'erc8004:1', tokenId: '1', agentId: '1', displayName: 'Bendr 2.0', role: 'Looper runtime' },
          { kind: 'operator', participantId: 'wallet:0x1234', wallet: '0x1234567890abcdef1234567890abcdef12345678', displayName: 'Authenticated holder', role: 'Operator' },
        ],
        messages: [],
      },
    },
  });
  const text = render(renderMultipassConsole(snapshot)).textContent;

  assert.match(text, /2 participants in room/i);
  assert.match(text, /2 room participants are sharing this thread|2 participants in room/i);
  assert.doesNotMatch(text, /2 wallet-owned agents|2 participating agents|2 agents in room/i);
});

test('Multipass Console proof rail spans above both panels and only labels exact runtime evidence', () => {
  const [agent] = sampleAgents();
  agent.erc8004AgentId = 87069;
  const snapshot = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
      consoleAgentThread: {
        status: 'received',
        transport: 'xmtp_group',
        conversationId: 'conversation-1',
        memoryProvider: 'sibyl_memory',
        inferenceProvider: 'bankr_llm_gateway',
        executionMode: 'review_only',
        messages: [{ role: 'agent', text: 'Verified response.', inferenceProvider: 'bankr_llm_gateway' }],
        proposals: [{ status: 'review_only', executable: false, title: 'Review this' }],
        savedMemory: [{ text: 'Saved preference.' }, { text: 'Saved constraint.' }],
        recalledMemory: [{ text: 'Recalled mission.' }],
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const console = root.querySelector('.multipass-console');
  const shell = root.querySelector('.console-basic-shell');
  const main = root.querySelector('.console-basic-main');
  const rail = console?.querySelector(':scope > .console-proof-rail');

  assert.ok(rail);
  assert.equal(console?.firstElementChild, rail);
  assert.equal(rail.nextElementSibling, shell);
  assert.equal(shell?.contains(rail), false);
  assert.equal(main?.querySelector(':scope > .console-proof-rail'), null);
  assert.match(rail.textContent, /Bankr gateway/);
  assert.match(rail.textContent, /XMTP live/);
  assert.match(rail.textContent, /Sibyl saved 2/);
  assert.match(rail.textContent, /Sibyl recalled 1/);
  assert.match(rail.textContent, /ERC-8004 #87069/);
  assert.match(rail.textContent, /Review-only/);
  assert.equal(rail.tagName, 'DETAILS');
  assert.equal(rail.open, false);
});

test('Multipass Console withholds proof labels for readiness strings and incomplete evidence', () => {
  const [agent] = sampleAgents();
  agent.erc8004AgentId = 0;
  const snapshot = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
      consoleAgentThread: {
        transport: 'xmtp_group',
        conversationId: '',
        memoryProvider: 'Sibyl-ready',
        inferenceProvider: 'Bankr-ready',
        proposals: [{ status: 'pending', executable: true }],
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const railText = root.querySelector('.console-proof-rail')?.textContent ?? '';

  assert.doesNotMatch(railText, /Bankr gateway|Bankr-ready/);
  assert.doesNotMatch(railText, /XMTP live/);
  assert.doesNotMatch(railText, /Sibyl memory|Sibyl saved|Sibyl recalled|Sibyl-ready/);
  assert.doesNotMatch(railText, /ERC-8004/);
  assert.doesNotMatch(railText, /Review-only|Approval/);
  assert.match(railText, /No verified runtime proof yet/);
});

test('Multipass Console features the selected identity portrait and names local clearing honestly', () => {
  const [agent] = sampleAgents();
  agent.erc8004AgentId = 87069;
  agent.image = 'https://example.test/looper.png';
  const root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
      consoleAgentThread: { messages: [{ role: 'agent', text: 'Hello.' }] },
    },
  })));
  const identity = root.querySelector('.console-identity-card');

  assert.equal(identity?.classList.contains('console-identity-card-compact'), false);
  assert.ok(identity?.firstElementChild?.classList.contains('console-agent-portrait'));
  const portraitImage = identity?.querySelector('.console-agent-portrait img[data-console-avatar-image]');
  const portraitFallback = identity?.querySelector('.console-agent-portrait .console-thread-avatar-fallback');
  assert.equal(portraitImage?.getAttribute('src'), 'https://example.test/looper.png');
  assert.equal(portraitImage?.getAttribute('alt'), '');
  assert.equal(portraitFallback?.textContent, 'B2');
  assert.equal(portraitFallback?.hidden, true);
  assert.match(identity?.textContent ?? '', /Bendr 2\.0/);
  assert.match(identity?.textContent ?? '', /Token #1/);
  assert.match(identity?.textContent ?? '', /ERC-8004 #87069/);
  assert.equal([...identity?.querySelectorAll('details') ?? []].every((detail) => !detail.open), true);
  assert.equal(root.querySelector('[data-action="reset-console-session"]')?.textContent.trim(), 'Hide chat locally');
  assert.ok(root.querySelector('.console-thread-secondary-details [data-action="reset-console-session"]'));
  assert.equal(root.querySelector('.console-thread-composer [data-action="reset-console-session"]'), null);
  assert.ok(root.querySelector('.console-send-button svg'));
  assert.match(root.querySelector('.console-proof-rail')?.textContent ?? '', /Verified runtime proof/);
  assert.doesNotMatch(root.textContent, /\$(?:CRED|BANKR|DRB)\b/);
  assert.doesNotMatch(root.textContent, /fresh-session|Session recall/i);
});

test('Multipass Console does not present a client reset flag as fresh-session proof', () => {
  const snapshot = createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleAgentThread: {
        status: 'reset',
        sessionReset: true,
        recalledMission: 'I remember this wallet 0x1234...5678. Active mission: Cred tier, public proof, route health, and mission changes. Constraint: review-only proposals. No execution path is attached.',
        savedMemory: [
          { text: 'Watchlist preference: Cred tier, public proof, route health, and mission changes.', tags: ['watchlist'] },
        ],
        recalledMemory: [
          { text: 'Server-backed recall evidence.', tags: ['recall'] },
        ],
        messages: [],
        proposals: [],
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const text = root.textContent;

  assert.match(text, /Room notes/);
  assert.doesNotMatch(text, /Session recall|fresh-session/i);
  assert.match(text, /Sibyl recall/);
  assert.match(text, /I remember this wallet/);
  assert.match(text, /review-only proposals/);
  assert.equal(root.querySelector('.console-signal-grid'), null);
  assert.match(root.querySelector('.console-thread-activity')?.textContent ?? '', /Sibyl recall/);
});

test('Multipass Console renders no recall activity without server-backed recalled memory entries', () => {
  const root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleAgentThread: {
        messages: [],
        memoryProvider: 'sibyl_memory',
      },
    },
  })));

  const threadText = root.querySelector('.console-agent-thread-panel')?.textContent ?? '';
  assert.equal(root.querySelector('.console-thread-activity-recall'), null);
  assert.doesNotMatch(threadText, /Prior room memory loaded|Sibyl recall|No recalled memory yet/);
});

test('Multipass Console proof gates require response-level and explicit array evidence', () => {
  const [agent] = sampleAgents();
  const renderProof = (thread) => render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
      consoleAgentThread: thread,
    },
  }))).querySelector('.console-proof-rail')?.textContent ?? '';

  const omittedEvidence = renderProof({
    inferenceProvider: 'bankr_llm_gateway',
    memoryProvider: 'sibyl_memory',
    executionMode: 'review_only',
    messages: [{ role: 'human', text: 'Mission', inferenceProvider: 'bankr_llm_gateway' }],
    proposals: [{ status: 'review_only' }],
  });
  assert.doesNotMatch(omittedEvidence, /Bankr gateway|Sibyl saved|Sibyl recalled|Review-only/);

  const exactEvidence = renderProof({
    inferenceProvider: 'bankr_llm_gateway',
    memoryProvider: 'sibyl_memory',
    executionMode: 'review_only',
    messages: [{ role: 'agent', text: 'Response', inferenceProvider: 'bankr_llm_gateway' }],
    savedMemory: [],
    recalledMemory: [{ text: 'Server recall' }],
    proposals: [{ status: 'review_only', executable: false }],
  });
  assert.match(exactEvidence, /Bankr gateway/);
  assert.match(exactEvidence, /Sibyl saved 0/);
  assert.match(exactEvidence, /Sibyl recalled 1/);
  assert.match(exactEvidence, /Review-only/);
});

test('Multipass Console withholds Review-only proof for contradictory execution flags', () => {
  const agents = sampleAgents();
  for (const proposal of [
    { status: 'review_only', executable: true, executionEnabled: false },
    { status: 'review_only', executable: false, executionEnabled: true },
  ]) {
    const snapshot = createMultipassConsoleSnapshot({
      agents,
      state: {
        walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
        consoleOwnedAgents: { status: 'loaded', agents },
        consoleSelectedAgentId: '1',
        consoleAgentThread: {
          executionMode: 'review_only',
          proposals: [proposal],
        },
      },
    });

    assert.equal(snapshot.suiteChecks.some((check) => check.value === 'Review-only'), false);
  }
});

test('Multipass Console places mobile navigation and chat before sidebar content in document order', () => {
  const root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleAgentThread: { messages: [] },
    },
  })));
  const shell = root.querySelector('.console-basic-shell');

  assert.equal(shell?.firstElementChild?.classList.contains('console-agent-switcher-mobile'), true);
  assert.equal(shell?.children[1]?.classList.contains('console-workspace-nav-mobile'), true);
  assert.equal(shell?.children[2]?.classList.contains('console-basic-main'), true);
  assert.equal(shell?.children[3]?.classList.contains('console-basic-sidebar'), true);
});

test('Multipass Console places the active desktop roster above both aligned workspace panels', () => {
  const root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleAuthenticatedWallet: '0x1234567890abcdef1234567890abcdef12345678',
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleAgentThread: { messages: [] },
    },
  })));
  const shell = root.querySelector('.console-basic-shell');
  const main = root.querySelector('.console-basic-main');
  const roster = shell?.querySelector(':scope > .console-main-roster-drawer');

  assert.ok(roster);
  assert.match(roster.querySelector('summary')?.textContent ?? '', /My agents/i);
  assert.equal(main?.querySelector(':scope > .console-main-roster-drawer'), null);
  assert.equal(shell?.querySelectorAll('.console-main-roster-drawer').length, 1);
});

test('Multipass Console identity drawer shows canonical facts instead of repeating the agent bio', () => {
  const agents = sampleAgents();
  agents[0].erc8004AgentId = 87069;
  const root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents,
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleAuthenticatedWallet: '0x1234567890abcdef1234567890abcdef12345678',
      consoleOwnedAgents: { status: 'loaded', agents },
      consoleSelectedAgentId: '1',
      consoleAgentThread: { messages: [] },
    },
  })));
  const identity = root.querySelector('.console-basic-sidebar .console-identity-card');
  const identityDrawer = [...identity?.querySelectorAll('.console-sidebar-drawer') ?? []]
    .find((drawer) => /Identity data/i.test(drawer.querySelector('summary')?.textContent ?? ''));
  const facts = identityDrawer?.querySelector('.console-identity-data');

  assert.ok(identityDrawer);
  assert.ok(facts);
  assert.match(facts.textContent, /Collection\s*Loopers/i);
  assert.match(facts.textContent, /Token\s*#1/i);
  assert.match(facts.textContent, /Chain\s*Base \(8453\)/i);
  assert.match(facts.textContent, /CRED\s*80/i);
  assert.match(facts.textContent, /ERC-8004\s*#87069/i);
  assert.doesNotMatch(identityDrawer.textContent, /Lead agent in a direct thread/i);
  assert.doesNotMatch(identity?.textContent ?? '', /Identity profile/i);
});

test('Multipass Console associates the visible composer label with its textarea', () => {
  const root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: sampleAgents(),
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: sampleAgents() },
      consoleSelectedAgentId: '1',
      consoleAgentThread: { messages: [] },
    },
  })));
  const textarea = root.querySelector('.console-thread-composer textarea');
  const label = root.querySelector('.console-thread-composer-label');

  assert.ok(textarea?.id);
  assert.equal(label?.htmlFor, textarea.id);
});

test('Multipass Console keeps participants and technical room context in closed secondary details', () => {
  const agents = sampleAgents();
  const root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents,
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents },
      consoleSelectedAgentId: '1',
      consoleAgentThread: {
        transport: 'xmtp_group',
        roomName: 'Bendr review room',
        participants: [
          { participantId: '1', displayName: 'Bendr 2.0', role: 'Lead agent' },
          { participantId: '81', displayName: 'Quigbot', role: 'Strategy agent' },
        ],
        messages: [{ role: 'agent', senderLabel: 'Bendr 2.0', text: 'Room ready.', transport: 'xmtp_group' }],
      },
    },
  })));
  const details = root.querySelector('.console-thread-secondary-details');
  const header = root.querySelector('.console-thread-shell-header');

  assert.ok(details);
  assert.equal(details.open, false);
  assert.ok(details.querySelector('.console-thread-members'));
  assert.ok(details.querySelector('.console-thread-shell-meta'));
  assert.match(details.textContent, /Bendr review room|XMTP room/i);
  assert.equal(header?.querySelector('.console-thread-members'), null);
  assert.equal(header?.querySelector('.console-thread-shell-meta'), null);
});

test('Console CRED normalization uses only canonical CRED and never token-specific or legacy fallback values', () => {
  const available = canonicalCred(40, 'MARGINAL');
  const stale = canonicalCred(41, 'MARGINAL', {
    status: 'stale',
    freshness: {
      status: 'stale', stale: true, cached: true, ageSeconds: 901,
      maxAgeSeconds: 300, staleIfErrorSeconds: 86400, reason: 'upstream_timeout',
    },
  });
  assert.deepEqual(normalizeConsoleCred({ tokenId: '614', cred: available, credScore: 65, credLabel: 'Cred 65' }), {
    cred: available,
    credScore: 40,
    credLabel: 'CRED 40 · MARGINAL',
  });
  assert.deepEqual(normalizeConsoleCred({ tokenId: '614', cred: stale }), {
    cred: stale,
    credScore: 41,
    credLabel: 'CRED 41 · MARGINAL · STALE',
  });
  assert.deepEqual(normalizeConsoleCred({ tokenId: '614', credScore: 65, credLabel: 'Cred 65' }), {
    cred: null,
    credScore: null,
    credLabel: 'CRED pending',
  });
  assert.deepEqual(normalizeConsoleCred({ tokenId: '615', cred: { status: 'unavailable', score: null } }), {
    cred: { status: 'unavailable', score: null },
    credScore: null,
    credLabel: 'CRED unavailable',
  });
});

test('Console renders canonical score, evidence coverage, freshness, and escaped unavailable states', () => {
  const freshAgent = {
    ...sampleAgents()[0],
    tokenId: '614',
    name: '<img src=x onerror=alert(1)>',
    erc8004AgentId: '87043',
    cred: canonicalCred(40, 'MARGINAL'),
  };
  const freshRoot = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: [freshAgent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleAuthenticatedWallet: '0x1234567890abcdef1234567890abcdef12345678',
      consoleOwnedAgents: { status: 'loaded', agents: [freshAgent] },
      consoleSelectedAgentId: '614',
    },
  })));
  assert.match(freshRoot.textContent, /CRED 40.*MARGINAL/s);
  assert.match(freshRoot.textContent, /GOOD.*70%|70%.*GOOD/s);
  assert.match(freshRoot.textContent, /Fresh/);
  assert.equal(freshRoot.querySelector('img[src="x"]'), null);

  const staleAgent = {
    ...freshAgent,
    tokenId: '615',
    name: 'Looper #615',
    cred: canonicalCred(41, 'MARGINAL', {
      status: 'stale',
      freshness: {
        status: 'stale', stale: true, cached: true, ageSeconds: 901,
        maxAgeSeconds: 300, staleIfErrorSeconds: 86400, reason: 'upstream_timeout',
      },
    }),
  };
  const unavailableAgent = {
    ...freshAgent,
    tokenId: '616',
    name: 'Looper #616',
    cred: { status: 'unavailable', score: null, error: { code: '<script>alert(1)</script>' } },
  };
  const rosterRoot = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: [staleAgent, unavailableAgent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleAuthenticatedWallet: '0x1234567890abcdef1234567890abcdef12345678',
      consoleOwnedAgents: { status: 'loaded', agents: [staleAgent, unavailableAgent] },
      consoleSelectedAgentId: null,
      consoleMainRosterOpen: true,
    },
  })));
  assert.match(rosterRoot.textContent, /CRED 41.*STALE/s);
  assert.match(rosterRoot.textContent, /Evidence GOOD.*70%/s);
  assert.match(rosterRoot.textContent, /CRED unavailable/);
  assert.equal(rosterRoot.querySelector('script'), null);
});

test('Multipass drawer is closed by default and exposes only available public facts and evidence', () => {
  const [agent] = sampleAgents();
  agent.image = 'https://example.test/looper.png';
  agent.erc8004AgentId = 87069;
  agent.wallet = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const snapshot = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnerProfile: { displayName: 'quigley.eth', avatarUrl: 'https://example.test/quigley.png' },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
      consoleAgentThread: {
        conversationId: 'conversation-1', transport: 'xmtp_group', inferenceProvider: 'bankr_llm_gateway',
        messages: [{ role: 'agent', text: 'Ready.', inferenceProvider: 'bankr_llm_gateway' }],
      },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  const drawer = root.querySelector('details.console-multipass-drawer');
  assert.ok(drawer);
  assert.equal(drawer.open, false);
  assert.equal(root.querySelector('.multipass-console')?.firstElementChild, drawer);
  assert.equal(drawer.nextElementSibling, root.querySelector('.console-basic-shell'));
  assert.equal(root.querySelector('.console-basic-main')?.contains(drawer), false);
  assert.match(drawer.querySelector('summary')?.textContent ?? '', /Verified runtime proof.*Bankr gateway.*XMTP live/s);
  assert.match(drawer.textContent, /Agent name.*Bendr 2\.0/s);
  assert.match(drawer.textContent, /Owner.*quigley\.eth/s);
  assert.match(drawer.textContent, /Token.*#1/s);
  assert.match(drawer.textContent, /ERC-8004.*#87069/s);
  assert.match(drawer.textContent, /Cred.*CRED 80 · PRIME/s);
  assert.doesNotMatch(drawer.textContent, /Sibyl/);
});

test('Console uses Agent name, removes instructions, and keeps safety outside Temper', () => {
  const [agent] = sampleAgents();
  agent.temperament = 'Blunt, spicy, review-only';
  agent.temperamentBody = 'Review-only personality with sharp answers.';
  const root = render(renderMultipassConsole(createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
    },
  })));
  const temper = [...root.querySelectorAll('.console-identity-dossier-entry')].find((entry) => /Temper/.test(entry.textContent));
  assert.doesNotMatch(temper?.textContent ?? '', /review-only/i);
  assert.match(root.querySelector('.console-thread-actions-note')?.textContent ?? '', /Nothing executes without your approval/i);
  assert.match(root.textContent, /Agent name/);
  assert.doesNotMatch(root.textContent, /Console name/);
  assert.doesNotMatch(root.textContent, /Agent selection lives under My agents\.|The Console only loads real Loopers owned by the connected wallet\./);
});

test('Console decorates messages from current roles and rejects stale or unsafe avatars', () => {
  const [agent] = sampleAgents();
  agent.image = 'https://example.test/looper.png';
  const snapshot = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnerProfile: { displayName: 'quigley.eth', avatarUrl: 'https://example.test/quigley.png' },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
      consoleAgentThread: { messages: [
        { role: 'human', senderLabel: 'Stale holder', avatarUrl: 'javascript:alert(1)', text: 'Hello' },
        { role: 'agent', senderLabel: 'Stale agent', avatarUrl: 'https://stale.test/a.png', text: 'Ready' },
      ] },
    },
  });
  assert.deepEqual(snapshot.agentThread.messages.map(({ senderLabel, avatarUrl }) => ({ senderLabel, avatarUrl })), [
    { senderLabel: 'quigley.eth (you)', avatarUrl: 'https://example.test/quigley.png' },
    { senderLabel: 'Bendr 2.0', avatarUrl: 'https://example.test/looper.png' },
  ]);

  snapshot.agentThread.messages[0].avatarUrl = 'data:image/png;base64,bad';
  const root = render(renderMultipassConsole(snapshot));
  const humanAvatar = root.querySelector('.console-thread-message.human .console-thread-avatar');
  assert.equal(humanAvatar?.querySelector('img'), null);
  assert.match(humanAvatar?.textContent ?? '', /Q/);
  const agentAvatar = root.querySelector('.console-thread-message.agent .console-thread-avatar');
  assert.equal(agentAvatar?.querySelector('img')?.getAttribute('src'), 'https://example.test/looper.png');
  assert.ok(agentAvatar?.querySelector('.console-thread-avatar-fallback'));
});

test('Console truncates the wallet and marks it as you when ENS is unavailable', () => {
  const [agent] = sampleAgents();
  const wallet = '0x1234567890abcdef1234567890abcdef12345678';
  const snapshot = createMultipassConsoleSnapshot({
    agents: [agent],
    state: {
      walletSnapshot: { connected: true, address: wallet },
      consoleOwnedAgents: { status: 'loaded', agents: [agent] },
      consoleSelectedAgentId: '1',
      consoleAgentThread: { messages: [{ role: 'human', text: 'Hello' }] },
    },
  });
  const root = render(renderMultipassConsole(snapshot));
  assert.equal(snapshot.agentThread.messages[0].senderLabel, '0x1234...5678 (you)');
  assert.match(root.querySelector('.console-multipass-drawer')?.textContent ?? '', /Owner.*0x1234\.\.\.5678 \(you\)/s);
  assert.doesNotMatch(root.textContent, /0x1234567890abcdef1234567890abcdef12345678/i);
  assert.equal(root.querySelector('.console-thread-message.human .console-thread-avatar-fallback')?.textContent, '0X');
});

test('Multipass Console snapshot preserves separate capability and candidate response fields', () => {
  const agents = sampleAgents();
  const capabilities = {
    version: `sha256:${'c'.repeat(64)}`,
    skills: [{
      id: 'bankr', name: 'Bankr', summary: 'Bounded catalog knowledge.',
      capabilities: ['transfer'], enabledCapabilities: ['propose_transfer'],
      execution: 'human_review', credentialAccess: false, constraints: ['No direct execution.'],
    }],
  };
  const proposalCandidates = [{
    skill: 'bankr', assetType: 'native', assetContract: null,
    recipient: '0x2222222222222222222222222222222222222222', amountBaseUnits: '9',
    rationale: 'Exact current-message suggestion.', sourceMessageId: 'message-81', participantId: '81',
    sourceOrdinal: 0, skillRefs: ['bankr'],
  }];
  const snapshot = createMultipassConsoleSnapshot({
    agents,
    state: {
      walletSnapshot: { connected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
      consoleOwnedAgents: { status: 'loaded', agents },
      consoleSelectedAgentId: '1',
      consoleParticipantAgentIds: ['1', '81'],
      consoleAgentThread: {
        messages: [{ id: 'message-81', role: 'agent', participantId: '81', senderLabel: 'Quigbot', text: 'Suggestion.' }],
        participants: [{ participantId: '1', displayName: 'Bendr 2.0' }, { participantId: '81', displayName: 'Quigbot' }],
        proposals: [{ status: 'review_only', title: 'Legacy review queue item' }],
        capabilities,
        proposalCandidates,
      },
    },
  });

  assert.strictEqual(snapshot.agentThread.capabilities, capabilities);
  assert.strictEqual(snapshot.agentThread.proposalCandidates, proposalCandidates);
  assert.equal(snapshot.agentThread.proposals.length, 1);
  assert.equal('amountBaseUnits' in snapshot.agentThread.proposals[0], false);
  const root = render(renderMultipassConsole(snapshot));
  assert.equal(root.querySelectorAll('.console-unverified-transfer').length, 1);
  assert.match(root.querySelector('.console-thread-proposal')?.textContent ?? '', /Legacy review queue item/);
});
