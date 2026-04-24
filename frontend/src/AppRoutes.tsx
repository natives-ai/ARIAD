import { Route, Routes } from "react-router-dom";

import { AuthCallbackPage } from "./routes/AuthCallbackPage";
import { ExplanationPage } from "./routes/ExplanationPage";
import { LandingPage } from "./routes/LandingPage";
import { WorkspaceShell } from "./routes/WorkspaceShell";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/service.html" element={<LandingPage />} />
      <Route path="/explanation" element={<ExplanationPage />} />
      <Route path="/workspace" element={<WorkspaceShell />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
    </Routes>
  );
}
