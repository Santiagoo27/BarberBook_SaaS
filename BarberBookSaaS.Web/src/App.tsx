import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CookieBanner } from "./components/CookieBanner";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { Login } from "./features/auth/Login";

const AdminLayout = lazy(() => import("./components/AdminLayout").then(m => ({ default: m.AdminLayout })));
const BarberLayout = lazy(() => import("./components/BarberLayout").then(m => ({ default: m.BarberLayout })));
const SuperAdminLayout = lazy(() => import("./components/SuperAdminLayout").then(m => ({ default: m.SuperAdminLayout })));

const Dashboard = lazy(() => import("./features/dashboard/Dashboard").then(m => ({ default: m.Dashboard })));
const BarberManagement = lazy(() => import("./features/barbers/BarberManagement").then(m => ({ default: m.BarberManagement })));
const ServiceManagement = lazy(() => import("./features/services/ServiceManagement").then(m => ({ default: m.ServiceManagement })));
const AppointmentManagement = lazy(() => import("./features/appointments/AppointmentManagement").then(m => ({ default: m.AppointmentManagement })));
const LocationManagement = lazy(() => import("./features/locations/LocationManagement").then(m => ({ default: m.LocationManagement })));
const BarberDashboard = lazy(() => import("./features/barbers/BarberDashboard").then(m => ({ default: m.BarberDashboard })));
const BarberSchedule = lazy(() => import("./features/barbers/BarberSchedule").then(m => ({ default: m.BarberSchedule })));
const BrandingPage = lazy(() => import("./features/branding/BrandingPage").then(m => ({ default: m.BrandingPage })));
const BookingPage = lazy(() => import("./features/booking/BookingPage").then(m => ({ default: m.BookingPage })));
const SuperAdminPage = lazy(() => import("./features/superadmin/SuperAdminPage").then(m => ({ default: m.SuperAdminPage })));
const ReviewPage = lazy(() => import("./features/reviews/ReviewPage").then(m => ({ default: m.ReviewPage })));
const ReschedulePage = lazy(() => import("./features/booking/ReschedulePage").then(m => ({ default: m.ReschedulePage })));
const AdminReviews = lazy(() => import("./features/reviews/AdminReviews").then(m => ({ default: m.AdminReviews })));
const CustomerPage = lazy(() => import("./features/customers/CustomerPage").then(m => ({ default: m.CustomerPage })));
const LandingPage = lazy(() => import("./features/landing/LandingPage").then(m => ({ default: m.LandingPage })));
const DemoPage = lazy(() => import("./features/demo/DemoPage").then(m => ({ default: m.DemoPage })));
const PrivacyPolicy = lazy(() => import("./features/legal/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy })));
const TermsAndConditions = lazy(() => import("./features/legal/TermsAndConditions").then(m => ({ default: m.TermsAndConditions })));
const SuggestionsPage = lazy(() => import("./features/suggestions/SuggestionsPage").then(m => ({ default: m.SuggestionsPage })));
const ForgotPassword = lazy(() => import("./features/auth/ForgotPassword").then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import("./features/auth/ResetPassword").then(m => ({ default: m.ResetPassword })));

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              {/* Rutas públicas */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/book/:subdomain/citas" element={<BookingPage />} />
              <Route path="/book/:subdomain" element={<BookingPage />} />
              <Route path="/review/:subdomain" element={<ReviewPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/r/:token" element={<ReschedulePage />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsAndConditions />} />

              {/* Rutas Admin */}
              <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
                <Route element={<AdminLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/barbers" element={<BarberManagement />} />
                  <Route path="/customers" element={<CustomerPage />} />
                  <Route path="/services" element={<ServiceManagement />} />
                  <Route path="/appointments" element={<AppointmentManagement />} />
                  <Route path="/locations" element={<LocationManagement />} />
                  <Route path="/reviews" element={<AdminReviews />} />
                  <Route path="/branding" element={<BrandingPage />} />
                  <Route path="/suggestions" element={<SuggestionsPage />} />
                </Route>
              </Route>

              {/* Rutas SuperAdmin */}
              <Route element={<ProtectedRoute allowedRoles={["SuperAdmin"]} />}>
                <Route element={<SuperAdminLayout />}>
                  <Route path="/superadmin" element={<SuperAdminPage />} />
                </Route>
              </Route>

              {/* Rutas Barbero */}
              <Route element={<ProtectedRoute allowedRoles={["Barbero"]} />}>
                <Route element={<BarberLayout />}>
                  <Route path="/barber" element={<BarberDashboard />} />
                  <Route path="/barber/schedule" element={<BarberSchedule />} />
                </Route>
              </Route>

              {/* Landing pública y catch-all */}
              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <CookieBanner />
          <SpeedInsights />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
