-- ============================================================
-- V3 STEP 3/3: Backfill + Trigger
-- Chay SAU step 2 de cot updated_at da ton tai that trong catalog.
-- Idempotent: backfill chi chay khi co row NULL, trigger chi tao
-- khi chua ton tai.
-- ============================================================

-- Backfill updated_at = created_at cho row cu (updated_at dang NULL)
IF COL_LENGTH('users', 'updated_at') IS NOT NULL
   AND EXISTS (SELECT 1 FROM users WHERE updated_at IS NULL)
BEGIN
  UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
  PRINT '[V3 step 3a] backfilled updated_at from created_at';
END
ELSE
BEGIN
  PRINT '[V3 step 3a] no rows to backfill, skip';
END
GO

-- Trigger tu dong set updated_at = SYSUTCDATETIME() khi row bi UPDATE
IF OBJECT_ID('TR_users_updated_at', 'TR') IS NULL
BEGIN
  EXEC('
    CREATE TRIGGER TR_users_updated_at
    ON users
    AFTER UPDATE
    AS
    BEGIN
      SET NOCOUNT ON;
      IF NOT UPDATE(updated_at)
      BEGIN
        UPDATE u SET updated_at = SYSUTCDATETIME()
        FROM users u
        INNER JOIN inserted i ON u.id = i.id;
      END
    END
  ');
  PRINT '[V3 step 3b] created trigger TR_users_updated_at';
END
ELSE
BEGIN
  PRINT '[V3 step 3b] trigger TR_users_updated_at already exists, skip';
END
GO

-- Verify cuoi cung
SELECT
  COL_LENGTH('users', 'updated_at')       AS column_exists,
  OBJECT_ID('TR_users_updated_at', 'TR')  AS trigger_exists,
  (SELECT COUNT(*) FROM users WHERE updated_at IS NULL) AS null_count;
