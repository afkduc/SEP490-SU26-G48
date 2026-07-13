/* ============================================================
   QUICK FIX - Grant role admin cho user admin@autogara.vn
   Chay 1 lan trong DB tong, sau do dang nhap lai = la xong.

   Cu phap:
     1. Mo SSMS, ket noi DB tong
     2. New Query -> paste toan bo file nay -> Execute (F5)
     3. Xem ket qua o Messages va Results tab
   ============================================================ */

USE [AutoGaraDB];   -- <-- Neu DB ten khac, sua lai cho khop
GO

BEGIN TRY
  BEGIN TRANSACTION;

  -- BUOC 1: Dam bao role 'admin' ton tai (tao neu chua co)
  IF NOT EXISTS (SELECT 1 FROM [dbo].[roles] WHERE [role_name] = 'admin')
  BEGIN
    INSERT INTO [dbo].[roles] ([role_name], [role_label])
    VALUES (N'admin', N'Quan tri vien');
    PRINT 'Step 1 OK: da tao role admin';
  END
  ELSE
    PRINT 'Step 1 OK: role admin da ton tai';

  -- BUOC 2: Tim user admin dang nhap (cac email dang admin/autogara)
  DECLARE @userId BIGINT;
  SELECT TOP 1 @userId = id
  FROM [dbo].[users]
  WHERE LOWER([email]) LIKE '%admin%' OR LOWER([email]) LIKE '%autogara%';

  IF @userId IS NULL
  BEGIN
    PRINT 'Step 2 FAIL: khong tim thay user admin nao trong bang users.';
    PRINT '  -> Can tao user truoc. Lien he dev hoac chay script tao user.';
    ROLLBACK;
    RETURN;
  END

  PRINT 'Step 2 OK: tim thay user_id = ' + CAST(@userId AS NVARCHAR(20));

  -- BUOC 3: Gan role admin cho user do (neu chua co)
  DECLARE @adminRoleId BIGINT;
  SELECT @adminRoleId = [id] FROM [dbo].[roles] WHERE [role_name] = 'admin';

  IF NOT EXISTS (
    SELECT 1 FROM [dbo].[user_role]
    WHERE [user_id] = @userId AND [role_id] = @adminRoleId
  )
  BEGIN
    INSERT INTO [dbo].[user_role] ([user_id], [role_id])
    VALUES (@userId, @adminRoleId);
    PRINT 'Step 3 OK: da gan role admin cho user_id = ' + CAST(@userId AS NVARCHAR(20));
  END
  ELSE
    PRINT 'Step 3 OK: user_id = ' + CAST(@userId AS NVARCHAR(20)) + N' da co role admin roi';

  COMMIT TRANSACTION;

  -- BUOC 4: Verify lai - query kiem tra
  SELECT
    u.id            AS user_id,
    u.email,
    u.user_name,
    r.role_name,
    r.role_label
  FROM [dbo].[users] u
  JOIN [dbo].[user_role] ur ON ur.user_id = u.id
  JOIN [dbo].[roles] r     ON r.id = ur.role_id
  WHERE u.id = @userId;

  PRINT '============================================================';
  PRINT 'HOAN TAT! Bay gio:';
  PRINT '  1. Quay lai trinh duyet FE';
  PRINT '  2. Dang xuat, dang nhap lai bang admin';
  PRINT '  3. JWT moi se co roles = ["admin"] -> BE se cho qua';
  PRINT '============================================================';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'LOI: ' + ERROR_MESSAGE();
  THROW;
END CATCH
GO
