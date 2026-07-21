/**
 * Auto-runner cho cac file SQL migration trong /migrations.
 *
 * Quy tac:
 *   - File dat ten V{n}__short_description.sql (VD: V1__add_user_branches.sql)
 *   - Moi file PHAI id idempotent (dung IF OBJECT_ID IS NULL / IF COL_LENGTH IS NULL)
 *   - Migration da chay se duoc luu trong bang _migrations (tu tao neu chua co)
 *   - Moi lan khoi dong server, se quet thu muc migrations va chay cac file moi
 *
 * Loi ich:
 *   - Team moi khong can doc README, chi can npm start -> tu dong chay migration
 *   - Tranh tinh trang "code moi nhung DB schema cu" (crash khi query cot moi)
 *
 * Chay thu cong: node src/infrastructure/database/migrate.js
 */
const fs = require('fs');
const path = require('path');
const { query } = require('./sqlServer');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'migrations');

async function ensureMigrationsTable() {
  await query(`
    IF OBJECT_ID('_migrations', 'U') IS NULL
    BEGIN
      CREATE TABLE _migrations (
        version     VARCHAR(20) PRIMARY KEY,
        filename    NVARCHAR(255) NOT NULL,
        applied_at  DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);
}

async function getAppliedVersions() {
  const r = await query('SELECT version FROM _migrations');
  return new Set(r.recordset.map((row) => row.version));
}

async function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^V\d+__.*\.sql$/i.test(f))
    .sort();
}

async function applyMigration(filename) {
  const versionMatch = filename.match(/^(V\d+)__/i);
  if (!versionMatch) throw new Error(`Invalid migration filename: ${filename}`);
  const version = versionMatch[1];

  const sqlPath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Tach thanh cac batch theo 'GO' (xuong dong co GO rieng)
  const batches = sql
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  for (const batch of batches) {
    await query(batch);
  }

  await query(
    'INSERT INTO _migrations (version, filename) VALUES (@p1, @p2)',
    { p1: version, p2: filename }
  );

  console.log(`[migrate] applied ${filename}`);
}

async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await getAppliedVersions();
  const files = await getMigrationFiles();

  const pending = files.filter((f) => {
    const v = f.match(/^(V\d+)__/i)[1];
    return !applied.has(v);
  });

  if (pending.length === 0) {
    console.log('[migrate] no pending migrations');
    return;
  }

  for (const f of pending) {
    await applyMigration(f);
  }
  console.log(`[migrate] done — applied ${pending.length} migration(s)`);
}

// Cho phep chay thu cong: node src/infrastructure/database/migrate.js
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}

module.exports = runMigrations;
