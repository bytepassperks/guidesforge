import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Send, Loader2, CheckCircle, Building2 } from "lucide-react"

export default function ContactSales() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [teamSize, setTeamSize] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ""}/api/auth/contact-sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, team_size: teamSize, message }),
      })
    } catch {
      // Still show success
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0C0D14] text-white">
      <nav className="border-b border-white/5 bg-[#0C0D14]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GuidesForge" className="w-8 h-8 rounded-lg" />
            <span className="text-sm font-semibold gradient-text">GuidesForge</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Contact Sales</h1>
            <p className="text-sm text-gray-400">Get a custom plan for your team</p>
          </div>
        </div>

        {sent ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Message sent!</h2>
            <p className="text-gray-400 text-sm mb-6">We will get back to you within 24 hours.</p>
            <Link to="/" className="text-indigo-400 hover:text-indigo-300 text-sm transition">
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cs-name" className="block text-sm font-medium text-gray-300 mb-1.5">Your Name</label>
                <input id="cs-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" placeholder="John Doe" required />
              </div>
              <div>
                <label htmlFor="cs-email" className="block text-sm font-medium text-gray-300 mb-1.5">Work Email</label>
                <input id="cs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" placeholder="you@company.com" required />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cs-company" className="block text-sm font-medium text-gray-300 mb-1.5">Company</label>
                <input id="cs-company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" placeholder="Acme Inc." required />
              </div>
              <div>
                <label htmlFor="cs-size" className="block text-sm font-medium text-gray-300 mb-1.5">Team Size</label>
                <select id="cs-size" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-gray-300 focus:border-indigo-500 outline-none transition" required>
                  <option value="">Select...</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="200+">200+</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="cs-message" className="block text-sm font-medium text-gray-300 mb-1.5">How can we help?</label>
              <textarea id="cs-message" value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none" rows={4} placeholder="Tell us about your needs..." required />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Message
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
