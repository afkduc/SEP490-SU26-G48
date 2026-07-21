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
-- Test:
--   SELECT id, user_name, created_at, updated_at FROM users
--   UPDATE users SET first_name = 'test' WHERE id = 1
--   SELECT id, user_name, created_at, updated_at FROM users WHERE id = 1
--   -- updated_at phai khac created_at (moi hon)
-- ============================================================

IF COL_LENGTH('users', 'updated_at') IS NULL
BEGIN
  ALTER TABLE users ADD updated_at DATETIME2 NULL;

  -- Backfill cho user cu: mac dinh updated_at = created_at de UI
  -- khong hien thi null/0.
  UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;

  -- Trigger tu dong cap nhat updated_at khi row bi UPDATE.
  -- SYSDATETIME() tra local time cua server, con SYSUTCDATETIME()
  -- tra UTC. Chon SYSUTCDATETIME() de dong bo voi created_at
  -- (DEFAULT SYSUTCDATETIME()) va node-mssql useUTC=true.
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

  PRINT '[migration] added users.updated_at + trigger';
END
ELSE
BEGIN
  PRINT '[migration] users.updated_at already exists, skip';
END
