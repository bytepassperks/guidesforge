import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { guidesAPI, stepsAPI, pipelineAPI } from "@/services/api"
import { formatDate } from "@/lib/utils"
import {
  ArrowLeft,
  Save,
  Play,
  Globe,
  Trash2,
  Plus,
  GripVertical,
  Image,
  Volume2,
  Edit3,
  Loader2,
  Code,
  Eye,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
} from "lucide-react"
import CollaborativeEditor from "@/components/editor/CollaborativeEditor"

interface GuideStep {
  id: string
  step_number: number
  screenshot_url: string | null
  description: string
  narration_script: string | null
  audio_url: string | null
  callout_annotations: Record<string, unknown> | null
  dom_selector: string | null
  page_url: string | null
}

interface Guide {
  id: string
  title: string
  description: string | null
  status: string
  video_url: string | null
  language: string
  voice_id: string | null
  staleness_status: string
  created_at: string
  updated_at: string
}

export default function GuideEditor() {
  const { guideId } = useParams<{ guideId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [editNarration, setEditNarration] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [showEmbed, setShowEmbed] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data: guideData, isLoading: guideLoading } = useQuery({
    queryKey: ["guide", guideId],
    queryFn: () => guidesAPI.get(guideId!),
    enabled: !!guideId,
  })

  const guide: Guide | undefined = guideData?.data

  const { data: stepsData, isLoading: stepsLoading } = useQuery({
    queryKey: ["guide-steps", guideId],
    queryFn: () => stepsAPI.list(guideId!),
    enabled: !!guideId,
  })

  const steps: GuideStep[] = stepsData?.data || []

  useEffect(() => {
    if (guide) {
      setTitle(guide.title)
      setDescription(guide.description || "")
    }
  }, [guide])

  const updateGuide = useMutation({
    mutationFn: (data: Record<string, unknown>) => guidesAPI.update(guideId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guide", guideId] }),
  })

  const updateStep = useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: Record<string, unknown> }) =>
      stepsAPI.update(guideId!, stepId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guide-steps", guideId] })
      setEditingStep(null)
    },
  })

  const deleteStep = useMutation({
    mutationFn: (stepId: string) => stepsAPI.delete(guideId!, stepId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guide-steps", guideId] }),
  })

  const publishGuide = useMutation({
    mutationFn: () => guidesAPI.publish(guideId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guide", guideId] }),
  })

  const regenerateAudio = useMutation({
    mutationFn: (stepId: string) => stepsAPI.regenerateAudio(guideId!, stepId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guide-steps", guideId] }),
  })

  const regenerateCallouts = useMutation({
    mutationFn: (stepId: string) => stepsAPI.regenerateCallouts(guideId!, stepId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guide-steps", guideId] }),
  })

  async function handleProcessGuide() {
    setProcessing(true)
    try {
      await pipelineAPI.processGuide({
        guide_id: guideId!,
        steps: steps.map((s) => ({
          step_number: s.step_number,
          screenshot_url: s.screenshot_url,
          description: s.description,
          dom_selector: s.dom_selector,
          page_url: s.page_url,
        })),
      })
    } catch {
      // error handling
    } finally {
      setProcessing(false)
    }
  }

  function handleSave() {
    updateGuide.mutate({ title, description: description || null }, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      },
    })
  }

  if (guideLoading || stepsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full py-20">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!guide) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <p className="text-gray-400">Guide not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  guide.status === "published" ? "bg-green-500/10 text-green-400" :
                  guide.status === "processing" ? "bg-yellow-500/10 text-yellow-400" :
                  "bg-gray-500/10 text-gray-400"
                }`}>
                  {guide.status}
                </span>
                {guide.staleness_status === "stale" && (
                  <span className="flex items-center gap-1 text-orange-400 text-xs">
                    <AlertTriangle className="w-3 h-3" /> Stale
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Last updated {formatDate(guide.updated_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmbed(!showEmbed)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 transition"
            >
              <Code className="w-4 h-4" /> Embed
            </button>
            <div className="relative group">
              <button
                onClick={handleProcessGuide}
                disabled={processing || steps.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 transition disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Process
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#1A1B23] border border-white/10 rounded-lg text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
                {steps.length === 0 ? "Add steps first to process this guide" : "Run AI pipeline: generate narration, TTS audio, and video"}
              </div>
            </div>
            {guide.status === "draft" && (
              <button
                onClick={() => publishGuide.mutate()}
                disabled={publishGuide.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition"
              >
                <Globe className="w-4 h-4" /> Publish
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={updateGuide.isPending}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              {updateGuide.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        {/* Embed code */}
        {showEmbed && (
          <div className="glass-card rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-medium text-white mb-3">Embed Code</h3>
            <div className="bg-black/30 rounded-xl p-4">
              <code className="text-xs text-indigo-300 break-all">
                {`<iframe src="${window.location.origin}/embed/${guideId}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`}
              </code>
            </div>
            <p className="text-xs text-gray-500 mt-2">Copy and paste this code to embed the guide on your website.</p>
          </div>
        )}

        {/* Title & Description */}
        <div className="glass-card rounded-2xl p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-lg font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none"
              rows={2}
              placeholder="Brief description of this guide..."
            />
          </div>
        </div>

        {/* Video preview */}
        {guide.video_url && (
          <div className="glass-card rounded-2xl p-6 mb-6">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-400" /> Generated Video
            </h3>
            <video
              src={guide.video_url}
              controls
              className="w-full rounded-xl bg-black"
            />
          </div>
        )}

        {/* Steps */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Steps ({steps.length})</h3>
          </div>

          {steps.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Image className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm mb-1">No steps yet</p>
              <p className="text-gray-500 text-xs">Use the Chrome extension to record steps, or they will be uploaded via the API.</p>
            </div>
          ) : (
            steps.map((step) => (
              <div key={step.id} className="glass-card rounded-2xl p-5 hover:border-indigo-500/10 transition">
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-2 pt-1">
                    <GripVertical className="w-4 h-4 text-gray-600" />
                    <span className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-sm font-mono">
                      {step.step_number}
                    </span>
                  </div>

                  {step.screenshot_url && (
                    <div className="w-48 shrink-0">
                      <img
                        src={step.screenshot_url}
                        alt={`Step ${step.step_number}`}
                        className="w-full rounded-lg border border-white/5"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {editingStep === step.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition resize-none"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Narration Script</label>
                          <CollaborativeEditor
                            content={editNarration}
                            onChange={(html) => setEditNarration(html)}
                            placeholder="Write narration script for this step..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateStep.mutate({
                                stepId: step.id,
                                data: { description: editDescription, narration_script: editNarration },
                              })
                            }
                            disabled={updateStep.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-indigo-500 hover:bg-indigo-600 text-white transition"
                          >
                            {updateStep.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingStep(null)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-white mb-1">{step.description}</p>
                        {step.narration_script && (
                          <p className="text-xs text-gray-400 italic mb-2">&ldquo;{step.narration_script}&rdquo;</p>
                        )}
                        {step.page_url && (
                          <p className="text-xs text-gray-600 truncate">{step.page_url}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => {
                              setEditingStep(step.id)
                              setEditDescription(step.description)
                              setEditNarration(step.narration_script || "")
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          {step.audio_url && (
                            <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition">
                              <Volume2 className="w-3 h-3" /> Play Audio
                            </button>
                          )}
                          <button
                            onClick={() => regenerateAudio.mutate(step.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition"
                          >
                            <RefreshCw className="w-3 h-3" /> Re-narrate
                          </button>
                          <button
                            onClick={() => regenerateCallouts.mutate(step.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition"
                          >
                            <Eye className="w-3 h-3" /> Re-annotate
                          </button>
                          <button
                            onClick={() => deleteStep.mutate(step.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition ml-auto"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
