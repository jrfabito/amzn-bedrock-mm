import { HashRouter, BrowserRouter, Routes, Route } from "react-router-dom";
import { USE_BROWSER_ROUTER } from "./common/constants";
import GlobalHeader from "./components/global-header";
import HomePage from "./pages/home";
import CreateMigrationPage from "./pages/create-migration";
import MigrationResultsPage from "./pages/migration-results";
import ProvidePromptTemplatesPage from "./pages/provide-prompt-templates";
import StartShadowTestingPage from "./pages/start-shadow-testing";
import "./styles/app.scss";
import NotFound from "./pages/not-found";

export default function App() {
  const Router = USE_BROWSER_ROUTER ? BrowserRouter : HashRouter;

  return (
    <div style={{ height: "100%" }}>
      <Router>
        <GlobalHeader />
        <div style={{ height: "56px", backgroundColor: "#000716" }}>&nbsp;</div>
        <div>
          <Routes>
            <Route index path="/" element={<HomePage />} />
            <Route path="/create-migration" element={<CreateMigrationPage />} />
            <Route path="/results/:jobId" element={<MigrationResultsPage />} />
            <Route path="/provide-prompt-templates" element={<ProvidePromptTemplatesPage />} />
            <Route path="/start-shadow-testing" element={<StartShadowTestingPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
}
