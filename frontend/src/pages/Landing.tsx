import { Link } from "react-router-dom"
import { Play, Zap, Shield, Globe, Video, BookOpen, Monitor, ArrowRight, Check, Star } from "lucide-react"

const features = [
  {
    icon: <Video className="w-6 h-6 text-indigo-400" />,
    title: "AI-Narrated Video Guides",
    description: "Record clicks, get a fully narrated MP4 video with annotations — automatically.",
  },
  {
    icon: <BookOpen className="w-6 h-6 text-violet-400" />,
    title: "Step-by-Step Documentation",
    description: "Every recording becomes a structured doc with annotated screenshots.",
  },
  {
    icon: <Monitor className="w-6 h-6 text-orange-400" />,
    title: "In-App Interactive Tours",
    description: "Embed Driver.js tours that walk users through your product live.",
  },
  {
    icon: <Globe className="w-6 h-6 text-indigo-400" />,
    title: "Auto-Published Help Center",
    description: "Semantic search-powered help center pages, published instantly.",
  },
  {
    icon: <Shield className="w-6 h-6 text-violet-400" />,
    title: "Staleness Detection",
    description: "Nightly Playwright checks alert you when your UI drifts from documentation.",
  },
  {
    icon: <Zap className="w-6 h-6 text-orange-400" />,
    title: "Voice Cloning",
    description: "Upload a 10-second sample and narrate all guides in your own voice.",
  },
]

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["10 guides/month", "Video + Doc output", "Community support", "GuidesForge watermark"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Starter",
    price: "$15",
    period: "/month",
    inr: "₹999",
    features: ["100 guides/month", "All output formats", "SDK embed (100 MAU)", "Staleness alerts", "No watermark"],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Pro",
    price: "$39",
    period: "/month",
    inr: "₹2,499",
    features: ["Unlimited guides", "Voice cloning", "5 team seats", "SDK (1K MAU)", "Advanced analytics", "Priority support"],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Business",
    price: "$99",
    period: "/month",
    inr: "₹6,999",
    features: ["Everything in Pro", "White-label", "10 seats", "SDK (10K MAU)", "Custom domain", "SSO (SAML)"],
    cta: "Contact Sales",
    popular: false,
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0C0D14] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0C0D14]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GuidesForge" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-semibold gradient-text">GuidesForge</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-gray-400 hover:text-white transition px-4 py-2">
              Sign In
            </Link>
            <Link to="/register" className="text-sm bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-full transition font-medium">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-8">
            <span className="w-2 h-2 bg-indigo-400 rounded-full recording-dot" />
            Now in public beta
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Record once.
            <br />
            <span className="gradient-text">Publish four ways.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Click through your product. Our AI turns every recording into narrated video,
            step-by-step docs, interactive tours, and a searchable help center — automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3.5 rounded-full text-lg font-medium transition glow"
            >
              <Play className="w-5 h-5" /> Start Free — No Card Required
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 text-gray-400 hover:text-white px-8 py-3.5 rounded-full border border-white/10 hover:border-white/20 transition"
            >
              See How It Works <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-4">14-day Pro trial. No credit card needed.</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Four outputs. <span className="gradient-text">One recording.</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Every click-through recording is automatically transformed into four different formats.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="glass-card rounded-2xl p-6 hover:border-indigo-500/20 transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-indigo-500/10 transition">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
          </div>
          <div className="space-y-12">
            {[
              { step: "01", title: "Install the Chrome extension", desc: "One click install. It runs silently in the background — no 'click to record' needed." },
              { step: "02", title: "Click through your product", desc: "Just use your app normally. Every click, navigation, and form fill is captured automatically." },
              { step: "03", title: "AI processes everything", desc: "Screenshots are described, narration scripts are generated, TTS audio is produced, and video is assembled." },
              { step: "04", title: "Publish everywhere", desc: "Get a narrated video, step-by-step doc, interactive tour, and help center page — all from one recording." },
            ].map((item, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-mono text-sm shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-400">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 ${
                  plan.popular
                    ? "bg-indigo-500/10 border-2 border-indigo-500/40 relative"
                    : "glass-card"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 rounded-full text-xs font-medium">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
                {plan.inr && <p className="text-xs text-gray-500 mb-4">or {plan.inr}/mo</p>}
                {!plan.inr && <div className="mb-4" />}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block text-center py-2.5 rounded-full text-sm font-medium transition ${
                    plan.popular
                      ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to automate your documentation?
          </h2>
          <p className="text-gray-400 mb-8">
            Join teams who save hours every week with AI-powered guide creation.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3.5 rounded-full text-lg font-medium transition glow"
          >
            Start Your Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="GuidesForge" className="w-6 h-6 rounded" />
            <span className="text-sm text-gray-400">GuidesForge</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="mailto:support@guidesforge.org" className="hover:text-gray-300 transition">Support</a>
            <a href="#" className="hover:text-gray-300 transition">Privacy</a>
            <a href="#" className="hover:text-gray-300 transition">Terms</a>
          </div>
          <p className="text-xs text-gray-600">&copy; 2026 GuidesForge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
