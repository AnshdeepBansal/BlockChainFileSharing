'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { getIPFSUrl } from '@/lib/ipfs';
import type { FileWithAccess } from '@/hooks/useFileAccess';

interface AccessControlProps {
  files: FileWithAccess[];
  onGrant: (fileId: number, viewer: string) => Promise<void>;
  onRevoke: (fileId: number, viewer: string) => Promise<void>;
  onCheck: (fileId: number, viewer: string) => Promise<boolean>;
  loading: boolean;
}

export default function AccessControl({ files, onGrant, onRevoke, onCheck, loading }: AccessControlProps) {
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [viewerAddress, setViewerAddress] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [accessResult, setAccessResult] = useState<boolean | null>(null);

  const validateAddress = (addr: string): boolean => {
    try {
      return ethers.isAddress(addr) && addr.toLowerCase() !== ethers.ZeroAddress.toLowerCase();
    } catch {
      return false;
    }
  };

  const handleGrant = async () => {
    if (selectedFileId === null || !viewerAddress) return;
    if (!validateAddress(viewerAddress)) {
      setMessage({ type: 'error', text: 'Invalid Ethereum address' });
      return;
    }

    setProcessing(true);
    setMessage(null);
    setAccessResult(null);
    try {
      await onGrant(selectedFileId, viewerAddress);
      setMessage({ type: 'success', text: `Access granted to ${viewerAddress}` });
      setViewerAddress('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to grant access';
      setMessage({ type: 'error', text: msg });
    } finally {
      setProcessing(false);
    }
  };

  const handleRevoke = async () => {
    if (selectedFileId === null || !viewerAddress) return;
    if (!validateAddress(viewerAddress)) {
      setMessage({ type: 'error', text: 'Invalid Ethereum address' });
      return;
    }

    setProcessing(true);
    setMessage(null);
    setAccessResult(null);
    try {
      await onRevoke(selectedFileId, viewerAddress);
      setMessage({ type: 'success', text: `Access revoked from ${viewerAddress}` });
      setViewerAddress('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke access';
      setMessage({ type: 'error', text: msg });
    } finally {
      setProcessing(false);
    }
  };

  const handleCheck = async () => {
    if (selectedFileId === null || !viewerAddress) return;
    if (!validateAddress(viewerAddress)) {
      setMessage({ type: 'error', text: 'Invalid Ethereum address' });
      return;
    }

    setProcessing(true);
    setMessage(null);
    try {
      const hasAccess = await onCheck(selectedFileId, viewerAddress);
      setAccessResult(hasAccess);
      setMessage({
        type: hasAccess ? 'success' : 'error',
        text: hasAccess
          ? `${viewerAddress} HAS access to this file`
          : `${viewerAddress} does NOT have access to this file`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Access check failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-xl mx-auto p-6 bg-white rounded-lg shadow-md text-center">
        <p className="text-gray-500">Loading your files...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Access Control</h2>

      {/* ── File List ── */}
      {files.length === 0 ? (
        <p className="text-gray-500 mb-4">
          No files registered on-chain yet. Upload a file first.
        </p>
      ) : (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select a File
          </label>
          <select
            value={selectedFileId ?? ''}
            onChange={(e) => {
              setSelectedFileId(e.target.value ? Number(e.target.value) : null);
              setMessage(null);
              setAccessResult(null);
            }}
            className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm
              text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- choose file --</option>
            {files.map((f) => (
              <option key={f.fileId} value={f.fileId}>
                #{f.fileId} — {f.fileName}
              </option>
            ))}
          </select>

          {/* Selected file details */}
          {selectedFileId !== null && (() => {
            const file = files.find((f) => f.fileId === selectedFileId);
            if (!file) return null;
            return (
              <div className="mt-3 p-3 bg-gray-50 rounded-md text-sm space-y-1">
                <p><span className="font-medium text-gray-700">File:</span> {file.fileName}</p>
                <p className="break-all">
                  <span className="font-medium text-gray-700">CID:</span>{' '}
                  <span className="font-mono text-xs">{file.cid}</span>
                </p>
                <p>
                  <span className="font-medium text-gray-700">Uploaded:</span>{' '}
                  {new Date(file.uploadedAt * 1000).toLocaleString()}
                </p>
                <a
                  href={getIPFSUrl(file.cid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-blue-600 hover:text-blue-800 underline text-xs"
                >
                  View on IPFS →
                </a>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Viewer Address Input ── */}
      {selectedFileId !== null && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Viewer Wallet Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={viewerAddress}
              onChange={(e) => {
                setViewerAddress(e.target.value);
                setMessage(null);
                setAccessResult(null);
              }}
              disabled={processing}
              className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm
                text-gray-800 placeholder-gray-400
                focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                disabled:opacity-50"
            />
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex gap-3">
            <button
              onClick={handleGrant}
              disabled={!viewerAddress || processing}
              className="flex-1 py-2 px-4 bg-green-600 text-white font-semibold rounded-md
                hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                transition-colors text-sm"
            >
              {processing ? 'Processing...' : 'Grant Access'}
            </button>
            <button
              onClick={handleRevoke}
              disabled={!viewerAddress || processing}
              className="flex-1 py-2 px-4 bg-red-600 text-white font-semibold rounded-md
                hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                transition-colors text-sm"
            >
              {processing ? 'Processing...' : 'Revoke Access'}
            </button>
            <button
              onClick={handleCheck}
              disabled={!viewerAddress || processing}
              className="flex-1 py-2 px-4 bg-blue-600 text-white font-semibold rounded-md
                hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                transition-colors text-sm"
            >
              {processing ? 'Checking...' : 'Check Access'}
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      {message && (
        <div
          className={`mt-4 p-3 rounded-md border text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
