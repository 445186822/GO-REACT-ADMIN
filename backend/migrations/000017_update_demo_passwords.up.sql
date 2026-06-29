-- Update demo user passwords to "123456"
-- These users were created in migration 000014 with an older password hash.
UPDATE sys_users
SET password_hash = '$2a$10$0hj./IKNdJf7sdl7MgvLWORTU7IPGoo3mUpDyKAbrU.niJa75FsMC',
    updated_at = now()
WHERE username IN ('dept_manager', 'hr_manager', 'customer_manager', 'demo_applicant')
  AND deleted_at IS NULL;
