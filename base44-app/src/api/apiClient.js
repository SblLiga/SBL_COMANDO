const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const TOKEN_KEY = "sbl_access_token";

function getToken() {
  const primary = localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token");
  if (primary) return primary;
  // One-time migration from legacy key (pre-independence)
  const legacy = localStorage.getItem("base44_access_token");
  if (legacy) {
    localStorage.setItem(TOKEN_KEY, legacy);
    localStorage.removeItem("base44_access_token");
    return legacy;
  }
  return null;
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("token", token);
    // Migrate away from legacy key if present
    localStorage.removeItem("base44_access_token");
  }
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("token");
  localStorage.removeItem("base44_access_token");
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data?.detail || data?.message || `Request failed (${response.status})`;
    const error = new Error(typeof message === "string" ? message : JSON.stringify(message));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function makeEntity(name) {
  return {
    list: (sort, limit) => {
      const params = new URLSearchParams();
      if (sort) params.set("sort", sort);
      if (limit) params.set("limit", String(limit));
      const qs = params.toString();
      return request(`/api/entities/${name}${qs ? `?${qs}` : ""}`);
    },
    filter: (criteria) =>
      request(`/api/entities/${name}/filter`, {
        method: "POST",
        body: JSON.stringify({ criteria }),
      }),
    get: (id) => request(`/api/entities/${name}/${id}`),
    create: (data) =>
      request(`/api/entities/${name}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      request(`/api/entities/${name}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      request(`/api/entities/${name}/${id}`, {
        method: "DELETE",
      }),
    bulkCreate: (items) =>
      request(`/api/entities/${name}/bulk`, {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    bulkUpdate: (items) =>
      request(`/api/entities/${name}/bulk`, {
        method: "PATCH",
        body: JSON.stringify({ items }),
      }),
  };
}

const auth = {
  async loginViaEmailPassword(email, password) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(result.access_token);
    return result;
  },
  async register({ email, password }) {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  async verifyOtp({ email, otpCode }) {
    const result = await request("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otpCode }),
    });
    if (result?.access_token) setToken(result.access_token);
    return result;
  },
  async resendOtp(email) {
    return request("/api/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  async resetPasswordRequest(email) {
    return request("/api/auth/reset-password-request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  async resetPassword({ resetToken, newPassword }) {
    return request("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ resetToken, newPassword }),
    });
  },
  async changePassword({ current_password, new_password, currentPassword, newPassword }) {
    return request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: current_password || currentPassword,
        new_password: new_password || newPassword,
      }),
    });
  },
  me: () => request("/api/auth/me"),
  updateMe: (data) =>
    request("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  setToken,
  logout: () => {
    clearToken();
  },
  redirectToLogin: (returnUrl) => {
    const target = returnUrl
      ? `/login?return=${encodeURIComponent(returnUrl)}`
      : "/login";
    window.location.href = target;
  },
  loginWithProvider: () => {
    throw new Error("Google login is not configured on self-hosted SBL yet");
  },
  isAuthenticated: () => Boolean(getToken()),
};

const entities = {
  User: makeEntity("User"),
  Member: makeEntity("Member"),
  Group: makeEntity("Group"),
  Goal: makeEntity("Goal"),
  Task: makeEntity("Task"),
  Notification: makeEntity("Notification"),
  Meeting: makeEntity("Meeting"),
  Report: makeEntity("Report"),
  SystemSetting: makeEntity("SystemSetting"),
};

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const form = new FormData();
      // Explicit filename helps some mobile browsers / FastAPI parsers
      form.append("file", file, file.name || "avatar.jpg");
      return request("/api/integrations/core/upload-file", {
        method: "POST",
        body: form,
        // Do not set Content-Type — browser must add multipart boundary
        headers: {},
      });
    },
    InvokeLLM: async () => {
      throw new Error("LLM integration is not available in self-hosted mode");
    },
    GenerateImage: async () => {
      throw new Error("Image generation is not available in self-hosted mode");
    },
    SendEmail: async () => {
      throw new Error("Email integration is not available in self-hosted mode");
    },
  },
  Make: {
    triggerCheckout: () =>
      request("/api/integrations/make/trigger-checkout", { method: "POST", body: "{}" }),
  },
};

export const apiClient = {
  auth,
  entities,
  integrations,
  functions: {
    invoke: async () => {
      throw new Error("Server functions are not available in self-hosted mode");
    },
  },
  users: {
    inviteUser: async () => {
      throw new Error("User invite is not available in self-hosted mode");
    },
  },
  analytics: {
    track: () => {},
  },
  agents: {},
};

export default apiClient;
