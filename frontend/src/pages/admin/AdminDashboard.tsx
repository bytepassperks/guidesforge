import { useQuery } from "@tanstack/react-query"
import AdminLayout from "@/components/layout/AdminLayout"
import { adminStatsAPI } from "@/services/adminApi"
import {
  Users,
  Building2,
  BookOpen,
  CreditCard,
  TrendingUp,
  Eye,
  Loader2,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminStatsAPI.getStats(),
  })
  const stats = data?.data

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-red-400" />
        </div>
      </AdminLayout>
    )
  }

  const statCards = [
    { label: "Total Users", value: stats?.total_users || 0, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Workspaces", value: stats?.total_workspaces || 0, icon: Building2, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Total Guides", value: stats?.total_guides || 0, icon: BookOpen, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Active Subs", value: stats?.total_active_subscriptions || 0, icon: CreditCard, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "New Users (7d)", value: stats?.new_users_7d || 0, icon: TrendingUp, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Views (30d)", value: stats?.total_views_30d || 0, icon: Eye, color: "text-pink-400", bg: "bg-pink-500/10" },
  ]

  return (
    <AdminLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Admin Dashboard</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="glass-card rounded-2xl p-4">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Daily signups chart */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Daily Signups (30 days)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.daily_signups || []}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1A1B23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                    labelStyle={{ color: "#fff" }}
                    itemStyle={{ color: "#ef4444" }}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Plan breakdown */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Users by Plan</h2>
            <div className="space-y-3">
              {Object.entries(stats?.plan_breakdown || {}).map(([plan, count]) => {
                const total = stats?.total_users || 1
                const pct = Math.round(((count as number) / total) * 100)
                const colors: Record<string, string> = {
                  free: "bg-gray-500",
                  starter: "bg-blue-500",
                  pro: "bg-indigo-500",
                  business: "bg-purple-500",
                }
                return (
                  <div key={plan}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 capitalize">{plan}</span>
                      <span className="text-gray-500">{count as number} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[plan] || "bg-gray-500"} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <h2 className="text-sm font-semibold text-white mt-6 mb-4">Guide Status</h2>
            <div className="space-y-3">
              {Object.entries(stats?.status_breakdown || {}).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span className="text-gray-300 capitalize">{status}</span>
                  <span className="text-gray-500">{count as number}</span>
                </div>
              ))}
            </div>

            <h2 className="text-sm font-semibold text-white mt-6 mb-4">Active Subscriptions by Provider</h2>
            <div className="space-y-3">
              {Object.entries(stats?.revenue_breakdown || {}).map(([provider, count]) => (
                <div key={provider} className="flex justify-between text-sm">
                  <span className="text-gray-300 capitalize">{provider}</span>
                  <span className="text-gray-500">{count as number}</span>
                </div>
              ))}
              {Object.keys(stats?.revenue_breakdown || {}).length === 0 && (
                <p className="text-xs text-gray-600">No active subscriptions</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
