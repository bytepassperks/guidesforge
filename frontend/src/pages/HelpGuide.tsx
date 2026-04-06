import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { ArrowLeft, Play, FileText, ChevronRight, Loader2, BookOpen } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || ""

interface GuideStep {
  id: string
  step_number: number
  screenshot_url: string | null
  description: string
  narration_script: string | null
  audio_url: string | null
}

interface GuideData {
  id: string
  title: string
  description: string | null
  video_url: string | null
  thumbnail_url: string | null
  language: string
  steps: GuideStep[]
  workspace_name: string
  workspace_slug: string
  brand_color: string
}

export default function HelpGuide() {
  const { workspaceSlug, guideId } = useParams<{ workspaceSlug: string; guideId: string }>()

  const { data: guideData, isLoading } = useQuery({
    queryKey: ["help-guide", workspaceSlug, guideId],
    queryFn: () => axios.get(`${API_URL}/api/help/${workspaceSlug}/guides/${guideId}`),
    enabled: !!workspaceSlug && !!guideId,
  })

  const guide: GuideData | undefined = guideData?.data

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!guide) {
    return (
      <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Guide Not Found</h1>
          <p className="text-gray-400 text-sm">This guide doesn&apos;t exist or hasn&apos;t been published.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0C0D14] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0E0F17]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to={`/help/${workspaceSlug}`}
              className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <Link
                to={`/help/${workspaceSlug}`}
                className="text-xs text-gray-500 hover:text-indigo-400 transition"
              >
                {guide.workspace_name} Help Center
              </Link>
              <h1 className="text-lg font-semibold">{guide.title}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {guide.description && (
          <p className="text-gray-400 mb-8">{guide.description}</p>
        )}

        {/* Video */}
        {guide.video_url && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold">Watch Video Guide</h2>
            </div>
            <video
              src={guide.video_url}
              controls
              poster={guide.thumbnail_url || undefined}
              className="w-full rounded-2xl bg-black border border-white/5"
            />
          </div>
        )}

        {/* Steps */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Step-by-Step Instructions</h2>
            <span className="text-sm text-gray-500">({guide.steps.length} steps)</span>
          </div>

          <div className="space-y-6">
            {guide.steps.map((step, index) => (
              <div key={step.id} className="glass-card rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-mono"
                    style={{ background: `${guide.brand_color}15`, color: guide.brand_color }}
                  >
                    {step.step_number}
                  </span>
                  <h3 className="text-sm font-medium text-white flex-1">{step.description}</h3>
                  {index < guide.steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="p-5">
                  {step.screenshot_url && (
                    <img
                      src={step.screenshot_url}
                      alt={`Step ${step.step_number}: ${step.description}`}
                      className="w-full rounded-xl border border-white/5 mb-4"
                    />
                  )}
                  {step.narration_script && (
                    <p className="text-sm text-gray-300 leading-relaxed">{step.narration_script}</p>
                  )}
                  {step.audio_url && (
                    <audio src={step.audio_url} controls className="w-full mt-3" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
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
