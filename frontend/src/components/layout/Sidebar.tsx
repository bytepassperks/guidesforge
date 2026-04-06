import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Settings,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: CreditCard, label: "Billing", path: "/billing" },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col border-r border-white/5 bg-[#0E0F17] transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/5">
        <Link to="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <img src="/logo.png" alt="GuidesForge" className="w-8 h-8 rounded-lg shrink-0" />
          {!collapsed && <span className="text-sm font-semibold gradient-text whitespace-nowrap">GuidesForge</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition",
                active
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-white/5 p-3 space-y-2">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-medium shrink-0">
              {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-white truncate">{user.full_name || user.email}</p>
              <p className="text-xs text-gray-500 truncate">{user.plan} plan</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition text-sm"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={logout}
            className="flex items-center justify-center px-3 py-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
