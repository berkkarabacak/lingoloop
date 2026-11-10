import { apiBaseUrl } from "./baseUrl";

let authToken: string | null = null;
export function setApiToken(token: string | null) { authToken = token; }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body && !(typeof FormData !== "undefined" && options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    });
    if (response.status === 204) return undefined as T;
    const body = await response.json();
    if (!response.ok) throw new ApiError(response.status, body.error?.code || "REQUEST_FAILED", body.error?.message || "Something went wrong.");
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "NETWORK", "Cannot reach the LingoLoop server. Check that the backend is running.");
  } finally {
    clearTimeout(timer);
  }
}
