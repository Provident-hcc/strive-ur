const { app } = require('@azure/functions');
const { query, sql } = require('../db.js');

async function getSetup(request, context) {
    try {
        const result = await query(
            "SELECT setting_value FROM app_setup WHERE setting_key = 'mode'"
        );
        const mode = result.recordset.length
            ? result.recordset[0].setting_value
            : 'live';
        return { jsonBody: { mode } };
    } catch (err) {
        context.error('getSetup error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function putSetup(request, context) {
    try {
        const body = await request.json();
        const mode = body.mode || 'live';

        await query(
            `MERGE app_setup AS target
             USING (SELECT 'mode' AS setting_key) AS source
             ON target.setting_key = source.setting_key
             WHEN MATCHED THEN UPDATE SET setting_value = @value
             WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES ('mode', @value);`,
            [{ name: 'value', type: sql.NVarChar, value: mode }]
        );

        return { jsonBody: { mode } };
    } catch (err) {
        context.error('putSetup error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('setup-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'setup',
    handler: getSetup,
});

app.http('setup-put', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'setup',
    handler: putSetup,
});
