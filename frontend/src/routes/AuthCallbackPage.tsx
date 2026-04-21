import { useLocation } from "react-router-dom";

import { copy } from "../copy";
import { loadFrontendEnv } from "../config/env";

export function AuthCallbackPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const env = loadFrontendEnv();

  return (
    <main className="auth-callback">
      <span className="eyebrow">Route Baseline</span>
      <h1>{copy.auth.title}</h1>
      <p>{copy.auth.callbackDescription}</p>
      <dl className="callback-grid">
        <div>
          <dt>Configured path</dt>
          <dd>{env.authCallbackPath}</dd>
        </div>
        <div>
          <dt>code</dt>
          <dd>{params.get("code") ?? "missing"}</dd>
        </div>
        <div>
          <dt>state</dt>
          <dd>{params.get("state") ?? "missing"}</dd>
        </div>
      </dl>
    </main>
  );
}
