# Frontend

React + TypeScript + Vite + Ant Design frontend for Enterprise Demo.

## Commands

Normal local startup should use the repository script from the root:

```bash
enterprise-demo.bat start
enterprise-demo.bat status
enterprise-demo.bat stop
```

Frontend-only commands:

```bash
npm install
npm run dev
npm run build
npx vitest run src
```

The root script starts the frontend on `http://127.0.0.1:15173` and proxies API calls to the backend on `http://127.0.0.1:18080`.

## Runtime Rules

- The login page calls the real backend `/api/v1/auth/login` endpoint.
- Use the admin password configured with `INITIAL_ADMIN_PASSWORD` during first backend initialization.
- Mock login, prefilled credentials, and placeholder feature pages are not allowed.
- New pages must be backed by real backend APIs, permissions, routes, and verification before they appear in menus.
