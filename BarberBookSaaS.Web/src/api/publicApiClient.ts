import axios from "axios";

const publicApiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5299",
  headers: { "Content-Type": "application/json" },
});

const getSubdomainFromUrl = (): string => {
  const path = window.location.pathname;
  const match = path.match(/\/(?:book|review)\/([^/]+)/);
  return match ? match[1] : "";
};

const getStoredTenantId = (): string => {
  try {
    const user = localStorage.getItem("customer_user");
    if (!user) return "";
    return JSON.parse(user).tenantId ?? "";
  } catch {
    return "";
  }
};

const clearCustomerAuth = () => {
  localStorage.removeItem("customer_token");
  localStorage.removeItem("customer_refresh_token");
  localStorage.removeItem("customer_user");
};

publicApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("customer_token");
  if (!token) return config;

  const urlSubdomain = getSubdomainFromUrl();
  const tokenTenantId = getStoredTenantId();

  if (urlSubdomain && tokenTenantId && urlSubdomain !== tokenTenantId) {
    clearCustomerAuth();
    return config;
  }

  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

publicApiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retry = true;
      const refreshToken = localStorage.getItem("customer_refresh_token");
      const subdomain = getSubdomainFromUrl();
      if (refreshToken && subdomain) {
        try {
          const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5299";
          const res = await axios.post(`${baseURL}/api/public/${subdomain}/auth/refresh`, JSON.stringify(refreshToken), {
            headers: { "Content-Type": "application/json" },
          });
          const { token, refreshToken: newRefresh } = res.data;
          localStorage.setItem("customer_token", token);
          localStorage.setItem("customer_refresh_token", newRefresh);
          original.headers.Authorization = `Bearer ${token}`;
          return publicApiClient(original);
        } catch {
          // refresh failed — clear stale session below
        }
      }
      clearCustomerAuth();
    }
    return Promise.reject(error);
  }
);

export default publicApiClient;
