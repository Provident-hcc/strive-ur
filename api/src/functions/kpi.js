const { app } = require('@azure/functions');
const { query, transaction, sql } = require('../db.js');

async function getKpi(request, context) {
    try {
        const result = await query('SELECT * FROM kpi_manual ORDER BY month, kpi_id');

        // Build nested shape: { '2026-07': { denial_rate: 0.05, ... } }
        const nested = {};
        for (const row of result.recordset) {
            if (!nested[row.month]) nested[row.month] = {};
            nested[row.month][row.kpi_id] = row.value;
        }

        return { jsonBody: nested };
    } catch (err) {
        context.error('getKpi error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function putKpi(request, context) {
    try {
        const body = await request.json();

        await transaction(async (txn) => {
            const delReq = new sql.Request(txn);
            await delReq.query('DELETE FROM kpi_manual');

            for (const [month, kpis] of Object.entries(body)) {
                for (const [kpiId, value] of Object.entries(kpis)) {
                    const req = new sql.Request(txn);
                    req.input('month', month);
                    req.input('kpi_id', kpiId);
                    req.input('value', value);
                    await req.query(
                        'INSERT INTO kpi_manual (month, kpi_id, value) VALUES (@month, @kpi_id, @value)'
                    );
                }
            }
        });

        return { jsonBody: { message: 'KPI data saved' } };
    } catch (err) {
        context.error('putKpi error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('kpi-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'kpi',
    handler: getKpi,
});

app.http('kpi-put', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'kpi',
    handler: putKpi,
});
