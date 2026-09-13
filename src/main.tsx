import React from "react"
import ReactDOM from "react-dom/client"
import App from "@/app/App"
import { AppConfigProvider } from "@/domains/persistence"
import { UpdaterProvider } from "@/domains/updater"
import { I18nProvider } from "@/shared/i18n"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppConfigProvider>
      <I18nProvider>
        <UpdaterProvider>
          <App />
        </UpdaterProvider>
      </I18nProvider>
    </AppConfigProvider>
  </React.StrictMode>,
)

postMessage({ payload: "removeLoading" }, "*")
