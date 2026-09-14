import { api } from "./client";

export interface AuthUser {
  username: string;
}

export const authApi = {
  login: (username: string, password: string) => api.post<AuthUser>("/auth/login", { username, password }),
  logout: () => api.post<{ ok: true }>("/auth/logout"),
  me: () => api.get<AuthUser>("/auth/me"),
};
