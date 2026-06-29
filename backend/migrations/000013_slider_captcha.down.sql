ALTER TABLE auth_captcha_challenges
    DROP COLUMN IF EXISTS image_seed,
    DROP COLUMN IF EXISTS target_y,
    DROP COLUMN IF EXISTS expected_x,
    DROP COLUMN IF EXISTS challenge_type;
