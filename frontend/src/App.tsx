import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/hooks/useAuth"
import { ReactNode } from "react"

// Pages
import Landing from "@/pages/Landing"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import Dashboard from "@/pages/Dashboard"
import GuideEditor from "@/pages/GuideEditor"
import GuideViewer from "@/pages/GuideViewer"
import Analytics from "@/pages/Analytics"
import Settings from "@/pages/Settings"
import Billing from "@/pages/Billing"
import HelpCenter from "@/pages/HelpCenter"
import HelpGuide from "@/pages/HelpGuide"
import EmbedViewer from "@/pages/EmbedViewer"

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

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/guides/:guideId/edit" element={<ProtectedRoute><GuideEditor /></ProtectedRoute>} />
      <Route path="/guides/:guideId" element={<ProtectedRoute><GuideViewer /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />

      {/* Public help center */}
      <Route path="/help" element={<HelpCenter />} />
      <Route path="/help/:workspaceSlug" element={<HelpCenter />} />
      <Route path="/help/:workspaceSlug/guides/:guideId" element={<HelpGuide />} />

      {/* Embed viewer */}
      <Route path="/embed/:guideId" element={<EmbedViewer />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
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
