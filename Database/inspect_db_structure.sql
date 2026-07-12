-- ============================================================
-- Script INSPECT 2: Tim hieu DB tong co gi
-- Chay va gui ket qua cho dev
-- ============================================================

-- 1. Liet ke DB hien tai
SELECT DB_NAME() AS [current_db];

-- 2. Toan bo bang (kem row count)
SELECT
  t.TABLE_SCHEMA AS [schema],
  t.TABLE_NAME   AS [ten_bang],
  p.rows         AS [so_dong]
FROM INFORMATION_SCHEMA.TABLES t
LEFT JOIN sys.partitions p
  ON p.OBJECT_ID = OBJECT_ID(QUOTENAME(t.TABLE_SCHEMA) + '.' + QUOTENAME(t.TABLE_NAME))
 AND p.index_id IN (0, 1)
WHERE t.TABLE_TYPE = 'BASE TABLE'
ORDER BY t.TABLE_NAME;

-- 3. Toan bo stored procedures
SELECT
  ROUTINE_SCHEMA AS [schema],
  ROUTINE_NAME   AS [ten_proc],
  DATA_TYPE      AS [loai]
FROM INFORMATION_SCHEMA.ROUTINES
ORDER BY ROUTINE_NAME;

-- 4. Toan bo view
SELECT
  TABLE_SCHEMA AS [schema],
  TABLE_NAME   AS [ten_view]
FROM INFORMATION_SCHEMA.VIEWS
ORDER BY TABLE_NAME;

-- 5. Kiem tra co table AspNet* (Identity) khong
IF OBJECT_ID('dbo.AspNetUsers', 'U') IS NOT NULL
  PRINT N'[FOUND] Co bang AspNetUsers (ASP.NET Identity)';
ELSE
  PRINT N'[INFO] Khong co AspNetUsers';

IF OBJECT_ID('dbo.AspNetRoles', 'U') IS NOT NULL
  PRINT N'[FOUND] Co bang AspNetRoles (ASP.NET Identity)';
ELSE
  PRINT N'[INFO] Khong co AspNetRoles';

IF OBJECT_ID('dbo.AspNetUserRoles', 'U') IS NOT NULL
  PRINT N'[FOUND] Co bang AspNetUserRoles (ASP.NET Identity)';
ELSE
  PRINT N'[INFO] Khong co AspNetUserRoles';

-- 6. Liet ke tat ca cac table type (kieu user-defined)
SELECT name FROM sys.types WHERE is_user_defined = 1 ORDER BY name;