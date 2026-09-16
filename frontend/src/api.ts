const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Expected JSON from ${response.url}; received ${contentType || "unknown"}. ${text.slice(0, 100)}`);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : JSON.stringify(data?.detail ?? data));
  return data as T;
}

export const api = {
  get: async <T,>(url: string): Promise<T> => parseResponse<T>(await fetch(apiUrl(url), { headers: { Accept: "application/json" } })),
  post: async <T,>(url: string, body?: unknown): Promise<T> => parseResponse<T>(await fetch(apiUrl(url), {
    method: "POST",
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })),
};
