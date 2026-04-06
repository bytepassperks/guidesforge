import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { guidesAPI, stepsAPI } from "@/services/api"
import { ArrowLeft, Play, FileText, ChevronRight, Loader2, ExternalLink } from "lucide-react"

interface GuideStep {
  id: string
  step_number: number
  screenshot_url: string | null
  description: string
  narration_script: string | null
  audio_url: string | null
  callout_annotations: Record<string, unknown> | null
}

interface Guide {
  id: string
  title: string
  description: string | null
  status: string
  video_url: string | null
  thumbnail_url: string | null
  language: string
}

export default function GuideViewer() {
  const { guideId } = useParams<{ guideId: string }>()

  const { data: guideData, isLoading: guideLoading } = useQuery({
    queryKey: ["guide", guideId],
    queryFn: () => guidesAPI.get(guideId!),
    enabled: !!guideId,
  })

  const { data: stepsData } = useQuery({
    queryKey: ["guide-steps", guideId],
    queryFn: () => stepsAPI.list(guideId!),
    enabled: !!guideId,
  })

  const guide: Guide | undefined = guideData?.data
  const steps: GuideStep[] = stepsData?.data || []

  if (guideLoading) {
    return (
      <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!guide) {
    return (
      <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center">
        <p className="text-gray-400">Guide not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0C0D14] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0E0F17]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{guide.title}</h1>
              {guide.description && <p className="text-sm text-gray-400">{guide.description}</p>}
            </div>
          </div>
          <Link
            to={`/guides/${guideId}/edit`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 transition"
          >
            <ExternalLink className="w-4 h-4" /> Edit
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Video section */}
        {guide.video_url && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold">Video Guide</h2>
            </div>
            <video
              src={guide.video_url}
              controls
              poster={guide.thumbnail_url || undefined}
              className="w-full rounded-2xl bg-black border border-white/5"
            />
          </div>
        )}

        {/* Steps section */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Step-by-Step Guide</h2>
            <span className="text-sm text-gray-500">({steps.length} steps)</span>
          </div>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={step.id} className="glass-card rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                  <span className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-sm font-mono">
                    {step.step_number}
                  </span>
                  <h3 className="text-sm font-medium text-white flex-1">{step.description}</h3>
                  {index < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-600" />}
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
    </div>
  )
}
