import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import DevicesPage from './pages/DevicesPage';
import ConnectCallbackPage from './pages/ConnectCallbackPage';
import SimulationsPage from './pages/SimulationsPage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';
import IntakePage from './pages/IntakePage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import PrivacyPage from './pages/PrivacyPage';
import InstallPromptModal from './components/InstallPromptModal';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/analytics" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        }
      />
      <Route
        path="/simulation"
        element={
          <ProtectedRoute>
            <SimulationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/devices"
        element={
          <ProtectedRoute>
            <DevicesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/intake"
        element={
          <ProtectedRoute>
            <IntakePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={<Navigate to="/devices" replace />}
      />
      <Route
        path="/connect"
        element={<Navigate to="/devices?tab=add" replace />}
      />
      <Route
        path="/connect/callback/:provider"
        element={
          <ProtectedRoute>
            <ConnectCallbackPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/privacy"
        element={
          <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
            <PrivacyPage />
          </div>
        }
      />
      <Route path="/dashboard" element={<Navigate to="/analytics" replace />} />
      <Route path="/simulations" element={<Navigate to="/simulation" replace />} />
      <Route path="/goals" element={<Navigate to="/analytics" replace />} />
      <Route path="/achievements" element={<Navigate to="/analytics" replace />} />
      <Route path="/coach" element={<Navigate to="/analytics" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <InstallPromptModal />
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
