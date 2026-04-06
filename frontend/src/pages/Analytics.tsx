import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { analyticsAPI, workspacesAPI } from "@/services/api"
import {
  BarChart3,
  Eye,
  Clock,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Video,
  FileText,
  Users,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

interface OverviewData {
  total_guides: number
  total_views: number
  total_completions: number
  completion_rate: number
  avg_watch_time: number
  stale_guides: number
  daily_views: { date: string; views: number; completions: number }[]
  top_guides: { id: string; title: string; views: number; completion_rate: number }[]
}

interface StalenessReport {
  total_monitored: number
  stale_count: number
  healthy_count: number
  stale_guides: { id: string; title: string; last_check: string; staleness_score: number }[]
  healthy_guides: { id: string; title: string; last_check: string; staleness_score: number }[]
}

export default function Analytics() {
  const [days, setDays] = useState(30)

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspacesAPI.list(),
  })
  const workspace = workspacesData?.data?.[0]

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ["analytics-overview", workspace?.id, days],
    queryFn: () => analyticsAPI.overview({ workspace_id: workspace?.id, days }),
    enabled: !!workspace,
  })

  const { data: stalenessData } = useQuery({
    queryKey: ["analytics-staleness", workspace?.id],
    queryFn: () => analyticsAPI.staleness(workspace?.id),
    enabled: !!workspace,
  })

  const overview: OverviewData | undefined = overviewData?.data
  const staleness: StalenessReport | undefined = stalenessData?.data

  const statCards = [
    {
      icon: <FileText className="w-5 h-5 text-indigo-400" />,
      label: "Total Guides",
      value: overview?.total_guides ?? 0,
    },
    {
      icon: <Eye className="w-5 h-5 text-violet-400" />,
      label: "Total Views",
      value: overview?.total_views ?? 0,
    },
    {
      icon: <Video className="w-5 h-5 text-orange-400" />,
      label: "Completions",
      value: overview?.total_completions ?? 0,
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-green-400" />,
      label: "Avg. Completion",
      value: `${(overview?.completion_rate ?? 0).toFixed(1)}%`,
    },
  ]

  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-400" /> Analytics
            </h1>
            <p className="text-gray-400 text-sm mt-1">Track guide performance and engagement</p>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-300 outline-none focus:border-indigo-500 transition"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {overviewLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statCards.map((card, i) => (
                <div key={i} className="glass-card rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      {card.icon}
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Views chart */}
            <div className="glass-card rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-medium text-white mb-4">Daily Views & Completions</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.daily_views || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "#1A1B23",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#6366F1"
                      fill="rgba(99,102,241,0.1)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="completions"
                      stroke="#8B5CF6"
                      fill="rgba(139,92,246,0.1)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top guides & Staleness */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top guides */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Top Guides
                </h3>
                {overview?.top_guides && overview.top_guides.length > 0 ? (
                  <div className="space-y-3">
                    {overview.top_guides.map((guide, i) => (
                      <div key={guide.id} className="flex items-center gap-3 py-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-mono shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{guide.title}</p>
                          <p className="text-xs text-gray-500">{guide.views} views</p>
                        </div>
                        <span className="text-xs text-gray-400">{guide.completion_rate.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No guide data yet</p>
                )}
              </div>

              {/* Staleness report */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" /> Staleness Report
                </h3>
                {staleness ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-green-400">{staleness.healthy_count}</p>
                        <p className="text-xs text-gray-500">Fresh</p>
                      </div>
                      <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-orange-400">{staleness.stale_count}</p>
                        <p className="text-xs text-gray-500">Stale</p>
                      </div>
                      <div className="bg-gray-500/5 border border-gray-500/10 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-gray-400">{staleness.total_monitored - staleness.healthy_count - staleness.stale_count}</p>
                        <p className="text-xs text-gray-500">Unknown</p>
                      </div>
                    </div>
                    {staleness.stale_guides.length > 0 && (
                      <div className="space-y-2">
                        {staleness.stale_guides.slice(0, 5).map((g) => (
                          <div key={g.id} className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" />
                            <span className="text-gray-300 truncate flex-1">{g.title}</span>
                            <span className="text-xs text-orange-400">{(g.staleness_score * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No staleness data yet</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
