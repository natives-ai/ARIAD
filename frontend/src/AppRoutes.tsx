import { Route, Routes } from "react-router-dom";

import { AuthCallbackPage } from "./routes/AuthCallbackPage";
import { WorkspaceShell } from "./routes/WorkspaceShell";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WorkspaceShell />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
    </Routes>
  );
}
