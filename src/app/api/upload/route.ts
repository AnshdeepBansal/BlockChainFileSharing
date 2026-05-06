import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import {
  addSecureFile,
  addTelemetryEvent,
  type SecureFileRecord,
} from '@/lib/server/storage';
import { requireAuthenticatedWallet } from '@/lib/server/auth';
import {
  compressBuffer,
  encodePayload,
  encryptAesGcm,
  encryptAesGcm as encryptMeta,
  sha256Hex,
  shouldCompress,
} from '@/lib/crypto';
import { generateAndWrapDataKey } from '@/lib/kms';

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const walletAddress = (formData.get('walletAddress')?.toString() || '').trim();
    const authenticatedWallet = await requireAuthenticatedWallet(request);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!authenticatedWallet) {
      return NextResponse.json({ error: 'Wallet session is required' }, { status: 401 });
    }

    if (walletAddress && walletAddress.toLowerCase() !== authenticatedWallet.toLowerCase()) {
      return NextResponse.json({ error: 'walletAddress does not match authenticated session' }, { status: 403 });
    }

    const effectiveWallet = authenticatedWallet;

    const pinataKey = process.env.PINATA_API_KEY;
    const pinataSecret = process.env.PINATA_API_SECRET;
    if (!pinataKey || !pinataSecret) {
      return NextResponse.json(
        { error: 'Server IPFS credentials are not configured (PINATA_API_KEY/PINATA_API_SECRET)' },
        { status: 500 }
      );
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const compressed = shouldCompress(file.type, file.size);
    const processedBuffer = compressed ? compressBuffer(originalBuffer) : originalBuffer;

    const originalHash = sha256Hex(originalBuffer);
    const processedHash = sha256Hex(processedBuffer);

    const { plaintextKey, wrappedKey } = await generateAndWrapDataKey();
    const payloadEnc = encryptAesGcm(processedBuffer, plaintextKey);
    const metadataEnc = encryptMeta(
      Buffer.from(
        JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          uploadedAt: new Date().toISOString(),
        }),
        'utf8'
      ),
      plaintextKey
    );

    plaintextKey.fill(0);

    const encryptedPayload = encodePayload(payloadEnc.iv, payloadEnc.tag, payloadEnc.ciphertext);
    const pinataBody = new FormData();
    pinataBody.append('file', new Blob([encryptedPayload]), `${file.name}.enc`);
    pinataBody.append(
      'pinataMetadata',
      JSON.stringify({
        name: `${file.name}.enc`,
        keyvalues: {
            ownerWallet: effectiveWallet,
          encrypted: true,
          compressed,
        },
      })
    );

    const pinResp = await fetch(PINATA_API_URL, {
      method: 'POST',
      headers: {
        pinata_api_key: pinataKey,
        pinata_secret_api_key: pinataSecret,
      },
      body: pinataBody,
    });

    if (!pinResp.ok) {
      const err = await pinResp.text();
      return NextResponse.json({ error: `Pinata upload failed: ${err}` }, { status: 502 });
    }

    const pinData = (await pinResp.json()) as { IpfsHash?: string };
    const cid = pinData.IpfsHash;
    if (!cid) {
      return NextResponse.json({ error: 'Invalid Pinata response: CID missing' }, { status: 502 });
    }

    const record: SecureFileRecord = {
      id: randomUUID(),
      ownerWallet: effectiveWallet,
      cid,
      wrappedKey,
      metadataCiphertext: metadataEnc.ciphertext.toString('base64'),
      metadataIv: metadataEnc.iv.toString('base64'),
      metadataTag: metadataEnc.tag.toString('base64'),
      originalHash,
      processedHash,
      isCompressed: compressed,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      createdAt: new Date().toISOString(),
    };

    await addSecureFile(record);
    await addTelemetryEvent({
      event: 'upload',
      wallet: effectiveWallet,
      timestamp: Date.now(),
      context: {
        cid,
        fileType: file.type,
        fileSize: file.size,
        compressed,
      },
    });

    return NextResponse.json({ cid, isCompressed: compressed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
