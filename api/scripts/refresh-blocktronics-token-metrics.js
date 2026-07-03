#!/usr/bin/env node
const fs = require('node:fs');
const Database = require('better-sqlite3');
const metrics = require('../services/blocktronics-token-metrics');
const coveredTokenConfig = require('../config/blocktronics-covered-tokens.json');

const DB_PATH = process.env.TERMINAL_DB_PATH || '/home/ubuntu/.openclaw/workspace/terminal/data/terminal.db';
const allowPaid = process.env.BLOCKTRONICS_ALLOW_PAID_REFRESH === '1';
const PRICE_USDC = Number(coveredTokenConfig.price_usdc || 0.04) || 0.04;

function usage() {
    return [
        'Usage: refresh-blocktronics-token-metrics.js [--dry-run] (--token <address> | --all-covered) [--limit <count>] [--chain base]',
        '',
        'Default with no target is dry-run --all-covered --limit 5.',
        'Paid execution requires BLOCKTRONICS_ALLOW_PAID_REFRESH=1 and DEPLOYER_KEY or AGENT_PRIVATE_KEY.',
    ].join('\n');
}

function codedError(code, message = code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function readOptionValue(argv, index, flag) {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
        throw codedError('invalid_args', `${flag} requires a value`);
    }
    return value;
}

function parseArgs(argv) {
    const options = {
        token: null,
        allCovered: false,
        dryRun: false,
        chain: 'base',
        limit: null,
        help: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--token') {
            options.token = readOptionValue(argv, i, arg);
            i += 1;
        } else if (arg === '--all-covered') {
            options.allCovered = true;
        } else if (arg === '--limit') {
            const raw = readOptionValue(argv, i, arg);
            const parsed = Number(raw);
            if (!Number.isInteger(parsed) || parsed < 1) {
                throw codedError('invalid_args', '--limit must be a positive integer');
            }
            options.limit = parsed;
            i += 1;
        } else if (arg === '--chain') {
            options.chain = readOptionValue(argv, i, arg);
            i += 1;
        } else {
            throw codedError('invalid_args', `unknown option: ${arg}`);
        }
    }

    if (options.help) return options;

    options.chain = metrics.normalizeChain(options.chain);

    if (options.token && options.allCovered) {
        throw codedError('invalid_args', 'choose either --token or --all-covered, not both');
    }

    if (!options.token && !options.allCovered) {
        options.dryRun = true;
        options.allCovered = true;
    }

    if (options.allCovered && options.limit === null) {
        options.limit = 5;
    }

    if (options.token) {
        options.token = normalizeCoveredToken(options.token, options.chain).address;
    }

    options.paid = !options.dryRun && Boolean(options.token || options.allCovered);
    return options;
}

function coveredMeta(address) {
    const normalized = metrics.normalizeTokenAddress(address);
    return coveredTokenConfig.tokens.find((token) => metrics.normalizeTokenAddress(token.address) === normalized) || null;
}

function normalizeCoveredToken(token, chain) {
    const address = metrics.normalizeTokenAddress(token);
    if (!metrics.isCoveredToken(address, chain)) {
        throw codedError('unknown_token', `unsupported token: ${address}`);
    }
    const meta = coveredMeta(address);
    return {
        symbol: meta?.symbol || null,
        address,
        chain: metrics.normalizeChain(chain),
    };
}

function openReadonlyDb(dbPath) {
    if (dbPath === ':memory:') {
        return new Database(dbPath);
    }
    if (!fs.existsSync(dbPath)) {
        return null;
    }
    return new Database(dbPath, { readonly: true, fileMustExist: true });
}

function openWritableDb(dbPath) {
    return new Database(dbPath);
}

function resolveCandidates(options, db) {
    if (options.token) {
        return [normalizeCoveredToken(options.token, options.chain)];
    }

    if (!options.allCovered) {
        return [];
    }

    return metrics.selectRefreshCandidates(db, {
        chain: options.chain,
        limit: options.limit,
    }).map((candidate) => normalizeCoveredToken(candidate.address, candidate.chain));
}

function formatUsdc(value) {
    return value.toFixed(2).replace(/\.00$/, '');
}

function printPlan(options, candidates) {
    console.log('Blocktronics token metrics refresh');
    console.log(`dry_run: ${options.dryRun ? 'true' : 'false'}`);
    console.log(`db_path: ${DB_PATH}`);
    console.log(`chain: ${options.chain}`);
    console.log(`targets: ${candidates.length}`);
    console.log(`cost_estimate: ${candidates.length} tokens * ${formatUsdc(PRICE_USDC)} USDC = ${formatUsdc(candidates.length * PRICE_USDC)} USDC`);
    console.log(`network: ${options.dryRun ? 'skipped' : 'paid x402 enabled'}`);
    console.log('candidates:');
    if (candidates.length === 0) {
        console.log('  []');
        return;
    }

    for (const candidate of candidates) {
        console.log(`  - symbol: ${candidate.symbol || 'unknown'}`);
        console.log(`    token: ${candidate.address}`);
        console.log(`    chain: ${candidate.chain}`);
    }
}

async function createPaidFetch() {
    const key = process.env.DEPLOYER_KEY || process.env.AGENT_PRIVATE_KEY;
    if (!key) throw codedError('missing_private_key', 'missing private key: set DEPLOYER_KEY or AGENT_PRIVATE_KEY');

    const { privateKeyToAccount } = require('viem/accounts');
    const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
    const { ExactEvmScheme } = require('@x402/evm/exact/client');

    const account = privateKeyToAccount(key);
    const client = new x402Client();
    client.register('eip155:*', new ExactEvmScheme(account));
    return wrapFetchWithPayment(fetch, client);
}

async function runPaidRefresh(db, candidates, paidFetch) {
    if (candidates.length === 0) {
        console.log('No refresh candidates selected.');
        return;
    }

    for (const candidate of candidates) {
        console.log(`fetching: ${candidate.symbol || candidate.address} (${candidate.address})`);
        const record = await metrics.fetchBlocktronicsTokenMetrics({
            token: candidate.address,
            chain: candidate.chain,
            fetchImpl: paidFetch,
        });
        metrics.upsertTokenMetricsCache(db, record);
        console.log(`cached: ${candidate.address} status=${record.status} fetched_at=${record.fetched_at}`);
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        console.log(usage());
        return;
    }

    if (options.paid && !allowPaid) {
        throw codedError('paid_refresh_disabled', 'paid refresh requires BLOCKTRONICS_ALLOW_PAID_REFRESH=1');
    }

    let selectionDb = null;
    let writeDb = null;
    try {
        if (options.allCovered && !options.token) {
            selectionDb = openReadonlyDb(DB_PATH);
        }

        const candidates = resolveCandidates(options, selectionDb);
        if (selectionDb) {
            selectionDb.close();
            selectionDb = null;
        }

        printPlan(options, candidates);

        if (options.dryRun) {
            console.log('Dry run only; no network request or database write was made.');
            return;
        }

        if (candidates.length === 0) {
            console.log('No refresh candidates selected.');
            return;
        }

        const paidFetch = await createPaidFetch();
        writeDb = openWritableDb(DB_PATH);
        metrics.ensureTokenMetricsTables(writeDb);
        await runPaidRefresh(writeDb, candidates, paidFetch);
    } finally {
        if (selectionDb) selectionDb.close();
        if (writeDb) writeDb.close();
    }
}

main().catch((err) => {
    const message = err && err.message ? err.message : String(err);
    console.error(`error: ${message}`);
    if (err && err.code === 'invalid_args') {
        console.error(usage());
    }
    process.exitCode = 1;
});
