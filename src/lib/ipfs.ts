/**
 * IPFS upload using Pinata pinning service
 */

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const PINATA_API_SECRET = process.env.NEXT_PUBLIC_PINATA_API_SECRET;
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

/**
 * Upload a file to IPFS using Pinata
 * @param file - The file to upload
 * @returns The IPFS CID (Content Identifier)
 */
export async function uploadToIPFS(file: File): Promise<string> {
  if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    throw new Error('Pinata API credentials are not configured. Please add NEXT_PUBLIC_PINATA_API_KEY and NEXT_PUBLIC_PINATA_API_SECRET to .env.local');
  }

  try {
    // Create form data
    const formData = new FormData();
    formData.append('file', file);

    // Optional: Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
      },
    });
    formData.append('pinataMetadata', metadata);

    // Optional: Add pinning options
    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', options);

    // Upload to Pinata
    const response = await fetch(PINATA_API_URL, {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_API_SECRET,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Pinata returns IpfsHash as the CID
    return data.IpfsHash;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw error instanceof Error ? error : new Error('Failed to upload to IPFS');
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
