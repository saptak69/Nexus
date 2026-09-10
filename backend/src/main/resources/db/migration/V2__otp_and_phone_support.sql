-- V2 OTP and Phone Authentication Support for Telegram-style Flow
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

CREATE TABLE IF NOT EXISTS otp_tokens (
    id BIGSERIAL PRIMARY KEY,
    target VARCHAR(100) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    ticket_jti VARCHAR(100) UNIQUE,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_target_consumed ON otp_tokens(target, consumed);
CREATE INDEX IF NOT EXISTS idx_otp_ticket_jti ON otp_tokens(ticket_jti);
