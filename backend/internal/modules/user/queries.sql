-- name: ListUsers :many
SELECT
    id,
    username,
    display_name,
    email,
    phone,
    status,
    department_id,
    is_super_admin,
    created_at,
    updated_at
FROM sys_users
WHERE deleted_at IS NULL
  AND (@keyword::text = '' OR username ILIKE '%' || @keyword || '%' OR display_name ILIKE '%' || @keyword || '%')
ORDER BY created_at DESC
LIMIT @limit_count OFFSET @offset_count;

-- name: CountUsers :one
SELECT count(*)
FROM sys_users
WHERE deleted_at IS NULL
  AND (@keyword::text = '' OR username ILIKE '%' || @keyword || '%' OR display_name ILIKE '%' || @keyword || '%');
