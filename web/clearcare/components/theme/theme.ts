export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

// Apply the saved theme before first paint to avoid a flash of the system theme.
export const APPLY_SAVED_THEME_SCRIPT = `(function () {
  try {
    var theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch (error) {}
})();`;
