ALTER TABLE auth_captcha_challenges
    ADD COLUMN IF NOT EXISTS challenge_type TEXT NOT NULL DEFAULT 'slider',
    ADD COLUMN IF NOT EXISTS expected_x INTEGER NULL,
    ADD COLUMN IF NOT EXISTS target_y INTEGER NULL,
    ADD COLUMN IF NOT EXISTS image_seed INTEGER NULL;

UPDATE auth_captcha_challenges
SET challenge_type = 'slider'
WHERE challenge_type IS NULL;
