CREATE TABLE auth_captcha_challenges (
    id TEXT PRIMARY KEY,
    expected_path TEXT[] NOT NULL,
    verified_token TEXT UNIQUE NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_captcha_token ON auth_captcha_challenges(verified_token)
WHERE verified_token IS NOT NULL;

CREATE INDEX idx_auth_captcha_expires ON auth_captcha_challenges(expires_at);
