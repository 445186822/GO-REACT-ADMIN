CREATE TABLE IF NOT EXISTS biz_customers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'NORMAL',
    phone TEXT NULL,
    email TEXT NULL,
    owner_id BIGINT NOT NULL REFERENCES sys_users(id),
    department_id BIGINT NOT NULL REFERENCES sys_departments(id),
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    remark TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_biz_customers_owner ON biz_customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_biz_customers_department ON biz_customers(department_id);
