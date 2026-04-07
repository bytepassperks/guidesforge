import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { useAuth } from "@/hooks/useAuth"
import { workspacesAPI, authAPI } from "@/services/api"
import {
  Settings as SettingsIcon,
  User,
  Building2,
  Users,
  Key,
  Mic,
  Save,
  Copy,
  Check,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  Upload,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
} from "lucide-react"

interface Workspace {
  id: string
  name: string
  slug: string
  brand_color: string
  sdk_key: string | null
  help_center_enabled: boolean
  custom_domain: string | null
}

interface Member {
  id: string
  user_id: string
  email: string
  full_name: string | null
  role: string
  joined_at: string
}

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get("tab") || "profile"
  const setTab = (t: string) => setSearchParams({ tab: t })
  const [fullName, setFullName] = useState("")
  const [copied, setCopied] = useState(false)
  const [showSDKKey, setShowSDKKey] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [wsSaved, setWsSaved] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [wsName, setWsName] = useState("")
  const [wsSlug, setWsSlug] = useState("")
  const [wsBrandColor, setWsBrandColor] = useState("#6366F1")
  const [wsHelpCenter, setWsHelpCenter] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("editor")
  const voiceInputRef = useRef<HTMLInputElement>(null)

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspacesAPI.list(),
  })
  const workspace: Workspace | undefined = workspacesData?.data?.[0]

  const { data: membersData } = useQuery({
    queryKey: ["workspace-members", workspace?.id],
    queryFn: () => workspacesAPI.members(workspace!.id),
    enabled: !!workspace,
  })
  const members: Member[] = membersData?.data || []

  useEffect(() => {
    if (user) setFullName(user.full_name || "")
  }, [user])

  useEffect(() => {
    if (workspace) {
      setWsName(workspace.name)
      setWsSlug(workspace.slug)
      setWsBrandColor(workspace.brand_color || "#6366F1")
      setWsHelpCenter(workspace.help_center_enabled)
    }
  }, [workspace])

  const updateProfile = useMutation({
    mutationFn: () => authAPI.updateMe({ full_name: fullName }),
    onSuccess: () => {
      refreshUser()
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    },
  })

  const changePassword = useMutation({
    mutationFn: () => authAPI.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
      setPasswordError("")
      setPasswordSaved(true)
      setTimeout(() => setPasswordSaved(false), 3000)
    },
    onError: () => setPasswordError("Current password is incorrect"),
  })

  const updateWorkspace = useMutation({
    mutationFn: () =>
      workspacesAPI.update(workspace!.id, {
        name: wsName,
        slug: wsSlug,
        brand_color: wsBrandColor,
        help_center_enabled: wsHelpCenter,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] })
      setWsSaved(true)
      setTimeout(() => setWsSaved(false), 3000)
    },
  })

  const inviteMember = useMutation({
    mutationFn: () => workspacesAPI.invite(workspace!.id, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] })
      setInviteEmail("")
    },
  })

  const removeMember = useMutation({
    mutationFn: (memberId: string) => workspacesAPI.removeMember(workspace!.id, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-members"] }),
  })

  const regenerateSDK = useMutation({
    mutationFn: () => workspacesAPI.regenerateSDKKey(workspace!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
  })

  const uploadVoice = useMutation({
    mutationFn: (file: File) => authAPI.uploadVoice(file),
    onSuccess: () => refreshUser(),
  })

  function handleCopySDK() {
    if (workspace?.sdk_key) {
      navigator.clipboard.writeText(workspace.sdk_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "workspace", label: "Workspace", icon: Building2 },
    { id: "team", label: "Team", icon: Users },
    { id: "sdk", label: "SDK & API", icon: Key },
    { id: "voice", label: "Voice Profile", icon: Mic },
  ]

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-8">
          <SettingsIcon className="w-6 h-6 text-indigo-400" /> Settings
        </h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white/5 rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition flex-1 justify-center ${
                tab === t.id
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Profile */}
        {tab === "profile" && (
          <div className="glass-card rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">Profile Settings</h3>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Plan</label>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 text-sm font-medium">
                  {user?.plan || "free"}
                </span>
                {user?.trial_ends_at && (
                  <span className="text-xs text-gray-500">
                    Trial ends {new Date(user.trial_ends_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateProfile.mutate()}
                disabled={updateProfile.isPending}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
              >
                {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Profile
              </button>
              {profileSaved && (
                <span className="flex items-center gap-1 text-green-400 text-sm"><CheckCircle2 className="w-4 h-4" /> Saved</span>
              )}
            </div>

            {/* Change Password */}
            <div className="border-t border-white/5 pt-5 mt-5">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-gray-400" /> Change Password</h4>
              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-2 mb-3">{passwordError}</div>
              )}
              <div className="space-y-3">
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 outline-none transition" placeholder="Current password" />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 outline-none transition" placeholder="New password (min 8 characters)" />
                <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 outline-none transition" placeholder="Confirm new password" />
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => {
                    if (newPassword.length < 8) { setPasswordError("New password must be at least 8 characters"); return }
                    if (newPassword !== confirmNewPassword) { setPasswordError("Passwords do not match"); return }
                    setPasswordError("")
                    changePassword.mutate()
                  }}
                  disabled={changePassword.isPending || !currentPassword || !newPassword}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 transition disabled:opacity-50"
                >
                  {changePassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Update Password
                </button>
                {passwordSaved && (
                  <span className="flex items-center gap-1 text-green-400 text-sm"><CheckCircle2 className="w-4 h-4" /> Password updated</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Workspace */}
        {tab === "workspace" && workspace && (
          <div className="glass-card rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">Workspace Settings</h3>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Workspace Name</label>
              <input
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">/help/</span>
                <input
                  type="text"
                  value={wsSlug}
                  onChange={(e) => setWsSlug(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Brand Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={wsBrandColor}
                  onChange={(e) => setWsBrandColor(e.target.value)}
                  className="w-10 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer"
                />
                <input
                  type="text"
                  value={wsBrandColor}
                  onChange={(e) => setWsBrandColor(e.target.value)}
                  className="w-32 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">Help Center</p>
                <p className="text-xs text-gray-500">Enable public help center for this workspace</p>
              </div>
              <button
                onClick={() => setWsHelpCenter(!wsHelpCenter)}
                className={`w-11 h-6 rounded-full transition ${wsHelpCenter ? "bg-indigo-500" : "bg-white/10"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition transform ${wsHelpCenter ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <button
              onClick={() => updateWorkspace.mutate()}
              disabled={updateWorkspace.isPending}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
            >
              {updateWorkspace.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Workspace
            </button>
            {wsSaved && (
              <span className="flex items-center gap-1 text-green-400 text-sm ml-3"><CheckCircle2 className="w-4 h-4" /> Saved</span>
            )}
          </div>
        )}

        {/* Team */}
        {tab === "team" && !workspace && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">No workspace yet</h3>
            <p className="text-sm text-gray-400">Create a workspace first to manage team members.</p>
          </div>
        )}
        {tab === "team" && workspace && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Invite Member</h3>
              <form
                onSubmit={(e) => { e.preventDefault(); inviteMember.mutate() }}
                className="flex gap-3"
              >
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                  placeholder="colleague@company.com"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-gray-300 text-sm outline-none focus:border-indigo-500 transition"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={inviteMember.isPending}
                  className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
                >
                  {inviteMember.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Invite
                </button>
              </form>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Team Members ({members.length})</h3>
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 py-2">
                    <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-medium shrink-0">
                      {(member.full_name || member.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{member.full_name || member.email}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-gray-400">{member.role}</span>
                    <button
                      onClick={() => removeMember.mutate(member.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SDK */}
        {tab === "sdk" && workspace && (
          <div className="glass-card rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">SDK & API Keys</h3>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">SDK Key</label>
              <div className="flex gap-2">
                <input
                  type={showSDKKey ? "text" : "password"}
                  value={workspace.sdk_key || "Not generated"}
                  readOnly
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-gray-300 text-sm font-mono"
                />
                <button
                  onClick={() => setShowSDKKey(!showSDKKey)}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition"
                  aria-label={showSDKKey ? "Hide SDK key" : "Show SDK key"}
                >
                  {showSDKKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleCopySDK}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => regenerateSDK.mutate()}
                  disabled={regenerateSDK.isPending}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${regenerateSDK.isPending ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Embed Script</label>
              <div className="bg-black/30 rounded-xl p-4">
                <code className="text-xs text-indigo-300 break-all">
                  {`<script src="https://guidesforge.org/sdk/v1/widget.js" data-key="${workspace.sdk_key || "YOUR_SDK_KEY"}"></script>`}
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Voice Profile */}
        {tab === "voice" && (
          <div className="glass-card rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">Voice Profile</h3>
            <p className="text-sm text-gray-400">
              Upload a 10-second audio sample to clone your voice for guide narration.
              Powered by Chatterbox TTS with zero-shot voice cloning.
            </p>
            {user?.voice_profile_url ? (
              <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400 font-medium">Voice profile enrolled</span>
                </div>
                <audio src={user.voice_profile_url} controls className="w-full" />
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center">
                <Mic className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-4">
                  Upload a WAV or MP3 file (10-30 seconds of clear speech)
                </p>
                <input
                  ref={voiceInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadVoice.mutate(file)
                  }}
                />
                <button
                  onClick={() => voiceInputRef.current?.click()}
                  disabled={uploadVoice.isPending}
                  className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition mx-auto"
                >
                  {uploadVoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload Voice Sample
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
