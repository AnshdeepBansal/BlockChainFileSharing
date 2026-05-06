'use client';

import { useState, useEffect } from 'react';
import { isMetaMaskInstalled, connectWallet, getCurrentAddress } from '@/lib/ethers';
import { establishWalletSession } from '@/lib/session';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);

  // Check if MetaMask is installed on mount
  useEffect(() => {
    setIsInstalled(isMetaMaskInstalled());
    
    // Check if already connected
    if (isMetaMaskInstalled()) {
      getCurrentAddress().then(addr => {
        if (addr) setAddress(addr);
      });

      window.ethereum
        ?.request?.({ method: 'eth_chainId' })
        .then((id: string) => setChainId(id))
        .catch(() => setChainId(null));
    }
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        setAddress(null);
        setError('Wallet disconnected. Reconnect to create a new session.');
      } else {
        setAddress(null);
        setError('Wallet account changed. Reconnect to refresh the signed session.');
      }
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.off) {
        window.ethereum.off('accountsChanged', handleAccountsChanged);
        window.ethereum.off('chainChanged', handleChainChanged);
      } else if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // Connect wallet function
  const connect = async () => {
    setError(null);
    setIsConnecting(true);

    try {
      const addr = await connectWallet();
      await establishWalletSession({ walletAddress: addr, chainId });
      setAddress(addr);
      fetch('/api/anomaly/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'wallet_connect', wallet: addr, context: { chainId } }),
      }).catch(() => {
        // Best effort telemetry.
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    address,
    isConnecting,
    error,
    isInstalled,
    chainId,
    connect,
  };
}
