import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  is_staff: boolean;
  roles: string[];
  /** UX hint only. The API re-checks every request. */
  permissions: string[];
  cinemas: { id: string; name: string }[];
  mfa: { enabled: boolean; required: boolean; verified: boolean };
}

export interface LoginResult {
  user: AuthUser;
  mfa_required: boolean;
  mfa_setup_required: boolean;
}

export interface AccountProfile {
  user: AuthUser;
  phone: string | null;
  locale: "en" | "ko";
  marketing_opt_in: boolean;
}

export interface SessionInfo {
  id: string;
  ip: string | null;
  user_agent: string;
  last_active_at: string;
  current: boolean;
}

export const authApi = {
  me: () => apiGet<AuthUser>("/auth/me", { silent401: true }).then((r) => r.data),
  login: (email: string, password: string) => apiPost<LoginResult>("/auth/login", { email, password }, { silent401: true }).then((r) => r.data),
  staffLogin: (email: string, password: string) => apiPost<LoginResult>("/auth/staff/login", { email, password }, { silent401: true }).then((r) => r.data),
  logout: () => apiPost<null>("/auth/logout", undefined, { silent401: true }),
  register: (input: { name: string; email: string; password: string; password_confirmation: string; phone?: string; terms: boolean }) =>
    apiPost<null>("/auth/register", input),
  forgotPassword: (email: string) => apiPost<null>("/auth/forgot-password", { email }),
  resetPassword: (input: { token: string; email: string; password: string; password_confirmation: string }) =>
    apiPost<null>("/auth/reset-password", input),
  resendVerification: () => apiPost<null>("/auth/email/resend"),
  changePassword: (input: { current_password: string; password: string; password_confirmation: string }) =>
    apiPost<null>("/auth/password/change", input),

  mfaSetup: (password: string) => apiPost<{ secret: string; otpauth_uri: string }>("/auth/mfa/setup", { password }).then((r) => r.data),
  mfaConfirm: (code: string) => apiPost<{ recovery_codes: string[] }>("/auth/mfa/confirm", { code }).then((r) => r.data),
  mfaChallenge: (input: { code?: string; recovery_code?: string }) => apiPost<null>("/auth/mfa/challenge", input),
  mfaDisable: (password: string) => apiDelete<null>("/auth/mfa", { password }),

  profile: () => apiGet<AccountProfile>("/account/profile").then((r) => r.data),
  updateProfile: (input: Partial<{ name: string; phone: string | null; locale: "en" | "ko"; marketing_opt_in: boolean }>) =>
    apiPatch<AccountProfile>("/account/profile", input).then((r) => r.data),
  sessions: () => apiGet<SessionInfo[]>("/account/sessions").then((r) => r.data),
  revokeSession: (id: string) => apiDelete<null>(`/account/sessions/${id}`),
};
