import { Switch, Route, Router as WouterRouter, Link, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Camera, Grid3X3 } from "lucide-react";

import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function BottomNav() {
  const [atHome] = useRoute("/");
  const [atCatalog] = useRoute("/catalog");

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-t border-stone-200 flex">
      <Link
        href="/"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
          atHome ? "text-primary" : "text-stone-400 hover:text-stone-600"
        }`}
      >
        <Camera className="w-5 h-5" />
        <span className="text-xs font-medium">Фото</span>
        {atHome && <span className="absolute bottom-1.5 w-5 h-0.5 bg-primary rounded-full" />}
      </Link>
      <Link
        href="/catalog"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
          atCatalog ? "text-primary" : "text-stone-400 hover:text-stone-600"
        }`}
      >
        <Grid3X3 className="w-5 h-5" />
        <span className="text-xs font-medium">Каталог</span>
        {atCatalog && <span className="absolute bottom-1.5 w-5 h-0.5 bg-primary rounded-full" />}
      </Link>
    </nav>
  );
}

function Router() {
  return (
    <>
      <div className="pb-16">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/catalog" component={Catalog} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <BottomNav />
    </>
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
