import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import DriverLayout from "./components/DriverLayout";
import RequireAdmin from "./components/RequireAdmin";
import RoutesPage from "./pages/RoutesPage";
import LoginPage from "./pages/LoginPage";
import DriverLoginPage from "./pages/DriverLoginPage";
import DriverForgotPasswordPage from "./pages/DriverForgotPasswordPage";
import DriverResetPasswordPage from "./pages/DriverResetPasswordPage";
import DriverDashboardPage from "./pages/DriverDashboardPage";
import AdminPage from "./pages/AdminPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminRoutesPage from "./pages/AdminRoutesPage";
import AdminBusesPage from "./pages/AdminBusesPage";
import AdminFeedbackPage from "./pages/AdminFeedbackPage";
import RouteMapPage from "./pages/RouteMapPage";
import "./index.css";

function AdminRoute({ children }) {
  return (
    <Layout>
      <RequireAdmin>{children}</RequireAdmin>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/driver/login"
            element={
              <DriverLayout>
                <DriverLoginPage />
              </DriverLayout>
            }
          />
          <Route
            path="/driver/forgot-password"
            element={
              <DriverLayout>
                <DriverForgotPasswordPage />
              </DriverLayout>
            }
          />
          <Route
            path="/driver/reset-password"
            element={
              <DriverLayout>
                <DriverResetPasswordPage />
              </DriverLayout>
            }
          />
          <Route
            path="/driver"
            element={
              <DriverLayout>
                <DriverDashboardPage />
              </DriverLayout>
            }
          />
          <Route
            path="/login"
            element={
              <Layout>
                <LoginPage />
              </Layout>
            }
          />
          <Route path="/routes/:routeId/map" element={<AdminRoute><RouteMapPage /></AdminRoute>} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
          <Route path="/admin/routes" element={<AdminRoute><AdminRoutesPage /></AdminRoute>} />
          <Route path="/admin/buses" element={<AdminRoute><AdminBusesPage /></AdminRoute>} />
          <Route path="/admin/feedback" element={<AdminRoute><AdminFeedbackPage /></AdminRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="/" element={<AdminRoute><RoutesPage /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
