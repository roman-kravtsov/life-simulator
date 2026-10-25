import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadCountry, loadIndex } from "./data";
import "./styles.css";
import { browserPersistence } from "./save";
import { App } from "./ui/App";
import { browserSeed, createGameStore } from "./ui/store";

const store = createGameStore(browserSeed, { loadIndex, loadCountry }, browserPersistence());
store.init();

createRoot(document.getElementById("main")!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
