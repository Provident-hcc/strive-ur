const { app } = require('@azure/functions');
const { query, transaction, toDb, fromDb, sql } = require('../db.js');

function getUserName(request) {
    const header = request.headers.get('x-ms-client-principal');
    if (!header) return 'System';
    try {
        const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
        return decoded.userDetails || decoded.userId || 'System';
    } catch { return 'System'; }
}

async function bulkUpsert(request, context) {
    try {
        const body = await request.json();
        const { records = [], census, importLog } = body;
        const userName = getUserName(request);

        await transaction(async (txn) => {
            for (const record of records) {
                const dbRec = toDb(record);
                const tasks = record.tasks || [];
                const auditLog = record.auditLog || [];
                delete dbRec.tasks;
                delete dbRec.audit_log;
                delete dbRec.auditLog;

                const cols = Object.keys(dbRec);
                const id = dbRec.id;

                // MERGE record (upsert on id)
                const setCols = cols.filter((c) => c !== 'id');
                const setClause = setCols.map((c) => `target.${c} = source.${c}`).join(', ');
                const insertCols = cols.join(', ');
                const insertVals = cols.map((c) => `source.${c}`).join(', ');
                const sourceVals = cols.map((c) => `@${c} AS ${c}`).join(', ');

                const mergeSql = `
                    MERGE records AS target
                    USING (SELECT ${sourceVals}) AS source
                    ON target.id = source.id
                    WHEN MATCHED THEN UPDATE SET ${setClause}
                    WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});
                `;

                const mergeReq = new sql.Request(txn);
                for (const c of cols) {
                    mergeReq.input(c, dbRec[c]);
                }
                await mergeReq.query(mergeSql);

                // Replace tasks
                const delReq = new sql.Request(txn);
                delReq.input('record_id', id);
                await delReq.query('DELETE FROM tasks WHERE record_id = @record_id');

                for (const task of tasks) {
                    const t = toDb(task);
                    t.record_id = id;
                    const tCols = Object.keys(t);
                    const tPlaceholders = tCols.map((c) => `@${c}`);
                    const tReq = new sql.Request(txn);
                    for (const c of tCols) {
                        tReq.input(c, t[c]);
                    }
                    await tReq.query(
                        `INSERT INTO tasks (${tCols.join(', ')}) VALUES (${tPlaceholders.join(', ')})`
                    );
                }

                // Append new audit entries
                if (auditLog.length) {
                    const maxReq = new sql.Request(txn);
                    maxReq.input('record_id', id);
                    const maxResult = await maxReq.query(
                        'SELECT MAX(ts) AS max_ts FROM audit_log WHERE record_id = @record_id'
                    );
                    const maxTs = maxResult.recordset[0]?.max_ts || '';

                    for (const entry of auditLog) {
                        if (!entry.ts || entry.ts > maxTs) {
                            const a = toDb(entry);
                            a.record_id = id;
                            a.user_name = a.user_name || userName;
                            const aCols = Object.keys(a);
                            const aPlaceholders = aCols.map((c) => `@${c}`);
                            const aReq = new sql.Request(txn);
                            for (const c of aCols) {
                                aReq.input(c, a[c]);
                            }
                            await aReq.query(
                                `INSERT INTO audit_log (${aCols.join(', ')}) VALUES (${aPlaceholders.join(', ')})`
                            );
                        }
                    }
                }
            }

            // Census snapshot
            if (census && census.mris) {
                const cReq = new sql.Request(txn);
                cReq.input('at', new Date().toISOString());
                cReq.input('mris', JSON.stringify(census.mris));
                await cReq.query(
                    'INSERT INTO census_snapshot (at, mris) VALUES (@at, @mris)'
                );
            }

            // Import log
            if (importLog) {
                const lReq = new sql.Request(txn);
                lReq.input('file_name', importLog.fileName || 'bulk-import');
                lReq.input('imported_at', importLog.importedAt || new Date().toISOString());
                lReq.input('tabs', importLog.tabs || null);
                lReq.input('new_count', importLog.newCount || 0);
                lReq.input('updated_count', importLog.updatedCount || 0);
                lReq.input('gap_count', importLog.gapCount || 0);
                lReq.input('auth_skipped', importLog.authSkipped || 0);
                await lReq.query(
                    `INSERT INTO import_log (file_name, imported_at, tabs, new_count, updated_count, gap_count, auth_skipped)
                     VALUES (@file_name, @imported_at, @tabs, @new_count, @updated_count, @gap_count, @auth_skipped)`
                );
            }
        });

        return {
            jsonBody: { message: `Upserted ${records.length} records` },
        };
    } catch (err) {
        context.error('bulkUpsert error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('records-bulk', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'records/bulk',
    handler: bulkUpsert,
});
