-- ============================================================
-- Script tạo bảng login_sessions trong database sep490_g48
-- Chạy file này trong SQL Server Management Studio (SSMS)
-- ============================================================

USE [sep490_g48]
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'login_sessions')
BEGIN
    CREATE TABLE [dbo].[login_sessions](
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [action_type] [varchar](20) NOT NULL,
        [user_id] [bigint] NULL,
        [user_name] [nvarchar](250) NULL,
        [phone] [varchar](20) NULL,
        [ip_address] [varchar](64) NULL,
        [user_agent] [nvarchar](512) NULL,
        [branch_id] [bigint] NULL,
        [status] [varchar](20) NOT NULL DEFAULT 'active',
        [login_time] [datetime] NOT NULL DEFAULT GETDATE(),
        [logout_time] [datetime] NULL,
        [session_duration_seconds] [int] NULL,
        CONSTRAINT [login_sessions_pkey] PRIMARY KEY CLUSTERED
        (
            [id] ASC
        ) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF,
                ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
    ) ON [PRIMARY];

    CREATE NONCLUSTERED INDEX [idx_login_sessions_user_name] ON [dbo].[login_sessions]([user_name]);
    CREATE NONCLUSTERED INDEX [idx_login_sessions_status] ON [dbo].[login_sessions]([status]);
    CREATE NONCLUSTERED INDEX [idx_login_sessions_login_time] ON [dbo].[login_sessions]([login_time] DESC);

    PRINT 'Bang login_sessions da duoc tao thanh cong trong sep490_g48!';
END
ELSE
BEGIN
    PRINT 'Bang login_sessions da ton tai trong sep490_g48!';
END
GO
