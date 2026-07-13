-- ============================================================
--  Script: ONE-SHOT FIX cho DB tong server
--  Tu dong detect DB thieu gi va fix tuong ung
--
--  Tinh huong xu ly:
--    A) DB rong                       -> tao full schema tu AutoGara
--    B) Co schema nhung thieu users/roles/user_role -> chi tao 3 bang do
--    C) Co du schema                   -> chi grant role admin
--
--  Chay 1 lan trong SSMS voi DB tong server (khong phai DB local).
--  Idempotent: chay nhieu lan deu an toan.
-- ============================================================
SET NOCOUNT ON;

PRINT N'============================================================';
PRINT N'  AUTO-FIX DB TONG SERVER - BAT DAU';
PRINT N'============================================================';

-- ============================================================
-- BUOC 1: DETECT - DB dang co gi?
-- ============================================================
DECLARE @hasUsers   BIT = CASE WHEN OBJECT_ID('dbo.users',     'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasRoles   BIT = CASE WHEN OBJECT_ID('dbo.roles',     'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasUserRole BIT = CASE WHEN OBJECT_ID('dbo.user_role', 'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasBranches BIT = CASE WHEN OBJECT_ID('dbo.branches', 'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasVehicles BIT = CASE WHEN OBJECT_ID('dbo.vehicles', 'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @userCount   INT = 0;
DECLARE @adminRoleId BIGINT = NULL;

PRINT N'-- Trang thai DB hien tai --';
PRINT N'   users     : ' + CASE WHEN @hasUsers   = 1 THEN N'CO' ELSE N'THIEU' END;
PRINT N'   roles     : ' + CASE WHEN @hasRoles   = 1 THEN N'CO' ELSE N'THIEU' END;
PRINT N'   user_role : ' + CASE WHEN @hasUserRole = 1 THEN N'CO' ELSE N'THIEU' END;
PRINT N'   branches  : ' + CASE WHEN @hasBranches = 1 THEN N'CO' ELSE N'THIEU' END;
PRINT N'   vehicles  : ' + CASE WHEN @hasVehicles = 1 THEN N'CO' ELSE N'THIEU' END;

-- Dem user neu co bang users
IF @hasUsers = 1
  SELECT @userCount = COUNT(*) FROM [dbo].[users];
PRINT N'   So user hien co: ' + CAST(@userCount AS NVARCHAR(10));

-- ============================================================
-- BUOC 2: FIX theo tinh huong
-- ============================================================

------------------------------------------------------------
-- TINH HUONG A: DB rong (khong co ca branches)
-- => Chay full file AutoGara.sql roi quay lai script nay
------------------------------------------------------------
IF @hasBranches = 0
BEGIN
  PRINT N'';
  PRINT N'[HUONG DAN] DB rong - can chay full file AutoGara.sql truoc.';
  PRINT N'             Sau do chay lai script nay de grant role admin.';
  PRINT N'';
  PRINT N'         File AutoGara.sql o: Database\AutoGara.sql';
  PRINT N'         Lenh de chay trong SSMS:';
  PRINT N'             USE AutoGaraDB;';
  PRINT N'             :r D:\path\to\Database\AutoGara.sql';
  PRINT N'';
  -- Thoat som, khong lam gi them
  RETURN;
END

------------------------------------------------------------
-- TINH HUONG B: Thieu bang users/roles/user_role
-- => Tao 3 bang do (lay schema tu AutoGara.sql)
------------------------------------------------------------
IF @hasUsers = 0 OR @hasRoles = 0 OR @hasUserRole = 0
BEGIN
  PRINT N'';
  PRINT N'[INFO] Phat hien thieu bang can thiet - se tao bo sung...';

  -- Tao bang ROLES
  IF @hasRoles = 0
  BEGIN
    CREATE TABLE [dbo].[roles](
      [id]         [bigint] IDENTITY(1,1) NOT NULL,
      [role_name]  [varchar](50) NOT NULL,
      [role_label] [nvarchar](100) NULL,
      CONSTRAINT [roles_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
      CONSTRAINT [roles_name_uq] UNIQUE NONCLUSTERED ([role_name] ASC)
    ) ON [PRIMARY];
    PRINT N'   [OK] Da tao bang roles';
  END

  -- Tao bang USERS
  IF @hasUsers = 0
  BEGIN
    CREATE TABLE [dbo].[users](
      [id]            [bigint] IDENTITY(1,1) NOT NULL,
      [pseudo_id]     [varchar](20) NOT NULL,
      [user_name]     [nvarchar](250) NOT NULL,
      [email]         [varchar](100) NULL,
      [user_password] [varchar](250) NOT NULL,
      [first_name]    [nvarchar](50) NULL,
      [last_name]     [nvarchar](50) NULL,
      [phone]         [varchar](20) NULL,
      [branch_id]     [bigint] NULL,
      [team_size]     [int] NOT NULL DEFAULT ((0)),
      [status]        [varchar](20) NOT NULL DEFAULT ('active'),
      [avatar]        [varchar](255) NULL,
      [notes]         [nvarchar](500) NULL,
      [created_at]    [datetime] NOT NULL DEFAULT (getdate()),
      [team_leader_id] [bigint] NULL,
      CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
      CONSTRAINT [users_code_uq] UNIQUE NONCLUSTERED ([pseudo_id] ASC)
    ) ON [PRIMARY];
    CREATE UNIQUE NONCLUSTERED INDEX [users_email_uq] ON [dbo].[users]
      ([email] ASC) WHERE ([email] IS NOT NULL);
    PRINT N'   [OK] Da tao bang users';
  END

  -- Tao bang USER_ROLE
  IF @hasUserRole = 0
  BEGIN
    CREATE TABLE [dbo].[user_role](
      [id]      [bigint] IDENTITY(1,1) NOT NULL,
      [user_id] [bigint] NOT NULL,
      [role_id] [bigint] NOT NULL,
      CONSTRAINT [ur_pkey] PRIMARY KEY CLUSTERED ([id] ASC),
      CONSTRAINT [ur_uq] UNIQUE NONCLUSTERED ([user_id] ASC, [role_id] ASC)
    ) ON [PRIMARY];
    PRINT N'   [OK] Da tao bang user_role';
  END

  PRINT N'   [INFO] Can tao user admin bang cach dang ky qua UI FE,';
  PRINT N'          roi chay lai script nay de grant role.';
  RETURN;
END

-- ============================================================
-- TINH HUONG C: Co du schema -> Grant role admin
-- ============================================================
PRINT N'';
PRINT N'[OK] Schema OK - tien hanh grant role admin...';

-- BUOC 2.1: Dam bao role admin ton tai
IF NOT EXISTS (SELECT 1 FROM [dbo].[roles] WHERE [role_name] = N'admin')
BEGIN
  INSERT INTO [dbo].[roles] ([role_name], [role_label])
  VALUES (N'admin', N'Quan tri vien');
  PRINT N'   [OK] Da tao role admin';
END

SELECT @adminRoleId = id FROM [dbo].[roles] WHERE [role_name] = N'admin';

-- BUOC 2.2: Grant role admin cho TAT CA user active (chua co)
INSERT INTO [dbo].[user_role] ([user_id], [role_id])
SELECT u.id, @adminRoleId
FROM   [dbo].[users] u
WHERE  u.[status] = N'active'
  AND  NOT EXISTS (
         SELECT 1 FROM [dbo].[user_role] ur
         WHERE ur.user_id = u.id AND ur.role_id = @adminRoleId
       );

PRINT N'   [OK] Da grant role admin cho tat ca user active';

-- ============================================================
-- BUOC 3: BAO CAO KET QUA
-- ============================================================
PRINT N'';
PRINT N'============================================================';
PRINT N'  KET QUA';
PRINT N'============================================================';
PRINT N'Danh sach user va role:';
SELECT
  u.id            AS [user_id],
  u.email         AS [email],
  u.[user_name]   AS [username],
  u.[status]      AS [trang_thai],
  STRING_AGG(r.role_name, N', ') AS [cac_role]
FROM [dbo].[users] u
LEFT JOIN [dbo].[user_role] ur ON ur.user_id = u.id
LEFT JOIN [dbo].[roles] r ON r.id = ur.role_id
GROUP BY u.id, u.email, u.[user_name], u.[status]
ORDER BY u.email;

PRINT N'';
PRINT N'[DONE] Hoan tat. Hay DANG NHAP LAI tren FE de nhan JWT moi co role admin.';