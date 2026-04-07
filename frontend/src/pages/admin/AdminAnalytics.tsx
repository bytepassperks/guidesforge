import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import AdminLayout from "@/components/layout/AdminLayout"
import { adminStatsAPI } from "@/services/adminApi"
import { BarChart3, Loader2, Eye, CheckCircle, Clock } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

export default function AdminAnalytics() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", days],
    queryFn: () => adminStatsAPI.getAnalytics(days),
  })
  const analytics = data?.data

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-red-400" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-400" /> Platform Analytics
          </h1>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-red-500 outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Views", value: analytics?.total_views || 0, icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Completions", value: analytics?.total_completions || 0, icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
            { label: "Completion Rate", value: `${analytics?.completion_rate || 0}%`, icon: BarChart3, color: "text-indigo-400", bg: "bg-indigo-500/10" },
            { label: "Avg Watch Time", value: `${analytics?.avg_watch_time || 0}s`, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { label: "SDK Sessions", value: analytics?.total_sdk_sessions || 0, icon: BarChart3, color: "text-pink-400", bg: "bg-pink-500/10" },
          ].map((s) => (
            <div key={s.label} className="glass-card rounded-2xl p-4">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Daily views chart */}
        <div className="glass-card rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Daily Views</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.daily_views || []}>
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1A1B23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#ef4444" }}
                />
                <Bar dataKey="views" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top guides */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Top Guides by Views</h2>
            <div className="space-y-3">
              {(analytics?.top_guides || []).map((g: { id: string; title: string; views: number }, i: number) => (
                <div key={g.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{g.title}</p>
                  </div>
                  <span className="text-sm text-gray-400">{g.views}</span>
                </div>
              ))}
              {(!analytics?.top_guides || analytics.top_guides.length === 0) && (
                <p className="text-xs text-gray-600">No view data yet</p>
              )}
            </div>
          </div>

          {/* Traffic sources */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Traffic Sources</h2>
            <div className="space-y-3">
              {Object.entries(analytics?.sources || {}).map(([source, count]) => {
                const total = analytics?.total_views || 1
                const pct = Math.round(((count as number) / total) * 100)
                return (
                  <div key={source}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 capitalize">{source}</span>
                      <span className="text-gray-500">{count as number} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {Object.keys(analytics?.sources || {}).length === 0 && (
                <p className="text-xs text-gray-600">No source data yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
