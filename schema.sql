-- schema.sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    credit_balance INTEGER NOT NULL DEFAULT 25,
    last_monthly_grant INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS credit_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    reference_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Optional: Insert a test user so you can actually test the deduction
INSERT OR IGNORE INTO users (id, email, credit_balance) 
VALUES ('test-user-1', 'test@example.com', 100);