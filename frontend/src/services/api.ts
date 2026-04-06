import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || ""

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem("refresh_token")
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          })
          localStorage.setItem("access_token", res.data.access_token)
          localStorage.setItem("refresh_token", res.data.refresh_token)
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`
          return api(originalRequest)
        } catch {
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
          window.location.href = "/login"
        }
      } else {
        window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const authAPI = {
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post("/api/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/api/auth/login", data),
  refresh: (refresh_token: string) =>
    api.post("/api/auth/refresh", { refresh_token }),
  me: () => api.get("/api/auth/me"),
  updateMe: (data: { full_name?: string; avatar_photo_url?: string }) =>
    api.put("/api/auth/me", data),
  uploadVoice: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return api.post("/api/auth/upload-voice", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
}

// Guides
export const guidesAPI = {
  list: (params?: { page?: number; per_page?: number; search?: string; status?: string; workspace_id?: string }) =>
    api.get("/api/guides", { params }),
  get: (id: string) => api.get(`/api/guides/${id}`),
  create: (data: { title: string; description?: string; workspace_id?: string }) =>
    api.post("/api/guides", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/guides/${id}`, data),
  delete: (id: string) => api.delete(`/api/guides/${id}`),
  publish: (id: string) => api.post(`/api/guides/${id}/publish`),
  embedCode: (id: string) => api.get(`/api/guides/${id}/embed-code`),
  trackView: (id: string, data: Record<string, unknown>) =>
    api.post(`/api/guides/${id}/track-view`, data),
  getSteps: (id: string) => api.get(`/api/guides/${id}/steps`),
}

// Steps
export const stepsAPI = {
  list: (guideId: string) => api.get(`/api/guides/${guideId}/steps`),
  get: (guideId: string, stepId: string) =>
    api.get(`/api/guides/${guideId}/steps/${stepId}`),
  update: (guideId: string, stepId: string, data: Record<string, unknown>) =>
    api.put(`/api/guides/${guideId}/steps/${stepId}`, data),
  delete: (guideId: string, stepId: string) =>
    api.delete(`/api/guides/${guideId}/steps/${stepId}`),
  regenerateAudio: (guideId: string, stepId: string) =>
    api.post(`/api/guides/${guideId}/steps/${stepId}/regenerate-audio`),
  regenerateCallouts: (guideId: string, stepId: string) =>
    api.post(`/api/guides/${guideId}/steps/${stepId}/regenerate-callouts`),
}

// Workspaces
export const workspacesAPI = {
  list: () => api.get("/api/workspaces"),
  get: (id: string) => api.get(`/api/workspaces/${id}`),
  create: (data: { name: string; slug?: string; brand_color?: string }) =>
    api.post("/api/workspaces", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/workspaces/${id}`, data),
  delete: (id: string) => api.delete(`/api/workspaces/${id}`),
  invite: (id: string, data: { email: string; role?: string }) =>
    api.post(`/api/workspaces/${id}/invite`, data),
  members: (id: string) => api.get(`/api/workspaces/${id}/members`),
  removeMember: (workspaceId: string, memberId: string) =>
    api.delete(`/api/workspaces/${workspaceId}/members/${memberId}`),
  regenerateSDKKey: (id: string) =>
    api.post(`/api/workspaces/${id}/sdk-key`),
}

// Billing
export const billingAPI = {
  // DodoPayments - primary payment gateway
  dodoCheckout: (data: { workspace_id: string; plan: string; interval: string }) =>
    api.post("/api/billing/dodo/checkout", data),
  // Legacy gateways (kept for backward compatibility)
  stripeCheckout: (data: { workspace_id: string; plan: string; interval: string }) =>
    api.post("/api/billing/stripe/checkout", data),
  razorpaySubscription: (data: { workspace_id: string; plan: string; interval: string }) =>
    api.post("/api/billing/razorpay/create-subscription", data),
  easebuzzCheckout: (data: { workspace_id: string; plan: string; interval: string; currency?: string }) =>
    api.post("/api/billing/easebuzz/checkout", data),
  easebuzzStatus: (txnid: string) =>
    api.get(`/api/billing/easebuzz/status/${txnid}`),
  getSubscription: (workspaceId: string) =>
    api.get("/api/billing/subscription", { params: { workspace_id: workspaceId } }),
  cancel: (data: { workspace_id: string; reason?: string }) =>
    api.post("/api/billing/cancel", data),
}

// Analytics
export const analyticsAPI = {
  overview: (params?: { workspace_id?: string; days?: number }) =>
    api.get("/api/analytics/overview", { params }),
  guideAnalytics: (guideId: string, days?: number) =>
    api.get(`/api/analytics/guides/${guideId}`, { params: { days } }),
  staleness: (workspaceId?: string) =>
    api.get("/api/analytics/staleness", { params: { workspace_id: workspaceId } }),
}

// Pipeline
export const pipelineAPI = {
  processGuide: (data: { guide_id: string; steps: Record<string, unknown>[] }) =>
    api.post("/api/pipeline/process-guide", data),
  checkStaleness: (guideId: string) =>
    api.post("/api/pipeline/check-staleness", { guide_id: guideId }),
  jobStatus: (taskId: string) => api.get(`/api/pipeline/job/${taskId}`),
  uploadRecording: (data: { guide_id: string; steps: Record<string, unknown>[] }) =>
    api.post("/api/pipeline/upload-recording", data),
}

export default api
