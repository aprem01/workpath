/**
 * PayRanker Native Bridge
 * Activates native iOS features when running inside Capacitor
 * This is what makes it a real app, not a web wrapper
 */

(function () {
  // Only run inside Capacitor native shell
  if (!window.Capacitor) return;

  const { Capacitor, Plugins } = window;
  if (!Capacitor.isNativePlatform()) return;

  console.log("[PayRanker Native] Initializing native features...");

  // ─── 1. PUSH NOTIFICATIONS ──────────────────────────────────
  async function setupPushNotifications() {
    try {
      const { PushNotifications } = Plugins;
      if (!PushNotifications) return;

      const permission = await PushNotifications.requestPermissions();
      if (permission.receive === "granted") {
        await PushNotifications.register();
        console.log("[PayRanker Native] Push notifications registered");
      }

      // Listen for registration token
      PushNotifications.addListener("registration", (token) => {
        console.log("[PayRanker Native] Push token:", token.value);
        // Store token for future use
        localStorage.setItem("payranker_push_token", token.value);
      });

      // Handle incoming notifications
      PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
          console.log("[PayRanker Native] Notification:", notification);
          // Show as in-app alert
          if (notification.body) {
            const banner = document.createElement("div");
            banner.style.cssText =
              "position:fixed;top:0;left:0;right:0;padding:60px 16px 16px;background:#E725E2;color:white;font-weight:bold;z-index:99999;text-align:center;font-size:14px;";
            banner.textContent = notification.body;
            document.body.appendChild(banner);
            setTimeout(() => banner.remove(), 4000);
          }
        }
      );

      // Handle notification tap
      PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          console.log("[PayRanker Native] Notification tapped:", action);
          // Navigate to messages
          window.location.href = "/messages";
        }
      );
    } catch (e) {
      console.log("[PayRanker Native] Push setup skipped:", e);
    }
  }

  // ─── 2. HAPTIC FEEDBACK ──────────────────────────────────────
  async function addHapticFeedback() {
    try {
      const { Haptics } = Plugins;
      if (!Haptics) return;

      // Add haptic feedback to skill pill additions
      document.addEventListener("click", (e) => {
        const target = e.target;

        // Skill pill pop
        if (
          target.closest("[class*='animate-pill-pop']") ||
          target.closest("button[class*='rounded-full']")
        ) {
          Haptics.impact({ style: "light" });
        }

        // CTA button press
        if (
          target.closest("[class*='bg-magenta']") ||
          target.closest("[class*='bg-teal']")
        ) {
          Haptics.impact({ style: "medium" });
        }

        // Tab switch
        if (target.closest("[class*='gradient']")) {
          Haptics.selectionChanged();
        }
      });

      console.log("[PayRanker Native] Haptic feedback enabled");
    } catch (e) {
      console.log("[PayRanker Native] Haptics skipped:", e);
    }
  }

  // ─── 3. NETWORK STATUS (OFFLINE HANDLING) ────────────────────
  async function setupNetworkHandling() {
    try {
      const { Network } = Plugins;
      if (!Network) return;

      Network.addListener("networkStatusChange", (status) => {
        console.log("[PayRanker Native] Network:", status.connected);

        if (!status.connected) {
          // Show offline banner
          let banner = document.getElementById("payranker-offline-banner");
          if (!banner) {
            banner = document.createElement("div");
            banner.id = "payranker-offline-banner";
            banner.style.cssText =
              "position:fixed;bottom:0;left:0;right:0;padding:12px;background:#F7A31C;color:white;font-weight:bold;z-index:99999;text-align:center;font-size:14px;";
            banner.textContent =
              "You're offline. Some features may not work.";
            document.body.appendChild(banner);
          }
        } else {
          const banner = document.getElementById("payranker-offline-banner");
          if (banner) banner.remove();
        }
      });

      console.log("[PayRanker Native] Network monitoring enabled");
    } catch (e) {
      console.log("[PayRanker Native] Network skipped:", e);
    }
  }

  // ─── 4. KEYBOARD HANDLING ────────────────────────────────────
  async function setupKeyboard() {
    try {
      const { Keyboard } = Plugins;
      if (!Keyboard) return;

      // Scroll input into view when keyboard appears
      Keyboard.addListener("keyboardWillShow", (info) => {
        document.body.style.paddingBottom = info.keyboardHeight + "px";
        // Scroll active element into view
        const active = document.activeElement;
        if (active && active.tagName === "INPUT") {
          setTimeout(() => {
            active.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
        }
      });

      Keyboard.addListener("keyboardWillHide", () => {
        document.body.style.paddingBottom = "0px";
      });

      console.log("[PayRanker Native] Keyboard handling enabled");
    } catch (e) {
      console.log("[PayRanker Native] Keyboard skipped:", e);
    }
  }

  // ─── 5. APP LIFECYCLE ────────────────────────────────────────
  async function setupAppLifecycle() {
    try {
      const { App } = Plugins;
      if (!App) return;

      // Handle back button on Android (future-proof)
      App.addListener("backButton", () => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });

      // Handle app resume — refresh data
      App.addListener("appStateChange", (state) => {
        if (state.isActive) {
          console.log("[PayRanker Native] App resumed — refreshing...");
          // Trigger a soft refresh of the current page data
          window.dispatchEvent(new Event("payranker-app-resume"));
        }
      });

      console.log("[PayRanker Native] App lifecycle handlers enabled");
    } catch (e) {
      console.log("[PayRanker Native] Lifecycle skipped:", e);
    }
  }

  // ─── 6. STATUS BAR STYLING ──────────────────────────────────
  async function setupStatusBar() {
    try {
      const { StatusBar } = Plugins;
      if (!StatusBar) return;

      StatusBar.setStyle({ style: "LIGHT" });
      StatusBar.setBackgroundColor({ color: "#FFFFFF" });
      console.log("[PayRanker Native] Status bar styled");
    } catch (e) {
      console.log("[PayRanker Native] StatusBar skipped:", e);
    }
  }

  // ─── INIT ALL ────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    setupPushNotifications();
    addHapticFeedback();
    setupNetworkHandling();
    setupKeyboard();
    setupAppLifecycle();
    setupStatusBar();
    console.log("[PayRanker Native] All native features initialized");
  });
})();
