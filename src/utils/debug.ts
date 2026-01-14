let debugEnabled = false;

export function enableDebug(): void {
  debugEnabled = true;
}

export function debug(...args: unknown[]): void {
  if (debugEnabled) {
    console.log('[DEBUG]', ...args);
  }
}
