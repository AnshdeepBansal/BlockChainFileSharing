import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import { addTelemetryEvent } from '@/lib/server/storage';
import { requireAuthenticatedWallet } from '@/lib/server/auth';

const ALLOWED_EVENTS = new Set(['grant', 'revoke', 'check_access', 'wallet_connect']);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      event?: string;
      wallet?: string;
      context?: Record<string, unknown>;
    };

    const event = body.event?.trim() ?? '';
    const wallet = body.wallet?.trim() ?? '';
    const authenticatedWallet = await requireAuthenticatedWallet(request);

    if (!ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ error: 'Unsupported event type' }, { status: 400 });
    }

    if (!authenticatedWallet) {
      return NextResponse.json({ error: 'Wallet session is required' }, { status: 401 });
    }

    if (wallet && wallet.toLowerCase() !== authenticatedWallet.toLowerCase()) {
      return NextResponse.json({ error: 'wallet does not match authenticated session' }, { status: 403 });
    }

    if (wallet && !ethers.isAddress(wallet)) {
      return NextResponse.json({ error: 'wallet is invalid' }, { status: 400 });
    }

    await addTelemetryEvent({
      event,
      wallet: authenticatedWallet,
      timestamp: Date.now(),
      context: body.context ?? {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown telemetry error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
