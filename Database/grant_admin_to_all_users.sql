-- ============================================================
--  Script: Grant role admin cho TAT CA user trong DB
--  Muc dich: Test nhanh - khong can biet email admin cu the
--  Idempotent: chay nhieu lan deu an toan
-- ============================================================
SET NOCOUNT ON;

-- BUOC 1: Dam bao role admin ton tai trong bang roles
IF NOT EXISTS (SELECT 1 FROM [dbo].[roles] WHERE [role_name] = 'admin')
BEGIN
  INSERT INTO [dbo].[roles] ([role_name], [role_label])
  VALUES (N'admin', N'Quan tri vien');
  PRINT N'[OK] Da tao role admin';
END
ELSE
  PRINT N'[OK] Role admin da ton tai';

-- BUOC 2: Lay id cua role admin
DECLARE @adminRoleId BIGINT;
SELECT @adminRoleId = id FROM [dbo].[roles] WHERE [role_name] = N'admin';

-- BUOC 3: Grant role admin cho TAT CA user active (chua co)
INSERT INTO [dbo].[user_role] ([user_id], [role_id])
SELECT u.id, @adminRoleId
FROM   [dbo].[users] u
WHERE  u.[status] = N'active'
  AND  NOT EXISTS (
         SELECT 1 FROM [dbo].[user_role] ur
         WHERE ur.user_id = u.id AND ur.role_id = @adminRoleId
       );

PRINT N'[OK] Da grant role admin cho tat ca user active';

-- BUOC 4: Kiem tra ket qua
PRINT N'--- Tat ca user va role cua ho ---';
SELECT
  u.id            AS [user_id],
  u.email         AS [email],
  u.[user_name]   AS [ten_dang_nhap],
  u.[status]      AS [trang_thai],
  STUFF((
    SELECT ', ' + r.role_name
    FROM   [dbo].[user_role] ur2
    JOIN   [dbo].[roles] r ON r.id = ur2.role_id
    WHERE  ur2.user_id = u.id
    FOR XML PATH('')
  ), 1, 2, '') AS [cac_role]
FROM [dbo].[users] u
LEFT JOIN [dbo].[user_role] ur ON ur.user_id = u.id
LEFT JOIN [dbo].[roles] r ON r.id = ur.role_id
GROUP BY u.id, u.email, u.[user_name], u.[status]
ORDER BY u.email;
