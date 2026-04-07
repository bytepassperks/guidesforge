import { Link } from "react-router-dom"
import { ArrowLeft, FileText } from "lucide-react"

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#0C0D14] text-white">
      <nav className="border-b border-white/5 bg-[#0C0D14]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GuidesForge" className="w-8 h-8 rounded-lg" />
            <span className="text-sm font-semibold gradient-text">GuidesForge</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Terms of Service</h1>
            <p className="text-sm text-gray-400">Last updated: January 1, 2026</p>
          </div>
        </div>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using GuidesForge, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Service Description</h2>
            <p>GuidesForge is an AI-powered guide creation platform that transforms screen recordings into narrated videos, step-by-step documentation, interactive tours, and help center pages.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Account Terms</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to use GuidesForge for any unlawful purpose, to upload malicious content, to attempt to gain unauthorized access, or to interfere with the service's operation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Intellectual Property</h2>
            <p>You retain ownership of all content you create using GuidesForge. We retain ownership of the GuidesForge platform, including all software, designs, and documentation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Payment &amp; Billing</h2>
            <p>Paid plans are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law. We may change pricing with 30 days notice.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Termination</h2>
            <p>We may terminate or suspend your account if you violate these terms. You may cancel your account at any time through the billing settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>GuidesForge is provided &quot;as is&quot; without warranty of any kind. We shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Contact</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:support@guidesforge.org" className="text-indigo-400 hover:text-indigo-300">support@guidesforge.org</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
