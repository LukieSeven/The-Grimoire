import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { lazy, Suspense, useEffect } from "react";

function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const pageHasBeenReloaded = sessionStorage.getItem("page_chunk_reloaded") === "true";
    try {
      const component = await componentImport();
      sessionStorage.setItem("page_chunk_reloaded", "false");
      return component;
    } catch (error) {
      if (!pageHasBeenReloaded) {
        sessionStorage.setItem("page_chunk_reloaded", "true");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}

const NotFound = lazyWithRetry(() => import("@/pages/not-found"));
const Dashboard = lazyWithRetry(() => import("@/pages/dashboard"));
const CharacterSheet = lazyWithRetry(() => import("@/pages/character-sheet"));
const Bookshelf = lazyWithRetry(() => import("@/pages/bookshelf"));
const Codex = lazyWithRetry(() => import("@/pages/codex"));
const Chronicle = lazyWithRetry(() => import("@/pages/chronicle"));

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

const getBase = () => {
  const envBase = import.meta.env.BASE_URL;
  if (!envBase || envBase === "/" || envBase === "." || envBase === "./") {
    return "";
  }
  return envBase.replace(/\/$/, "");
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={getBase()}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
