/**
 * Shared SQL connection pool module using mssql + Azure Managed Identity.
 *
 * Uses azure-active-directory-default authentication which automatically
 * picks up Managed Identity in Azure and falls back to Azure CLI creds locally.
 */

const sql = require('mssql');

// ---------------------------------------------------------------------------
// Connection pool (lazy singleton)
// ---------------------------------------------------------------------------

let _pool = null;
let _poolPromise = null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function buildConfig() {
  return {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    port: parseInt(process.env.AZURE_SQL_PORT || '1433', 10),
    authentication: {
      type: 'azure-active-directory-default',
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

async function createPool(attempt = 1) {
  try {
    const config = buildConfig();
    const pool = await new sql.ConnectionPool(config).connect();

    pool.on('error', (err) => {
      console.error('[db] Pool error:', err.message);
      _pool = null;
      _poolPromise = null;
    });

    return pool;
  } catch (err) {
    console.error(
      `[db] Connection attempt ${attempt}/${MAX_RETRIES} failed:`,
      err.message
    );
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      return createPool(attempt + 1);
    }
    throw err;
  }
}

/**
 * Returns the cached connection pool, creating it on first call.
 */
async function getPool() {
  if (_pool && _pool.connected) return _pool;

  if (!_poolPromise) {
    _poolPromise = createPool().then((pool) => {
      _pool = pool;
      return pool;
    });
  }

  return _poolPromise;
}

// ---------------------------------------------------------------------------
// Query helper
// ---------------------------------------------------------------------------

/**
 * Execute a parameterised SQL query.
 *
 * @param {string}   sqlText  - SQL statement with @param placeholders
 * @param {Object[]} [params] - Array of { name, type, value } objects
 * @returns {Promise<import('mssql').IResult>}
 *
 * Example:
 *   await query(
 *     'SELECT * FROM records WHERE mri = @mri',
 *     [{ name: 'mri', type: sql.NVarChar, value: '12345' }]
 *   );
 */
async function query(sqlText, params = []) {
  const pool = await getPool();
  const request = pool.request();
  for (const p of params) {
    if (p.type) {
      request.input(p.name, p.type, p.value);
    } else {
      request.input(p.name, p.value);
    }
  }
  return request.query(sqlText);
}

// ---------------------------------------------------------------------------
// Transaction helper
// ---------------------------------------------------------------------------

/**
 * Run a callback inside a SQL transaction.
 *
 * @param {(transaction: import('mssql').Transaction) => Promise<any>} callback
 * @returns {Promise<any>} - The value returned by the callback
 *
 * Example:
 *   await transaction(async (txn) => {
 *     const req = new sql.Request(txn);
 *     req.input('id', sql.Int, 1);
 *     await req.query('UPDATE records SET stage = @stage WHERE id = @id');
 *   });
 */
async function transaction(callback) {
  const pool = await getPool();
  const txn = new sql.Transaction(pool);
  await txn.begin();
  try {
    const result = await callback(txn);
    await txn.commit();
    return result;
  } catch (err) {
    await txn.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Field mapping helpers
// ---------------------------------------------------------------------------

/**
 * Mapping of camelCase JS keys to snake_case SQL column names.
 * Keys not listed here are passed through unchanged.
 */
const CAMEL_TO_SNAKE = {
  // ---- record fields ----
  lastName: 'last_name',
  firstName: 'first_name',
  last: 'last_name',
  first: 'first_name',
  dischargeType: 'discharge_type',
  insType: 'ins_type',
  insProduct: 'ins_product',
  authCode: 'auth_code',
  authPeriod: 'auth_period',
  authStart: 'auth_start',
  authEnd: 'auth_end',
  daysAuth: 'days_auth',
  daysReq: 'days_req',
  submitDate: 'submit_date',
  authReceived: 'auth_received',
  denialReason: 'denial_reason',
  denialSub: 'denial_sub',
  appealFiled: 'appeal_filed',
  appealOutcome: 'appeal_outcome',
  denialDate: 'denial_date',
  wfNotes: 'wf_notes',
  nextTask: 'next_task',
  nextDue: 'next_due',
  admissionId: 'admission_id',
  nextReview: 'next_review',
  createdAt: 'created_at',
  updatedAt: 'updated_at',

  // ---- task fields ----
  recordId: 'record_id',
  dueDate: 'due_date',
  completedAt: 'completed_at',
  sortOrder: 'sort_order',

  // ---- audit_log fields ----
  userName: 'user_name',
};

/**
 * Reverse mapping: snake_case SQL column → camelCase JS key.
 */
const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([camel, snake]) => [snake, camel])
);

// Resolve aliases so the canonical camelCase name wins.
// e.g. last_name -> lastName (not "last")
// firstName wins over first, lastName wins over last
SNAKE_TO_CAMEL['last_name'] = 'lastName';
SNAKE_TO_CAMEL['first_name'] = 'firstName';
SNAKE_TO_CAMEL['due_date'] = 'dueDate';

/**
 * Convert a camelCase JS object to snake_case columns for SQL INSERTs/UPDATEs.
 *
 * @param {Object} record - JS object with camelCase keys
 * @returns {Object} - Object with snake_case keys
 */
function toDb(record) {
  if (!record) return record;
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    const dbKey = CAMEL_TO_SNAKE[key] || key;
    result[dbKey] = value;
  }
  return result;
}

/**
 * Convert a snake_case SQL row to a camelCase JS object.
 *
 * @param {Object} row - SQL row with snake_case columns
 * @returns {Object} - JS object with camelCase keys
 */
function fromDb(row) {
  if (!row) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const jsKey = SNAKE_TO_CAMEL[key] || key;
    result[jsKey] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  sql,
  getPool,
  query,
  transaction,
  toDb,
  fromDb,
};
