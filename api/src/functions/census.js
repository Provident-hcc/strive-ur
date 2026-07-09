const { app } = require('@azure/functions');
const { query, sql } = require('../db.js');

async function getCensus(request, context) {
    try {
        const result = await query(
            'SELECT TOP 1 * FROM census_snapshot ORDER BY snapshot_at DESC'
        );
        if (!result.recordset.length) {
            return { jsonBody: null };
        }
        const row = result.recordset[0];
        return {
            jsonBody: {
                snapshotAt: row.snapshot_at,
                mris: typeof row.mris === 'string' ? JSON.parse(row.mris) : row.mris,
            },
        };
    } catch (err) {
        context.error('getCensus error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function postCensus(request, context) {
    try {
        const body = await request.json();
        const mris = body.mris || [];

        await query(
            'INSERT INTO census_snapshot (snapshot_at, mris) VALUES (@at, @mris)',
            [
                { name: 'at', type: sql.NVarChar, value: body.snapshotAt || new Date().toISOString() },
                { name: 'mris', type: sql.NVarChar, value: JSON.stringify(mris) },
            ]
        );

        return { status: 201, jsonBody: { message: 'Census snapshot saved' } };
    } catch (err) {
        context.error('postCensus error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function getImportLog(request, context) {
    try {
        const result = await query(
            'SELECT * FROM import_log ORDER BY imported_at DESC'
        );
        const rows = result.recordset.map((row) => ({
            fileName: row.file_name,
            importedAt: row.imported_at,
            tabs: row.tabs,
            newCount: row.new_count,
            updatedCount: row.updated_count,
            gapCount: row.gap_count,
            authSkipped: row.auth_skipped,
        }));
        return { jsonBody: rows };
    } catch (err) {
        context.error('getImportLog error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('census-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'census',
    handler: getCensus,
});

app.http('census-post', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'census',
    handler: postCensus,
});

app.http('import-log-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'import/log',
    handler: getImportLog,
});
