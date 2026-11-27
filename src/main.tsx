import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Vopa Mail could not start.");

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
