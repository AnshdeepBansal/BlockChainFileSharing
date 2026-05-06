import { ethers } from 'ethers';
import { getProvider } from './ethers';
import FileAccessControlABI from '@/artifacts/contracts/FileAccessControl.sol/FileAccessControl.json';

// Read contract address from environment variable (set by deploy script)
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
const ZERO_ADDRESS = ethers.ZeroAddress;

type BytecodeCheckCache = {
  chainId: string;
  address: string;
};

let bytecodeCheckCache: BytecodeCheckCache | null = null;

if (!CONTRACT_ADDRESS) {
  console.warn('NEXT_PUBLIC_CONTRACT_ADDRESS is not set. Run the deploy script and restart the dev server.');
}

function assertValidNonZeroAddress(address: string, fieldName: string): void {
  if (!ethers.isAddress(address)) {
    throw new Error(`${fieldName} is not a valid Ethereum address`);
  }
  if (address.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    throw new Error(`${fieldName} cannot be the zero address`);
  }
}

async function assertContractBytecodeAvailable(provider: ethers.BrowserProvider): Promise<void> {
  assertValidNonZeroAddress(CONTRACT_ADDRESS, 'Contract address');

  const network = await provider.getNetwork();
  const chainId = network.chainId.toString();

  if (
    bytecodeCheckCache &&
    bytecodeCheckCache.chainId === chainId &&
    bytecodeCheckCache.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
  ) {
    return;
  }

  const code = await provider.getCode(CONTRACT_ADDRESS);
  if (code === '0x') {
    throw new Error(
      `No contract bytecode at ${CONTRACT_ADDRESS} on chainId ${chainId}. ` +
        'Switch wallet network or redeploy and restart the dev server.'
    );
  }

  bytecodeCheckCache = {
    chainId,
    address: CONTRACT_ADDRESS,
  };
}

// ───────── Contract Instance Helpers ─────────

/**
 * Get a read-only contract instance (uses provider, no signer needed)
 */
export async function getReadOnlyContract(): Promise<ethers.Contract | null> {
  if (!CONTRACT_ADDRESS) return null;
  const provider = getProvider();
  if (!provider) return null;
  await assertContractBytecodeAvailable(provider);
  return new ethers.Contract(CONTRACT_ADDRESS, FileAccessControlABI.abi, provider);
}

/**
 * Get a writable contract instance (uses signer — requires connected wallet)
 */
export async function getSignedContract(): Promise<ethers.Contract> {
  if (!CONTRACT_ADDRESS) throw new Error('Contract address not configured. Deploy the contract and restart the dev server.');
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask is not available');

  await assertContractBytecodeAvailable(provider);

  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, FileAccessControlABI.abi, signer);
}

// ───────── Write Functions ─────────

/**
 * Register a file's CID on-chain after IPFS upload.
 * @returns The fileId assigned by the contract
 */
export async function registerFile(cid: string, fileName: string): Promise<number> {
  const contract = await getSignedContract();
  const tx = await contract.registerFile(cid, fileName);
  const receipt = await tx.wait();

  // Parse the FileUploaded event to extract fileId
  const event = receipt.logs
    .map((log: ethers.Log) => {
      try {
        return contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .find((parsed: ethers.LogDescription | null) => parsed?.name === 'FileUploaded');

  if (!event) throw new Error('FileUploaded event not found in receipt');

  return Number(event.args.fileId);
}

/**
 * Grant view access to a single address.
 */
export async function grantAccess(fileId: number, viewerAddress: string): Promise<void> {
  assertValidNonZeroAddress(viewerAddress, 'Viewer address');
  const contract = await getSignedContract();
  const tx = await contract.grantAccess(fileId, viewerAddress);
  await tx.wait();
}

/**
 * Revoke view access from a single address.
 */
export async function revokeAccess(fileId: number, viewerAddress: string): Promise<void> {
  assertValidNonZeroAddress(viewerAddress, 'Viewer address');
  const contract = await getSignedContract();
  const tx = await contract.revokeAccess(fileId, viewerAddress);
  await tx.wait();
}

/**
 * Grant access to multiple addresses in one transaction.
 */
export async function grantAccessBatch(fileId: number, viewers: string[]): Promise<void> {
  for (const viewer of viewers) {
    assertValidNonZeroAddress(viewer, 'Viewer address');
  }
  const contract = await getSignedContract();
  const tx = await contract.grantAccessBatch(fileId, viewers);
  await tx.wait();
}

// ───────── Read Functions ─────────

export interface FileInfo {
  cid: string;
  fileName: string;
  owner: string;
  uploadedAt: number;
}

/**
 * Check whether an address has access to a file.
 */
export async function checkAccess(fileId: number, viewerAddress: string): Promise<boolean> {
  assertValidNonZeroAddress(viewerAddress, 'Viewer address');
  const contract = getReadOnlyContract();
  const resolved = await contract;
  if (!resolved) throw new Error('Provider not available');
  return await resolved.hasAccess(fileId, viewerAddress);
}

/**
 * Get file info (only callable by users who have access).
 */
export async function getFileInfo(fileId: number): Promise<FileInfo> {
  const contract = await getSignedContract();
  const [cid, fileName, owner, uploadedAt] = await contract.getFile(fileId);
  return {
    cid,
    fileName,
    owner,
    uploadedAt: Number(uploadedAt),
  };
}

/**
 * Get all file IDs uploaded by an owner address.
 */
export async function getOwnerFileIds(ownerAddress: string): Promise<number[]> {
  assertValidNonZeroAddress(ownerAddress, 'Owner address');
  const contract = await getReadOnlyContract();
  if (!contract) throw new Error('Provider not available');
  const ids = await contract.getOwnerFiles(ownerAddress);
  return ids.map((id: bigint) => Number(id));
}

/**
 * Get total number of files registered.
 */
export async function getTotalFiles(): Promise<number> {
  const contract = await getReadOnlyContract();
  if (!contract) throw new Error('Provider not available');
  return Number(await contract.totalFiles());
}
