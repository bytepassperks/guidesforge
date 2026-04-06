import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { Search, BookOpen, Video, ChevronRight, Loader2 } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || ""

interface HelpGuide {
  id: string
  title: string
  description: string | null
  video_url: string | null
  thumbnail_url: string | null
  steps_count: number
  created_at: string
}

interface HelpCenterData {
  workspace_name: string
  workspace_slug: string
  brand_color: string
  guides: HelpGuide[]
}

export default function HelpCenter() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>()
  const [search, setSearch] = useState("")

  const { data: helpData, isLoading } = useQuery({
    queryKey: ["help-center", workspaceSlug],
    queryFn: () => axios.get(`${API_URL}/api/help/${workspaceSlug}`),
    enabled: !!workspaceSlug,
  })

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["help-search", workspaceSlug, search],
    queryFn: () => axios.get(`${API_URL}/api/help/${workspaceSlug}/search`, { params: { q: search } }),
    enabled: !!workspaceSlug && search.length >= 2,
  })

  const helpCenter: HelpCenterData | undefined = helpData?.data
  const searchResults: HelpGuide[] = searchData?.data?.results || []
  const guides = search.length >= 2 ? searchResults : helpCenter?.guides || []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!helpCenter) {
    return (
      <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Help Center Not Found</h1>
          <p className="text-gray-400 text-sm">This help center doesn&apos;t exist or has been disabled.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0C0D14] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0E0F17]">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="GuidesForge" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-semibold" style={{ color: helpCenter.brand_color }}>
              {helpCenter.workspace_name}
            </span>
            <span className="text-gray-500 text-sm">Help Center</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">How can we help?</h1>
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for guides, topics, or questions..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
            {searchLoading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
            )}
          </div>
        </div>
      </div>

      {/* Guides */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {guides.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              {search ? "No guides match your search" : "No guides published yet"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {guides.map((guide) => (
              <Link
                key={guide.id}
                to={`/help/${workspaceSlug}/guides/${guide.id}`}
                className="glass-card rounded-2xl p-5 hover:border-indigo-500/20 transition group flex items-center gap-4"
              >
                {guide.thumbnail_url ? (
                  <img
                    src={guide.thumbnail_url}
                    alt={guide.title}
                    className="w-24 h-16 object-cover rounded-xl shrink-0"
                  />
                ) : (
                  <div className="w-24 h-16 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    {guide.video_url ? <Video className="w-6 h-6 text-indigo-400" /> : <BookOpen className="w-6 h-6 text-indigo-400" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white group-hover:text-indigo-400 transition truncate">
                    {guide.title}
                  </h3>
                  {guide.description && (
                    <p className="text-sm text-gray-400 mt-1 truncate">{guide.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">{guide.steps_count} steps</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 transition shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            Powered by <a href="https://guidesforge.org" className="text-indigo-400 hover:text-indigo-300">GuidesForge</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
