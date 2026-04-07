import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import AdminLayout from "@/components/layout/AdminLayout"
import { adminUsersAPI } from "@/services/adminApi"
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Plus,
  Loader2,
  Shield,
  X,
} from "lucide-react"

export default function AdminUsers() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("")
  const [editUser, setEditUser] = useState<Record<string, unknown> | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", plan: "free", is_admin: false })

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search, planFilter],
    queryFn: () => adminUsersAPI.list({ page, per_page: 20, search: search || undefined, plan: planFilter || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminUsersAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => adminUsersAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setEditUser(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof newUser) => adminUsersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setShowCreate(false)
      setNewUser({ email: "", password: "", full_name: "", plan: "free", is_admin: false })
    },
  })

  const users = data?.data?.items || []
  const total = data?.data?.total || 0
  const pages = data?.data?.pages || 1

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-red-400" /> Users
            <span className="text-sm font-normal text-gray-500 ml-2">({total})</span>
          </h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" /> Create User
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by email or name..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:border-red-500 outline-none transition"
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setPage(1) }}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-red-500 outline-none"
          >
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* Table */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">User</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Plan</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Role</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Joined</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-red-400 mx-auto" /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-500 text-sm">No users found</td></tr>
                ) : users.map((u: Record<string, unknown>) => (
                  <tr key={u.id as string} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{(u.full_name as string) || "—"}</p>
                      <p className="text-xs text-gray-500">{u.email as string}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.plan === "pro" ? "bg-indigo-500/10 text-indigo-400" :
                        u.plan === "business" ? "bg-purple-500/10 text-purple-400" :
                        u.plan === "starter" ? "bg-blue-500/10 text-blue-400" :
                        "bg-gray-500/10 text-gray-400"
                      }`}>
                        {u.plan as string}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_admin ? (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">User</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.created_at ? new Date(u.created_at as string).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditUser(u)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete ${u.email}?`)) deleteMutation.mutate(u.id as string) }}
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

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <p className="text-xs text-gray-500">Page {page} of {pages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1A1B23] border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Edit User</h2>
                <button onClick={() => setEditUser(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={(editUser.full_name as string) || ""}
                    onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Plan</label>
                  <select
                    value={(editUser.plan as string) || "free"}
                    onChange={(e) => setEditUser({ ...editUser, plan: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-red-500"
                  >
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!editUser.is_admin}
                    onChange={(e) => setEditUser({ ...editUser, is_admin: e.target.checked })}
                    className="rounded"
                  />
                  <label className="text-sm text-gray-300">Admin access</label>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button onClick={() => setEditUser(null)} className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition">Cancel</button>
                <button
                  onClick={() => updateMutation.mutate({
                    id: editUser.id as string,
                    data: { full_name: editUser.full_name, plan: editUser.plan, is_admin: editUser.is_admin }
                  })}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1A1B23] border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Create User</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-red-500" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Password</label>
                  <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-red-500" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                  <input type="text" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Plan</label>
                  <select value={newUser.plan} onChange={(e) => setNewUser({ ...newUser, plan: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-red-500">
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newUser.is_admin} onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })} className="rounded" />
                  <label className="text-sm text-gray-300">Admin access</label>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition">Cancel</button>
                <button
                  onClick={() => createMutation.mutate(newUser)}
                  disabled={createMutation.isPending || !newUser.email || !newUser.password}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
