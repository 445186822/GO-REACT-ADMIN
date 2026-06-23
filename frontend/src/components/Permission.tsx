import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';

type PermissionProps = {
  code: string;
  children: ReactNode;
};

export function Permission({ code, children }: PermissionProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  if (!hasPermission(code)) {
    return null;
  }
  return <>{children}</>;
}
