// 이 페이지는 Google 로그인 콜백 응답을 받아 세션 연동 결과를 표시합니다.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { copy } from "../copy";
import { loadFrontendEnv } from "../config/env";

// 인증 콜백 페이지 상태입니다.
type CallbackStatus = "idle" | "processing" | "success" | "skipped" | "error";

export function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const env = loadFrontendEnv();
  const [status, setStatus] = useState<CallbackStatus>("idle");
  const [statusText, setStatusText] = useState("No action required.");
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const credential = query.get("credential");
  const code = query.get("code");

  useEffect(() => {
    if (!credential && !code) {
      setStatus("skipped");
      setStatusText("No identity credential found in callback.");
      return;
    }

    if (!credential) {
      setStatus("skipped");
      setStatusText("Redirect callback shape is not handled yet. Use Google identity credential flow.");
      return;
    }

    let cancelled = false;

    const run = async () => {
      setStatus("processing");
      setStatusText("Exchanging Google credential for a session...");

      try {
        const response = await fetch(`${env.apiBaseUrl}/auth/google/login`, {
          body: JSON.stringify({ credential }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });

        if (!response.ok) {
          throw new Error(`google_exchange_failed:${response.status}`);
        }

        if (!cancelled) {
          setStatus("success");
          setStatusText("Session exchange completed.");
          window.setTimeout(() => {
            if (!cancelled) {
              navigate("/", { replace: true });
            }
          }, 600);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setStatusText(
            error instanceof Error ? error.message : "Google session exchange failed."
          );
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [code, credential, env.apiBaseUrl, navigate]);

  const statusLabel = () => {
    if (status === "processing") {
      return "processing";
    }
    if (status === "success") {
      return "success";
    }
    if (status === "error") {
      return "error";
    }

    return "idle";
  };

  return (
    <main className="auth-callback">
      <span className="eyebrow">Route Baseline</span>
      <h1>{copy.auth.title}</h1>
      <p>{copy.auth.callbackDescription}</p>
      <dl className="callback-grid">
        <div>
          <dt>status</dt>
          <dd>{statusLabel()}</dd>
        </div>
        <div>
          <dt>message</dt>
          <dd>{statusText}</dd>
        </div>
      </dl>
      <dl className="callback-grid">
        <div>
          <dt>Configured path</dt>
          <dd>{env.authCallbackPath}</dd>
        </div>
        <div>
          <dt>code</dt>
          <dd>{query.get("code") ?? "missing"}</dd>
        </div>
        <div>
          <dt>state</dt>
          <dd>{query.get("state") ?? "missing"}</dd>
        </div>
      </dl>
    </main>
  );
}
