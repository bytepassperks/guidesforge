import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import AdminLayout from "@/components/layout/AdminLayout"
import { adminWorkspacesAPI } from "@/services/adminApi"
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  Loader2,
  Users,
  BookOpen,
} from "lucide-react"
import { Link } from "react-router-dom"

export default function AdminWorkspaces() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-workspaces", page, search],
    queryFn: () => adminWorkspacesAPI.list({ page, per_page: 20, search: search || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminWorkspacesAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-workspaces"] }),
  })

  const workspaces = data?.data?.items || []
  const total = data?.data?.total || 0
  const pages = data?.data?.pages || 1

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-red-400" /> Workspaces
            <span className="text-sm font-normal text-gray-500 ml-2">({total})</span>
          </h1>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by name or slug..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:border-red-500 outline-none transition"
            />
          </div>
        </div>

        {/* Table */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Workspace</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Owner</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Members</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Guides</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Created</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-red-400 mx-auto" /></td></tr>
                ) : workspaces.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500 text-sm">No workspaces found</td></tr>
                ) : workspaces.map((ws: Record<string, unknown>) => (
                  <tr key={ws.id as string} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{ws.name as string}</p>
                      <p className="text-xs text-gray-500">{ws.slug as string}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-300">{ws.owner_name as string}</p>
                      <p className="text-xs text-gray-500">{ws.owner_email as string}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-sm text-gray-300">
                        <Users className="w-3 h-3" /> {ws.member_count as number}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-sm text-gray-300">
                        <BookOpen className="w-3 h-3" /> {ws.guide_count as number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {ws.created_at ? new Date(ws.created_at as string).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/admin/workspaces/${ws.id}`}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => { if (confirm(`Delete workspace "${ws.name}"?`)) deleteMutation.mutate(ws.id as string) }}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition"
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
