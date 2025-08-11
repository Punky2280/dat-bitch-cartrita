import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { NotificationProvider } from "@/components/ui/NotificationProvider";
import "./index.css";
import "./i18n";
import { AmbientProvider } from "@/context/AmbientContext";
import "./setup/apiBaseFetchShim";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AmbientProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AmbientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
