// All player-facing text goes through t(key, vars) (L10N-001).
import { en } from "./content/strings/en";

/** BCP 47 code of the language the strings and number formats use. */
export const DEFAULT_LOCALE = "en";

export type Strings = Readonly<Record<string, string>>;
export type Vars = Readonly<Record<string, string | number>>;

export function createTranslator(strings: Strings) {
  return (key: string, vars: Vars = {}): string => {
    const template = strings[key];
    if (template === undefined) throw new Error(`Missing string: ${key}`);
    return template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = vars[name];
      if (value === undefined) throw new Error(`Missing variable "${name}" for string ${key}`);
      return String(value);
    });
  };
}

export const t = createTranslator(en);
