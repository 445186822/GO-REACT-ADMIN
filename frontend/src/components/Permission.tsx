import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';

type PermissionProps = {
  code: string;
  children: ReactNode;
};

// hasPermission is a stable function reference — no need for a dynamic selector.
const selectHasPermission = (s: { hasPermission: (code: string) => boolean }) => s.hasPermission;

export function Permission({ code, children }: PermissionProps) {
  const hasPermission = useAuthStore(selectHasPermission);
  if (!hasPermission(code)) return null;
  return <>{children}</>;
}
