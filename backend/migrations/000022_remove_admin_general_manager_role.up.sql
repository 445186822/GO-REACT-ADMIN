DELETE FROM sys_user_roles
WHERE user_id IN (SELECT id FROM sys_users WHERE username = 'admin')
  AND role_id IN (SELECT id FROM sys_roles WHERE code = 'GENERAL_MANAGER');
