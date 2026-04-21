declare global {
  interface Window {
    __SCENAAIRO_STANDALONE__?: boolean;
  }
}

export type FrontendRuntimeMode = "served" | "standalone";

export function detectFrontendRuntimeMode(): FrontendRuntimeMode {
  if (
    typeof window !== "undefined" &&
    (window.__SCENAAIRO_STANDALONE__ === true || window.location.protocol === "file:")
  ) {
    return "standalone";
  }

  return "served";
}
