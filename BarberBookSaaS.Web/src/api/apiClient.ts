import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5299",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("barber_token");
  const tenantId = localStorage.getItem("barber_tenant_id");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Don't clobber an X-Tenant-Id set explicitly by the caller (e.g. SuperAdmin
  // acting on a specific tenant) with the stale value from localStorage.
  if (tenantId && !config.headers["X-Tenant-Id"]) config.headers["X-Tenant-Id"] = tenantId;
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/api/auth/refresh")
    ) {
      original._retry = true;
      const refreshToken = localStorage.getItem("barber_refresh_token");
      if (refreshToken) {
        try {
          const res = await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:5299"}/api/auth/refresh`, { refreshToken });
          const { token, refreshToken: newRefresh } = res.data;
          localStorage.setItem("barber_token", token);
          localStorage.setItem("barber_refresh_token", newRefresh);
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        } catch {
          // refresh failed — clear session
        }
      }
      ["barber_token", "barber_tenant_id", "barber_user", "barber_refresh_token", "barber_branding"].forEach(
        (k) => localStorage.removeItem(k)
      );
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
