/**
 * Single source of truth for the security and caching policy.
 * Both the build (host header files) and the Node server import this so the
 * two never drift apart.
 */

export const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // MediaPipe compiles WebAssembly at runtime; 'wasm-unsafe-eval' allows that
  // without opening the door to arbitrary eval().
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/** Long-lived immutable assets, short-lived documents. */
export function cacheControlFor(pathname) {
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/vendor/mediapipe/"))
    return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/vendor/")) return "public, max-age=604800";
  if (pathname === "/sw.js") return "no-cache";
  if (pathname === "/index.html" || pathname === "/" || pathname === "")
    return "no-cache";
  if (pathname === "/version.json") return "no-cache";
  if (pathname === "/manifest.webmanifest") return "public, max-age=3600";
  if (pathname.endsWith(".png")) return "public, max-age=604800";
  return "public, max-age=3600";
}
