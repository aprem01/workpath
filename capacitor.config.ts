import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.payranker.app",
  appName: "PayRanker: Skill to Pay",
  webDir: "out",
  server: {
    url: "https://workpath-iota.vercel.app",
    cleartext: false,
    errorPath: "/offline.html",
  },
  ios: {
    scheme: "PayRanker",
    contentInset: "automatic",
    allowsLinkPreview: false,
    backgroundColor: "#F7F2F2",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#F7F2F2",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#FFFFFF",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
