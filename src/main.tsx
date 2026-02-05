import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No #root element");

try {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  rootEl.innerHTML = `<p style="padding:1rem;font-family:system-ui;color:#c00">Failed to load: ${String(err)}</p>`;
  console.error(err);
}
