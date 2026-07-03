function walletErrorText(error) {
  return [
    typeof error === 'string' ? error : '',
    error?.message,
    error?.shortMessage,
    error?.reason,
    error?.error?.message,
    error?.info?.error?.message,
    error?.method,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isWalletRejection(error) {
  const code = error?.code;
  const message = walletErrorText(error);

  return code === 4001
    || code === 'ACTION_REJECTED'
    || message.includes('user rejected')
    || message.includes('rejected the request')
    || message.includes('action_rejected');
}

export function shouldFallbackToPrivyAfterWalletError(error) {
  return !isWalletRejection(error);
}

export function shouldRetryHumanPublishOffchain(error) {
  if (isWalletRejection(error)) return false;

  const message = walletErrorText(error);
  return message.includes('mint phase error')
    || message.includes('mint creation error')
    || message.includes('eth_sendtransaction')
    || message.includes('no runners')
    || (message.includes('human register failed') && (message.includes('mint') || message.includes('onchain')));
}

export function getWalletPublishFallbackMessage(_error) {
  return 'Wallet/onchain publishing failed, so the human profile was saved offchain instead.';
}
