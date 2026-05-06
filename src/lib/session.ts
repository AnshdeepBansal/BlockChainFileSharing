import { getProvider } from '@/lib/ethers';

export async function signWalletMessage(message: string): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error('MetaMask provider is not available');
  }

  const signer = await provider.getSigner();
  return await signer.signMessage(message);
}

export async function establishWalletSession(params: {
  walletAddress: string;
  chainId: string | null;
}): Promise<void> {
  const nonceResponse = await fetch('/api/auth/nonce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: params.walletAddress, chainId: params.chainId }),
  });

  const nonceData = (await nonceResponse.json()) as {
    nonce?: string;
    message?: string;
    error?: string;
  };

  if (!nonceResponse.ok || !nonceData.nonce || !nonceData.message) {
    throw new Error(nonceData.error || 'Failed to start wallet authentication');
  }

  const signature = await signWalletMessage(nonceData.message);

  const verifyResponse = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: params.walletAddress,
      nonce: nonceData.nonce,
      signature,
    }),
  });

  const verifyData = (await verifyResponse.json()) as { ok?: boolean; error?: string };
  if (!verifyResponse.ok || !verifyData.ok) {
    throw new Error(verifyData.error || 'Wallet session verification failed');
  }
}