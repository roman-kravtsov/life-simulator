import { t } from "../i18n";
import { toggleTheme } from "./theme";

export function ThemeToggle() {
  return (
    <button type="button" className="ghost icon" aria-label={t("theme.toggle")} onClick={toggleTheme}>
      {/* Half-filled circle, drawn with currentColor so it follows the theme. */}
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 2a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
    </button>
  );
}
