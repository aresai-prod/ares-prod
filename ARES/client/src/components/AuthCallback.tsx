import { useEffect } from "react";
import { exchangeGoogleToken, fetchProfile, getGoogleCallbackUrl, setAuthToken } from "../lib/api";
import type { User } from "../lib/types";

type AuthCallbackProps = {
  onAuthed: (user: User) => void;
  onError: (message: string) => void;
};

export default function AuthCallback({ onAuthed, onError }: AuthCallbackProps) {
  useEffect(() => {
    async function handle() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const token = searchParams.get("token") ?? hashParams.get("token");
      const error = searchParams.get("error") ?? hashParams.get("error");
      const code = searchParams.get("code") ?? hashParams.get("code");
      const accessToken = searchParams.get("access_token") ?? hashParams.get("access_token");
      const idToken =
        searchParams.get("id_token") ??
        hashParams.get("id_token") ??
        searchParams.get("credential") ??
        hashParams.get("credential") ??
        searchParams.get("g_id_token") ??
        hashParams.get("g_id_token");
      if (error) {
        onError(error === "google_not_configured" ? "Google login is not configured." : "Google login failed.");
        try {
          window.history.replaceState({}, "", "/");
        } catch {
          // ignore history errors
        }
        return;
      }
      if (!token && code) {
        const state = searchParams.get("state") ?? hashParams.get("state") ?? window.location.origin;
        window.location.href = getGoogleCallbackUrl(code, state);
        return;
      }
      if (!token && (accessToken || idToken)) {
        try {
          const response = await exchangeGoogleToken({ accessToken, idToken });
          setAuthToken(response.token);
          const profile = await fetchProfile();
          onAuthed(profile);
        } catch (err) {
          setAuthToken(null);
          onError(err instanceof Error ? err.message : "Google login failed.");
        } finally {
          try {
            window.history.replaceState({}, "", "/");
          } catch {
            // ignore history errors
          }
        }
        return;
      }
      if (!token) {
        onError("Missing auth token. Ensure Google Redirect URI is set and the API server is running.");
        try {
          window.history.replaceState({}, "", "/");
        } catch {
          // ignore history errors
        }
        return;
      }
      setAuthToken(token);
      try {
        const profile = await fetchProfile();
        onAuthed(profile);
      } catch (err) {
        setAuthToken(null);
        onError(err instanceof Error ? err.message : "Auth failed.");
      } finally {
        try {
          window.history.replaceState({}, "", "/");
        } catch {
          // ignore history errors
        }
      }
    }
    handle();
  }, [onAuthed, onError]);

  return <div className="auth-shell">Completing Google sign-in...</div>;
}
