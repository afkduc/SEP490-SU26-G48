-- ============================================================
--  Script: Kiem tra user admin sau khi grant role
--  Chay trong DB ma BE dang connect
-- ============================================================
SET NOCOUNT ON;

PRINT N'=== BAO CAO USER ADMIN ===';

-- 1. Liet ke cac user co role admin
PRINT N'--- Cac user co role admin ---';
SELECT
  u.id            AS [user_id],
  u.email         AS [email],
  u.[user_name]   AS [username],
  u.[first_name] + N' ' + u.[last_name] AS [ho_ten],
  u.[status]      AS [trang_thai]
FROM [dbo].[users] u
JOIN [dbo].[user_role] ur ON ur.user_id = u.id
JOIN [dbo].[roles] r ON r.id = ur.role_id
WHERE r.role_name = N'admin'
ORDER BY u.email;

-- 2. Liet ke cac user KHONG CO role nao (candidates can grant)
PRINT N'--- Cac user chua co role admin ---';
SELECT
  u.id            AS [user_id],
  u.email         AS [email],
  u.[user_name]   AS [username],
  u.[status]      AS [trang_thai]
FROM [dbo].[users] u
WHERE u.[status] = N'active'
  AND u.id NOT IN (
    SELECT ur.user_id
    FROM [dbo].[user_role] ur
    JOIN [dbo].[roles] r ON r.id = ur.role_id
    WHERE r.role_name = N'admin'
  )
ORDER BY u.email;

-- 3. Dem tong so
PRINT N'--- Tong ket ---';
SELECT
  (SELECT COUNT(*) FROM [dbo].[users] WHERE [status] = N'active') AS [tong_user_active],
  (SELECT COUNT(*) FROM [dbo].[user_role] ur
   JOIN [dbo].[roles] r ON r.id = ur.role_id
   WHERE r.role_name = N'admin') AS [so_user_co_role_admin];
