import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyStoredTheme } from "./layout/Shell";
import { apiBase, isNative } from "./store/api";
// Tipografía incluida en la app (funciona sin internet y no envía datos a terceros)
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./styles.css";

applyStoredTheme();

/* Errores de la app: se reportan al servidor (el administrador los ve en «Sistema») */
let reported = 0;
function report(message, stack) {
  if (!import.meta.env.PROD || reported++ > 10 || !message) return;
  try {
    fetch(`${apiBase()}/api/report-error`, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ message: String(message).slice(0, 500), stack: String(stack || "").slice(0, 6000), path: location.hash || location.pathname }) }).catch(() => {});
  } catch { /* nada */ }
}
window.addEventListener("error", (e) => { if (e.message && !/ResizeObserver|Script error/.test(e.message)) report(e.message, e.error?.stack); });
window.addEventListener("unhandledrejection", (e) => report(e.reason?.message || String(e.reason), e.reason?.stack));
window.__vytrafitReport = report;

/* Service worker: abrir sin conexión y recibir notificaciones (solo en la web publicada) */
if (import.meta.env.PROD && !isNative() && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {}); });
}

/** Si una pantalla falla, se muestra un aviso con «Recargar» en lugar de una página en blanco. */
class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { report(error?.message, `${error?.stack || ""}\n${info?.componentStack || ""}`); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "var(--body)" }}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>Algo salió mal</h1>
          <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>Ya nos llegó el aviso. Tus datos están a salvo: recarga para seguir.</p>
          <button className="btn btn-primary btn-lg" onClick={() => location.reload()}>Recargar</button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Boundary><App /></Boundary>
  </StrictMode>,
);
