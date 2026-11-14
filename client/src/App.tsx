import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import SiteLayout from "./components/store/SiteLayout";
import { CartProvider } from "./contexts/CartContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "./pages/NotFound";
import { Route, Switch } from "wouter";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const Home = lazy(() => import("./pages/Home"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const ManageOrderPage = lazy(() => import("./pages/ManageOrderPage"));

function WomenPage() { return <CategoryPage category="women" />; }
function KidsPage() { return <CategoryPage category="kids" />; }

function Router() {
  return (
    <Suspense fallback={<div className="page-loading">جارٍ تجهيز الصفحة…</div>}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/women" component={WomenPage} />
        <Route path="/kids" component={KidsPage} />
        <Route path="/product/:id" component={ProductPage} />
        <Route path="/cart" component={CartPage} />
        <Route path="/checkout" component={CheckoutPage} />
        <Route path="/my-order" component={ManageOrderPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <CartProvider>
            <Toaster position="top-center" dir="rtl" />
            <SiteLayout><Router /></SiteLayout>
          </CartProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
