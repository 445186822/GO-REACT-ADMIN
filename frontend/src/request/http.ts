import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { formatApiTimes } from './timeFormat';

type AuthRefreshRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
};

type InternalAuthRefreshRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
};

const refreshPath = '/auth/refresh';
const publicAuthPaths = new Set(['/auth/login', refreshPath, '/auth/captcha', '/auth/captcha/verify']);

export const http = axios.create({
  baseURL: '/api/v1',
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const authConfig = config as InternalAuthRefreshRequestConfig;
  const token = useAuthStore.getState().accessToken;
  if (token && !authConfig._skipAuthRefresh) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const activeRoleCode = useAuthStore.getState().activeRoleCode;
  if (activeRoleCode && !authConfig._skipAuthRefresh) {
    config.headers['X-Active-Role'] = activeRoleCode;
  }
  return config;
});

http.interceptors.response.use(
  (response) => formatApiTimes(response.data),
  async (error: AxiosError) => {
    const originalConfig = error.config as InternalAuthRefreshRequestConfig | undefined;
    if (!shouldRefreshAccessToken(error, originalConfig)) {
      if (error.response?.status === 401 && !isPublicAuthRequest(originalConfig?.url)) {
        useAuthStore.getState().clearSession();
      }
      return Promise.reject(error);
    }

    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken || !originalConfig) {
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    originalConfig._retry = true;

    try {
      const refreshResponse = await http.post<unknown, { data: { access_token: string } }>(
        refreshPath,
        { refresh_token: refreshToken },
        { _skipAuthRefresh: true } as AuthRefreshRequestConfig,
      );
      const accessToken = refreshResponse.data.access_token;
      if (!accessToken) {
        throw new Error('refresh response missing access_token');
      }
      useAuthStore.getState().setAccessToken(accessToken);
      originalConfig.headers.Authorization = `Bearer ${accessToken}`;
      return http.request(originalConfig);
    } catch (refreshError) {
      useAuthStore.getState().clearSession();
      return Promise.reject(refreshError);
    }
  },
);

function shouldRefreshAccessToken(error: AxiosError, config?: InternalAuthRefreshRequestConfig) {
  return Boolean(
    error.response?.status === 401 &&
      config &&
      !config._retry &&
      !config._skipAuthRefresh &&
      !isPublicAuthRequest(config.url),
  );
}

function isPublicAuthRequest(url?: string) {
  return publicAuthPaths.has(normalizeRequestPath(url));
}

function normalizeRequestPath(url?: string) {
  if (!url) {
    return '';
  }
  const path = url.split('?')[0].replace(/^\/api\/v1/, '');
  return path || '/';
}
