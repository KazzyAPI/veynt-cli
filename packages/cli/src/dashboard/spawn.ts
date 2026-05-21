export function shouldUseDashboard(noUi: boolean, overrideActive: boolean): boolean {
  if (noUi || overrideActive) {
    return false;
  }
  if (process.env.CI === "true" || process.env.VEYNT_NO_UI === "1") {
    return false;
  }
  return true;
}
