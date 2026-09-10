import { Navigate, Route, Routes } from "react-router-dom";
import { AppShellLayout } from "./components/AppShellLayout";
import { ProductsPage } from "./features/products/ProductsPage";
import { SuppliersPage } from "./features/suppliers/SuppliersPage";
import { ExpensesPage } from "./features/expenses/ExpensesPage";
import { MarketplacesPage } from "./features/marketplaces/MarketplacesPage";
import { MarketplaceDetailPage } from "./features/marketplaces/MarketplaceDetailPage";

export default function App() {
    return (
        <Routes>
            <Route element={<AppShellLayout />}>
                <Route index element={<Navigate to="/products" replace />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/marketplaces" element={<MarketplacesPage />} />
                <Route
                    path="/marketplaces/:marketplaceId"
                    element={<MarketplaceDetailPage />}
                />
                <Route path="*" element={<Navigate to="/products" replace />} />
            </Route>
        </Routes>
    );
}
