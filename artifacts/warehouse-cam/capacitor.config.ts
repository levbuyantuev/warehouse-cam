import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.warehousecam.app',
  appName: 'WarehouseCam',
  webDir: 'dist/public',
  // Loads the live Vercel deployment — no need to bundle API
  server: {
    url: 'https://warehouse-cam.vercel.app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#ffffff',
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
};

export default config;
