import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { meApi } from '../api/auth';
import { BasicLayout } from '../layouts/BasicLayout';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { NotFoundPage } from '../features/common/NotFoundPage';
import { useAuthStore } from '../store/authStore';
import { enterpriseRoutes } from './lazyRoutes';

const lazyRouteComponents = enterpriseRoutes.map((route) => ({
  ...route,
  Component: lazy(route.loader),
}));

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
    return null;
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

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#667085' }}>加载中...</div>}>{children}</Suspense>;
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
            {lazyRouteComponents.map(({ path, Component }) => (
              <Route
                key={path}
                path={path}
                element={
                  <LazyPage>
                    <Component />
                  </LazyPage>
                }
              />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthBootstrap>
  );
}
