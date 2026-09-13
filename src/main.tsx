import React from "react"
import ReactDOM from "react-dom/client"
import App from "@/app/App"
import { AppConfigProvider } from "@/domains/persistence"
import { I18nProvider } from "@/shared/i18n"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppConfigProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </AppConfigProvider>
  </React.StrictMode>,
)

postMessage({ payload: "removeLoading" }, "*")
