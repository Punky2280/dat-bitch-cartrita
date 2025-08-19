import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { NotificationProvider } from "@/components/ui/NotificationProvider";
import "./index.css";
import "./i18n";
import { AmbientProvider } from "@/context/AmbientContext";
import { ThemeProvider } from "@/theme/ThemeProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AmbientProvider>
        <ThemeProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </ThemeProvider>
      </AmbientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
