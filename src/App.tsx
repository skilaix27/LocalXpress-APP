import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Lazy-loaded pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminStops = lazy(() => import("./pages/admin/AdminStops"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers"));
const AdminMap = lazy(() => import("./pages/admin/AdminMap"));
const AdminHistory = lazy(() => import("./pages/admin/AdminHistory"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const ShopLayout = lazy(() => import("./pages/shop/ShopLayout"));
const ShopDashboard = lazy(() => import("./pages/shop/ShopDashboard"));
const ShopNewStop = lazy(() => import("./pages/shop/ShopNewStop"));
const ShopHistory = lazy(() => import("./pages/shop/ShopHistory"));
const DriverApp = lazy(() => import("./pages/driver/DriverApp"));

const PageLoader = () => (
  <div className="h-[100dvh] flex items-center justify-center bg-background">
    <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s — avoid refetching data that's still fresh
      gcTime: 5 * 60_000,      // 5min — keep unused data in cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Index - redirects based on role */}
            <Route path="/" element={<Index />} />
            
            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="stops" element={<AdminStops />} />
              <Route path="users" element={<AdminDrivers />} />
              <Route path="map" element={<AdminMap />} />
              <Route path="history" element={<AdminHistory />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            
            {/* Shop routes */}
            <Route
              path="/shop"
              element={
                <ProtectedRoute requiredRole="shop">
                  <ShopLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ShopDashboard />} />
              <Route path="new" element={<ShopNewStop />} />
              <Route path="history" element={<ShopHistory />} />
            </Route>

            {/* Driver routes */}
            <Route
              path="/driver"
              element={
                <ProtectedRoute requiredRole="driver">
                  <DriverApp />
                </ProtectedRoute>
              }
            />
            
            {/* Catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
