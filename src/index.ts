// Main exports for programmatic usage
export { runWizard } from './run.js';
export { runMCPAdd, runMCPRemove } from './mcp.js';
export {
  addMCPServerToClientsStep,
  removeMCPServerFromClientsStep,
  getSupportedClients,
  MCPClient,
} from './steps/add-mcp-server-to-clients/index.js';
export type { WizardOptions, MCPServerConfig, MCPClientResult } from './utils/types.js';

// Device flow utilities (for programmatic auth)
export {
  startDeviceSession,
  exchangeForApiKey,
  isSessionValid,
  getSessionTimeRemaining,
  formatUserCode,
  isDeviceFlowError,
  type DeviceSession,
  type DeviceFlowError,
} from './utils/device-flow.js';
