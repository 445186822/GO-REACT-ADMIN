CREATE TABLE sys_departments (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT NULL REFERENCES sys_departments(id),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE sys_users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT NULL,
    phone TEXT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    department_id BIGINT NULL REFERENCES sys_departments(id),
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE sys_roles (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE sys_user_roles (
    user_id BIGINT NOT NULL REFERENCES sys_users(id),
    role_id BIGINT NOT NULL REFERENCES sys_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE sys_menus (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT NULL REFERENCES sys_menus(id),
    type TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    path TEXT NULL,
    component TEXT NULL,
    icon TEXT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    visible BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE sys_role_menus (
    role_id BIGINT NOT NULL REFERENCES sys_roles(id),
    menu_id BIGINT NOT NULL REFERENCES sys_menus(id),
    data_scope TEXT NOT NULL DEFAULT 'SELF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, menu_id)
);

CREATE TABLE sys_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    request_id TEXT NOT NULL,
    user_id BIGINT NULL,
    username TEXT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    ip TEXT NULL,
    user_agent TEXT NULL,
    response_code INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
