
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.securepasskey.app',
  appName: 'SecurePasskey',
  webDir: 'dist/public',
  server: {
    url: 'http://localhost:5000',
    cleartext: true
  }
};

export default config;
