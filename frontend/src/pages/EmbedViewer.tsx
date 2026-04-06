import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { guidesAPI, stepsAPI } from "@/services/api"
import { Play, FileText, ChevronRight, Loader2 } from "lucide-react"
import { useState } from "react"

interface GuideStep {
  id: string
  step_number: number
  screenshot_url: string | null
  description: string
  narration_script: string | null
  audio_url: string | null
}

interface Guide {
  id: string
  title: string
  description: string | null
  video_url: string | null
  thumbnail_url: string | null
}

export default function EmbedViewer() {
  const { guideId } = useParams<{ guideId: string }>()
  const [viewMode, setViewMode] = useState<"video" | "steps">("video")

  const { data: guideData, isLoading } = useQuery({
    queryKey: ["guide-embed", guideId],
    queryFn: () => guidesAPI.get(guideId!),
    enabled: !!guideId,
  })

  const { data: stepsData } = useQuery({
    queryKey: ["guide-steps-embed", guideId],
    queryFn: () => stepsAPI.list(guideId!),
    enabled: !!guideId,
  })

  const guide: Guide | undefined = guideData?.data
  const steps: GuideStep[] = stepsData?.data || []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!guide) {
    return (
      <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center text-gray-400">
        Guide not found
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0C0D14] text-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Title */}
        <div className="mb-4">
          <h1 className="text-xl font-bold">{guide.title}</h1>
          {guide.description && <p className="text-sm text-gray-400 mt-1">{guide.description}</p>}
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1 max-w-xs">
          <button
            onClick={() => setViewMode("video")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition flex-1 justify-center ${
              viewMode === "video" ? "bg-indigo-500/10 text-indigo-400" : "text-gray-400"
            }`}
          >
            <Play className="w-3.5 h-3.5" /> Video
          </button>
          <button
            onClick={() => setViewMode("steps")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition flex-1 justify-center ${
              viewMode === "steps" ? "bg-indigo-500/10 text-indigo-400" : "text-gray-400"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Steps
          </button>
        </div>

        {/* Video view */}
        {viewMode === "video" && guide.video_url && (
          <video
            src={guide.video_url}
            controls
            poster={guide.thumbnail_url || undefined}
            className="w-full rounded-xl bg-black"
          />
        )}

        {viewMode === "video" && !guide.video_url && (
          <div className="bg-white/5 rounded-xl p-8 text-center text-gray-500">
            Video not yet generated
          </div>
        )}

        {/* Steps view */}
        {viewMode === "steps" && (
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="glass-card rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                  <span className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-mono">
                    {step.step_number}
                  </span>
                  <span className="text-sm text-white flex-1">{step.description}</span>
                  {index < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-600" />}
                </div>
                {step.screenshot_url && (
                  <div className="p-4">
                    <img
                      src={step.screenshot_url}
                      alt={`Step ${step.step_number}`}
                      className="w-full rounded-lg border border-white/5"
                    />
                  </div>
                )}
                {step.narration_script && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-300">{step.narration_script}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Powered by */}
        <div className="text-center mt-6">
          <a
            href="https://guidesforge.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-600 hover:text-indigo-400 transition"
          >
            Powered by GuidesForge
          </a>
        </div>
      </div>
    </div>
  )
}
