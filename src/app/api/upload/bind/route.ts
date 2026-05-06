import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { addTelemetryEvent, bindFileId } from '@/lib/server/storage';
import { requireAuthenticatedWallet } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      cid?: string;
      fileId?: number;
      walletAddress?: string;
    };

    const cid = body.cid?.trim();
    const walletAddress = body.walletAddress?.trim();
    const fileId = body.fileId;
    const authenticatedWallet = await requireAuthenticatedWallet(request);

    if (!cid || !walletAddress || typeof fileId !== 'number' || Number.isNaN(fileId)) {
      return NextResponse.json({ error: 'cid, fileId and walletAddress are required' }, { status: 400 });
    }

    if (!authenticatedWallet) {
      return NextResponse.json({ error: 'Wallet session is required' }, { status: 401 });
    }

    if (walletAddress.toLowerCase() !== authenticatedWallet.toLowerCase()) {
      return NextResponse.json({ error: 'walletAddress does not match authenticated session' }, { status: 403 });
    }

    const updated = await bindFileId(cid, fileId, walletAddress);
    if (!updated) {
      return NextResponse.json({ error: 'No matching secure upload record found' }, { status: 404 });
    }

    await addTelemetryEvent({
      event: 'register',
      wallet: authenticatedWallet,
      timestamp: Date.now(),
      context: { fileId, cid },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown bind error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
