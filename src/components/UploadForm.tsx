'use client';

import { useState } from 'react';
import { bindFileRegistration, uploadToIPFS, getIPFSUrl } from '@/lib/ipfs';

interface UploadFormProps {
  /** Called after the file is uploaded to IPFS and registered on-chain */
  onRegister: (cid: string, fileName: string) => Promise<number>;
  walletAddress: string;
}

export default function UploadForm({ onRegister, walletAddress }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [fileId, setFileId] = useState<number | null>(null);
  const [compressed, setCompressed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setCid(null);
      setFileId(null);
      setCompressed(null);
      setError(null);
      setStatus(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);
    setCid(null);
    setFileId(null);
    setCompressed(null);

    try {
      // Step 1: Upload through secure backend pipeline
      setStatus('Uploading through secure pipeline (compression/encryption/IPFS)...');
      const upload = await uploadToIPFS(file, walletAddress);
      setCid(upload.cid);
      setCompressed(upload.isCompressed);

      // Step 2: Register on-chain
      setStatus('Registering on-chain (confirm in MetaMask)...');
      const id = await onRegister(upload.cid, file.name);
      setFileId(id);

      // Step 3: Bind secure record to on-chain fileId
      setStatus('Finalizing secure mapping...');
      await bindFileRegistration(upload.cid, id, walletAddress);
      setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file';
      setError(message);
      setStatus(null);
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Upload to IPFS</h2>
      
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label 
            htmlFor="file-upload" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select File
          </label>
          <input
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              disabled:opacity-50"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md
            hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
            transition-colors"
        >
          {uploading ? 'Processing...' : 'Upload & Register'}
        </button>
      </form>

      {/* Progress status */}
      {status && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">{status}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {cid && fileId !== null && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm font-medium text-green-800 mb-2">Upload & Registration Successful!</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-600 mb-1">On-chain File ID:</p>
              <p className="text-sm font-semibold text-gray-800">#{fileId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">IPFS CID:</p>
              <p className="text-sm font-mono text-gray-800 break-all">{cid}</p>
            </div>
            {compressed !== null && (
              <div>
                <p className="text-xs text-gray-600 mb-1">Compression:</p>
                <p className="text-sm font-semibold text-gray-800">
                  {compressed ? 'Applied before encryption' : 'Skipped (file type/size)'}
                </p>
              </div>
            )}
            <a
              href={getIPFSUrl(cid)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-blue-600 hover:text-blue-800 underline"
            >
              View on IPFS Gateway →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
