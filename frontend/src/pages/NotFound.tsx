import { Link } from "react-router-dom"
import { Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0C0D14] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <span className="text-8xl font-bold gradient-text font-cabinet">404</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved.
          Let us get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition"
          >
            <Home className="w-4 h-4" /> Go Home
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-gray-400 hover:text-white px-6 py-2.5 rounded-xl text-sm border border-white/10 hover:border-white/20 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
