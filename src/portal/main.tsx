import { createRoot } from "react-dom/client";
import "nes.css/css/nes.min.css";
import "./portal.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
