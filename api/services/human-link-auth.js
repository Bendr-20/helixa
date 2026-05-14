const { ethers } = require('ethers');

function normalizeAddress(address) {
    try {
        return ethers.getAddress(String(address || ''));
    } catch {
        return null;
    }
}

function authorizeHumanAgentLink({ profile, caller, privyUserId }) {
    const callerAddress = normalizeAddress(caller);
    if (!callerAddress) {
        return { ok: false, status: 401, error: 'Valid wallet authentication required' };
    }

    const profileWalletAddress = profile?.walletAddress ? normalizeAddress(profile.walletAddress) : null;
    if (profileWalletAddress) {
        if (profileWalletAddress.toLowerCase() !== callerAddress.toLowerCase()) {
            return { ok: false, status: 403, error: 'Caller must own this human principal profile' };
        }
        return { ok: true, profilePatch: {} };
    }

    const profileUserId = String(profile?.userId || '').trim();
    const verifiedUserId = String(privyUserId || '').trim();
    if (profileUserId && verifiedUserId && profileUserId === verifiedUserId) {
        return { ok: true, profilePatch: { walletAddress: callerAddress } };
    }

    return {
        ok: false,
        status: 403,
        error: 'Privy proof for this human profile is required before linking an agent',
    };
}

module.exports = {
    authorizeHumanAgentLink,
};
