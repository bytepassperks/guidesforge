import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import AdminLayout from "@/components/layout/AdminLayout"
import { adminGuidesAPI } from "@/services/adminApi"
import {
  BookOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
} from "lucide-react"

export default function AdminGuides() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-guides", page, search, statusFilter],
    queryFn: () => adminGuidesAPI.list({ page, per_page: 20, search: search || undefined, status: statusFilter || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminGuidesAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-guides"] }),
  })

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => adminGuidesAPI.reprocess(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-guides"] }),
  })

  const guides = data?.data?.items || []
  const total = data?.data?.total || 0
  const pages = data?.data?.pages || 1

  const statusColors: Record<string, string> = {
    published: "bg-green-500/10 text-green-400",
    processing: "bg-yellow-500/10 text-yellow-400",
    draft: "bg-gray-500/10 text-gray-400",
    stale: "bg-red-500/10 text-red-400",
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-red-400" /> Guides
            <span className="text-sm font-normal text-gray-500 ml-2">({total})</span>
          </h1>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by title..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:border-red-500 outline-none transition"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-red-500 outline-none"
          >
            <option value="">All Status</option>
            <option value="published">Published</option>
            <option value="processing">Processing</option>
            <option value="draft">Draft</option>
            <option value="stale">Stale</option>
          </select>
        </div>

        {/* Table */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Guide</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Workspace</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Status</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Steps</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Views</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Created</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-red-400 mx-auto" /></td></tr>
                ) : guides.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500 text-sm">No guides found</td></tr>
                ) : guides.map((g: Record<string, unknown>) => (
                  <tr key={g.id as string} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <p className="text-sm text-white truncate max-w-xs">{g.title as string}</p>
                      <p className="text-xs text-gray-500">{g.creator_email as string}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{g.workspace_name as string}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[g.status as string] || "bg-gray-500/10 text-gray-400"}`}>
                        {g.status as string}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{g.step_count as number}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{g.view_count as number}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {g.created_at ? new Date(g.created_at as string).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <a
                          href={`/guides/${g.id}`}
                          target="_blank"
                          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition"
                          aria-label={`View guide ${g.title}`}
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => reprocessMutation.mutate(g.id as string)}
                          disabled={reprocessMutation.isPending}
                          className="p-1.5 rounded-lg hover:bg-indigo-500/10 text-gray-500 hover:text-indigo-400 transition disabled:opacity-50"
                          aria-label={`Reprocess guide ${g.title}`}
                          title="Reprocess through AI pipeline"
                        >
                          <RefreshCw className={`w-4 h-4 ${reprocessMutation.isPending ? "animate-spin" : ""}`} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete guide "${g.title}"?`)) deleteMutation.mutate(g.id as string) }}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition"
                          aria-label={`Delete guide ${g.title}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <p className="text-xs text-gray-500">Page {page} of {pages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
