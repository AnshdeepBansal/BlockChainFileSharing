import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import abiJson from '@/artifacts/contracts/FileAccessControl.sol/FileAccessControl.json';
import { addTelemetryEvent, getSecureFileByFileId } from '@/lib/server/storage';
import { requireAuthenticatedWallet } from '@/lib/server/auth';
import { decodePayload, decompressBuffer, decryptAesGcm, sha256Hex } from '@/lib/crypto';
import { unwrapDataKey } from '@/lib/kms';

const DEFAULT_RPC = 'http://127.0.0.1:8545';

export async function POST(request: NextRequest) {
  let walletAddress = '';
  let fileId = -1;
  try {
    const body = (await request.json()) as { fileId?: number; walletAddress?: string };
    fileId = body.fileId ?? -1;
    walletAddress = body.walletAddress?.trim() ?? '';
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

    if (!Number.isInteger(fileId) || fileId < 0) {
      return NextResponse.json({ error: 'fileId must be a non-negative integer' }, { status: 400 });
    }

    const record = await getSecureFileByFileId(fileId);
    if (!record) {
      return NextResponse.json({ error: 'File record not found or not yet bound' }, { status: 404 });
    }

    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
    if (!ethers.isAddress(contractAddress)) {
      return NextResponse.json({ error: 'Contract address is not configured' }, { status: 500 });
    }

    const rpcUrl = process.env.RPC_URL || DEFAULT_RPC;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, abiJson.abi, provider);
    const hasAccess = (await contract.hasAccess(fileId, walletAddress)) as boolean;

    if (!hasAccess) {
      await addTelemetryEvent({
        event: 'failed_auth',
        wallet: authenticatedWallet,
        timestamp: Date.now(),
        context: { fileId, reason: 'no_access' },
      });
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const gateway = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs';
    const payloadResp = await fetch(`${gateway}/${record.cid}`);
    if (!payloadResp.ok) {
      return NextResponse.json({ error: 'Failed to fetch encrypted payload from IPFS' }, { status: 502 });
    }
    const payloadBuffer = Buffer.from(await payloadResp.arrayBuffer());
    const { iv, tag, ciphertext } = decodePayload(payloadBuffer);

    const dataKey = await unwrapDataKey(record.wrappedKey);
    const decrypted = decryptAesGcm(ciphertext, dataKey, iv, tag);
    dataKey.fill(0);

    const processedHash = sha256Hex(decrypted);
    if (processedHash !== record.processedHash) {
      await addTelemetryEvent({
        event: 'failed_decrypt',
        wallet: walletAddress,
        timestamp: Date.now(),
        context: { fileId, reason: 'hash_mismatch' },
      });
      return NextResponse.json({ error: 'Integrity check failed' }, { status: 409 });
    }

    const content = record.isCompressed ? decompressBuffer(decrypted) : decrypted;
    const originalHash = sha256Hex(content);
    if (originalHash !== record.originalHash) {
      await addTelemetryEvent({
        event: 'failed_decrypt',
        wallet: walletAddress,
        timestamp: Date.now(),
        context: { fileId, reason: 'original_hash_mismatch' },
      });
      return NextResponse.json({ error: 'Original content integrity check failed' }, { status: 409 });
    }

    await addTelemetryEvent({
      event: 'download',
      wallet: authenticatedWallet,
      timestamp: Date.now(),
      context: { fileId, cid: record.cid },
    });

    return new NextResponse(content, {
      headers: {
        'Content-Type': record.fileType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(record.fileName)}"`,
      },
    });
  } catch (error) {
    await addTelemetryEvent({
      event: 'failed_decrypt',
      wallet: walletAddress || 'unknown',
      timestamp: Date.now(),
      context: { fileId, reason: error instanceof Error ? error.message : 'unknown' },
    });
    const message = error instanceof Error ? error.message : 'Unknown download error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
