-- ============================================================
-- 002_seed.sql  -  Default seed data for UR Intelligence Tracker
-- ============================================================

-- -----------------------------------------------
-- cadence_config  (keyed by 'Res 3.5', 'Res 3.1')
-- -----------------------------------------------

-- Res 3.5 defaults: interval=7, submitBuffer=1, remindAhead=2, p2p=1, appeal=30, initialSLA=1
INSERT INTO cadence_config (loc, payer, interval_days, submit_buffer, remind_ahead, p2p_window, appeal_window, initial_sla)
VALUES
    ('Res 3.5', 'Anthem',     7, 1, 2, 1, 30, 1),
    ('Res 3.5', 'CareSource', 7, 1, 2, 1, 33, 1),
    ('Res 3.5', 'MHS',        7, 1, 2, 1, 33, 1),
    ('Res 3.5', 'MDwise',     7, 1, 2, 1, 30, 1),
    ('Res 3.5', 'Default',    7, 1, 2, 1, 30, 1);

-- Res 3.1 defaults: interval=14, submitBuffer=2, remindAhead=3, p2p=1, appeal=30, initialSLA=1
-- MHS 3.1 overrides: interval=21, appeal=33
INSERT INTO cadence_config (loc, payer, interval_days, submit_buffer, remind_ahead, p2p_window, appeal_window, initial_sla)
VALUES
    ('Res 3.1', 'Anthem',     14, 2, 3, 1, 30, 1),
    ('Res 3.1', 'CareSource', 14, 2, 3, 1, 33, 1),
    ('Res 3.1', 'MHS',        21, 2, 3, 1, 33, 1),
    ('Res 3.1', 'MDwise',     14, 2, 3, 1, 30, 1),
    ('Res 3.1', 'Default',    14, 2, 3, 1, 30, 1);

-- -----------------------------------------------
-- sla_cadence_config  (keyed by '3.5', '3.1')
-- -----------------------------------------------

INSERT INTO sla_cadence_config (loc, payer, interval_days, submit_buffer, remind_ahead, p2p_window, appeal_window, initial_sla)
VALUES
    ('3.5', 'Anthem',     7, 1, 2, 1, 30, 1),
    ('3.5', 'CareSource', 7, 1, 2, 1, 33, 1),
    ('3.5', 'MHS',        7, 1, 2, 1, 33, 1),
    ('3.5', 'MDwise',     7, 1, 2, 1, 30, 1),
    ('3.5', 'Default',    7, 1, 2, 1, 30, 1);

INSERT INTO sla_cadence_config (loc, payer, interval_days, submit_buffer, remind_ahead, p2p_window, appeal_window, initial_sla)
VALUES
    ('3.1', 'Anthem',     14, 2, 3, 1, 30, 1),
    ('3.1', 'CareSource', 14, 2, 3, 1, 33, 1),
    ('3.1', 'MHS',        21, 2, 3, 1, 33, 1),
    ('3.1', 'MDwise',     14, 2, 3, 1, 30, 1),
    ('3.1', 'Default',    14, 2, 3, 1, 30, 1);

-- -----------------------------------------------
-- coordinators
-- -----------------------------------------------

INSERT INTO coordinators (name, sort_order)
VALUES
    ('Meredith Dawson',    1),
    ('John Delahoyde',     2),
    ('Dusty Dawkins',      3),
    ('Heather Reynolds',   4),
    ('UR Director',        5);

-- -----------------------------------------------
-- app_setup
-- -----------------------------------------------

INSERT INTO app_setup (setting_key, setting_value)
VALUES ('mode', 'live');
