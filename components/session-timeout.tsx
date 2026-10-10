"use client";

import { useEffect } from "react";

const USER_KEY = "user";
const LAST_ACTIVITY_KEY = "jprime:lastActivityAt";
const TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 5 * 1000;
const SERVER_HEARTBEAT_THROTTLE_MS = 60 * 1000;

function hasSavedUser(): boolean {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return false;
    const user = JSON.parse(raw);
    return Boolean(user && typeof user === "object" && user.username);
  } catch {
    return false;
  }
}

/**
 * Coordinates browser inactivity logout with a server-issued HttpOnly session.
 * The server cookie is renewed only by same-origin heartbeats while activity
 * is detected and expires after 15 minutes without a successful heartbeat.
 */
export function SessionTimeout() {
  useEffect(() => {
    let expired = false;
    let lastWriteAt = 0;
    let lastHeartbeatAt = 0;
    let heartbeatInFlight = false;

    const redirectToLogin = () => {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    };

    const expireSession = () => {
      if (expired) return;
      expired = true;
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      // Clear the server-issued HttpOnly cookie too. The server also rejects
      // it after 15 minutes without a successful activity heartbeat.
      void fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      }).catch(() => undefined);
      window.alert("Session expired. Please log in again.");
      redirectToLogin();
    };

    const refreshServerSession = async () => {
      if (!hasSavedUser() || expired || heartbeatInFlight) return;
      const now = Date.now();
      if (now - lastHeartbeatAt < SERVER_HEARTBEAT_THROTTLE_MS) return;
      lastHeartbeatAt = now;
      heartbeatInFlight = true;
      try {
        const response = await fetch("/api/auth/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (response.status === 401) expireSession();
      } catch {
        // Temporary network errors should not instantly log the user out.
      } finally {
        heartbeatInFlight = false;
      }
    };

    const checkExpiry = () => {
      if (!hasSavedUser()) {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        return;
      }

      const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
      const now = Date.now();

      // Existing logins created before this patch get a fresh 15-minute window
      // on their first visit after installing the patch.
      if (!Number.isFinite(stored) || stored <= 0) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        lastWriteAt = now;
        void refreshServerSession();
        return;
      }

      if (now - stored >= TIMEOUT_MS) {
        expireSession();
      }
    };

    const recordActivity = () => {
      if (!hasSavedUser() || expired) return;

      const now = Date.now();
      const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY));

      // Check expiry before recording an event, so returning to an idle tab
      // after 15 minutes cannot revive an expired login.
      if (Number.isFinite(stored) && stored > 0 && now - stored >= TIMEOUT_MS) {
        expireSession();
        return;
      }

      if (!Number.isFinite(stored) || stored <= 0) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        lastWriteAt = now;
        return;
      }

      if (now - lastWriteAt >= ACTIVITY_WRITE_THROTTLE_MS && now - stored < TIMEOUT_MS) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        lastWriteAt = now;
      }

      // Refresh the signed HttpOnly cookie at most once per minute while
      // the user is active. No activity means no refresh, so the server cookie
      // expires after 15 minutes even if browser-side state is tampered with.
      void refreshServerSession();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === USER_KEY && event.newValue === null) {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        redirectToLogin();
        return;
      }

      if (event.key === USER_KEY || event.key === LAST_ACTIVITY_KEY) {
        checkExpiry();
      }
    };

    checkExpiry();

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    activityEvents.forEach((name) => {
      window.addEventListener(name, recordActivity, { passive: true });
    });

    const checkOnReturn = () => checkExpiry();
    window.addEventListener("focus", checkOnReturn);
    window.addEventListener("pageshow", checkOnReturn);
    document.addEventListener("visibilitychange", checkOnReturn);
    window.addEventListener("storage", onStorage);

    const interval = window.setInterval(checkExpiry, 5_000);

    return () => {
      window.clearInterval(interval);
      activityEvents.forEach((name) => {
        window.removeEventListener(name, recordActivity);
      });
      window.removeEventListener("focus", checkOnReturn);
      window.removeEventListener("pageshow", checkOnReturn);
      document.removeEventListener("visibilitychange", checkOnReturn);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
