import { randomUUID } from 'crypto';
import os from 'os';
import { debug } from './debug.js';

const BACKEND_URL = process.env.NIA_BACKEND_URL || 'https://apigcp.trynia.ai';

const sessionId = randomUUID();
const distinctId = randomUUID();

const pending: Promise<void>[] = [];

function getVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../package.json').version;
  } catch {
    return 'unknown';
  }
}

export function getSessionId(): string {
  return sessionId;
}

export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (process.env.NIA_TELEMETRY_DISABLED === '1') return;

  const allProperties = {
    os: os.platform(),
    arch: os.arch(),
    node_version: process.version,
    wizard_version: getVersion(),
    onboarding_session_id: sessionId,
    ...properties,
  };

  const promise = fetch(`${BACKEND_URL}/public/cli/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, distinct_id: distinctId, properties: allProperties }),
    signal: AbortSignal.timeout(5000),
  })
    .then(() => { debug(`Tracked: ${event}`); })
    .catch((err) => { debug(`Track failed: ${event} - ${err}`); });

  pending.push(promise);
}

export async function shutdown(): Promise<void> {
  await Promise.allSettled(pending);
}
