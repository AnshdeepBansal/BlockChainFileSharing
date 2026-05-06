import { promises as fs } from 'node:fs';
import path from 'node:path';

export type SecureFileRecord = {
  id: string;
  ownerWallet: string;
  cid: string;
  wrappedKey: string;
  metadataCiphertext: string;
  metadataIv: string;
  metadataTag: string;
  originalHash: string;
  processedHash: string;
  isCompressed: boolean;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileId?: number;
  createdAt: string;
};

export type TelemetryEvent = {
  event: string;
  wallet: string;
  timestamp: number;
  context: Record<string, unknown>;
};

export type AuthChallengeRecord = {
  wallet: string;
  nonce: string;
  chainId: string | null;
  issuedAt: number;
  expiresAt: number;
};

export type WalletSessionRecord = {
  token: string;
  wallet: string;
  chainId: string | null;
  issuedAt: number;
  expiresAt: number;
};

type DbSchema = {
  secureFiles: SecureFileRecord[];
  telemetry: TelemetryEvent[];
  authChallenges: AuthChallengeRecord[];
  walletSessions: WalletSessionRecord[];
};

const DATA_DIR = path.join(process.cwd(), 'cache');
const DB_PATH = path.join(DATA_DIR, 'secure-files-db.json');

async function ensureDb(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    const init: DbSchema = {
      secureFiles: [],
      telemetry: [],
      authChallenges: [],
      walletSessions: [],
    };
    await fs.writeFile(DB_PATH, JSON.stringify(init, null, 2), 'utf8');
  }
}

function normalizeDb(raw: Partial<DbSchema> | null | undefined): DbSchema {
  return {
    secureFiles: Array.isArray(raw?.secureFiles) ? raw!.secureFiles : [],
    telemetry: Array.isArray(raw?.telemetry) ? raw!.telemetry : [],
    authChallenges: Array.isArray(raw?.authChallenges) ? raw!.authChallenges : [],
    walletSessions: Array.isArray(raw?.walletSessions) ? raw!.walletSessions : [],
  };
}

async function readDb(): Promise<DbSchema> {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, 'utf8');
  return normalizeDb(JSON.parse(raw) as Partial<DbSchema>);
}

async function writeDb(db: DbSchema): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

export async function addSecureFile(record: SecureFileRecord): Promise<void> {
  const db = await readDb();
  db.secureFiles.push(record);
  await writeDb(db);
}

export async function bindFileId(cid: string, fileId: number, wallet: string): Promise<boolean> {
  const db = await readDb();
  const idx = db.secureFiles.findIndex((r) => r.cid === cid && r.ownerWallet.toLowerCase() === wallet.toLowerCase());
  if (idx < 0) return false;
  db.secureFiles[idx].fileId = fileId;
  await writeDb(db);
  return true;
}

export async function getSecureFileByFileId(fileId: number): Promise<SecureFileRecord | null> {
  const db = await readDb();
  return db.secureFiles.find((r) => r.fileId === fileId) ?? null;
}

export async function addTelemetryEvent(ev: TelemetryEvent): Promise<void> {
  const db = await readDb();
  db.telemetry.push(ev);
  if (db.telemetry.length > 5000) {
    db.telemetry = db.telemetry.slice(db.telemetry.length - 5000);
  }
  await writeDb(db);
}

export async function storeAuthChallenge(challenge: AuthChallengeRecord): Promise<void> {
  const db = await readDb();
  db.authChallenges = db.authChallenges.filter(
    (entry) => entry.wallet.toLowerCase() !== challenge.wallet.toLowerCase()
  );
  db.authChallenges.push(challenge);
  await writeDb(db);
}

export async function consumeAuthChallenge(wallet: string, nonce: string): Promise<AuthChallengeRecord | null> {
  const db = await readDb();
  const now = Date.now();
  const idx = db.authChallenges.findIndex(
    (entry) => entry.wallet.toLowerCase() === wallet.toLowerCase() && entry.nonce === nonce && entry.expiresAt > now
  );

  if (idx < 0) {
    db.authChallenges = db.authChallenges.filter((entry) => entry.expiresAt > now);
    await writeDb(db);
    return null;
  }

  const [challenge] = db.authChallenges.splice(idx, 1);
  db.authChallenges = db.authChallenges.filter((entry) => entry.expiresAt > now);
  await writeDb(db);
  return challenge;
}

export async function storeWalletSession(session: WalletSessionRecord): Promise<void> {
  const db = await readDb();
  db.walletSessions = db.walletSessions.filter(
    (entry) => entry.token !== session.token && entry.wallet.toLowerCase() !== session.wallet.toLowerCase()
  );
  db.walletSessions.push(session);
  await writeDb(db);
}

export async function getWalletSession(token: string): Promise<WalletSessionRecord | null> {
  const db = await readDb();
  const now = Date.now();
  const session = db.walletSessions.find((entry) => entry.token === token && entry.expiresAt > now) ?? null;
  db.walletSessions = db.walletSessions.filter((entry) => entry.expiresAt > now);
  await writeDb(db);
  return session;
}

export async function getTelemetryByWallet(wallet: string, windowMs: number): Promise<TelemetryEvent[]> {
  const db = await readDb();
  const since = Date.now() - windowMs;
  return db.telemetry.filter((e) => e.wallet.toLowerCase() === wallet.toLowerCase() && e.timestamp >= since);
}
