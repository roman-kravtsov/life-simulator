// Tiny DOM helper: h("p", { class: "x" }, "text", child). No framework (design 6).
type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | boolean | ((event: Event) => void) | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === "function") el.addEventListener(name.replace(/^on/, ""), value);
    else if (value === true) el.setAttribute(name, "");
    else el.setAttribute(name, value);
  }
  for (const child of children) if (child) el.append(child);
  return el;
}
