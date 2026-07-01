import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CurrentUser = {
  id: number;
  username: string;
  display_name: string;
  roles?: RoleBrief[];
  active_role?: RoleBrief | null;
  permissions: string[];
  menus: MenuNode[];
};

export type RoleBrief = {
  id: number;
  code: string;
  name: string;
};

export type MenuNode = {
  id: number;
  parent_id?: number;
  type: 'directory' | 'page' | 'button';
  code: string;
  name: string;
  path?: string;
  icon?: string;
  children?: MenuNode[];
};

type AuthState = {
  accessToken: string;
  refreshToken: string;
  user: CurrentUser | null;
  activeRoleCode: string;
  setSession: (session: { accessToken: string; refreshToken: string; user: CurrentUser }) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: CurrentUser) => void;
  setActiveRoleCode: (code: string) => void;
  clearSession: () => void;
  hasPermission: (code: string) => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: '',
      refreshToken: '',
      user: null,
      activeRoleCode: '',
      setSession: (session) => set({ ...session, activeRoleCode: resolveActiveRoleCode(session.user) }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set((state) => ({ user, activeRoleCode: resolveActiveRoleCode(user, state.activeRoleCode) })),
      setActiveRoleCode: (code) => set({ activeRoleCode: code }),
      clearSession: () => set({ accessToken: '', refreshToken: '', user: null, activeRoleCode: '' }),
      hasPermission: (code) => {
        const user = get().user;
        return Boolean(user?.permissions.includes(code));
      },
    }),
    { name: 'enterprise-demo-auth-v4' },
  ),
);

function resolveActiveRoleCode(user: CurrentUser, preferredCode = '') {
  if (user.active_role?.code) {
    return user.active_role.code;
  }
  if (preferredCode && user.roles?.some((role) => role.code === preferredCode)) {
    return preferredCode;
  }
  return user.roles?.[0]?.code ?? '';
}
