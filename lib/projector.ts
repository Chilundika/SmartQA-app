export const PROJECTOR_KEY = "rsm_projector";

export function readProjector(): boolean {
  try {
    return localStorage.getItem(PROJECTOR_KEY) === "1";
  } catch {
    return false;
  }
}

export function applyProjector(on: boolean): void {
  document.documentElement.classList.toggle("projector", on);
}

export function persistProjector(on: boolean): void {
  applyProjector(on);
  try {
    localStorage.setItem(PROJECTOR_KEY, on ? "1" : "0");
  } catch {
    /* private mode — class still applies for this visit */
  }
}
