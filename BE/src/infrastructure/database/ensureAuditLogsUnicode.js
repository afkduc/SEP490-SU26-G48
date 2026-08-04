const { query } = require('../database/sqlServer');

let auditUnicodeReady = false;
let auditUnicodePromise = null;

/**
 * Dam bao cac cot text tieng Viet cua audit_logs la NVARCHAR.
 * VARCHAR + collation Latin -> ky tu Viet bi thanh '?'.
 */
async function ensureAuditLogsUnicodeColumns() {
  if (auditUnicodeReady) return;
  if (auditUnicodePromise) return auditUnicodePromise;

  auditUnicodePromise = (async () => {
    try {
      await query(`
        IF COL_LENGTH('dbo.audit_logs', 'entity_code') IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM sys.columns c
             JOIN sys.types t ON c.user_type_id = t.user_type_id
             WHERE c.object_id = OBJECT_ID('dbo.audit_logs')
               AND c.name = 'entity_code'
               AND t.name = 'varchar'
           )
        BEGIN
          ALTER TABLE dbo.audit_logs ALTER COLUMN entity_code NVARCHAR(128) NULL;
        END
      `);

      await query(`
        IF COL_LENGTH('dbo.audit_logs', 'entity_name') IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM sys.columns c
             JOIN sys.types t ON c.user_type_id = t.user_type_id
             WHERE c.object_id = OBJECT_ID('dbo.audit_logs')
               AND c.name = 'entity_name'
               AND t.name = 'varchar'
           )
        BEGIN
          ALTER TABLE dbo.audit_logs ALTER COLUMN entity_name NVARCHAR(255) NULL;
        END
      `);

      await query(`
        IF COL_LENGTH('dbo.audit_logs', 'user_name') IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM sys.columns c
             JOIN sys.types t ON c.user_type_id = t.user_type_id
             WHERE c.object_id = OBJECT_ID('dbo.audit_logs')
               AND c.name = 'user_name'
               AND t.name = 'varchar'
           )
        BEGIN
          ALTER TABLE dbo.audit_logs ALTER COLUMN user_name NVARCHAR(128) NULL;
        END
      `);

      // Sua entity_code da bi thanh '?' bang ten trong description / user_name
      await query(`
        UPDATE al
        SET al.entity_code = COALESCE(
          NULLIF(LTRIM(RTRIM(
            CASE
              WHEN al.description LIKE N'%: % từ %' THEN
                SUBSTRING(
                  al.description,
                  CHARINDEX(N': ', al.description) + 2,
                  CHARINDEX(N' từ ', al.description) - CHARINDEX(N': ', al.description) - 2
                )
              WHEN al.description LIKE N'%: % — %' THEN
                SUBSTRING(
                  al.description,
                  CHARINDEX(N': ', al.description) + 2,
                  CHARINDEX(N' — ', al.description) - CHARINDEX(N': ', al.description) - 2
                )
              ELSE NULL
            END
          )), N''),
          al.user_name
        )
        FROM dbo.audit_logs al
        WHERE al.entity_code LIKE N'%?%'
          AND al.action IN (N'LOGIN', N'FAILED_LOGIN', N'LOGOUT')
          AND (
            al.description LIKE N'%: % từ %'
            OR al.description LIKE N'%: % — %'
            OR (al.user_name IS NOT NULL AND al.user_name NOT LIKE N'%?%')
          )
      `);

      auditUnicodeReady = true;
    } catch (err) {
      console.warn('[auditSchema] ensureAuditLogsUnicodeColumns failed:', err.message);
      auditUnicodePromise = null;
      throw err;
    }
  })();

  return auditUnicodePromise;
}

module.exports = { ensureAuditLogsUnicodeColumns };
