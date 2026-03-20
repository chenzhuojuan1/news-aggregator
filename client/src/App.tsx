import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import SourcesPage from "./pages/SourcesPage";
import KeywordsPage from "./pages/KeywordsPage";
import ManualPage from "./pages/ManualPage";
import ReportsPage from "./pages/ReportsPage";
import EmailPage from "./pages/EmailPage";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sources" component={SourcesPage} />
        <Route path="/keywords" component={KeywordsPage} />
        <Route path="/manual" component={ManualPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/email" component={EmailPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
