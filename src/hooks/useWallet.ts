'use client';

import { useState, useEffect } from 'react';
import { isMetaMaskInstalled, connectWallet, getCurrentAddress } from '@/lib/ethers';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if MetaMask is installed on mount
  useEffect(() => {
    setIsInstalled(isMetaMaskInstalled());
    
    // Check if already connected
    if (isMetaMaskInstalled()) {
      getCurrentAddress().then(addr => {
        if (addr) setAddress(addr);
      });
    }
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        setAddress(null);
      } else {
        setAddress(accounts[0]);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  // Connect wallet function
  const connect = async () => {
    setError(null);
    setIsConnecting(true);

    try {
      const addr = await connectWallet();
      setAddress(addr);
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
    connect,
  };
}
