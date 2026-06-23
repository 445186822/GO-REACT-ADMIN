import { http } from '../request/http';
import type { CurrentUser } from '../store/authStore';

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: CurrentUser;
};

export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
  const res = await http.post<unknown, { data: LoginResponse }>('/auth/login', data);
  return res.data;
}

export async function meApi(): Promise<CurrentUser> {
  const res = await http.get<unknown, { data: CurrentUser }>('/auth/me');
  return res.data;
}
