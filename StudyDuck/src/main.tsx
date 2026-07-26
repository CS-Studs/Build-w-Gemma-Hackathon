import "./global.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { isWidgetWindow } from "./windows";

// Stamped before the first paint so the widget window never flashes opaque.
document.documentElement.dataset.window = isWidgetWindow ? "widget" : "workspace";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
