import { useState } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import {
  Play, Zap, Shield, Globe, Video, BookOpen, Monitor, ArrowRight, Check,
  Star, ChevronDown, Users, Sparkles,
} from "lucide-react"

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
    features: ["100 guides/month", "All output formats", "SDK embed (100 MAU)", "Staleness alerts", "No watermark"],
    cta: "Start Free Trial",
    popular: false,
    href: "/register",
  },
  {
    name: "Pro",
    price: "$39",
    period: "/month",
    features: ["Unlimited guides", "Voice cloning", "5 team seats", "SDK (1K MAU)", "Advanced analytics", "Priority support"],
    cta: "Start Free Trial",
    popular: true,
    href: "/register",
  },
  {
    name: "Business",
    price: "$99",
    period: "/month",
    features: ["Everything in Pro", "White-label", "10 seats", "SDK (10K MAU)", "Custom domain", "SSO (SAML)"],
    cta: "Contact Sales",
    popular: false,
    href: "/contact-sales",
  },
]

const stats = [
  { value: "4", suffix: "", label: "Output formats per recording" },
  { value: "23", suffix: "+", label: "Languages supported" },
  { value: "99.9", suffix: "%", label: "Uptime SLA" },
  { value: "10", suffix: "x", label: "Faster than manual docs" },
]

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Head of Product, Acme SaaS",
    quote: "GuidesForge cut our documentation time by 80%. We went from spending 2 days per guide to publishing four formats in under 10 minutes.",
    avatar: "SC",
  },
  {
    name: "Marcus Johnson",
    role: "CTO, DevToolCo",
    quote: "The staleness detection alone is worth the price. We no longer ship outdated docs because GuidesForge catches UI changes overnight.",
    avatar: "MJ",
  },
  {
    name: "Priya Sharma",
    role: "Customer Success Lead, CloudOps",
    quote: "Our support tickets dropped 40% after embedding the interactive tours. Customers figure things out on their own now.",
    avatar: "PS",
  },
]

const faqs = [
  {
    q: "What is GuidesForge?",
    a: "GuidesForge is an AI-powered platform that transforms screen recordings into four simultaneous outputs: narrated MP4 videos, step-by-step screenshot documentation, in-app interactive tours (Driver.js), and auto-published help center pages.",
  },
  {
    q: "How does the Chrome extension work?",
    a: "Install our Chrome extension, then just use your app normally. Every click, navigation, and form fill is captured automatically using rrweb. Screenshots are taken at each step and sent to our AI pipeline for processing.",
  },
  {
    q: "What AI models does GuidesForge use?",
    a: "We use GPT-4o-mini for screenshot description and UI element detection, Kokoro TTS for text-to-speech narration, Chatterbox for voice cloning across 23 languages, and Whisper for audio transcription.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes! Our Free plan includes 10 guides per month with video and doc output. All new accounts start with a 14-day Pro trial, no credit card required.",
  },
  {
    q: "What is staleness detection?",
    a: "GuidesForge runs nightly Playwright checks comparing live screenshots of your app against the guide's baseline screenshots. If the UI has changed significantly, you're alerted with a visual diff so you can update your documentation.",
  },
  {
    q: "Can I use my own voice for narrations?",
    a: "Yes! On Pro plans and above, you can upload a 10-second voice sample and our Chatterbox model will clone your voice for all future narrations across 23 languages.",
  },
]

const logos = [
  "Acme Corp", "TechFlow", "CloudSync", "DataBridge", "AppStack",
  "Nexus AI", "PixelForge", "StreamLine", "CoreLogic", "BrightPath",
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-base font-medium text-white group-hover:text-indigo-300 transition">{q}</span>
        <ChevronDown className={`w-5 h-5 text-gray-500 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-40 pb-5" : "max-h-0"}`}>
        <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0C0D14] text-white overflow-x-hidden">
      <Helmet>
        <title>GuidesForge - Record Once, Publish Four Ways</title>
        <meta name="description" content="AI-powered guide creation platform. Turn screen recordings into narrated videos, step-by-step docs, interactive tours, and help center pages automatically." />
        <meta property="og:title" content="GuidesForge - Record Once, Publish Four Ways" />
        <meta property="og:description" content="AI-powered guide creation. Turn screen recordings into narrated videos, step-by-step docs, interactive tours, and help center pages automatically." />
        <meta property="og:url" content="https://guidesforge.org/" />
      </Helmet>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0C0D14]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GuidesForge" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-semibold gradient-text font-cabinet">GuidesForge</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400 font-satoshi">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#testimonials" className="hover:text-white transition">Testimonials</a>
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
      <section className="pt-32 pb-20 px-6 animate-fade-in">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-8 animate-slide-up">
            <span className="w-2 h-2 bg-indigo-400 rounded-full recording-dot" />
            Now in public beta
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 font-cabinet animate-slide-up anim-delay-100">
            Record once.
            <br />
            <span className="gradient-text">Publish four ways.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-satoshi animate-slide-up anim-delay-200">
            Click through your product. Our AI turns every recording into narrated video,
            step-by-step docs, interactive tours, and a searchable help center — automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up anim-delay-300">
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

      {/* Logo Marquee */}
      <section className="py-12 border-y border-white/5 overflow-hidden">
        <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-8 font-satoshi">
          Trusted by fast-growing teams
        </p>
        <div className="relative">
          <div className="flex gap-16 animate-marquee whitespace-nowrap">
            {[...logos, ...logos].map((name, i) => (
              <span key={i} className="text-gray-600 text-lg font-semibold font-cabinet">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Counter */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="text-4xl md:text-5xl font-bold gradient-text mb-2 font-cabinet">
                {stat.value}<span className="text-indigo-400">{stat.suffix}</span>
              </div>
              <p className="text-sm text-gray-400 font-satoshi">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-cabinet">
              Four outputs. <span className="gradient-text">One recording.</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto font-satoshi">
              Every click-through recording is automatically transformed into four different formats.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="glass-card rounded-2xl p-6 hover:border-indigo-500/20 transition group animate-slide-up"
                style={{ animationDelay: `${i * 0.08}s` }}
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-cabinet">How it works</h2>
          </div>
          <div className="space-y-12">
            {[
              { step: "01", title: "Install the Chrome extension", desc: "One click install. It runs silently in the background — no 'click to record' needed.", icon: <Sparkles className="w-5 h-5" /> },
              { step: "02", title: "Click through your product", desc: "Just use your app normally. Every click, navigation, and form fill is captured automatically.", icon: <Monitor className="w-5 h-5" /> },
              { step: "03", title: "AI processes everything", desc: "Screenshots are described, narration scripts are generated, TTS audio is produced, and video is assembled.", icon: <Zap className="w-5 h-5" /> },
              { step: "04", title: "Publish everywhere", desc: "Get a narrated video, step-by-step doc, interactive tour, and help center page — all from one recording.", icon: <Globe className="w-5 h-5" /> },
            ].map((item, i) => (
              <div key={i} className="flex gap-6 items-start animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
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

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-cabinet">
              Loved by <span className="gradient-text">product teams</span>
            </h2>
            <p className="text-gray-400 font-satoshi">See what teams are saying about GuidesForge.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-sm font-semibold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-cabinet">Simple, transparent pricing</h2>
            <p className="text-gray-400 font-satoshi">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 animate-slide-up ${
                  plan.popular
                    ? "bg-indigo-500/10 border-2 border-indigo-500/40 relative"
                    : "glass-card"
                }`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 rounded-full text-xs font-medium">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold font-cabinet">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
                <div className="mb-4" />
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.href || "/register"}
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

      {/* FAQ */}
      <section id="faq" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-cabinet">
              Frequently asked <span className="gradient-text">questions</span>
            </h2>
          </div>
          <div className="divide-y divide-white/5">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-indigo-400" />
            <span className="text-sm text-gray-400">Join teams already using GuidesForge</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-cabinet">
            Ready to automate your documentation?
          </h2>
          <p className="text-gray-400 mb-8 font-satoshi">
            Save hours every week with AI-powered guide creation. Start your free trial today.
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
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="GuidesForge" className="w-8 h-8 rounded-lg" />
                <span className="text-lg font-semibold gradient-text font-cabinet">GuidesForge</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                AI-powered guide creation platform. Record once, publish four ways.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-gray-300 transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-gray-300 transition">Pricing</a></li>
                <li><Link to="/help" className="hover:text-gray-300 transition">Help Center</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="mailto:support@guidesforge.org" className="hover:text-gray-300 transition">Support</a></li>
                <li><Link to="/privacy" className="hover:text-gray-300 transition">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-gray-300 transition">Terms of Service</Link></li>
                <li><Link to="/contact-sales" className="hover:text-gray-300 transition">Contact Sales</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Developers</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="https://guidesforge-api.onrender.com/api/docs" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">API Docs</a></li>
                <li><a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">Chrome Extension</a></li>
                <li><Link to="/settings?tab=sdk" className="hover:text-gray-300 transition">SDK</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">&copy; 2026 GuidesForge. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span>Built with AI</span>
              <span>&middot;</span>
              <span>support@guidesforge.org</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
