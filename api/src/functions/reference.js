const { app } = require('@azure/functions');
const { query, transaction, sql } = require('../db.js');

async function getReference(request, context) {
    try {
        const result = await query('SELECT * FROM reference_registry ORDER BY kind, name');

        const ref = { payers: {}, locs: {} };
        for (const row of result.recordset) {
            const bucket = row.kind === 'payer' ? 'payers' : 'locs';
            ref[bucket][row.name] = {
                confirmed: !!row.confirmed,
                addedAt: row.added_at,
            };
        }

        return { jsonBody: ref };
    } catch (err) {
        context.error('getReference error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function putReference(request, context) {
    try {
        const body = await request.json();

        await transaction(async (txn) => {
            const delReq = new sql.Request(txn);
            await delReq.query('DELETE FROM reference_registry');

            for (const [kind, entries] of [
                ['payer', body.payers || {}],
                ['loc', body.locs || {}],
            ]) {
                for (const [name, meta] of Object.entries(entries)) {
                    const req = new sql.Request(txn);
                    req.input('kind', kind);
                    req.input('name', name);
                    req.input('confirmed', meta.confirmed ? 1 : 0);
                    req.input('added_at', meta.addedAt ?? null);
                    await req.query(
                        `INSERT INTO reference_registry (kind, name, confirmed, added_at)
                         VALUES (@kind, @name, @confirmed, @added_at)`
                    );
                }
            }
        });

        return { jsonBody: { message: 'Reference data saved' } };
    } catch (err) {
        context.error('putReference error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('reference-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'reference',
    handler: getReference,
});

app.http('reference-put', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'reference',
    handler: putReference,
});
