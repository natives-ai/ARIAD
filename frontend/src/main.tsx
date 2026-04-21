import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";

import { AppRoutes } from "./AppRoutes";
import { detectFrontendRuntimeMode } from "./runtime";
import "./styles.css";

const Router = detectFrontendRuntimeMode() === "standalone" ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <AppRoutes />
    </Router>
  </React.StrictMode>
);
