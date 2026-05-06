import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { setWalletSessionCookie, verifyAuthSignature } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      walletAddress?: string;
      nonce?: string;
      signature?: string;
    };

    const walletAddress = body.walletAddress?.trim() ?? '';
    const nonce = body.nonce?.trim() ?? '';
    const signature = body.signature?.trim() ?? '';

    if (!ethers.isAddress(walletAddress)) {
      return NextResponse.json({ error: 'walletAddress is invalid' }, { status: 400 });
    }

    if (!nonce) {
      return NextResponse.json({ error: 'nonce is required' }, { status: 400 });
    }

    if (!signature) {
      return NextResponse.json({ error: 'signature is required' }, { status: 400 });
    }

    const session = await verifyAuthSignature({ walletAddress, nonce, signature });
    if (!session) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, walletAddress: session.wallet });
    setWalletSessionCookie(response, session);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown auth verification error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}