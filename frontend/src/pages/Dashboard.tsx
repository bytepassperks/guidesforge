import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { guidesAPI, workspacesAPI } from "@/services/api"
import { formatDate } from "@/lib/utils"
import {
  Plus,
  Search,
  Video,
  FileText,
  Eye,
  MoreHorizontal,
  Trash2,
  Edit3,
  Globe,
  Clock,
  AlertTriangle,
  BookOpen,
  Loader2,
} from "lucide-react"

interface Guide {
  id: string
  title: string
  description: string | null
  status: string
  video_url: string | null
  thumbnail_url: string | null
  total_steps: number
  view_count: number
  staleness_score: number
  created_at: string
  updated_at: string
}

interface Workspace {
  id: string
  name: string
  slug: string
}

export default function Dashboard() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspacesAPI.list(),
  })
  const workspace: Workspace | undefined = workspacesData?.data?.[0]

  const { data: guidesData, isLoading } = useQuery({
    queryKey: ["guides", search, statusFilter, workspace?.id],
    queryFn: () =>
      guidesAPI.list({
        search: search || undefined,
        status: statusFilter || undefined,
        workspace_id: workspace?.id,
      }),
    enabled: !!workspace,
  })

  const guides: Guide[] = guidesData?.data?.guides || []

  const createGuide = useMutation({
    mutationFn: () =>
      guidesAPI.create({
        title: newTitle,
        description: newDesc || undefined,
        workspace_id: workspace?.id,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["guides"] })
      setShowCreate(false)
      setNewTitle("")
      setNewDesc("")
      navigate(`/guides/${res.data.id}/edit`)
    },
  })

  const deleteGuide = useMutation({
    mutationFn: (id: string) => guidesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guides"] })
      setMenuOpen(null)
    },
  })

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      draft: "bg-gray-500/10 text-gray-400",
      processing: "bg-yellow-500/10 text-yellow-400",
      ready: "bg-blue-500/10 text-blue-400",
      published: "bg-green-500/10 text-green-400",
      stale: "bg-orange-500/10 text-orange-400",
      error: "bg-red-500/10 text-red-400",
      failed: "bg-red-500/10 text-red-400",
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {status}
      </span>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Guides</h1>
            <p className="text-gray-400 text-sm mt-1">Create, edit, and manage your how-to guides</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" /> New Guide
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guides..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 outline-none focus:border-indigo-500 transition"
          >
            <option value="">All status</option>
            <option value="draft">Draft</option>
            <option value="processing">Processing</option>
            <option value="published">Published</option>
            <option value="ready">Ready</option>
            <option value="stale">Stale</option>
          </select>
        </div>

        {/* Guide list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : guides.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No guides yet</h3>
            <p className="text-gray-400 text-sm max-w-sm mb-6">
              Install the Chrome extension and start recording, or create a guide manually.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" /> Create Your First Guide
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {guides.map((guide) => (
              <div
                key={guide.id}
                className="glass-card rounded-2xl p-5 hover:border-indigo-500/20 transition group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        to={`/guides/${guide.id}/edit`}
                        className="text-lg font-semibold text-white hover:text-indigo-400 transition truncate"
                      >
                        {guide.title}
                      </Link>
                      {getStatusBadge(guide.status)}
                      {guide.staleness_score > 0.5 && (
                        <span className="flex items-center gap-1 text-orange-400 text-xs">
                          <AlertTriangle className="w-3 h-3" /> Stale
                        </span>
                      )}
                    </div>
                    {guide.description && (
                      <p className="text-sm text-gray-400 mb-3 truncate">{guide.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {guide.total_steps} steps
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {guide.view_count} views
                      </span>
                      {guide.video_url && (
                        <span className="flex items-center gap-1 text-indigo-400">
                          <Video className="w-3 h-3" /> Video ready
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(guide.updated_at)}
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === guide.id ? null : guide.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuOpen === guide.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-[#1A1B23] border border-white/10 rounded-xl shadow-xl z-10 py-1">
                        <button
                          onClick={() => { navigate(`/guides/${guide.id}/edit`); setMenuOpen(null) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition"
                        >
                          <Edit3 className="w-4 h-4" /> Edit
                        </button>
                        {guide.status === "published" && (
                          <button
                            onClick={() => { navigate(`/guides/${guide.id}`); setMenuOpen(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition"
                          >
                            <Globe className="w-4 h-4" /> View Live
                          </button>
                        )}
                        <button
                          onClick={() => deleteGuide.mutate(guide.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1A1B23] border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-white mb-4">Create New Guide</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  createGuide.mutate()
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                    placeholder="How to set up your dashboard"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Description (optional)</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none"
                    rows={3}
                    placeholder="Brief description of this guide..."
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createGuide.isPending}
                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                  >
                    {createGuide.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Guide
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
