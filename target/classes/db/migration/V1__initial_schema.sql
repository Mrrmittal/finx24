-- ================================================================
-- FinX24 — NBFC Finance Suite
-- DB Migration V1 — Initial Schema
-- Flyway: src/main/resources/db/migration/V1__initial_schema.sql
-- ================================================================

-- ── Users ────────────────────────────────────────────────────────
CREATE TABLE users (
    id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    username      NVARCHAR(50)  NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    full_name     NVARCHAR(100) NOT NULL,
    designation   NVARCHAR(100),
    role          NVARCHAR(20)  NOT NULL DEFAULT 'USER',   -- USER | ADMIN
    active        BIT           NOT NULL DEFAULT 1,
    created_at    DATETIME2     NOT NULL DEFAULT GETDATE(),
    updated_at    DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- Default users (passwords are BCrypt hashed)
-- admin   → Admin@2024
-- user1   → User@2024
INSERT INTO users (username, password_hash, full_name, designation, role) VALUES
('admin',  '$2a$12$HmESBFbDGbqUeJE6pjBYS.8p6SfjOr6qFnMkJl9FnFdHpvexYK4xy', 'Jatin Mittal',   'Finance Head',   'ADMIN'),
('user1',  '$2a$12$K8xBb5.WF9T3CZZr2G0oHeXJ1EJbX9x.Y7vOJmfzJmK5M9n6UBMPC', 'Finance User',   'Accounts Team',  'USER'),
('recon',  '$2a$12$K8xBb5.WF9T3CZZr2G0oHeXJ1EJbX9x.Y7vOJmfzJmK5M9n6UBMPC', 'Recon Analyst',  'Recon Team',     'USER');

-- ── Recon History (Phase 2 persistence) ─────────────────────────
CREATE TABLE recon_history (
    id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    recon_id      NVARCHAR(50)  NOT NULL UNIQUE,
    module        NVARCHAR(20)  NOT NULL,   -- LOANINS | MOTOR | BANK
    period_label  NVARCHAR(50),
    run_by        NVARCHAR(50),             -- username
    total_count   INT,
    match_count   INT,
    query_count   INT,
    excel_path    NVARCHAR(500),            -- Phase 2: S3/file path
    status        NVARCHAR(20)  NOT NULL DEFAULT 'COMPLETED',
    created_at    DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX idx_recon_history_module    ON recon_history(module);
CREATE INDEX idx_recon_history_run_by   ON recon_history(run_by);
CREATE INDEX idx_recon_history_created  ON recon_history(created_at);
