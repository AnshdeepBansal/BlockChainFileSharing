import { randomUUID } from 'node:crypto';
import { ethers } from 'ethers';
import { NextRequest, NextResponse } from 'next/server';
import {
  consumeAuthChallenge,
  getWalletSession,
  storeAuthChallenge,
  storeWalletSession,
  type AuthChallengeRecord,
  type WalletSessionRecord,
} from '@/lib/server/storage';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_COOKIE = 'wallet_session';

export function buildAuthMessage(params: {
  walletAddress: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  chainId: string | null;
}): string {
  const lines = [
    'Sign in to the Web3 File Sharing app.',
    `Wallet: ${params.walletAddress}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${new Date(params.issuedAt).toISOString()}`,
    `Expires At: ${new Date(params.expiresAt).toISOString()}`,
  ];

  if (params.chainId) {
    lines.push(`Chain ID: ${params.chainId}`);
  }

  lines.push('This signature only authenticates session creation and does not approve a transaction.');
  return lines.join('\n');
}

export async function createAuthChallenge(walletAddress: string, chainId: string | null): Promise<{
  challenge: AuthChallengeRecord;
  message: string;
}> {
  const now = Date.now();
  const challenge: AuthChallengeRecord = {
    wallet: walletAddress,
    nonce: randomUUID(),
    chainId,
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
  };

  await storeAuthChallenge(challenge);
  return {
    challenge,
    message: buildAuthMessage({
      walletAddress,
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
      chainId,
    }),
  };
}

export async function verifyAuthSignature(params: {
  walletAddress: string;
  nonce: string;
  signature: string;
}): Promise<WalletSessionRecord | null> {
  const challenge = await consumeAuthChallenge(params.walletAddress, params.nonce);
  if (!challenge) {
    return null;
  }

  const message = buildAuthMessage({
    walletAddress: challenge.wallet,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
    chainId: challenge.chainId,
  });

  const recovered = ethers.verifyMessage(message, params.signature);
  if (recovered.toLowerCase() !== challenge.wallet.toLowerCase()) {
    return null;
  }

  const now = Date.now();
  const session: WalletSessionRecord = {
    token: randomUUID(),
    wallet: challenge.wallet,
    chainId: challenge.chainId,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  await storeWalletSession(session);
  return session;
}

export function setWalletSessionCookie(response: NextResponse, session: WalletSessionRecord): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: session.token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function requireAuthenticatedWallet(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getWalletSession(token);
  return session?.wallet ?? null;
}