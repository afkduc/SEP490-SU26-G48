-- ============================================================
--  User Module - Migration V5 (bo sung cho Ngay 4)
--  Mo rong bang users + tao bang user_roles de gan role cho user
--  Chay SAU khi schema goc AutoGara.sql da tao xong.
--  Phu hop voi cac UC-08/09/10 (CRUD user).
-- ============================================================

USE AutoGaraDB;
GO

-- Guard an toan: neu chua chay AutoGara.sql thi bo qua
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
    PRINT N'BO QUA V5: bang [users] chua ton tai - hay chay Database/AutoGara.sql truoc.';
    RETURN;
END;
GO

-- 1) Tao bang user_roles neu chua co (nhieu user - nhieu role)
IF OBJECT_ID('dbo.user_roles', 'U') IS NULL
BEGIN
    CREATE TABLE user_roles (
        user_id   BIGINT NOT NULL,
        role_id   BIGINT NOT NULL,
        created_at DATETIME NOT NULL CONSTRAINT user_roles_created_at_df DEFAULT GETDATE(),
        CONSTRAINT user_roles_pk PRIMARY KEY (user_id, role_id),
        CONSTRAINT user_roles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT user_roles_role_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
    PRINT N'  + Tao bang user_roles';
END;
GO

-- 2) Mo rong bang users voi cac cot bo sung
IF COL_LENGTH('users', 'full_name') IS NULL
BEGIN
    ALTER TABLE users ADD full_name NVARCHAR(150) NULL;
    PRINT N'  + Them cot users.full_name';
END;
GO

IF COL_LENGTH('users', 'phone') IS NULL
BEGIN
    ALTER TABLE users ADD phone NVARCHAR(20) NULL;
    PRINT N'  + Them cot users.phone';
END;
GO

IF COL_LENGTH('users', 'branch_id') IS NULL
BEGIN
    ALTER TABLE users ADD branch_id BIGINT NULL;
    PRINT N'  + Them cot users.branch_id';
END;
GO

IF COL_LENGTH('users', 'status') IS NULL
BEGIN
    ALTER TABLE users ADD status NVARCHAR(20) NOT NULL
        CONSTRAINT users_status_df DEFAULT 'active';
    PRINT N'  + Them cot users.status (default: active)';
END;
GO

IF COL_LENGTH('users', 'last_login_at') IS NULL
BEGIN
    ALTER TABLE users ADD last_login_at DATETIME NULL;
    PRINT N'  + Them cot users.last_login_at';
END;
GO

IF COL_LENGTH('users', 'created_by') IS NULL
BEGIN
    ALTER TABLE users ADD created_by BIGINT NULL;
    PRINT N'  + Them cot users.created_by';
END;
GO

-- 3) FK users.created_by -> users.id (neu chua co)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'users_created_by_fk')
BEGIN
    ALTER TABLE users
        ADD CONSTRAINT users_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id);
    PRINT N'  + Tao FK users_created_by_fk';
END;
GO

-- 4) FK users.branch_id -> branches.id (neu chua co)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'users_branch_fk')
   AND OBJECT_ID('dbo.branches', 'U') IS NOT NULL
BEGIN
    ALTER TABLE users
        ADD CONSTRAINT users_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(id);
    PRINT N'  + Tao FK users_branch_fk';
END;
GO

-- 5) Dam bao co it nhat 1 role "admin" (de dang nhap bang admin)
IF NOT EXISTS (SELECT 1 FROM roles WHERE role_name = 'admin')
BEGIN
    INSERT INTO roles (role_name, role_label) VALUES ('admin', N'Quan tri he thong');
    PRINT N'  + Them role mac dinh: admin';
END;
GO

PRINT N'Migration V5 (user) hoan tat - mo rong users + tao user_roles + FK.';
GO
