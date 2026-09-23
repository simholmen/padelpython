// localStorage persistence so a page reload mid-tournament doesn't lose state.
// Scoped to this browser/origin only; wrapped in try/catch since storage can be
// unavailable (private browsing, quota exceeded, disabled) -- falls back to
// in-memory-only with a console warning.

const KEY = "nito-padel-tournament-v1";

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Kunne ikke lagre turneringsstatus til localStorage:", err);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Kunne ikke lese lagret turneringsstatus:", err);
    return null;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    console.warn("Kunne ikke tømme lagret turneringsstatus:", err);
  }
}
