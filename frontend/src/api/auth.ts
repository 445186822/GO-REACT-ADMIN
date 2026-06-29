import { http } from '../request/http';
import type { CurrentUser } from '../store/authStore';

export type LoginRequest = {
  username: string;
  password: string;
  captcha_token: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: CurrentUser;
};

export type CaptchaChallenge = {
  challenge_id: string;
  type: 'slider';
  width: number;
  height: number;
  piece_size: number;
  initial_x: number;
  target_x: number;
  target_y: number;
  tolerance: number;
  background: string;
  piece: string;
  expires_in: number;
};

export type CaptchaVerifyRequest = {
  challenge_id: string;
  x: number;
  track: Array<{ x: number; t: number }>;
};

export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
  const res = await http.post<unknown, { data: LoginResponse }>('/auth/login', data);
  return res.data;
}

export async function getCaptchaChallengeApi(): Promise<CaptchaChallenge> {
  const res = await http.get<unknown, { data: CaptchaChallenge }>('/auth/captcha');
  return res.data;
}

export async function verifyCaptchaApi(data: CaptchaVerifyRequest): Promise<{ captcha_token: string }> {
  const res = await http.post<unknown, { data: { captcha_token: string } }>('/auth/captcha/verify', data);
  return res.data;
}

export async function meApi(): Promise<CurrentUser> {
  const res = await http.get<unknown, { data: CurrentUser }>('/auth/me');
  return res.data;
}
