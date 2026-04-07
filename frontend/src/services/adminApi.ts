import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || ""

const adminApi = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Request interceptor to add admin auth token
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_access_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for token refresh
adminApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem("admin_access_token")
      localStorage.removeItem("admin_refresh_token")
      localStorage.removeItem("admin_user")
      window.location.href = "/admin/login"
    }
    return Promise.reject(error)
  }
)

// Admin Auth
export const adminAuthAPI = {
  login: (data: { email: string; password: string }) =>
    adminApi.post("/api/admin/login", data),
  bootstrap: (data: { email: string; password: string }) =>
    adminApi.post("/api/admin/bootstrap", data),
}

// Admin Dashboard
export const adminStatsAPI = {
  getStats: () => adminApi.get("/api/admin/stats"),
  getAnalytics: (days?: number) =>
    adminApi.get("/api/admin/analytics", { params: { days } }),
}

// Admin Users
export const adminUsersAPI = {
  list: (params?: { page?: number; per_page?: number; search?: string; plan?: string }) =>
    adminApi.get("/api/admin/users", { params }),
  get: (id: string) => adminApi.get(`/api/admin/users/${id}`),
  create: (data: { email: string; password: string; full_name?: string; plan?: string; is_admin?: boolean }) =>
    adminApi.post("/api/admin/users", data),
  update: (id: string, data: Record<string, unknown>) =>
    adminApi.put(`/api/admin/users/${id}`, data),
  delete: (id: string) => adminApi.delete(`/api/admin/users/${id}`),
}

// Admin Workspaces
export const adminWorkspacesAPI = {
  list: (params?: { page?: number; per_page?: number; search?: string }) =>
    adminApi.get("/api/admin/workspaces", { params }),
  get: (id: string) => adminApi.get(`/api/admin/workspaces/${id}`),
  delete: (id: string) => adminApi.delete(`/api/admin/workspaces/${id}`),
}

// Admin Guides
export const adminGuidesAPI = {
  list: (params?: { page?: number; per_page?: number; search?: string; status?: string }) =>
    adminApi.get("/api/admin/guides", { params }),
  get: (id: string) => adminApi.get(`/api/admin/guides/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    adminApi.put(`/api/admin/guides/${id}`, data),
  delete: (id: string) => adminApi.delete(`/api/admin/guides/${id}`),
  reprocess: (id: string) => adminApi.post(`/api/admin/guides/${id}/reprocess`),
}

// Admin Subscriptions
export const adminSubscriptionsAPI = {
  list: (params?: { page?: number; per_page?: number; status?: string; provider?: string }) =>
    adminApi.get("/api/admin/subscriptions", { params }),
  update: (id: string, data: Record<string, unknown>) =>
    adminApi.put(`/api/admin/subscriptions/${id}`, data),
}

// Admin Settings
export const adminSettingsAPI = {
  get: () => adminApi.get("/api/admin/settings"),
  update: (data: Record<string, unknown>) => adminApi.put("/api/admin/settings", data),
}

export default adminApi
