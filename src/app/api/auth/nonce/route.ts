import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createAuthChallenge } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { walletAddress?: string; chainId?: string | null };
    const walletAddress = body.walletAddress?.trim() ?? '';
    const chainId = body.chainId?.trim() || null;

    if (!ethers.isAddress(walletAddress)) {
      return NextResponse.json({ error: 'walletAddress is invalid' }, { status: 400 });
    }

    const { challenge, message } = await createAuthChallenge(walletAddress, chainId);
    return NextResponse.json({
      walletAddress,
      nonce: challenge.nonce,
      message,
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown nonce error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}