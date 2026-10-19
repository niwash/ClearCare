export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

// "standard" is the design for general users; "adult-centred" adds the changes for older readers.
export type Design = "standard" | "adult-centred";

export const DESIGN_STORAGE_KEY = "design";

// Apply the saved theme and design before first paint to avoid a flash of the defaults.
export const APPLY_SAVED_THEME_SCRIPT = `(function () {
  try {
    var theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    var design = localStorage.getItem(${JSON.stringify(DESIGN_STORAGE_KEY)});
    if (design === "adult-centred") document.documentElement.dataset.design = design;
  } catch (error) {}
})();`;
