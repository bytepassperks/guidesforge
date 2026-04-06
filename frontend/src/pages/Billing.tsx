import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { billingAPI, workspacesAPI } from "@/services/api"
import {
  CreditCard,
  Check,
  Zap,
  Crown,
  Building2,
  Loader2,
  AlertCircle,
} from "lucide-react"

interface Subscription {
  plan: string
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  provider: string | null
}

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    icon: <Zap className="w-5 h-5" />,
    features: ["10 guides/month", "Video + Doc output", "Community support", "GuidesForge watermark"],
    limits: { guides: 10, seats: 1, mau: 0 },
  },
  {
    id: "starter",
    name: "Starter",
    price: 15,
    icon: <Zap className="w-5 h-5" />,
    features: ["100 guides/month", "All 4 output formats", "SDK embed (100 MAU)", "Staleness alerts", "No watermark", "Email support"],
    limits: { guides: 100, seats: 2, mau: 100 },
  },
  {
    id: "pro",
    name: "Pro",
    price: 39,
    icon: <Crown className="w-5 h-5" />,
    features: ["Unlimited guides", "Voice cloning", "5 team seats", "SDK (1K MAU)", "Advanced analytics", "Tiptap editor", "Priority support"],
    limits: { guides: -1, seats: 5, mau: 1000 },
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    price: 99,
    icon: <Building2 className="w-5 h-5" />,
    features: ["Everything in Pro", "White-label branding", "10 team seats", "SDK (10K MAU)", "Custom domain", "SSO (SAML)", "Dedicated support"],
    limits: { guides: -1, seats: 10, mau: 10000 },
  },
]

export default function Billing() {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly")
  const [cancelReason, setCancelReason] = useState("")
  const [showCancel, setShowCancel] = useState(false)

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspacesAPI.list(),
  })
  const workspace = workspacesData?.data?.[0]

  const { data: subData } = useQuery({
    queryKey: ["subscription", workspace?.id],
    queryFn: () => billingAPI.getSubscription(workspace!.id),
    enabled: !!workspace,
  })
  const subscription: Subscription | undefined = subData?.data

  const dodoCheckout = useMutation({
    mutationFn: (plan: string) =>
      billingAPI.dodoCheckout({ workspace_id: workspace!.id, plan, interval }),
    onSuccess: (res) => {
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url
      }
    },
  })

  const cancelSub = useMutation({
    mutationFn: () =>
      billingAPI.cancel({ workspace_id: workspace!.id, reason: cancelReason }),
    onSuccess: () => setShowCancel(false),
  })

  function handleUpgrade(planId: string) {
    dodoCheckout.mutate(planId)
  }

  const currentPlan = subscription?.plan || "free"

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-indigo-400" /> Billing
            </h1>
            <p className="text-gray-400 text-sm mt-1">Manage your subscription and payment method</p>
          </div>
        </div>

        {/* Current plan banner */}
        {subscription && (
          <div className="glass-card rounded-2xl p-5 mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Current Plan</p>
              <p className="text-xl font-bold text-white capitalize">{subscription.plan}</p>
              {subscription.current_period_end && (
                <p className="text-xs text-gray-500 mt-1">
                  {subscription.cancel_at_period_end ? "Cancels" : "Renews"} on{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                subscription.status === "active" ? "bg-green-500/10 text-green-400" :
                subscription.status === "trialing" ? "bg-indigo-500/10 text-indigo-400" :
                "bg-gray-500/10 text-gray-400"
              }`}>
                {subscription.status}
              </span>
              {subscription.plan !== "free" && !subscription.cancel_at_period_end && (
                <button
                  onClick={() => setShowCancel(true)}
                  className="text-xs text-gray-500 hover:text-red-400 transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Interval toggle */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-4 py-2 rounded-lg text-sm transition ${interval === "monthly" ? "bg-indigo-500/10 text-indigo-400" : "text-gray-400"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("yearly")}
              className={`px-4 py-2 rounded-lg text-sm transition ${interval === "yearly" ? "bg-indigo-500/10 text-indigo-400" : "text-gray-400"}`}
            >
              Yearly <span className="text-xs text-green-400 ml-1">-20%</span>
            </button>
          </div>
          <p className="text-xs text-gray-500">Powered by DodoPayments — 150+ countries, 80+ currencies auto-detected</p>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id
            const yearlyPrice = interval === "yearly" ? Math.floor(plan.price * 12 * 0.8) : null
            const displayPrice = interval === "yearly" ? Math.floor((yearlyPrice || 0) / 12) : plan.price

            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-5 ${
                  plan.popular
                    ? "bg-indigo-500/10 border-2 border-indigo-500/40 relative"
                    : "glass-card"
                } ${isCurrentPlan ? "ring-2 ring-indigo-500/50" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 rounded-full text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-indigo-400">
                    {plan.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-white">{plan.name}</h3>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-white">${displayPrice}</span>
                  {plan.price > 0 && <span className="text-gray-500 text-sm">/mo</span>}
                  {interval === "yearly" && plan.price > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">Billed ${yearlyPrice}/year</p>
                  )}
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <Check className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrentPlan ? (
                  <div className="text-center py-2 rounded-xl text-sm text-indigo-400 bg-indigo-500/5 border border-indigo-500/20">
                    Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={dodoCheckout.isPending}
                    className={`w-full py-2 rounded-xl text-sm font-medium transition ${
                      plan.popular
                        ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                        : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    }`}
                  >
                    {dodoCheckout.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      plan.price === 0 ? "Downgrade" : "Upgrade"
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Cancel modal */}
        {showCancel && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1A1B23] border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold text-white">Cancel Subscription</h2>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Your subscription will remain active until the end of the current billing period.
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition resize-none mb-4"
                rows={3}
                placeholder="Why are you cancelling? (optional)"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCancel(false)}
                  className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition"
                >
                  Keep Plan
                </button>
                <button
                  onClick={() => cancelSub.mutate()}
                  disabled={cancelSub.isPending}
                  className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm font-medium border border-red-500/20 transition"
                >
                  {cancelSub.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cancel Subscription
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
