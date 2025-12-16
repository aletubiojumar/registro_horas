const KEY = "theme:dark";

export function applyTheme(isDark: boolean) {
  const root = document.documentElement; // <html>
  root.classList.toggle("dark", isDark);
  localStorage.setItem(KEY, isDark ? "1" : "0");
}

export function readTheme(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function initTheme() {
  applyTheme(readTheme());
}
