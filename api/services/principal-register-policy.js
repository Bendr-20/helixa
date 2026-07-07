function errorText(error) {
  return [
    typeof error === 'string' ? error : '',
    error?.message,
    error?.shortMessage,
    error?.reason,
    error?.error?.message,
    error?.info?.error?.message,
    error?.method,
    error?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function shouldContinueOffchainAfterMintError(error) {
  const text = errorText(error);
  if (!text) return false;

  const isMintTransportFailure = text.includes('mint creation error')
    || text.includes('eth_sendtransaction')
    || text.includes('no runners')
    || text.includes('replacement fee too low')
    || text.includes('nonce has already been used')
    || text.includes('could not coalesce error')
    || text.includes('unknown_error')
    || text.includes('-32603');

  if (!isMintTransportFailure) return false;

  return !text.includes('caller must own tokenid')
    && !text.includes('token binding requires wallet authentication')
    && !text.includes('on-chain mint requires wallet authentication')
    && !text.includes('name required');
}

function formatMintFallbackWarning(_error) {
  return 'Onchain minting failed, so this human profile was saved offchain instead.';
}

function shouldAllowServerSponsoredPrincipalMint(env = process.env) {
  return env.HELIXA_ALLOW_SERVER_SPONSORED_PRINCIPAL_MINTS === 'true';
}

module.exports = {
  shouldContinueOffchainAfterMintError,
  formatMintFallbackWarning,
  shouldAllowServerSponsoredPrincipalMint,
};
