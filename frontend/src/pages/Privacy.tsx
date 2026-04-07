import { Link } from "react-router-dom"
import { ArrowLeft, Shield } from "lucide-react"

export default function Privacy() {
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
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-sm text-gray-400">Last updated: January 1, 2026</p>
          </div>
        </div>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly: name, email address, and payment information when you create an account or subscribe. We also collect usage data including screen recordings you upload, guides you create, and analytics about guide views.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use your information to provide and improve GuidesForge services, process payments, send transactional emails, and provide customer support. Screen recordings are processed by our AI pipeline to generate guides and are stored securely.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Storage &amp; Security</h2>
            <p>Your data is stored on secure servers with encryption at rest and in transit. Screen recordings and generated media are stored in S3-compatible object storage. We use industry-standard security measures to protect your information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Services</h2>
            <p>We use the following third-party services: DodoPayments for payment processing, Mailgun for transactional email, Modal for AI processing, and iDrive E2 for file storage. Each service has its own privacy policy governing their use of data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
            <p>We retain your data for as long as your account is active. When you delete your account, we will delete your personal data and uploaded content within 30 days, except where we are required to retain it by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. You can export your guides at any time. To exercise these rights, contact us at support@guidesforge.org.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, contact us at <a href="mailto:support@guidesforge.org" className="text-indigo-400 hover:text-indigo-300">support@guidesforge.org</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
