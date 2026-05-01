declare global {
  interface Window {
    __ARIAD_STANDALONE__?: boolean;
  }
}

export type FrontendRuntimeMode = "served" | "standalone";

export function detectFrontendRuntimeMode(): FrontendRuntimeMode {
  if (
    typeof window !== "undefined" &&
    (window.__ARIAD_STANDALONE__ === true || window.location.protocol === "file:")
  ) {
    return "standalone";
  }

  return "served";
}
