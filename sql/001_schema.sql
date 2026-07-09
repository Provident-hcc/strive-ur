-- ============================================================
-- 001_schema.sql  -  UR Intelligence Tracker schema (Azure SQL)
-- ============================================================

-- Primary entity: one row per authorization period
CREATE TABLE records (
    id              NVARCHAR(50)  PRIMARY KEY,
    mri             NVARCHAR(20)  NOT NULL,
    last_name       NVARCHAR(100),
    first_name      NVARCHAR(100),
    admit           DATE,
    discharge       DATE,
    discharge_type  NVARCHAR(50),
    payer           NVARCHAR(200),
    ins_type        NVARCHAR(50),
    ins_product     NVARCHAR(100),
    loc             NVARCHAR(50),
    auth_code       NVARCHAR(100),
    auth_period     NVARCHAR(100),
    auth_start      DATE,
    auth_end        DATE,
    days_auth       INT DEFAULT 0,
    days_req        INT DEFAULT 0,
    submit_date     DATE,
    auth_received   DATE,
    decision        NVARCHAR(50) DEFAULT 'Pending',
    denial_reason   NVARCHAR(200),
    denial_sub      NVARCHAR(200),
    avoidable       NVARCHAR(50),
    appeal_filed    NVARCHAR(100),
    appeal_outcome  NVARCHAR(100),
    denial_date     DATE,
    coordinator     NVARCHAR(100),
    owner           NVARCHAR(200),
    dept            NVARCHAR(50),
    stage           NVARCHAR(100) DEFAULT 'pre-auth-gathering',
    wf_notes        NVARCHAR(MAX),
    notes           NVARCHAR(MAX),
    priority        NVARCHAR(20) DEFAULT 'low',
    next_task       NVARCHAR(500),
    next_due        DATE,
    source          NVARCHAR(20),
    admission_id    NVARCHAR(100),
    counselor       NVARCHAR(100),
    diagnoses       NVARCHAR(MAX),
    next_review     DATE,
    created_at      DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Tasks: child of records
CREATE TABLE tasks (
    id              NVARCHAR(50) PRIMARY KEY,
    record_id       NVARCHAR(50) NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    description     NVARCHAR(500),
    owner           NVARCHAR(200),
    due_date        DATE,
    priority        NVARCHAR(20) DEFAULT 'normal',
    done            BIT DEFAULT 0,
    completed_at    NVARCHAR(50),
    created_at      NVARCHAR(50),
    sort_order      INT DEFAULT 0
);

-- Audit log: child of records
CREATE TABLE audit_log (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    record_id       NVARCHAR(50) NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    ts              DATETIME2 NOT NULL,
    user_name       NVARCHAR(200),
    action          NVARCHAR(50),
    label           NVARCHAR(200),
    details         NVARCHAR(MAX),
    color           NVARCHAR(20)
);

-- Cadence config for strive_cadence_v1 (keyed by LOC like 'Res 3.5', 'Res 3.1')
CREATE TABLE cadence_config (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    loc             NVARCHAR(50) NOT NULL,
    payer           NVARCHAR(200) NOT NULL,
    interval_days   INT DEFAULT 7,
    submit_buffer   INT DEFAULT 1,
    remind_ahead    INT DEFAULT 2,
    p2p_window      INT DEFAULT 1,
    appeal_window   INT DEFAULT 30,
    initial_sla     INT DEFAULT 1,
    CONSTRAINT UQ_cadence_loc_payer UNIQUE (loc, payer)
);

-- SLA cadence config for strive_sla_cadence_v1 (keyed by LOC like '3.5', '3.1')
CREATE TABLE sla_cadence_config (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    loc             NVARCHAR(50) NOT NULL,
    payer           NVARCHAR(200) NOT NULL,
    interval_days   INT DEFAULT 7,
    submit_buffer   INT DEFAULT 1,
    remind_ahead    INT DEFAULT 2,
    p2p_window      INT DEFAULT 1,
    appeal_window   INT DEFAULT 30,
    initial_sla     INT DEFAULT 1,
    CONSTRAINT UQ_sla_cadence_loc_payer UNIQUE (loc, payer)
);

-- Coordinators
CREATE TABLE coordinators (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    name            NVARCHAR(200) NOT NULL UNIQUE,
    sort_order      INT DEFAULT 0
);

-- KPI manual entries
CREATE TABLE kpi_manual (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    kpi_id          NVARCHAR(50) NOT NULL,
    month           NVARCHAR(20) NOT NULL,
    value           FLOAT,
    CONSTRAINT UQ_kpi UNIQUE (kpi_id, month)
);

-- Reference registry (payers, LOCs, etc.)
CREATE TABLE reference_registry (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    kind            NVARCHAR(20) NOT NULL,
    name            NVARCHAR(200) NOT NULL,
    confirmed       BIT DEFAULT 0,
    added_at        DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_ref UNIQUE (kind, name)
);

-- Auto-done tracking
CREATE TABLE auto_done (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    task_key        NVARCHAR(200) NOT NULL UNIQUE,
    completed_at    NVARCHAR(50)
);

-- Census snapshots
CREATE TABLE census_snapshot (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    snapshot_at     DATETIME2 DEFAULT SYSUTCDATETIME(),
    mris            NVARCHAR(MAX)
);

-- Import log
CREATE TABLE import_log (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    file_name       NVARCHAR(500),
    imported_at     DATETIME2 DEFAULT SYSUTCDATETIME(),
    tabs            NVARCHAR(MAX),
    new_count       INT DEFAULT 0,
    updated_count   INT DEFAULT 0,
    gap_count       INT DEFAULT 0,
    auth_skipped    INT DEFAULT 0
);

-- App setup / configuration
CREATE TABLE app_setup (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    setting_key     NVARCHAR(50) NOT NULL UNIQUE,
    setting_value   NVARCHAR(200)
);
