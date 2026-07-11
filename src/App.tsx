import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import CharacterSheet from "@/pages/character-sheet";
import Bookshelf from "@/pages/bookshelf";
import Codex from "@/pages/codex";
import Chronicle from "@/pages/chronicle";

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();

  useEffect(() => {
    let scope = "bookshelf";
    if (location.startsWith("/grimoire") || location.match(/^\/characters\/\d+/)) {
      scope = "grimoire";
    } else if (location.startsWith("/codex")) {
      scope = "codex";
    } else if (location.startsWith("/chronicle")) {
      scope = "chronicle";
    }

    const savedTheme = localStorage.getItem(`aetherborne_theme_${scope}`) || "theme-grimoire";
    document.documentElement.className = savedTheme;
    
    const savedRadius = localStorage.getItem(`aetherborne_radius_${scope}`) || "0px";
    document.documentElement.style.setProperty("--radius", savedRadius);
  }, [location]);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Bookshelf} />
        <Route path="/grimoire" component={Dashboard} />
        <Route path="/codex" component={Codex} />
        <Route path="/chronicle" component={Chronicle} />
        <Route path="/characters/:id" component={CharacterSheet} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;