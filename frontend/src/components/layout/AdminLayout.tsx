import { ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Building2,
  BookOpen,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "Users", path: "/admin/users" },
  { icon: Building2, label: "Workspaces", path: "/admin/workspaces" },
  { icon: BookOpen, label: "Guides", path: "/admin/guides" },
  { icon: CreditCard, label: "Subscriptions", path: "/admin/subscriptions" },
  { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
  { icon: Settings, label: "Settings", path: "/admin/settings" },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()

  const adminUser = JSON.parse(localStorage.getItem("admin_user") || "{}")

  function handleLogout() {
    localStorage.removeItem("admin_access_token")
    localStorage.removeItem("admin_refresh_token")
    localStorage.removeItem("admin_user")
    navigate("/admin/login")
  }

  return (
    <div className="flex min-h-screen bg-[#0C0D14]">
      <aside className="w-60 h-screen sticky top-0 flex flex-col border-r border-white/5 bg-[#0E0F17]">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/5">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-sm font-semibold text-white">Admin Panel</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition",
                  active
                    ? "bg-red-500/10 text-red-400"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-white/5 p-3 space-y-2">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-sm font-medium">
              {adminUser.full_name?.charAt(0) || adminUser.email?.charAt(0)?.toUpperCase() || "A"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-white truncate">{adminUser.full_name || adminUser.email || "Admin"}</p>
              <p className="text-xs text-gray-500 truncate">Administrator</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition text-xs"
            >
              Back to App
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center px-3 py-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
