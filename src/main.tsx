import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Catch stale chunk 404s from dynamic lazy imports after a new build deploy
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const msg = typeof reason === "string" ? reason : reason?.message || "";
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  ) {
    const key = "grimoire_chunk_reload_time";
    const last = sessionStorage.getItem(key);
    const now = Date.now();
    if (!last || now - parseInt(last, 10) > 10000) {
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
