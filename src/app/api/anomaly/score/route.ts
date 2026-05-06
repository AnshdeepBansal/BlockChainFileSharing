import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import { getTelemetryByWallet } from '@/lib/server/storage';
import { scoreTelemetry } from '@/lib/anomaly';
import { requireAuthenticatedWallet } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { walletAddress?: string; windowHours?: number };
    const walletAddress = body.walletAddress?.trim() ?? '';
    const windowHours = Number(body.windowHours ?? 24);
    const authenticatedWallet = await requireAuthenticatedWallet(request);

    if (!authenticatedWallet) {
      return NextResponse.json({ error: 'Wallet session is required' }, { status: 401 });
    }

    if (!ethers.isAddress(walletAddress)) {
      return NextResponse.json({ error: 'walletAddress is invalid' }, { status: 400 });
    }

    if (walletAddress.toLowerCase() !== authenticatedWallet.toLowerCase()) {
      return NextResponse.json({ error: 'walletAddress does not match authenticated session' }, { status: 403 });
    }

    const hours = Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 24;
    const events = await getTelemetryByWallet(authenticatedWallet, hours * 60 * 60 * 1000);
    const result = scoreTelemetry(events);

    return NextResponse.json({
      walletAddress: authenticatedWallet,
      eventsAnalyzed: events.length,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scoring error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
