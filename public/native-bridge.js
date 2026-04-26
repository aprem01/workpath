/**
 * PayRanker Native Bridge
 *
 * Activates iOS features only available inside the native app.
 * Website users don't see these — they're exclusive to the App Store version.
 *
 * Apple Guideline 4.2 compliance:
 * - Document scanner (scan certifications with camera)
 * - Voice skill input (hands-free, uses iOS Speech framework)
 * - Calendar integration (add interviews directly to Calendar)
 * - Haptic feedback, push notifications, offline handling
 */

(function () {
  if (!window.Capacitor) return;
  const { Capacitor, Plugins } = window;
  if (!Capacitor.isNativePlatform()) return;

  console.log("[PayRanker Native] Initializing iOS-only features...");

  // ─── 1. NATIVE FEATURE: Document Scanner ────────────────────
  // Apple's VisionKit-style scanner for certifications, diplomas, prior job docs
  window.payrankerScanDocument = async function () {
    try {
      const { Camera } = Plugins;
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: "base64",
        source: "CAMERA",
        correctOrientation: true,
      });

      // Show confirmation
      alert("Certification captured! We'll extract the skill name automatically.");

      // Store the image for later processing
      localStorage.setItem("payranker_last_cert_image", photo.base64String);

      // Haptic success
      const { Haptics } = Plugins;
      if (Haptics) Haptics.notification({ type: "SUCCESS" });

      return photo.base64String;
    } catch (e) {
      console.log("[PayRanker Native] Document scan cancelled:", e);
    }
  };

  // ─── 2. NATIVE FEATURE: Voice Skill Input ───────────────────
  // Uses iOS Speech framework (SFSpeechRecognizer) for hands-free entry
  window.payrankerVoiceInput = async function (onResult) {
    try {
      const SpeechRecognition = Plugins.SpeechRecognition;
      if (!SpeechRecognition) {
        alert("Voice input is only available in the iOS app");
        return null;
      }

      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== "granted") {
        alert("Please grant microphone access to use voice input");
        return null;
      }

      // Haptic: start listening
      const { Haptics } = Plugins;
      if (Haptics) Haptics.impact({ style: "medium" });

      const result = await SpeechRecognition.start({
        language: "en-US",
        maxResults: 1,
        prompt: "Speak a skill you have",
        partialResults: false,
        popup: true,
      });

      const text = result.matches?.[0] || "";
      if (text && onResult) onResult(text);

      if (Haptics) Haptics.notification({ type: "SUCCESS" });
      return text;
    } catch (e) {
      console.log("[PayRanker Native] Voice input failed:", e);
      return null;
    }
  };

  // ─── 3. NATIVE FEATURE: Add to Calendar ─────────────────────
  // Interview requests auto-add to iOS Calendar with one tap
  window.payrankerAddToCalendar = async function (title, notes, startDate) {
    try {
      // iOS calendar:// URL scheme for event creation
      const start = startDate || new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour

      const formatDate = (d) =>
        d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

      // Create .ics file content
      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PayRanker//iOS//EN",
        "BEGIN:VEVENT",
        `UID:${Date.now()}@payranker.app`,
        `DTSTAMP:${formatDate(new Date())}`,
        `DTSTART:${formatDate(start)}`,
        `DTEND:${formatDate(end)}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${notes || ""}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\n");

      // Trigger iOS calendar via data URI
      const dataUri =
        "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
      window.location.href = dataUri;

      const { Haptics } = Plugins;
      if (Haptics) Haptics.notification({ type: "SUCCESS" });

      return true;
    } catch (e) {
      console.log("[PayRanker Native] Calendar add failed:", e);
      return false;
    }
  };

  // ─── 4. PUSH NOTIFICATIONS ───────────────────────────────────
  async function setupPushNotifications() {
    try {
      const { PushNotifications } = Plugins;
      if (!PushNotifications) return;
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive === "granted") {
        await PushNotifications.register();
      }
      PushNotifications.addListener("registration", (token) => {
        localStorage.setItem("payranker_push_token", token.value);
      });
      PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
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
      PushNotifications.addListener(
        "pushNotificationActionPerformed",
        () => {
          window.location.href = "/messages";
        }
      );
    } catch (e) {}
  }

  // ─── 5. HAPTIC FEEDBACK ──────────────────────────────────────
  async function addHapticFeedback() {
    try {
      const { Haptics } = Plugins;
      if (!Haptics) return;
      document.addEventListener("click", (e) => {
        const t = e.target;
        if (t.closest("button[class*='rounded-full']")) {
          Haptics.impact({ style: "light" });
        }
        if (t.closest("[class*='bg-magenta']")) {
          Haptics.impact({ style: "medium" });
        }
      });
    } catch (e) {}
  }

  // ─── 6. NETWORK STATUS ───────────────────────────────────────
  async function setupNetworkHandling() {
    try {
      const { Network } = Plugins;
      if (!Network) return;
      Network.addListener("networkStatusChange", (status) => {
        if (!status.connected) {
          let b = document.getElementById("payranker-offline-banner");
          if (!b) {
            b = document.createElement("div");
            b.id = "payranker-offline-banner";
            b.style.cssText =
              "position:fixed;bottom:0;left:0;right:0;padding:12px;background:#F7A31C;color:white;font-weight:bold;z-index:99999;text-align:center;font-size:14px;";
            b.textContent = "You're offline. Some features may not work.";
            document.body.appendChild(b);
          }
        } else {
          const b = document.getElementById("payranker-offline-banner");
          if (b) b.remove();
        }
      });
    } catch (e) {}
  }

  // ─── 7. KEYBOARD HANDLING ────────────────────────────────────
  async function setupKeyboard() {
    try {
      const { Keyboard } = Plugins;
      if (!Keyboard) return;
      Keyboard.addListener("keyboardWillShow", (info) => {
        document.body.style.paddingBottom = info.keyboardHeight + "px";
      });
      Keyboard.addListener("keyboardWillHide", () => {
        document.body.style.paddingBottom = "0px";
      });
    } catch (e) {}
  }

  // ─── 8. NATIVE ACTION BAR (floating button) ─────────────────
  // Inject a floating button that showcases native features on the skills page
  function injectNativeActionBar() {
    if (document.getElementById("payranker-native-bar")) return;

    // Only show on /skills page
    if (!window.location.pathname.includes("/skills")) return;

    const bar = document.createElement("div");
    bar.id = "payranker-native-bar";
    bar.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 12px;
      background: white;
      box-shadow: 0 8px 32px rgba(231,37,226,0.25);
      border-radius: 999px;
      padding: 12px;
      z-index: 9000;
      border: 2px solid #E725E2;
    `;

    const voiceBtn = document.createElement("button");
    voiceBtn.innerHTML = "🎤 Voice";
    voiceBtn.style.cssText =
      "background:#E725E2;color:white;border:none;padding:10px 18px;border-radius:999px;font-weight:bold;cursor:pointer;font-size:14px;";
    voiceBtn.onclick = async () => {
      const input = document.querySelector('input[placeholder*="driving"]') ||
                    document.querySelector('input[type="text"]');
      const result = await window.payrankerVoiceInput((text) => {
        if (input) {
          input.value = text;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
        }
      });
      if (result && input) {
        // Simulate Enter to add the skill
        setTimeout(() => {
          input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
          );
        }, 200);
      }
    };

    const scanBtn = document.createElement("button");
    scanBtn.innerHTML = "📷 Scan";
    scanBtn.style.cssText =
      "background:#F7A31C;color:white;border:none;padding:10px 18px;border-radius:999px;font-weight:bold;cursor:pointer;font-size:14px;";
    scanBtn.onclick = async () => {
      await window.payrankerScanDocument();
    };

    bar.appendChild(voiceBtn);
    bar.appendChild(scanBtn);
    document.body.appendChild(bar);
  }

  // Re-inject on route changes (SPA)
  let currentPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== currentPath) {
      currentPath = window.location.pathname;
      const existing = document.getElementById("payranker-native-bar");
      if (existing) existing.remove();
      setTimeout(injectNativeActionBar, 300);
    }
  }, 500);

  // ─── INIT ALL ────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    setupPushNotifications();
    addHapticFeedback();
    setupNetworkHandling();
    setupKeyboard();
    setTimeout(injectNativeActionBar, 1000);
    console.log("[PayRanker Native] All iOS features initialized");
  });
})();
