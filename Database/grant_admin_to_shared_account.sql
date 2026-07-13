/* ============================================================
   Script: Grant role admin cho 1 tai khoan admin chung
   Moi truong: SQL Server
   DB:        AutoGaraDB (hoac tuong duong)
   Muc dich:  Dam bao DB tong tren server co 1 tai khoan admin
              de ca nhom dev co the dang nhap vao trang admin.

   LUONG CHAY:
   1. Sua gia tri @adminEmail ben duoi thanh email admin chung
      cua ca nhom (vd admin@autogara.vn).
   2. Chay script 1 lan bang F5 trong SQL Server Management Studio.
   3. Xem ket qua o tab Messages va ket qua cuoi cung.

   Idempotent: chay nhieu lan deu an toan (khong loi, khong trung).
   ============================================================ */

SET NOCOUNT ON;

-- *** SUA GIA TRI NAY THANH EMAIL ADMIN CHUNG CUA CA NHOM ***
DECLARE @adminEmail NVARCHAR(255) = N'admin@autogara.vn';

-- ============================================================
-- BUOC 1: Dam bao role 'admin' ton tai trong bang roles
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [dbo].[roles] WHERE [role_name] = 'admin')
BEGIN
  INSERT INTO [dbo].[roles] ([role_name], [role_label], [description])
  VALUES (N'admin', N'Quản trị viên', N'Tài khoản quản trị hệ thống - toàn quyền');
  PRINT N'[OK] Da tao role admin';
END
ELSE
BEGIN
  PRINT N'[OK] Role admin da ton tai';
END

-- ============================================================
-- BUOC 2: Tim user theo email va gan role admin (neu co)
-- ============================================================
DECLARE @adminUserId BIGINT;
DECLARE @adminRoleId BIGINT;

SELECT @adminUserId = id FROM [dbo].[users] WHERE LOWER([email]) = LOWER(@adminEmail);
SELECT @adminRoleId = id FROM [dbo].[roles] WHERE [role_name] = N'admin';

IF @adminUserId IS NULL
BEGIN
  PRINT N'[WARNING] Khong tim thay user co email = ' + @adminEmail;
  PRINT N'         Hay tao user truoc (bang API register hoac script rieng), roi chay lai script nay.';
END
ELSE
BEGIN
  IF @adminRoleId IS NULL
  BEGIN
    PRINT N'[ERROR] Role admin khong ton tai - loi he thong (can kiem tra bang roles).';
  END
  ELSE
  BEGIN
    BEGIN TRY
      BEGIN TRANSACTION;

      -- Gan role admin (dung NOT EXISTS de tranh trung lap)
      IF NOT EXISTS (
        SELECT 1 FROM [dbo].[user_role]
        WHERE [user_id] = @adminUserId AND [role_id] = @adminRoleId
      )
      BEGIN
        INSERT INTO [dbo].[user_role] ([user_id], [role_id])
        VALUES (@adminUserId, @adminRoleId);
        PRINT N'[OK] Da gan role admin cho user_id = ' + CAST(@adminUserId AS NVARCHAR(20))
              + N' (email = ' + @adminEmail + N')';
      END
      ELSE
      BEGIN
        PRINT N'[OK] User_id = ' + CAST(@adminUserId AS NVARCHAR(20))
              + N' da co role admin san, khong can cap lai.';
      END

      -- Dam bao user o trang thai active
      IF EXISTS (SELECT 1 FROM [dbo].[users] WHERE id = @adminUserId AND [status] <> N'active')
      BEGIN
        UPDATE [dbo].[users] SET [status] = N'active' WHERE id = @adminUserId;
        PRINT N'[OK] Da kich hoat user (status = active).';
      END

      COMMIT TRANSACTION;
      PRINT N'[DONE] Cap quyen admin thanh cong.';
    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
      DECLARE @err NVARCHAR(2000) = ERROR_MESSAGE();
      PRINT N'[ERROR] ' + @err;
      THROW;
    END CATCH
  END
END

-- ============================================================
-- BUOC 3: Kiem tra lai tat ca user admin* sau khi chay
-- ============================================================
PRINT N'--- Kiem tra user co email bat dau bang "admin" ---';
SELECT
  u.id            AS [user_id],
  u.email         AS [email],
  u.full_name     AS [ho_ten],
  u.status        AS [trang_thai],
  STRING_AGG(r.role_name, N', ') AS [cac_role]
FROM [dbo].[users] u
LEFT JOIN [dbo].[user_role] ur ON ur.user_id = u.id
LEFT JOIN [dbo].[roles] r ON r.id = ur.role_id
WHERE LOWER(u.email) LIKE 'admin%'
GROUP BY u.id, u.email, u.full_name, u.status
ORDER BY u.email;