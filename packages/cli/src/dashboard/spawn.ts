export function shouldUseDashboard(noUi: boolean): boolean {
  if (noUi) {
    return false;
  }
  if (process.env.CI === "true" || process.env.VEYNT_NO_UI === "1") {
    return false;
  }
  return true;
}
