// Dev-only features (like the setup screen's "add test players" button) are
// gated on this, so they only ever show up when running locally and never on
// the deployed site.
export function isDevMode() {
  return typeof location !== "undefined" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1");
}
