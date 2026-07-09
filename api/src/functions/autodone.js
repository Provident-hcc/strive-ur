const { app } = require('@azure/functions');
const { query, transaction, sql } = require('../db.js');

async function getAutodone(request, context) {
    try {
        const result = await query('SELECT * FROM auto_done');

        const obj = {};
        for (const row of result.recordset) {
            obj[row.task_key] = row.completed_at;
        }

        return { jsonBody: obj };
    } catch (err) {
        context.error('getAutodone error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function putAutodone(request, context) {
    try {
        const body = await request.json();

        await transaction(async (txn) => {
            const delReq = new sql.Request(txn);
            await delReq.query('DELETE FROM auto_done');

            for (const [taskKey, completedAt] of Object.entries(body)) {
                const req = new sql.Request(txn);
                req.input('task_key', taskKey);
                req.input('completed_at', completedAt);
                await req.query(
                    'INSERT INTO auto_done (task_key, completed_at) VALUES (@task_key, @completed_at)'
                );
            }
        });

        return { jsonBody: { message: 'Autodone data saved' } };
    } catch (err) {
        context.error('putAutodone error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('autodone-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'autodone',
    handler: getAutodone,
});

app.http('autodone-put', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'autodone',
    handler: putAutodone,
});
