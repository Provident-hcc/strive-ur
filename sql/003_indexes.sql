-- ============================================================
-- 003_indexes.sql  -  Performance indexes for UR Intelligence Tracker
-- ============================================================

-- records indexes
CREATE NONCLUSTERED INDEX IX_records_mri         ON dbo.records (mri);
CREATE NONCLUSTERED INDEX IX_records_stage       ON dbo.records (stage);
CREATE NONCLUSTERED INDEX IX_records_coordinator ON dbo.records (coordinator);
CREATE NONCLUSTERED INDEX IX_records_auth_code   ON dbo.records (auth_code);
CREATE NONCLUSTERED INDEX IX_records_payer       ON dbo.records (payer);
CREATE NONCLUSTERED INDEX IX_records_decision    ON dbo.records (decision);
CREATE NONCLUSTERED INDEX IX_records_owner       ON dbo.records (owner);

-- tasks indexes
CREATE NONCLUSTERED INDEX IX_tasks_record_id     ON dbo.tasks (record_id);
CREATE NONCLUSTERED INDEX IX_tasks_done          ON dbo.tasks (done);
CREATE NONCLUSTERED INDEX IX_tasks_due_date      ON dbo.tasks (due_date);
CREATE NONCLUSTERED INDEX IX_tasks_owner         ON dbo.tasks (owner);

-- audit_log indexes
CREATE NONCLUSTERED INDEX IX_audit_log_record_id ON dbo.audit_log (record_id);
CREATE NONCLUSTERED INDEX IX_audit_log_ts        ON dbo.audit_log (ts);
