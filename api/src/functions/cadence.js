const { app } = require('@azure/functions');
const { query, transaction, sql } = require('../db.js');

async function getCadence(request, context) {
    try {
        const result = await query('SELECT * FROM cadence_config ORDER BY loc, payer');
        const nested = {};
        for (const row of result.recordset) {
            if (!nested[row.loc]) nested[row.loc] = {};
            nested[row.loc][row.payer] = {
                intervalDays: row.interval_days,
                submitBuffer: row.submit_buffer,
                remindAhead: row.remind_ahead,
                p2pWindow: row.p2p_window,
                appealWindow: row.appeal_window,
                initialSla: row.initial_sla,
            };
        }
        return { jsonBody: nested };
    } catch (err) {
        context.error('getCadence error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function putCadence(request, context) {
    try {
        const body = await request.json();

        await transaction(async (txn) => {
            const delReq = new sql.Request(txn);
            await delReq.query('DELETE FROM cadence_config');

            for (const [loc, payers] of Object.entries(body)) {
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
                        `INSERT INTO cadence_config (loc, payer, interval_days, submit_buffer, remind_ahead, p2p_window, appeal_window, initial_sla)
                         VALUES (@loc, @payer, @interval_days, @submit_buffer, @remind_ahead, @p2p_window, @appeal_window, @initial_sla)`
                    );
                }
            }
        });

        return { jsonBody: { message: 'Cadence config saved' } };
    } catch (err) {
        context.error('putCadence error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function getSlaCadence(request, context) {
    try {
        const result = await query('SELECT * FROM sla_cadence_config ORDER BY loc, payer');
        const nested = {};
        for (const row of result.recordset) {
            if (!nested[row.loc]) nested[row.loc] = {};
            nested[row.loc][row.payer] = {
                intervalDays: row.interval_days,
                submitBuffer: row.submit_buffer,
                remindAhead: row.remind_ahead,
                p2pWindow: row.p2p_window,
                appealWindow: row.appeal_window,
                initialSla: row.initial_sla,
            };
        }
        return { jsonBody: nested };
    } catch (err) {
        context.error('getSlaCadence error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function putSlaCadence(request, context) {
    try {
        const body = await request.json();

        await transaction(async (txn) => {
            const delReq = new sql.Request(txn);
            await delReq.query('DELETE FROM sla_cadence_config');

            for (const [loc, payers] of Object.entries(body)) {
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
                        `INSERT INTO sla_cadence_config (loc, payer, interval_days, submit_buffer, remind_ahead, p2p_window, appeal_window, initial_sla)
                         VALUES (@loc, @payer, @interval_days, @submit_buffer, @remind_ahead, @p2p_window, @appeal_window, @initial_sla)`
                    );
                }
            }
        });

        return { jsonBody: { message: 'SLA cadence config saved' } };
    } catch (err) {
        context.error('putSlaCadence error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('cadence-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'cadence',
    handler: getCadence,
});

app.http('cadence-put', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'cadence',
    handler: putCadence,
});

app.http('sla-cadence-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'sla-cadence',
    handler: getSlaCadence,
});

app.http('sla-cadence-put', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'sla-cadence',
    handler: putSlaCadence,
});
