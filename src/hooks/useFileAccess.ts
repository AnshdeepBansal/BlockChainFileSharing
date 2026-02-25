'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  registerFile,
  grantAccess,
  revokeAccess,
  checkAccess,
  getFileInfo,
  getOwnerFileIds,
  type FileInfo,
} from '@/lib/contract';

export interface FileWithAccess extends FileInfo {
  fileId: number;
}

/**
 * Hook that manages on-chain file registration, access granting/revoking,
 * and loading the connected user's files.
 */
export function useFileAccess(walletAddress: string | null) {
  const [myFiles, setMyFiles] = useState<FileWithAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load files owned by the connected wallet ──

  const loadMyFiles = useCallback(async () => {
    if (!walletAddress) {
      setMyFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fileIds = await getOwnerFileIds(walletAddress);
      const filesData: FileWithAccess[] = [];

      for (const id of fileIds) {
        try {
          const info = await getFileInfo(id);
          filesData.push({ ...info, fileId: id });
        } catch {
          // Skip files we can't read (shouldn't happen for owner)
          console.warn(`Could not load file #${id}`);
        }
      }

      setMyFiles(filesData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load files';
      setError(msg);
      console.error('loadMyFiles error:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadMyFiles();
  }, [loadMyFiles]);

  // ── Register file on-chain ──

  const register = async (cid: string, fileName: string): Promise<number> => {
    setError(null);
    try {
      const fileId = await registerFile(cid, fileName);
      await loadMyFiles(); // refresh list
      return fileId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
      throw err;
    }
  };

  // ── Grant access ──

  const grant = async (fileId: number, viewer: string): Promise<void> => {
    setError(null);
    try {
      await grantAccess(fileId, viewer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to grant access';
      setError(msg);
      throw err;
    }
  };

  // ── Revoke access ──

  const revoke = async (fileId: number, viewer: string): Promise<void> => {
    setError(null);
    try {
      await revokeAccess(fileId, viewer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke access';
      setError(msg);
      throw err;
    }
  };

  // ── Check access ──

  const check = async (fileId: number, viewer: string): Promise<boolean> => {
    setError(null);
    try {
      return await checkAccess(fileId, viewer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Access check failed';
      setError(msg);
      throw err;
    }
  };

  return {
    myFiles,
    loading,
    error,
    register,
    grant,
    revoke,
    check,
    refresh: loadMyFiles,
  };
}
