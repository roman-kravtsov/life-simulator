import "./styles.css";
import { startApp } from "./ui/app";
import { applyStoredTheme } from "./ui/theme";

applyStoredTheme();
startApp(document.getElementById("main")!);
