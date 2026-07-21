-- ============================================================
-- V3__add_users_updated_at.sql
-- Mo ta: Them cot users.updated_at de luu thoi diem cap nhat cuoi.
-- Truoc day chi co users.created_at, nen UI hien thi "Cap nhat lan
-- cuoi" luon bang ngay tao -> sai (nguoi dung nghi khong luu).
--
-- Migration nay:
--   1. ADD COLUMN users.updated_at DATETIME2 NULL (idempotent).
--   2. Backfill: copy created_at sang updated_at cho user cu (de UI
--      hien thi dung ngay khi migrate xong, khong phai "—" hay null).
--   3. Trigger: tu dong set updated_at = SYSUTCDATETIME() khi row bi
--      UPDATE (tru khi field updated_at da duoc set explicit trong
--      cau UPDATE).
--
-- Vi sao can:
--   - ProfilePage can hien thi "Cap nhat lan cuoi" de user biet duoc
--     thay doi co duoc luu hay khong.
--   - Khong muon sua tung repo de manual set updated_at (de quen).
--     Trigger dam bao luon dong bo o DB level, bat ke service nao
--     UPDATE users.
--
-- QUAN TRONG: phai dung `GO` de tach batch. SQL Server compile
-- toan bo batch truoc khi execute; neu dat ca CREATE TRIGGER trong
-- cung 1 batch voi ALTER TABLE, parser resolve identifier o menh de
-- SET (line "UPDATE users SET updated_at = ...") tu catalog hien tai
-- -> cot chua ton tai -> Msg 207 "Invalid column name 'updated_at'".
-- Bat buoc tach thanh 3 batch rieng biet.
--
-- Test:
--   SELECT id, user_name, created_at, updated_at FROM users
--   UPDATE users SET first_name = 'test' WHERE id = 1
--   SELECT id, user_name, created_at, updated_at FROM users WHERE id = 1
--   -- updated_at phai lon hon created_at (trigger)
-- ============================================================

-- Batch 1: Kiem tra truoc (optional nhung giup debug).
PRINT '--- V3 step 1/3: pre-check ---';
SELECT
  COL_LENGTH('users', 'updated_at')      AS updated_at_column_exists,
  OBJECT_ID('TR_users_updated_at', 'TR') AS trigger_exists;
GO

-- Batch 2: ADD cot (idempotent).
PRINT '--- V3 step 2/3: ADD COLUMN ---';
IF COL_LENGTH('users', 'updated_at') IS NULL
BEGIN
  ALTER TABLE users ADD updated_at DATETIME2 NULL;
  PRINT '[V3 step 2] added users.updated_at';
END
ELSE
BEGIN
  PRINT '[V3 step 2] users.updated_at already exists, skip ALTER';
END
GO

-- Batch 3: Backfill + Trigger (cot updated_at da ton tai that).
PRINT '--- V3 step 3/3: backfill + trigger ---';
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

-- Verify cuoi cung.
PRINT '--- V3 verify ---';
SELECT
  COL_LENGTH('users', 'updated_at')        AS updated_at_column_exists,
  OBJECT_ID('TR_users_updated_at', 'TR')   AS trigger_exists,
  (SELECT COUNT(*) FROM users)             AS total_users,
  (SELECT COUNT(*) FROM users WHERE updated_at IS NULL) AS null_updated_at_rows;
GO
