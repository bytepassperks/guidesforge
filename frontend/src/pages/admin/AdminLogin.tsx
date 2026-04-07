import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { adminAuthAPI } from "@/services/adminApi"
import { Shield, Loader2, AlertCircle } from "lucide-react"

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Try admin login first
      let res
      try {
        res = await adminAuthAPI.login({ email, password })
      } catch (loginErr: unknown) {
        const err = loginErr as { response?: { status?: number } }
        // If no admin exists yet, try bootstrap
        if (err.response?.status === 403 || err.response?.status === 401) {
          try {
            res = await adminAuthAPI.bootstrap({ email, password })
          } catch {
            throw loginErr
          }
        } else {
          throw loginErr
        }
      }

      localStorage.setItem("admin_access_token", res.data.access_token)
      localStorage.setItem("admin_refresh_token", res.data.refresh_token)
      localStorage.setItem("admin_user", JSON.stringify(res.data.user))
      navigate("/admin")
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-1">GuidesForge Administration</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-red-500 outline-none transition"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-red-500 outline-none transition"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {loading ? "Signing in..." : "Sign in to Admin"}
          </button>
        </form>
      </div>
    </div>
  )
}
