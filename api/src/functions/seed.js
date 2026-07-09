const { app } = require('@azure/functions');
const { transaction, sql } = require('../db.js');

async function seedData(request, context) {
    try {
        const body = await request.json();
        const { records = [], cadence, slaCadence, coordinators } = body;

        await transaction(async (txn) => {
            for (const record of records) {
                const tasks = record.tasks || [];
                const auditLog = record.auditLog || [];
                const rec = { ...record };
                delete rec.tasks;
                delete rec.auditLog;

                const cols = Object.keys(rec);
                const placeholders = cols.map((c) => `@${c}`);
                const req = new sql.Request(txn);
                for (const c of cols) req.input(c, rec[c]);
                await req.query(
                    `INSERT INTO records (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`
                );

                for (const t of tasks) {
                    t.record_id = t.record_id || rec.id;
                    const tCols = Object.keys(t);
                    const tReq = new sql.Request(txn);
                    for (const c of tCols) tReq.input(c, t[c]);
                    await tReq.query(
                        `INSERT INTO tasks (${tCols.join(', ')}) VALUES (${tCols.map((c) => `@${c}`).join(', ')})`
                    );
                }

                for (const a of auditLog) {
                    a.record_id = a.record_id || rec.id;
                    const aCols = Object.keys(a).filter((c) => c !== 'id');
                    const aReq = new sql.Request(txn);
                    for (const c of aCols) aReq.input(c, a[c]);
                    await aReq.query(
                        `INSERT INTO audit_log (${aCols.join(', ')}) VALUES (${aCols.map((c) => `@${c}`).join(', ')})`
                    );
                }
            }

            if (cadence) {
                for (const [loc, payers] of Object.entries(cadence)) {
                    for (const [payer, config] of Object.entries(payers)) {
                        const req = new sql.Request(txn);
                        req.input('loc', loc);
                        req.input('payer', payer);
                        req.input('interval_days', config.intervalDays ?? 7);
                        req.input('submit_buffer', config.submitBuffer ?? 1);
                        req.input('remind_ahead', config.remindAhead ?? 2);
                        req.input('p2p_window', config.p2pWindow ?? 1);
                        req.input('appeal_window', config.appealWindow ?? 30);
                        req.input('initial_sla', config.initialSla ?? 1);
                        await req.query(
                            `MERGE cadence_config AS target
                             USING (SELECT @loc AS loc, @payer AS payer) AS source
                             ON target.loc = source.loc AND target.payer = source.payer
                             WHEN MATCHED THEN UPDATE SET interval_days = @interval_days, submit_buffer = @submit_buffer, remind_ahead = @remind_ahead, p2p_window = @p2p_window, appeal_window = @appeal_window, initial_sla = @initial_sla
                             WHEN NOT MATCHED THEN INSERT (loc, payer, interval_days, submit_buffer, remind_ahead, p2p_window, appeal_window, initial_sla)
                             VALUES (@loc, @payer, @interval_days, @submit_buffer, @remind_ahead, @p2p_window, @appeal_window, @initial_sla);`
                        );
                    }
                }
            }

            if (coordinators && coordinators.length) {
                for (let i = 0; i < coordinators.length; i++) {
                    const req = new sql.Request(txn);
                    req.input('name', coordinators[i]);
                    req.input('sort_order', i);
                    await req.query(
                        `MERGE coordinators AS target
                         USING (SELECT @name AS name) AS source ON target.name = source.name
                         WHEN NOT MATCHED THEN INSERT (name, sort_order) VALUES (@name, @sort_order);`
                    );
                }
            }
        });

        return { jsonBody: { message: 'Seed data loaded' } };
    } catch (err) {
        context.error('seedData error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('seed', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'seed',
    handler: seedData,
});
