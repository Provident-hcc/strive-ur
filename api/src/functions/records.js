const { app } = require('@azure/functions');
const { query, transaction, toDb, fromDb, sql } = require('../db.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserName(request) {
    const header = request.headers.get('x-ms-client-principal');
    if (!header) return 'System';
    try {
        const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
        return decoded.userDetails || decoded.userId || 'System';
    } catch { return 'System'; }
}

/**
 * Nest tasks and auditLog arrays onto their parent records.
 */
function nestRelated(records, tasks, auditRows) {
    const taskMap = {};
    const auditMap = {};
    for (const t of tasks) {
        const rid = t.recordId || t.record_id;
        (taskMap[rid] = taskMap[rid] || []).push(fromDb(t));
    }
    for (const a of auditRows) {
        const rid = a.recordId || a.record_id;
        (auditMap[rid] = auditMap[rid] || []).push(fromDb(a));
    }
    return records.map((r) => {
        const rec = fromDb(r);
        rec.tasks = taskMap[rec.id] || [];
        rec.auditLog = auditMap[rec.id] || [];
        return rec;
    });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function listRecords(request, context) {
    try {
        const url = new URL(request.url);
        const active = url.searchParams.get('active');
        const mri = url.searchParams.get('mri');

        let recordSql = 'SELECT * FROM records';
        const conditions = [];
        const params = [];

        if (active === 'true') {
            conditions.push("stage NOT IN ('Discharged')");
        }
        if (mri) {
            conditions.push('mri = @mri');
            params.push({ name: 'mri', type: sql.NVarChar, value: mri });
        }
        if (conditions.length) {
            recordSql += ' WHERE ' + conditions.join(' AND ');
        }
        recordSql += ' ORDER BY id';

        const [recResult, taskResult, auditResult] = await Promise.all([
            query(recordSql, params),
            query('SELECT * FROM tasks ORDER BY sort_order, id'),
            query('SELECT * FROM audit_log ORDER BY ts'),
        ]);

        const nested = nestRelated(
            recResult.recordset,
            taskResult.recordset,
            auditResult.recordset
        );

        return { jsonBody: nested };
    } catch (err) {
        context.error('listRecords error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function getRecord(request, context) {
    try {
        const id = request.params.id;
        const [recResult, taskResult, auditResult] = await Promise.all([
            query('SELECT * FROM records WHERE id = @id', [
                { name: 'id', type: sql.NVarChar, value: id },
            ]),
            query('SELECT * FROM tasks WHERE record_id = @id ORDER BY sort_order, id', [
                { name: 'id', type: sql.NVarChar, value: id },
            ]),
            query('SELECT * FROM audit_log WHERE record_id = @id ORDER BY ts', [
                { name: 'id', type: sql.NVarChar, value: id },
            ]),
        ]);

        if (!recResult.recordset.length) {
            return { status: 404, jsonBody: { error: 'Record not found' } };
        }

        const nested = nestRelated(
            recResult.recordset,
            taskResult.recordset,
            auditResult.recordset
        );
        return { jsonBody: nested[0] };
    } catch (err) {
        context.error('getRecord error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function createRecord(request, context) {
    try {
        const body = await request.json();
        const userName = getUserName(request);
        const dbRec = toDb(body);

        // Separate out nested arrays
        const tasks = body.tasks || [];
        const auditLog = body.auditLog || [];
        delete dbRec.tasks;
        delete dbRec.audit_log;
        delete dbRec.auditLog;

        // Build INSERT for record
        const cols = Object.keys(dbRec);
        const placeholders = cols.map((c) => `@${c}`);
        const recordSql = `INSERT INTO records (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;

        await transaction(async (txn) => {
            // Insert record
            const req = new sql.Request(txn);
            for (const col of cols) {
                req.input(col, dbRec[col]);
            }
            await req.query(recordSql);

            // Insert tasks
            for (let i = 0; i < tasks.length; i++) {
                const t = toDb(tasks[i]);
                t.record_id = t.record_id || dbRec.id;
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

            // Insert audit log entries
            for (const entry of auditLog) {
                const a = toDb(entry);
                a.record_id = a.record_id || dbRec.id;
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
        });

        return { status: 201, jsonBody: body };
    } catch (err) {
        context.error('createRecord error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function updateRecord(request, context) {
    try {
        const id = request.params.id;
        const body = await request.json();
        const userName = getUserName(request);
        const dbRec = toDb(body);

        const tasks = body.tasks || [];
        const auditLog = body.auditLog || [];
        delete dbRec.tasks;
        delete dbRec.audit_log;
        delete dbRec.auditLog;

        // Build SET clause (exclude id)
        const setCols = Object.keys(dbRec).filter((c) => c !== 'id');
        const setClause = setCols.map((c) => `${c} = @${c}`).join(', ');

        await transaction(async (txn) => {
            // Update record
            if (setCols.length) {
                const req = new sql.Request(txn);
                req.input('id', id);
                for (const c of setCols) {
                    req.input(c, dbRec[c]);
                }
                await req.query(`UPDATE records SET ${setClause} WHERE id = @id`);
            }

            // Replace tasks: delete old, insert new
            const delReq = new sql.Request(txn);
            delReq.input('record_id', id);
            await delReq.query('DELETE FROM tasks WHERE record_id = @record_id');

            for (let i = 0; i < tasks.length; i++) {
                const t = toDb(tasks[i]);
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

            // Append new audit log entries (only those with ts > max existing)
            if (auditLog.length) {
                const maxReq = new sql.Request(txn);
                maxReq.input('record_id', id);
                const maxResult = await maxReq.query(
                    'SELECT MAX(ts) AS max_ts FROM audit_log WHERE record_id = @record_id'
                );
                const maxTs = maxResult.recordset[0]?.max_ts || '';

                for (const entry of auditLog) {
                    if (entry.ts && entry.ts > maxTs) {
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
        });

        // Return updated record
        const [recResult, taskResult, auditResult] = await Promise.all([
            query('SELECT * FROM records WHERE id = @id', [
                { name: 'id', type: sql.NVarChar, value: id },
            ]),
            query('SELECT * FROM tasks WHERE record_id = @id ORDER BY sort_order, id', [
                { name: 'id', type: sql.NVarChar, value: id },
            ]),
            query('SELECT * FROM audit_log WHERE record_id = @id ORDER BY ts', [
                { name: 'id', type: sql.NVarChar, value: id },
            ]),
        ]);

        const nested = nestRelated(
            recResult.recordset,
            taskResult.recordset,
            auditResult.recordset
        );
        return { jsonBody: nested[0] || {} };
    } catch (err) {
        context.error('updateRecord error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function deleteRecord(request, context) {
    try {
        const id = request.params.id;

        await transaction(async (txn) => {
            const req1 = new sql.Request(txn);
            req1.input('id', id);
            await req1.query('DELETE FROM audit_log WHERE record_id = @id');

            const req2 = new sql.Request(txn);
            req2.input('id', id);
            await req2.query('DELETE FROM tasks WHERE record_id = @id');

            const req3 = new sql.Request(txn);
            req3.input('id', id);
            await req3.query('DELETE FROM records WHERE id = @id');
        });

        return { status: 204 };
    } catch (err) {
        context.error('deleteRecord error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function clearRecords(request, context) {
    try {
        const url = new URL(request.url);
        if (url.searchParams.get('confirm') !== 'true') {
            return {
                status: 400,
                jsonBody: { error: 'Pass ?confirm=true to delete all records' },
            };
        }

        await transaction(async (txn) => {
            const req1 = new sql.Request(txn);
            await req1.query('DELETE FROM audit_log');
            const req2 = new sql.Request(txn);
            await req2.query('DELETE FROM tasks');
            const req3 = new sql.Request(txn);
            await req3.query('DELETE FROM records');
        });

        return { jsonBody: { message: 'All records cleared' } };
    } catch (err) {
        context.error('clearRecords error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

// ---------------------------------------------------------------------------
// Route registrations
// ---------------------------------------------------------------------------

app.http('records-list', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'records',
    handler: listRecords,
});

app.http('records-get', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'records/{id}',
    handler: getRecord,
});

app.http('records-create', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'records',
    handler: createRecord,
});

app.http('records-update', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'records/{id}',
    handler: updateRecord,
});

app.http('records-delete', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'records/{id}',
    handler: deleteRecord,
});

app.http('records-clear', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'records',
    handler: clearRecords,
});
