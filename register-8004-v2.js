const {ethers} = require('ethers');
const fs = require('fs');
require('dotenv').config();

const V2_CONTRACT_ADDRESS = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

// Missing from 8004 registry (minus #28 which we just test-registered as token 18575)
// #29 already registered in debug test above
const missing = [30,32,40,41,42,44,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,96,97,99];

// Agent addresses from earlier getAgent() calls
const agentAddrs = {28:'0xD66F5Db9dD10dDFD82D8c23D6D998C6814a87692',29:'0x9dc9b20361cCC5215489b56E9f1874d64263a4B3',30:'0xDaB1960e62d59861C8c12245bF8c1E3576634252',32:'0x036B2FFeF3A3da51c2af61a1e00106EaFB877a17',40:'0x59c0450c43030Be30046C478193A0734C56D53e2',41:'0xe6A0bF8fF813Aa2631594De91b144e45dfBBB544',42:'0x7d2c415C47B23455c86bF9AeD1075658Fd271E87',44:'0xf29EedeA8DA9FddA4D8B318530D297Cf1172B304',53:'0x8E6c8F889F30e281bc9ce8dCFaE1E0f58431305C',54:'0x5370D9b4b48b29508134534E8901DBd0A84BcaCe',55:'0xEA50d56307De1e59b31Bb8bBcDB02876Ccc20Eff',56:'0x125224E7964cfC1cBFaFc6e0f0DD9C8525e4c05E',57:'0xAf5E770478E45650E36805d1cCaaB240309F4A20',58:'0x4F3FCD089f214fDCc50475728eacb04e19F1fa87',59:'0xDFeE96CE5bC5C4593D2a5a49DE2e4b3aD1Cef32d',60:'0x7fb4d135cbB38617B69042d6B27f0c1973BcA7b9',61:'0xC0724EFdB9B88D1e26A7B10Bd99F0FA042ad2966',62:'0xdA251aC6C9042140eded44304444cD73BB01E3B0',63:'0x603a70F85E6B686Bb585D6042b0cd7FD4cdCa823',64:'0xC675ee400500CCF202a58DA42CEa158c2a2E5766',65:'0x64BB0BbF98e68E9004ae417d8A42D582c78c3B2b',66:'0xcEd353C01E8A06b9B116a659927d407D94B57f75',67:'0xa0AF17c5C45A6b6474f205973b0912358A7Dd949',68:'0xC9e7AE0A76326EB98BeEf4b24E6ECbB00b1f7A2e',69:'0xdc7dA02E6505bb4327A8045912405E643D9d6287',70:'0x79eFECA3C89290035bcea3D0649021c02EADE6Bd',71:'0x5199BFD0effF06EC10d8b05a0bA8AC141be8eF40',72:'0xedBDe20bb69735fc09b1B9Ee26FcB3ceA3A54e39',73:'0x39225d40C7a7157A838ecCdB05D09208d47Fd523',74:'0x523Eff3dB03938eaa31a5a6FBd41E3B9d23edde5',75:'0x109521552F472b3C2EeD0fF1D0b45A107EA008C5',76:'0x88d0e9fd5058114bE1Df181271FC979Beb66DceC',77:'0xCBf54FE19529b02646F27edA6fd259320Baa39E8',78:'0xeBe2ADcBc2448787EDffb030307BeB8eFBA583DA',79:'0x51aAC4f5d2CbDBA2fb6bB6478A6EB3fE4CF5B419',80:'0x523F79c955eBe1338d24125631ffAa1802bC846F',81:'0x17d7DfA154dc0828AdE4115B9EB8a0A91C0fbDe4',82:'0xf1B88fa889D1999bC1783e962D06dC2315B7233C',83:'0x07eB4b21919C73719F6AC89fAA843067c6ba4283',84:'0x58C36c75ff696b880Ce648485b8D3eF9Ae7b68a0',85:'0xa5EbE5D1871CC87480B23126FAc13D7161a5c1d9',86:'0x77384593dB39112D7f30B59a7214e9f2d864aCEe',87:'0xA9D06124b0526373c9547b65eCBB99f5a637d716',88:'0xe806bB484773C55B577372Ec3aCd2ABb82d6fD6f',89:'0x81204A1f2d322f109077CFeF88f2b2c574EeFAE7',90:'0x9BA3D087311844Dd81d1Af289414a61De828632f',91:'0xda67b6F7135694837353A643FAc2C121b1503548',92:'0xda67b6F7135694837353A643FAc2C121b1503548',93:'0xda67b6F7135694837353A643FAc2C121b1503548',94:'0xda67b6F7135694837353A643FAc2C121b1503548',96:'0xda67b6F7135694837353A643FAc2C121b1503548',97:'0x2Ee6D91b39B4C3cF0Ce8C1171A9dbd0312092cc2',99:'0x087a882527aef1ac23660AD6F446383a886447E3'};

(async () => {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(process.env.DEPLOYER_KEY, provider);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, [
        'function register(string) returns (uint256)',
        'function transferFrom(address,address,uint256)'
    ], wallet);

    // Fetch names from API (lightweight, no RPC needed)
    console.log('Fetching agent names from API...');
    let agents = [];
    for (const id of missing) {
        try {
            const resp = await fetch(`https://api.helixa.xyz/api/v2/metadata/${id}`);
            const meta = await resp.json();
            const attrs = meta.attributes || [];
            const name = meta.name || 'Agent #' + id;
            const fw = (attrs.find(a => a.trait_type === 'framework') || {}).value || 'unknown';
            const mission = (attrs.find(a => a.trait_type === 'mission') || {}).value;
            const origin = (attrs.find(a => a.trait_type === 'origin') || {}).value;
            let desc;
            if (mission) desc = mission;
            else if (origin) desc = origin;
            else desc = `${name} — AI agent on Base (${fw}).`;
            agents.push({ id, name, desc, addr: agentAddrs[id] });
        } catch(e) {
            // Fallback
            agents.push({ id, name: 'Agent #' + id, desc: `Agent #${id} on Helixa.`, addr: agentAddrs[id] });
        }
    }
    console.log('Got', agents.length, 'agents');

    // Phase 1: Register
    let nonce = await provider.getTransactionCount(wallet.address, 'pending');
    console.log('Starting nonce:', nonce);
    let transfers = [];
    let ok = 0, fail = 0;

    for (const agent of agents) {
        const regFile = {
            type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
            name: agent.name, description: agent.desc,
            image: `https://api.helixa.xyz/api/v2/agent/${agent.id}/card.png`,
            services: [{ name: 'web', endpoint: `https://helixa.xyz/agent/${agent.id}` }],
            x402Support: true, active: true,
            registrations: [{ agentId: agent.id, agentRegistry: `eip155:8453:${V2_CONTRACT_ADDRESS}` }],
        };
        const dataURI = 'data:application/json;base64,' + Buffer.from(JSON.stringify(regFile)).toString('base64');
        try {
            const tx = await registry['register(string)'](dataURI, { nonce, gasLimit: 700000 });
            const receipt = await tx.wait();
            const tLog = receipt.logs.find(l => l.topics[0] === ethers.id('Transfer(address,address,uint256)'));
            const regTokenId = tLog ? Number(BigInt(tLog.topics[3])) : null;
            console.log('REG #' + agent.id + ' ' + agent.name + ' -> 8004#' + regTokenId + ' gas:' + receipt.gasUsed.toString() + ' n=' + nonce);
            if (regTokenId && agent.addr && agent.addr.toLowerCase() !== wallet.address.toLowerCase()) {
                transfers.push({ regTokenId, to: agent.addr, v2Id: agent.id, name: agent.name });
            }
            nonce++;
            ok++;
        } catch (e) {
            console.error('X #' + agent.id + ': ' + (e.shortMessage || e.message).slice(0, 80));
            fail++;
            await new Promise(r => setTimeout(r, 3000));
            nonce = await provider.getTransactionCount(wallet.address, 'pending');
        }
    }
    console.log('\nRegistered:', ok, 'Failed:', fail);

    // Phase 2: Transfer
    console.log('Transferring', transfers.length, 'to agent wallets...');
    nonce = await provider.getTransactionCount(wallet.address, 'pending');
    let tok = 0;
    for (const t of transfers) {
        try {
            const tx = await registry.transferFrom(wallet.address, t.to, t.regTokenId, { nonce, gasLimit: 80000 });
            await tx.wait();
            console.log('XFER #' + t.v2Id + ' ' + t.name + ' -> ' + t.to.slice(0,10) + ' n=' + nonce);
            nonce++;
            tok++;
        } catch (e) {
            console.error('X XFER #' + t.v2Id + ': ' + (e.shortMessage || e.message).slice(0, 80));
            await new Promise(r => setTimeout(r, 3000));
            nonce = await provider.getTransactionCount(wallet.address, 'pending');
        }
    }
    console.log('\nDONE. Registered:', ok, 'Transferred:', tok);
})();
