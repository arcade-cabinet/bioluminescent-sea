import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.arcadecabinet.bioluminescentsea",
  appName: "Bioluminescent Sea",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#050a14",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#050a14",
      overlaysWebView: true,
    },
  },
};

export default config;
