import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { authAPI } from "@/services/api"

interface User {
  id: string
  email: string
  full_name: string | null
  plan: string
  plan_currency: string | null
  voice_profile_url: string | null
  avatar_photo_url: string | null
  trial_ends_at: string | null
  created_at: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (token) {
      refreshUser().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function refreshUser() {
    try {
      const res = await authAPI.me()
      setUser(res.data)
    } catch {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      setUser(null)
    }
  }

  async function login(email: string, password: string) {
    const res = await authAPI.login({ email, password })
    localStorage.setItem("access_token", res.data.access_token)
    localStorage.setItem("refresh_token", res.data.refresh_token)
    await refreshUser()
  }

  async function register(email: string, password: string, fullName: string) {
    const res = await authAPI.register({ email, password, full_name: fullName })
    localStorage.setItem("access_token", res.data.access_token)
    localStorage.setItem("refresh_token", res.data.refresh_token)
    await refreshUser()
  }

  function logout() {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    setUser(null)
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
