import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./ui/App";
import { browserSeed, createGameStore } from "./ui/store";
import { applyStoredTheme } from "./ui/theme";

applyStoredTheme();
const store = createGameStore(browserSeed);

createRoot(document.getElementById("main")!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
