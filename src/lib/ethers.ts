import { ethers } from 'ethers';

type EIP1193RequestArgs = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

interface EthereumProvider {
  request: (args: EIP1193RequestArgs) => Promise<unknown>;
  on: (eventName: string, listener: (...args: unknown[]) => void) => void;
  off?: (eventName: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (eventName: string, listener: (...args: unknown[]) => void) => void;
}

/**
 * Check if MetaMask is installed
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.ethereum !== 'undefined';
}

/**
 * Get the Ethereum provider from MetaMask
 */
export function getProvider(): ethers.BrowserProvider | null {
  if (!isMetaMaskInstalled()) {
    return null;
  }
  return new ethers.BrowserProvider(window.ethereum);
}

/**
 * Request wallet connection and return the connected address
 */
export async function connectWallet(): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed');
  }

  const provider = getProvider();
  if (!provider) {
    throw new Error('Failed to get provider');
  }

  // Request account access
  await provider.send('eth_requestAccounts', []);
  
  // Get the signer
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  
  return address;
}

/**
 * Get the current connected address (if any)
 */
export async function getCurrentAddress(): Promise<string | null> {
  if (!isMetaMaskInstalled()) {
    return null;
  }

  const provider = getProvider();
  if (!provider) {
    return null;
  }

  try {
    const accounts = await provider.send('eth_accounts', []);
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error('Error getting current address:', error);
    return null;
  }
}

/**
 * Sign an arbitrary message using the connected wallet.
 */
export async function signWalletMessage(message: string): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed');
  }

  const provider = getProvider();
  if (!provider) {
    throw new Error('Failed to get provider');
  }

  const signer = await provider.getSigner();
  return await signer.signMessage(message);
}

// Extend the Window interface to include ethereum
declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
