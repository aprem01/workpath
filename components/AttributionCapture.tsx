"use client";

/**
 * Records how a visitor first arrived, once, in a first-party cookie.
 *
 * Mounted in the root layout so it sees the landing page whatever that
 * page is. Renders nothing. Measurement must never be able to break a
 * page, so every step here is inside a try and every failure is silent.
 */

import { useEffect } from "react";
import {
  ATTR_COOKIE,
  ATTR_MAX_AGE_DAYS,
  parseAttribution,
  serializeAttribution,
} from "@/lib/attribution";

export default function AttributionCapture() {
  useEffect(() => {
    try {
      // First touch wins: the ad that started the visit keeps the credit,
      // not the brand search it caused three days later.
      const already = document.cookie
        .split(";")
        .some((c) => c.trim().startsWith(`${ATTR_COOKIE}=`));
      if (already) return;

      const attr = parseAttribution(window.location.search, {
        landing: window.location.pathname,
        referrer: document.referrer,
      });
      if (!attr) return; // organic visit — nothing to record

      const value = serializeAttribution(attr);
      if (!value) return;

      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie =
        `${ATTR_COOKIE}=${value}; path=/; max-age=${ATTR_MAX_AGE_DAYS * 86400}` +
        `; SameSite=Lax${secure}`;
    } catch {
      /* measurement is never worth a broken page */
    }
  }, []);

  return null;
}
