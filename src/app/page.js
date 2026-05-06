'use client';

import { useWallet } from '@/hooks/useWallet';
import { useFileAccess } from '@/hooks/useFileAccess';
import UploadForm from '@/components/UploadForm';
import AccessControl from '@/components/AccessControl';

export default function Home() {
  const { address, isConnecting, error, isInstalled, connect } = useWallet();
  const { myFiles, loading, error: contractError, register, grant, revoke, check } = useFileAccess(address);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Web3 File Sharing dApp
          </h1>
          <p className="text-gray-600">
            Upload files to IPFS • Control access via Smart Contract
          </p>
        </div>

        {/* MetaMask Connection Section */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Wallet Connection
          </h2>

          {!isInstalled ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-800 mb-2">
                MetaMask is not installed
              </p>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Install MetaMask →
              </a>
            </div>
          ) : !address ? (
            <div>
              <p className="text-gray-600 mb-4">
                Connect your MetaMask wallet to start uploading files
              </p>
              <button
                onClick={connect}
                disabled={isConnecting}
                className="py-2 px-6 bg-orange-500 text-white font-semibold rounded-md
                  hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                  transition-colors"
              >
                {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
              </button>
            </div>
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600 mb-1">Connected Wallet:</p>
              <p className="text-green-800 font-mono text-sm break-all">
                {address}
              </p>
            </div>
          )}

          {(error || contractError) && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error || contractError}</p>
            </div>
          )}
        </div>

        {/* Main Content — visible only when wallet connected */}
        {address ? (
          <div className="space-y-8">
            {/* Upload Form */}
            <UploadForm onRegister={register} walletAddress={address} />

            {/* Access Control Panel */}
            <AccessControl
              files={myFiles}
              onGrant={grant}
              onRevoke={revoke}
              onCheck={check}
              loading={loading}
            />
          </div>
        ) : (
          <div className="p-8 bg-white rounded-lg shadow-md text-center">
            <p className="text-gray-500">
              Please connect your wallet to upload files
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Web3 File Sharing • IPFS + Smart Contract Access Control</p>
        </div>
      </div>
    </div>
  );
}
