import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CurrentUser = {
  id: number;
  username: string;
  display_name: string;
  roles?: string[];
  permissions: string[];
  menus: MenuNode[];
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
  setSession: (session: { accessToken: string; refreshToken: string; user: CurrentUser }) => void;
  setUser: (user: CurrentUser) => void;
  clearSession: () => void;
  hasPermission: (code: string) => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: '',
      refreshToken: '',
      user: null,
      setSession: (session) => set(session),
      setUser: (user) => set({ user }),
      clearSession: () => set({ accessToken: '', refreshToken: '', user: null }),
      hasPermission: (code) => {
        const user = get().user;
        return Boolean(user?.permissions.includes(code));
      },
    }),
    { name: 'enterprise-demo-auth-v4' },
  ),
);
