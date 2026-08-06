import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { lazy, Suspense, useEffect } from "react";

const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const CharacterSheet = lazy(() => import("@/pages/character-sheet"));
const Bookshelf = lazy(() => import("@/pages/bookshelf"));
const Codex = lazy(() => import("@/pages/codex"));
const Chronicle = lazy(() => import("@/pages/chronicle"));

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
      <Suspense fallback={<div className="min-h-[40vh] grid place-items-center text-muted-foreground">Opening the archive…</div>}>
        <Switch>
          <Route path="/" component={Bookshelf} />
          <Route path="/grimoire" component={Dashboard} />
          <Route path="/codex" component={Codex} />
          <Route path="/chronicle" component={Chronicle} />
          <Route path="/characters/:id" component={CharacterSheet} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
