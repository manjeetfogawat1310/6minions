export const API_BASE_URL = window.location.origin;

const TIMEOUT_MS = 25000;

export class APIError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

export function apiURL(path) {
  return `${API_BASE_URL.replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;
}

export function resourceURL(path) {
  if (typeof path !== "string" || !path.trim()) return null;
  try {
    const url = new URL(path, `${API_BASE_URL.replace(/\/+$/, "")}/`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export const segment = value => encodeURIComponent(String(value));

function errorMessage(body, status) {
  let detail = body?.detail ?? body?.message ?? body?.error;
  if (Array.isArray(detail)) {
    detail = detail.map(item => {
      const field = Array.isArray(item.loc) ? item.loc.join(".") : "Request";
      return `${field}: ${item.msg || "Invalid value"}`;
    }).join("; ");
  } else if (detail && typeof detail === "object") {
    detail = JSON.stringify(detail);
  }

  if (detail) return String(detail);
  if (status === 404) return "The requested record or endpoint was not found.";
  if (status === 413) return "This file is too large for the backend.";
  if (status === 422) return "The backend rejected these fields. Check the entered values.";
  if (status === 503) return "The requested backend service is unavailable.";
  return `The backend returned HTTP ${status}. Please try again.`;
}

async function request(path, { method = "GET", body, query, signal } = {}) {
  const url = new URL(apiURL(path));
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const multipart = body instanceof FormData;
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {})
      },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store"
    });

    window.dispatchEvent(new CustomEvent("api:connection", {
      detail: { reachable: true }
    }));

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new APIError("The backend returned a non-JSON response where JSON was expected.", response.status);
        }
      }
    }

    if (!response.ok) throw new APIError(errorMessage(data, response.status), response.status, data);
    if (data?.success === false) {
      throw new APIError(errorMessage(data, response.status), response.status, data);
    }
    return data;
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (signal?.aborted && !timedOut) {
      throw new DOMException("Request cancelled", "AbortError");
    }

    window.dispatchEvent(new CustomEvent("api:connection", {
      detail: { reachable: false }
    }));

    const uncertain = method !== "GET"
      ? " The operation may have reached the server. Refresh the record before retrying."
      : "";
    throw new APIError(
      (timedOut
        ? "The request timed out."
        : "Cannot reach the backend. Check the API base URL, network, and backend CORS configuration.")
      + uncertain
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export const api = {
  get: (path, options = {}) => request(path, options),
  post: (path, body, options = {}) => request(path, { ...options, method: "POST", body })
};

export function unwrap(data) {
  return data?.data ?? data;
}

export function list(data, ...keys) {
  const value = unwrap(data);
  if (Array.isArray(value)) return value;
  for (const key of [...keys, "items", "results"]) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  throw new APIError("The backend response did not contain the expected list. No sample records have been substituted.");
}
