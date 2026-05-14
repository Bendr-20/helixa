const DEFAULT_SIWE_DOMAIN = 'helixa.xyz';
const SIWE_CHAIN_ID = 8453;

export function getHumanSiweDomain() {
  if (typeof window !== 'undefined' && window.location?.host) return window.location.host;
  return DEFAULT_SIWE_DOMAIN;
}

export function getHumanSiweUri(domain = getHumanSiweDomain()) {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return `https://${domain}`;
}

export function buildHumanSiweMessage(address: string, timestamp: string, domain = getHumanSiweDomain(), uri = getHumanSiweUri(domain)) {
  const issuedAt = new Date(Number(timestamp)).toISOString();
  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Helixa.\n\nURI: ${uri}\nVersion: 1\nChain ID: ${SIWE_CHAIN_ID}\nNonce: ${timestamp}\nIssued At: ${issuedAt}`;
}
