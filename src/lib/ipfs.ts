/**
 * IPFS is now handled through backend API routes so secrets and keys remain server-side.
 */

export type UploadResult = {
  cid: string;
  isCompressed: boolean;
};

/**
 * Upload a file using secure backend pipeline (compression + encryption + IPFS pinning)
 * @param file - The file to upload
 * @param walletAddress - Connected wallet address used for ownership telemetry and binding
 * @returns The IPFS CID (Content Identifier)
 */
export async function uploadToIPFS(file: File, walletAddress: string): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('walletAddress', walletAddress);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = (await response.json()) as { cid?: string; isCompressed?: boolean; error?: string };
  if (!response.ok || !data.cid) {
    throw new Error(data.error || 'Failed to upload to secure IPFS pipeline');
  }

  return {
    cid: data.cid,
    isCompressed: Boolean(data.isCompressed),
  };
}

/**
 * Bind on-chain fileId to secure upload record after successful registerFile tx.
 */
export async function bindFileRegistration(cid: string, fileId: number, walletAddress: string): Promise<void> {
  const response = await fetch('/api/upload/bind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid, fileId, walletAddress }),
  });

  const data = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Failed to bind on-chain registration to secure record');
  }
}

/**
 * Get the IPFS gateway URL for a given CID
 * @param cid - The IPFS CID
 * @returns The full gateway URL using Pinata's dedicated gateway
 */
export function getIPFSUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
