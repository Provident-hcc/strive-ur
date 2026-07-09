const { app } = require('@azure/functions');
const { query, fromDb, sql } = require('../db.js');

async function listTasks(request, context) {
    try {
        const url = new URL(request.url);
        const status = url.searchParams.get('status') || 'all';
        const owner = url.searchParams.get('owner');
        const priority = url.searchParams.get('priority');

        let sqlText = `
            SELECT t.*,
                   r.last_name, r.first_name, r.mri,
                   r.auth_period, r.payer, r.loc, r.id AS rid
            FROM tasks t
            JOIN records r ON t.record_id = r.id
        `;
        const conditions = [];
        const params = [];

        if (status === 'open') {
            conditions.push('(t.done = 0 OR t.done IS NULL)');
        } else if (status === 'closed') {
            conditions.push('t.done = 1');
        }
        if (owner) {
            conditions.push('t.owner = @owner');
            params.push({ name: 'owner', type: sql.NVarChar, value: owner });
        }
        if (priority) {
            conditions.push('t.priority = @priority');
            params.push({ name: 'priority', type: sql.NVarChar, value: priority });
        }
        if (conditions.length) {
            sqlText += ' WHERE ' + conditions.join(' AND ');
        }
        sqlText += ' ORDER BY t.due_date, t.sort_order, t.id';

        const result = await query(sqlText, params);

        const tasks = result.recordset.map((row) => {
            const t = fromDb(row);
            // Add cross-record shorthand fields
            t._pat = `${row.last_name || ''}, ${row.first_name || ''}`.replace(/^, |, $/, '');
            t._mri = row.mri;
            t._ap = row.auth_period;
            t._payer = row.payer;
            t._loc = row.loc;
            t._rid = row.rid || row.id;
            return t;
        });

        return { jsonBody: tasks };
    } catch (err) {
        context.error('listTasks error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

async function toggleTask(request, context) {
    try {
        const id = request.params.id;
        const body = await request.json();
        const done = body.done ? 1 : 0;
        const completedAt = done
            ? new Date().toLocaleDateString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
              })
            : null;

        await query(
            'UPDATE tasks SET done = @done, completed_at = @completedAt WHERE id = @id',
            [
                { name: 'done', type: sql.Bit, value: done },
                { name: 'completedAt', type: sql.NVarChar, value: completedAt },
                { name: 'id', type: sql.NVarChar, value: id },
            ]
        );

        return { jsonBody: { id, done, completedAt } };
    } catch (err) {
        context.error('toggleTask error:', err);
        return { status: 500, jsonBody: { error: err.message } };
    }
}

app.http('tasks-list', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'tasks',
    handler: listTasks,
});

app.http('tasks-update', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'tasks/{id}',
    handler: toggleTask,
});
