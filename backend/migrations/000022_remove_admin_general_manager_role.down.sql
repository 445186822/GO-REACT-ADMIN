INSERT INTO sys_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM sys_users u
JOIN sys_roles r ON r.code = 'GENERAL_MANAGER'
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;
