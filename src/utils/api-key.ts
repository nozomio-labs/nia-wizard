import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NIA_CONFIG_DIR = path.join(os.homedir(), '.config', 'nia');
const NIA_KEY_PATH = path.join(NIA_CONFIG_DIR, 'api_key');

export function storeApiKey(apiKey: string): void {
  fs.mkdirSync(NIA_CONFIG_DIR, { recursive: true });
  fs.writeFileSync(NIA_KEY_PATH, apiKey, { mode: 0o600 });
}
