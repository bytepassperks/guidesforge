import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/hooks/useAuth"
import { ReactNode } from "react"

// Pages
import Landing from "@/pages/Landing"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import ForgotPassword from "@/pages/ForgotPassword"
import Dashboard from "@/pages/Dashboard"
import GuideEditor from "@/pages/GuideEditor"
import GuideViewer from "@/pages/GuideViewer"
import Analytics from "@/pages/Analytics"
import Settings from "@/pages/Settings"
import Billing from "@/pages/Billing"
import HelpCenter from "@/pages/HelpCenter"
import HelpGuide from "@/pages/HelpGuide"
import EmbedViewer from "@/pages/EmbedViewer"
import Privacy from "@/pages/Privacy"
import Terms from "@/pages/Terms"
import ContactSales from "@/pages/ContactSales"
import NotFound from "@/pages/NotFound"

// Admin pages
import AdminLogin from "@/pages/admin/AdminLogin"
import AdminDashboard from "@/pages/admin/AdminDashboard"
import AdminUsers from "@/pages/admin/AdminUsers"
import AdminWorkspaces from "@/pages/admin/AdminWorkspaces"
import AdminGuides from "@/pages/admin/AdminGuides"
import AdminSubscriptions from "@/pages/admin/AdminSubscriptions"
import AdminAnalytics from "@/pages/admin/AdminAnalytics"
import AdminSettings from "@/pages/admin/AdminSettings"

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="GuidesForge" className="w-12 h-12 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/contact-sales" element={<ContactSales />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/guides/:guideId/edit" element={<ProtectedRoute><GuideEditor /></ProtectedRoute>} />
      <Route path="/guides/:guideId" element={<ProtectedRoute><GuideViewer /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />

      {/* Public help center */}
      <Route path="/help/:workspaceSlug" element={<HelpCenter />} />
      <Route path="/help/:workspaceSlug/guides/:guideId" element={<HelpGuide />} />

      {/* Embed viewer */}
      <Route path="/embed/:guideId" element={<EmbedViewer />} />

      {/* Admin routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/workspaces" element={<AdminWorkspaces />} />
      <Route path="/admin/guides" element={<AdminGuides />} />
      <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
      <Route path="/admin/analytics" element={<AdminAnalytics />} />
      <Route path="/admin/settings" element={<AdminSettings />} />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
