const {ethers} = require('ethers');
const fs = require('fs');
require('dotenv').config();

const V2_CONTRACT_ADDRESS = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

const missing = [28,29,30,32,40,41,42,44,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,96,97,99];

function build8004RegistrationFile(tokenId, name, framework, narrative) {
    let description;
    if (narrative?.mission) description = narrative.mission;
    else if (narrative?.origin) description = narrative.origin;
    else description = `${name} — AI agent on Base (${framework}).`;
    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name, description,
        image: `https://api.helixa.xyz/api/v2/agent/${tokenId}/card.png`,
        services: [{ name: 'web', endpoint: `https://helixa.xyz/agent/${tokenId}` }],
        x402Support: true, active: true,
        registrations: [{ agentId: tokenId, agentRegistry: `eip155:8453:${V2_CONTRACT_ADDRESS}` }],
    };
}

(async () => {
    const readProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const writeProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(process.env.DEPLOYER_KEY, writeProvider);
    
    const v2Abi = JSON.parse(fs.readFileSync('out/HelixaV2.sol/HelixaV2.json')).abi;
    const v2 = new ethers.Contract(V2_CONTRACT_ADDRESS, v2Abi, readProvider);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, [
        'function register(string) returns (uint256)',
        'function transferFrom(address,address,uint256)'
    ], wallet);

    // Fetch all agent data via metadata API (faster than individual contract calls)
    console.log('Fetching agent data for', missing.length, 'tokens...');
    let agents = [];
    for (const id of missing) {
        try {
            const resp = await fetch(`https://api.helixa.xyz/api/v2/metadata/${id}`);
            const meta = await resp.json();
            const attrs = meta.attributes || [];
            const name = meta.name || 'Agent #' + id;
            const framework = (attrs.find(a => a.trait_type === 'framework') || {}).value || 'unknown';
            const mission = (attrs.find(a => a.trait_type === 'mission') || {}).value;
            const origin = (attrs.find(a => a.trait_type === 'origin') || {}).value;
            
            // Get agentAddress from contract
            const a = await v2.getAgent(id);
            agents.push({ id, name, framework, addr: a.agentAddress, narrative: { mission, origin } });
            if (agents.length % 10 === 0) console.log('  Fetched', agents.length + '/' + missing.length);
        } catch(e) {
            console.error('  Failed to fetch #' + id + ':', e.message?.slice(0,50));
        }
    }

    let nonce = await writeProvider.getTransactionCount(wallet.address, 'pending');
    console.log('Starting nonce:', nonce);
    let ok = 0, fail = 0;
    let transfers = []; // {regTokenId, agentAddr}

    // Phase 1: Register all
    for (const agent of agents) {
        const regFile = build8004RegistrationFile(agent.id, agent.name, agent.framework, agent.narrative);
        const dataURI = 'data:application/json;base64,' + Buffer.from(JSON.stringify(regFile)).toString('base64');
        try {
            const tx = await registry['register(string)'](dataURI, { nonce, gasLimit: 300000 });
            console.log('REG V2#' + agent.id + ' ' + agent.name + ' TX:' + tx.hash.slice(0,12) + ' n=' + nonce);
            // Parse Transfer event to get registry tokenId
            const receipt = await tx.wait();
            const transferLog = receipt.logs.find(l => l.topics[0] === ethers.id('Transfer(address,address,uint256)'));
            if (transferLog) {
                const regTokenId = Number(BigInt(transferLog.topics[3]));
                transfers.push({ regTokenId, agentAddr: agent.addr, v2Id: agent.id, name: agent.name });
            }
            nonce++;
            ok++;
            if (ok % 10 === 0) {
                console.log('--- Registered ' + ok + '/' + agents.length + ' ---');
            }
        } catch (e) {
            console.error('X REG V2#' + agent.id + ': ' + (e.shortMessage || e.message));
            fail++;
            await new Promise(r => setTimeout(r, 3000));
            nonce = await writeProvider.getTransactionCount(wallet.address, 'pending');
        }
    }
    console.log('\nRegistration done. OK:', ok, 'Fail:', fail);
    
    // Phase 2: Transfer to agent wallets
    const deployer = wallet.address;
    const toTransfer = transfers.filter(t => t.agentAddr.toLowerCase() !== deployer.toLowerCase());
    console.log('\nTransferring', toTransfer.length, 'to agent wallets...');
    
    nonce = await writeProvider.getTransactionCount(wallet.address, 'pending');
    let tok = 0, tfail = 0;
    for (const t of toTransfer) {
        try {
            const tx = await registry.transferFrom(deployer, t.agentAddr, t.regTokenId, { nonce, gasLimit: 80000 });
            console.log('XFER V2#' + t.v2Id + ' ' + t.name + ' 8004#' + t.regTokenId + ' -> ' + t.agentAddr.slice(0,10) + ' n=' + nonce);
            nonce++;
            tok++;
            if (tok % 10 === 0) {
                console.log('--- Transferred ' + tok + '/' + toTransfer.length + ' ---');
                await new Promise(r => setTimeout(r, 2000));
            }
        } catch (e) {
            console.error('X XFER V2#' + t.v2Id + ': ' + (e.shortMessage || e.message));
            tfail++;
            await new Promise(r => setTimeout(r, 3000));
            nonce = await writeProvider.getTransactionCount(wallet.address, 'pending');
        }
    }
    console.log('\nTransfer done. OK:', tok, 'Fail:', tfail);
    console.log('TOTAL: Registered', ok, 'Transferred', tok);
})();
