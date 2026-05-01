// 이 파일은 앱의 주요 라우트를 연결합니다.
import { Route, Routes } from "react-router-dom";

import { AuthCallbackPage } from "./routes/AuthCallbackPage";
import { LandingPage } from "./routes/LandingPage";
import { WorkspaceShell } from "./routes/WorkspaceShell";

// 앱 진입 경로를 화면 컴포넌트에 매핑합니다.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/service.html" element={<LandingPage />} />
      <Route path="/explanation" element={<LandingPage />} />
      <Route path="/workspace" element={<WorkspaceShell />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
    </Routes>
  );
}
