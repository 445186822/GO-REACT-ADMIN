import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { http } from './http';
import { useAuthStore, type CurrentUser } from '../store/authStore';

const originalAdapter = http.defaults.adapter;

const user: CurrentUser = {
  id: 1,
  username: 'admin',
  display_name: '管理员',
  permissions: [],
  menus: [],
};

describe('http auth refresh interceptor', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      user,
      activeRoleCode: 'ADMIN',
    });
  });

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
    useAuthStore.setState({
      accessToken: '',
      refreshToken: '',
      user: null,
      activeRoleCode: '',
    });
  });

  it('refreshes the access token and retries the original request after a 401', async () => {
    const calls: Array<{ url?: string; authorization?: string }> = [];
    let protectedAttempts = 0;

    http.defaults.adapter = (async (config) => {
      calls.push({
        url: config.url,
        authorization: String(config.headers?.Authorization ?? ''),
      });

      if (config.url === '/protected') {
        protectedAttempts += 1;
        if (protectedAttempts === 1) {
          throw unauthorized(config);
        }
        return ok(config, { data: { ok: true } });
      }

      if (config.url === '/auth/refresh') {
        return ok(config, { data: { access_token: 'fresh-token' } });
      }

      throw new Error(`unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    const res = await http.get<unknown, { data: { ok: boolean } }>('/protected');

    expect(res.data.ok).toBe(true);
    expect(calls.map((call) => call.url)).toEqual(['/protected', '/auth/refresh', '/protected']);
    expect(calls[0].authorization).toBe('Bearer expired-token');
    expect(calls[2].authorization).toBe('Bearer fresh-token');
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
  });

  it('clears the session only when refresh also fails', async () => {
    http.defaults.adapter = (async (config) => {
      throw unauthorized(config);
    }) satisfies AxiosAdapter;

    await expect(http.get('/protected')).rejects.toBeTruthy();

    expect(useAuthStore.getState().accessToken).toBe('');
    expect(useAuthStore.getState().refreshToken).toBe('');
    expect(useAuthStore.getState().user).toBeNull();
  });
});

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
}

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError(
    'Unauthorized',
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    {
      data: {},
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
    },
  );
}
