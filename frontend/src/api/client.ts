// Relative by default: works both in production (frontend and API share an origin behind
// Traefik) and in local dev (Vite's dev-server proxy in vite.config.ts forwards it to the
// local backend). Only set VITE_API_URL if you deliberately want the local dev server to talk
// to a different backend (e.g. the deployed one) instead of a locally running one.
const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        credentials: "include",
        headers: init?.body
            ? { "Content-Type": "application/json" }
            : undefined,
        ...init,
    });

    if (res.status === 401 && !path.startsWith("/auth/")) {
        window.dispatchEvent(new CustomEvent("api:unauthorized"));
    }

    if (!res.ok) {
        let message = res.statusText;
        try {
            const body = (await res.json()) as { message?: string | string[] };
            if (body.message)
                message = Array.isArray(body.message)
                    ? body.message.join(", ")
                    : body.message;
        } catch {
            // ответ без тела/не JSON — оставляем statusText
        }
        throw new ApiError(res.status, message);
    }

    // Void endpoints (e.g. DELETE handlers) can come back as 200/204 with an empty body —
    // res.json() throws on an empty string, so check for actual content first.
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
}

export const api = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: "POST",
            body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
    put: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
    patch: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
