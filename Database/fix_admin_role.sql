/* ============================================================
   Fix: Đồng bộ role admin cho user có email admin trong DB.
   - Script này KHÔNG tự ý gán role - chỉ LIỆT KÊ các user
     có email dạng "admin*" và CHƯA có role 'admin'.
   - Người quản trị DB tự quyết định user nào được gán role admin
     bằng cách uncomment block INSERT phía dưới.

   Chạy phần SELECT trước để xem user nào đang thiếu role admin.
   ============================================================ */

BEGIN TRY
  BEGIN TRANSACTION;

  -- 1. Đảm bảo role 'admin' tồn tại
  IF NOT EXISTS (SELECT 1 FROM [dbo].[roles] WHERE [role_name] = 'admin')
  BEGIN
    INSERT INTO [dbo].[roles] ([role_name], [role_label], [description])
    VALUES (N'admin', N'Quản trị viên', N'Tài khoản quản trị hệ thống - toàn quyền');
    PRINT 'Inserted role admin';
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR: ' + ERROR_MESSAGE();
  THROW;
END CATCH

-- ============================================================
-- 2. LIỆT KÊ: các user có email dạng "admin*" và CHƯA có role admin
-- (Dùng để admin DB xem trước khi quyết định gán)
-- ============================================================
SELECT
  u.id            AS user_id,
  u.email,
  u.full_name,
  u.status,
  CASE WHEN EXISTS (
    SELECT 1 FROM [dbo].[user_role] ur
    JOIN [dbo].[roles] r ON r.id = ur.role_id
    WHERE ur.user_id = u.id AND r.role_name = 'admin'
  ) THEN N'ĐÃ CÓ role admin' ELSE N'CHƯA CÓ role admin' END AS admin_role_status
FROM [dbo].[users] u
WHERE LOWER(u.email) LIKE 'admin%'
ORDER BY u.email;

-- ============================================================
-- 3. GÁN role admin cho user cụ thể
--    *** BỎ COMMENT (@@ chỗ này) đoạn dưới rồi thay <USER_ID>
--        bằng user_id lấy từ query trên, sau đó chạy lại. ***
-- ============================================================

/*
BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @userId BIGINT = <USER_ID>;  -- <-- Thay bằng user_id cần gán
  DECLARE @adminRoleId BIGINT;
  SELECT @adminRoleId = id FROM [dbo].[roles] WHERE [role_name] = 'admin';

  IF @adminRoleId IS NULL
  BEGIN
    PRINT 'ERROR: role admin chưa tồn tại';
    ROLLBACK TRANSACTION;
    RETURN;
  END

  IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE id = @userId)
  BEGIN
    PRINT 'ERROR: user_id không tồn tại';
    ROLLBACK TRANSACTION;
    RETURN;
  END

  INSERT INTO [dbo].[user_role] ([user_id], [role_id])
  SELECT @userId, @adminRoleId
  WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[user_role]
    WHERE [user_id] = @userId AND [role_id] = @adminRoleId
  );

  PRINT 'Done: granted role admin to user_id = ' + CAST(@userId AS NVARCHAR(20));
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR: ' + ERROR_MESSAGE();
  THROW;
END CATCH
*/