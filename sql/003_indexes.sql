-- ============================================================
-- 003_indexes.sql  -  Performance indexes for UR Intelligence Tracker
-- ============================================================

-- records indexes
CREATE NONCLUSTERED INDEX IX_records_mri         ON records (mri);
CREATE NONCLUSTERED INDEX IX_records_stage       ON records (stage);
CREATE NONCLUSTERED INDEX IX_records_coordinator ON records (coordinator);
CREATE NONCLUSTERED INDEX IX_records_auth_code   ON records (auth_code);
CREATE NONCLUSTERED INDEX IX_records_payer       ON records (payer);
CREATE NONCLUSTERED INDEX IX_records_decision    ON records (decision);
CREATE NONCLUSTERED INDEX IX_records_owner       ON records (owner);

-- tasks indexes
CREATE NONCLUSTERED INDEX IX_tasks_record_id     ON tasks (record_id);
CREATE NONCLUSTERED INDEX IX_tasks_done          ON tasks (done);
CREATE NONCLUSTERED INDEX IX_tasks_due_date      ON tasks (due_date);
CREATE NONCLUSTERED INDEX IX_tasks_owner         ON tasks (owner);

-- audit_log indexes
CREATE NONCLUSTERED INDEX IX_audit_log_record_id ON audit_log (record_id);
CREATE NONCLUSTERED INDEX IX_audit_log_ts        ON audit_log (ts);
