import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3000/api";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (username, password) => {
    const response = await api.post("/auth/login", { username, password });
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getAll: async () => {
    const response = await api.get("/users");
    return response.data;
  },

  updateLimit: async (userId, dailyLimit) => {
    const response = await api.patch(`/users/${userId}`, { dailyLimit });
    return response.data;
  },

  toggleBlock: async (userId, isBlocked) => {
    const response = await api.patch(`/users/${userId}/block`, { isBlocked });
    return response.data;
  },

  updateGlobalLimit: async (dailyLimit) => {
    const response = await api.patch("/users/global-limit", { dailyLimit });
    return response.data;
  },
};

// AI Providers API
export const aiProvidersAPI = {
  getAll: async () => {
    const response = await api.get("/ai-providers");
    return response.data;
  },

  activate: async (providerId) => {
    const response = await api.patch(`/ai-providers/${providerId}/activate`);
    return response.data;
  },

  updateModel: async (providerId, selectedModel) => {
    const response = await api.patch(`/ai-providers/${providerId}/model`, {
      selectedModel,
    });
    return response.data;
  },

  addToken: async (providerId, tokenData) => {
    const response = await api.post(
      `/ai-providers/${providerId}/tokens`,
      tokenData
    );
    return response.data;
  },

  updateToken: async (providerId, tokenId, updates) => {
    const response = await api.patch(
      `/ai-providers/${providerId}/tokens/${tokenId}`,
      updates
    );
    return response.data;
  },

  deleteToken: async (providerId, tokenId) => {
    const response = await api.delete(
      `/ai-providers/${providerId}/tokens/${tokenId}`
    );
    return response.data;
  },

  testProvider: async (providerId) => {
    const response = await api.post(`/ai-providers/${providerId}/test`);
    return response.data;
  },
};

export default api;
