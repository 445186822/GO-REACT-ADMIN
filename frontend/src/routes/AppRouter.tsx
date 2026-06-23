import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { meApi } from '../api/auth';
import { BasicLayout } from '../layouts/BasicLayout';
import { AuditLogPage } from '../features/auditlog/pages/AuditLogPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { NotFoundPage } from '../features/common/NotFoundPage';
import { CustomerListPage } from '../features/customer/pages/CustomerListPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { DepartmentListPage } from '../features/department/pages/DepartmentListPage';
import { FileCenterPage } from '../features/file/pages/FileCenterPage';
import { MenuListPage } from '../features/menu/pages/MenuListPage';
import { RoleListPage } from '../features/role/pages/RoleListPage';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { UserListPage } from '../features/user/pages/UserListPage';
import { useAuthStore } from '../store/authStore';

function AuthBootstrap({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [ready, setReady] = useState(!accessToken);

  useEffect(() => {
    let cancelled = false;

    if (!accessToken) {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    setReady(false);
    meApi()
      .then((user) => {
        if (!cancelled) {
          setUser(user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, clearSession, setUser]);

  if (!ready) {
    return <div className="app-loading">加载中...</div>;
  }

  return children;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function AppRouter() {
  return (
    <AuthBootstrap>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <BasicLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="system/users" element={<UserListPage />} />
            <Route path="system/roles" element={<RoleListPage />} />
            <Route path="system/menus" element={<MenuListPage />} />
            <Route path="system/departments" element={<DepartmentListPage />} />
            <Route path="business/customers" element={<CustomerListPage />} />
            <Route path="files" element={<FileCenterPage />} />
            <Route path="logs/operation" element={<AuditLogPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthBootstrap>
  );
}
