import axios from 'axios';

/**
 * Single Axios instance for every backend call.
 * The browser always talks to the same origin; Vite proxies /api to Express.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// A 401 from any console endpoint means the session is gone; let the auth
// provider clear the user so protected routes redirect to the sign-in page.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      if (!url.startsWith('/auth/login') && !url.startsWith('/auth/me')) {
        window.dispatchEvent(new Event('goldenhour:unauthenticated'));
      }
    }
    return Promise.reject(error);
  },
);

export function describeApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { message?: string } | undefined;
    if (payload?.message) return payload.message;
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    if (!error.response) {
      return 'Cannot reach the GoldenHour API. Is the backend running on port 4000?';
    }
    return `Request failed with status ${error.response.status}.`;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
