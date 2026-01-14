/**
 * Device Authorization Flow for CLI onboarding
 * 
 * This implements a device authorization flow similar to OAuth Device Flow,
 * allowing the CLI to obtain API keys through browser-based authentication.
 * 
 * Flow:
 * 1. CLI calls /public/mcp-device/start to get session + user code
 * 2. CLI opens browser to verification URL
 * 3. User signs in and authorizes in browser
 * 4. CLI exchanges session for API key via /public/mcp-device/exchange
 */

import { debug } from './debug.js';

// Backend API URL
const BACKEND_URL = process.env.NIA_BACKEND_URL || 'https://apigcp.trynia.ai';
// App URL for browser - if set locally, override backend's verification_url
const APP_URL = process.env.NIA_APP_URL || '';

// Session expiry (matches backend: 15 minutes)
const SESSION_TTL_MS = 15 * 60 * 1000;

export interface DeviceSession {
  authorization_session_id: string;
  user_code: string;
  verification_url: string;
  expires_at: string;
}

export interface DeviceFlowError {
  type: 'network' | 'expired' | 'not_ready' | 'consumed' | 'invalid' | 'unknown';
  message: string;
  detail?: string;
}

/**
 * Start a new device authorization session
 */
export async function startDeviceSession(): Promise<DeviceSession> {
  debug('Starting device session...');
  
  const response = await fetch(`${BACKEND_URL}/public/mcp-device/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    debug(`Failed to start device session: ${response.status} - ${errorText}`);
    
    if (response.status === 429) {
      throw createError('network', 'Too many requests. Please wait a moment and try again.');
    }
    
    throw createError('network', `Failed to connect to Nia servers: ${response.status}`);
  }

  const data = (await response.json()) as {
    authorization_session_id: string;
    user_code: string;
    verification_url: string;
    expires_at: string;
  };
  debug(`Device session started: code=${data.user_code}`);
  
  // Construct the verification URL to use /cli-onboarding for full experience
  // (org creation, GitHub connect, etc.) instead of /cli-auth which skips it
  let verificationUrl: string;
  if (APP_URL) {
    // Local dev - use local app URL
    verificationUrl = `${APP_URL}/cli-onboarding?code=${data.user_code}`;
    debug(`Using local APP_URL for verification: ${verificationUrl}`);
  } else {
    // Production - override backend's /cli-auth with /cli-onboarding
    verificationUrl = data.verification_url.replace('/cli-auth?', '/cli-onboarding?');
    debug(`Using cli-onboarding URL: ${verificationUrl}`);
  }
  
  return {
    authorization_session_id: data.authorization_session_id,
    user_code: data.user_code,
    verification_url: verificationUrl,
    expires_at: data.expires_at,
  };
}

/**
 * Exchange a device session for an API key
 * 
 * This should be called after the user has completed authorization in the browser.
 * Returns the API key on success, or throws a DeviceFlowError.
 */
export async function exchangeForApiKey(
  session: DeviceSession,
): Promise<string> {
  debug('Exchanging device session for API key...');
  
  // Check if session has expired locally first
  const expiresAt = new Date(session.expires_at).getTime();
  if (Date.now() > expiresAt) {
    throw createError('expired', 'Session has expired. Please run the setup again.');
  }
  
  const response = await fetch(`${BACKEND_URL}/public/mcp-device/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      authorization_session_id: session.authorization_session_id,
      user_code: session.user_code,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({ detail: 'Unknown error' }))) as { detail?: string };
    const detail = errorData.detail || `HTTP ${response.status}`;
    debug(`Exchange failed: ${response.status} - ${detail}`);
    
    // Map HTTP status to error type
    switch (response.status) {
      case 400:
        // Check if it's a "not ready" error
        if (detail.includes('not yet authorized') || detail.includes('pending')) {
          throw createError('not_ready', 'Session not yet authorized. Complete the setup in your browser first.', detail);
        }
        if (detail.includes('complete the setup') || detail.includes('authorized')) {
          throw createError('not_ready', 'Please complete the setup in your browser first (sign in, etc.).', detail);
        }
        throw createError('invalid', detail);
        
      case 404:
        throw createError('invalid', 'Invalid session or code. Please run the setup again.');
        
      case 409:
        throw createError('consumed', 'This session has already been used. Please run the setup again.');
        
      case 410:
        throw createError('expired', 'Session has expired. Please run the setup again.');
        
      default:
        throw createError('unknown', `Failed to get API key: ${detail}`);
    }
  }

  const data = (await response.json()) as { api_key?: string };
  
  if (!data.api_key) {
    throw createError('unknown', 'Server did not return an API key');
  }
  
  debug('Successfully obtained API key');
  return data.api_key;
}

/**
 * Check if a session is still valid (not expired)
 */
export function isSessionValid(session: DeviceSession): boolean {
  const expiresAt = new Date(session.expires_at).getTime();
  // Add a small buffer (30 seconds) to account for network latency
  return Date.now() < expiresAt - 30000;
}

/**
 * Get the remaining time until session expires (in seconds)
 */
export function getSessionTimeRemaining(session: DeviceSession): number {
  const expiresAt = new Date(session.expires_at).getTime();
  const remaining = Math.max(0, expiresAt - Date.now());
  return Math.floor(remaining / 1000);
}

/**
 * Format the user code for display (e.g., "ABCD-EFGH")
 */
export function formatUserCode(code: string): string {
  return code.toUpperCase();
}

/**
 * Create a typed error object
 */
function createError(
  type: DeviceFlowError['type'],
  message: string,
  detail?: string,
): DeviceFlowError {
  return { type, message, detail };
}

/**
 * Check if an error is a DeviceFlowError
 */
export function isDeviceFlowError(error: unknown): error is DeviceFlowError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error
  );
}
