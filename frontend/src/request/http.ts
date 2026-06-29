import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { formatApiTimes } from './timeFormat';

export const http = axios.create({
  baseURL: '/api/v1',
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => formatApiTimes(response.data),
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  },
);
