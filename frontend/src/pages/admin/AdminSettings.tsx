import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import AdminLayout from "@/components/layout/AdminLayout"
import { adminSettingsAPI } from "@/services/adminApi"
import { Settings, Loader2, CheckCircle, XCircle, Save, CheckCircle2 } from "lucide-react"

export default function AdminSettings() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminSettingsAPI.get(),
  })
  const settings = data?.data
  const [corsOrigins, setCorsOrigins] = useState("")
  const [frontendUrl, setFrontendUrl] = useState("")
  const [mailgunDomain, setMailgunDomain] = useState("")
  const [saved, setSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  if (settings && !initialized) {
    setCorsOrigins(settings.cors_origins || "")
    setFrontendUrl(settings.frontend_url || "")
    setMailgunDomain(settings.mailgun_domain || "")
    setInitialized(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => adminSettingsAPI.update({ cors_origins: corsOrigins, frontend_url: frontendUrl, mailgun_domain: mailgunDomain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-red-400" />
        </div>
      </AdminLayout>
    )
  }

  const integrations = [
    { name: "DodoPayments", key: "dodo_payments_configured", desc: "Primary payment gateway" },
    { name: "Stripe", key: "stripe_configured", desc: "Legacy payment gateway" },
    { name: "Razorpay", key: "razorpay_configured", desc: "Legacy payment gateway (INR)" },
    { name: "Easebuzz", key: "easebuzz_configured", desc: "Legacy payment gateway (INR)" },
    { name: "OpenAI", key: "openai_configured", desc: "AI embeddings & processing" },
    { name: "Mailgun", key: "mailgun_configured", desc: "Transactional email" },
    { name: "Customer.io", key: "customerio_configured", desc: "Marketing automation" },
    { name: "Modal", key: "modal_configured", desc: "AI inference pipeline" },
    { name: "iDrive E2 (S3)", key: "s3_configured", desc: "File storage" },
  ]

  return (
    <AdminLayout>
      <div className="p-8 max-w-4xl">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
          <Settings className="w-6 h-6 text-red-400" /> System Settings
        </h1>

        {/* Environment */}
        <div className="glass-card rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Environment</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Environment</label>
              <p className="text-sm text-white bg-white/5 rounded-xl px-4 py-2.5">{settings?.environment || "—"}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Frontend URL</label>
              <input type="text" value={frontendUrl} onChange={(e) => setFrontendUrl(e.target.value)} className="w-full text-sm text-white bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-red-500 transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">CORS Origins</label>
              <input type="text" value={corsOrigins} onChange={(e) => setCorsOrigins(e.target.value)} className="w-full text-sm text-white bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-red-500 transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mailgun Domain</label>
              <input type="text" value={mailgunDomain} onChange={(e) => setMailgunDomain(e.target.value)} className="w-full text-sm text-white bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-red-500 transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">S3 Endpoint</label>
              <p className="text-sm text-white bg-white/5 rounded-xl px-4 py-2.5">{settings?.s3_endpoint || "—"}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">S3 Bucket</label>
              <p className="text-sm text-white bg-white/5 rounded-xl px-4 py-2.5">{settings?.s3_bucket || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
            {saved && <span className="flex items-center gap-1 text-green-400 text-sm"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
          </div>
        </div>

        {/* Integration Status */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Integration Status</h2>
          <div className="space-y-3">
            {integrations.map((i) => {
              const configured = settings?.[i.key]
              return (
                <div key={i.key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-white">{i.name}</p>
                    <p className="text-xs text-gray-500">{i.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {configured ? (
                      <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
                        <XCircle className="w-3 h-3" /> Not configured
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
