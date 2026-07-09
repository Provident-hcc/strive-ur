const { app } = require('@azure/functions');
const { query, transaction, sql } = require('../db.js');

async function getCoordinators(request, context) {
    try {
        const result = await query(
            'SELECT name FROM coordinators ORDER BY sort_order'
        );
        const names = result.recordset.map((r) => r.name);
        return { jsonBody: names };
    } catch (err) {
        context.error('getCoordinators error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function putCoordinators(request, context) {
    try {
        const names = await request.json();

        await transaction(async (txn) => {
            const delReq = new sql.Request(txn);
            await delReq.query('DELETE FROM coordinators');

            for (let i = 0; i < names.length; i++) {
                const req = new sql.Request(txn);
                req.input('name', names[i]);
                req.input('sort_order', i);
                await req.query(
                    'INSERT INTO coordinators (name, sort_order) VALUES (@name, @sort_order)'
                );
            }
        });

        return { jsonBody: { message: 'Coordinators saved' } };
    } catch (err) {
        context.error('putCoordinators error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('coordinators-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'coordinators',
    handler: getCoordinators,
});

app.http('coordinators-put', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'coordinators',
    handler: putCoordinators,
});
