import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import AdminLayout from "@/components/layout/AdminLayout"
import { adminSubscriptionsAPI } from "@/services/adminApi"
import {
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Loader2,
  X,
} from "lucide-react"

export default function AdminSubscriptions() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [providerFilter, setProviderFilter] = useState("")
  const [editSub, setEditSub] = useState<Record<string, unknown> | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions", page, statusFilter, providerFilter],
    queryFn: () => adminSubscriptionsAPI.list({ page, per_page: 20, status: statusFilter || undefined, provider: providerFilter || undefined }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => adminSubscriptionsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] })
      setEditSub(null)
    },
  })

  const subs = data?.data?.items || []
  const total = data?.data?.total || 0
  const pages = data?.data?.pages || 1

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-400",
    cancelled: "bg-red-500/10 text-red-400",
    cancelling: "bg-yellow-500/10 text-yellow-400",
    expired: "bg-gray-500/10 text-gray-400",
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-red-400" /> Subscriptions
            <span className="text-sm font-normal text-gray-500 ml-2">({total})</span>
          </h1>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-red-500 outline-none"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="cancelling">Cancelling</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={providerFilter}
            onChange={(e) => { setProviderFilter(e.target.value); setPage(1) }}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-red-500 outline-none"
          >
            <option value="">All Providers</option>
            <option value="dodopayments">DodoPayments</option>
            <option value="stripe">Stripe</option>
            <option value="razorpay">Razorpay</option>
            <option value="easebuzz">Easebuzz</option>
          </select>
        </div>

        {/* Table */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Workspace</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Owner</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Plan</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Provider</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Interval</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Status</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Created</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-red-400 mx-auto" /></td></tr>
                ) : subs.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-500 text-sm">No subscriptions found</td></tr>
                ) : subs.map((s: Record<string, unknown>) => (
                  <tr key={s.id as string} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-sm text-white">{s.workspace_name as string}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{s.owner_email as string}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 capitalize">
                        {s.plan as string}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 capitalize">{s.provider as string}</td>
                    <td className="px-4 py-3 text-sm text-gray-300 capitalize">{s.interval as string}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status as string] || "bg-gray-500/10 text-gray-400"}`}>
                        {s.status as string}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {s.created_at ? new Date(s.created_at as string).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setEditSub(s)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition"
                        >
                          <Edit2 className="w-4 h-4" />
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

        {/* Edit Modal */}
        {editSub && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1A1B23] border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Edit Subscription</h2>
                <button onClick={() => setEditSub(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-gray-400 mb-4">Workspace: {editSub.workspace_name as string}</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Plan</label>
                  <select
                    value={(editSub.plan as string) || "free"}
                    onChange={(e) => setEditSub({ ...editSub, plan: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-red-500"
                  >
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select
                    value={(editSub.status as string) || "active"}
                    onChange={(e) => setEditSub({ ...editSub, status: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-red-500"
                  >
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button onClick={() => setEditSub(null)} className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition">Cancel</button>
                <button
                  onClick={() => updateMutation.mutate({
                    id: editSub.id as string,
                    data: { plan: editSub.plan, status: editSub.status }
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
      </div>
    </AdminLayout>
  )
}
