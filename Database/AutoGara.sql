-- ============================================================
--  AutoGara Database – SQL Server
--  Hệ thống quản lý bảo dưỡng & sửa chữa ủy quyền Mazda & Kia
--  Phiên bản: 2.3  (gộp team_leaders vào users, employee_code -> pseudo_id,
--                    parts -> products)
-- ============================================================

USE master;
GO
CREATE DATABASE AutoGaraDB
    COLLATE Vietnamese_CI_AS;
GO
USE AutoGaraDB;
GO

ALTER DATABASE [AutoGaraDB] SET COMPATIBILITY_LEVEL = 160
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [AutoGaraDB].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [AutoGaraDB] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [AutoGaraDB] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [AutoGaraDB] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [AutoGaraDB] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [AutoGaraDB] SET ARITHABORT OFF 
GO
ALTER DATABASE [AutoGaraDB] SET AUTO_CLOSE OFF 
GO
ALTER DATABASE [AutoGaraDB] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [AutoGaraDB] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [AutoGaraDB] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [AutoGaraDB] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [AutoGaraDB] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [AutoGaraDB] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [AutoGaraDB] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [AutoGaraDB] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [AutoGaraDB] SET  DISABLE_BROKER 
GO
ALTER DATABASE [AutoGaraDB] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [AutoGaraDB] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [AutoGaraDB] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [AutoGaraDB] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [AutoGaraDB] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [AutoGaraDB] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [AutoGaraDB] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [AutoGaraDB] SET RECOVERY FULL 
GO
ALTER DATABASE [AutoGaraDB] SET  MULTI_USER 
GO
ALTER DATABASE [AutoGaraDB] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [AutoGaraDB] SET DB_CHAINING OFF 
GO
ALTER DATABASE [AutoGaraDB] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [AutoGaraDB] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [AutoGaraDB] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [AutoGaraDB] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
ALTER DATABASE [AutoGaraDB] SET OPTIMIZED_LOCKING = OFF 
GO
ALTER DATABASE [AutoGaraDB] SET QUERY_STORE = ON
GO
ALTER DATABASE [AutoGaraDB] SET QUERY_STORE (OPERATION_MODE = READ_WRITE, CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30), DATA_FLUSH_INTERVAL_SECONDS = 900, INTERVAL_LENGTH_MINUTES = 60, MAX_STORAGE_SIZE_MB = 1000, QUERY_CAPTURE_MODE = AUTO, SIZE_BASED_CLEANUP_MODE = AUTO, MAX_PLANS_PER_QUERY = 200, WAIT_STATS_CAPTURE_MODE = ON)
GO
USE [AutoGaraDB]
GO
/****** Object:  User [demo_masked_user]    Script Date: 7/12/2026 12:12:58 AM ******/
CREATE USER [demo_masked_user] FOR LOGIN [demo_masked_login] WITH DEFAULT_SCHEMA=[dbo]
GO
/****** Object:  User [demo_full_user]    Script Date: 7/12/2026 12:12:58 AM ******/
CREATE USER [demo_full_user] FOR LOGIN [demo_full_login] WITH DEFAULT_SCHEMA=[dbo]
GO
/****** Object:  DatabaseRole [role_data_masked]    Script Date: 7/12/2026 12:12:58 AM ******/
CREATE ROLE [role_data_masked]
GO
/****** Object:  DatabaseRole [role_data_full]    Script Date: 7/12/2026 12:12:58 AM ******/
CREATE ROLE [role_data_full]
GO
ALTER ROLE [role_data_masked] ADD MEMBER [demo_masked_user]
GO
ALTER ROLE [role_data_full] ADD MEMBER [demo_full_user]
GO
/****** Object:  UserDefinedFunction [dbo].[fn_mask_cccd]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   FUNCTION [dbo].[fn_mask_cccd](@cccd VARCHAR(20))
RETURNS VARCHAR(20)
AS
BEGIN
    IF @cccd IS NULL OR LEN(@cccd) <= 6
        RETURN N'******';

    RETURN LEFT(@cccd, 3) + N'******' + RIGHT(@cccd, 3);
END;
GO
/****** Object:  Table [dbo].[brands]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[brands](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[brand_code] [varchar](20) NOT NULL,
	[brand_name] [nvarchar](100) NOT NULL,
	[logo_url] [varchar](255) NULL,
	[warranty_years] [int] NOT NULL,
	[warranty_km] [int] NOT NULL,
 CONSTRAINT [brands_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [brands_code_uq] UNIQUE NONCLUSTERED 
(
	[brand_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[branches]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[branches](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[branch_code] [varchar](20) NOT NULL,
	[branch_name] [nvarchar](150) NOT NULL,
	[address] [nvarchar](255) NULL,
	[phone] [varchar](20) NULL,
	[email] [varchar](100) NULL,
	[manager_id] [bigint] NULL,
	[is_active] [bit] NOT NULL,
 CONSTRAINT [branches_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [branches_code_uq] UNIQUE NONCLUSTERED 
(
	[branch_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[customers]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[customers](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[customer_code] [varchar](20) NULL,
	[full_name] [nvarchar](150) NOT NULL,
	[phone] [varchar](20) MASKED WITH (FUNCTION = 'partial(3, "*****", 2)') NOT NULL,
	[email] [varchar](100) MASKED WITH (FUNCTION = 'email()') NULL,
	[cccd] [varchar](20) MASKED WITH (FUNCTION = 'partial(3, "******", 3)') NULL,
	[date_of_birth] [date] MASKED WITH (FUNCTION = 'default()') NULL,
	[address] [nvarchar](255) NULL,
	[tax_code] [varchar](20) MASKED WITH (FUNCTION = 'partial(2, "****", 2)') NULL,
	[contact_name] [nvarchar](100) NULL,
	[contact_phone] [varchar](20) NULL,
	[avatar_url] [varchar](500) NULL,
	[contract_id] [bigint] NULL,
	[created_at] [datetime] NOT NULL,
 CONSTRAINT [customers_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[vehicles]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[vehicles](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[license_plate] [varchar](20) NOT NULL,
	[brand_id] [bigint] NULL,
	[customer_id] [bigint] NULL,
	[vehicle_model_text] [nvarchar](200) NULL,
	[frame_number] [varchar](50) NULL,
	[engine_number] [varchar](50) NULL,
	[manufacture_year] [int] NULL,
	[color] [nvarchar](50) NULL,
	[current_km] [int] NOT NULL,
 CONSTRAINT [vehicles_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [vehicles_plate_uq] UNIQUE NONCLUSTERED 
(
	[license_plate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[warranty_records]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[warranty_records](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[vehicle_id] [bigint] NOT NULL,
	[brand_id] [bigint] NOT NULL,
	[purchase_date] [date] NOT NULL,
	[purchase_branch_id] [bigint] NULL,
	[warranty_end_date] [date] NOT NULL,
	[warranty_km] [int] NOT NULL,
	[notes] [nvarchar](500) NULL,
 CONSTRAINT [wr_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[v_warranty_status]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ------------------------------------------------------------
--  3.2  VIEW – Kiểm tra bảo hành real-time
--       Dùng khi xe vào sửa: tra theo license_plate hoặc vehicle_id
-- ------------------------------------------------------------
CREATE VIEW [dbo].[v_warranty_status] AS
SELECT
    v.id                                         AS vehicle_id,
    v.license_plate,
    v.frame_number,
    v.vehicle_model_text,
    v.current_km,
    b.brand_name,
    b.warranty_years,
    b.warranty_km                                AS max_warranty_km,
    wr.purchase_date,
    wr.warranty_end_date,
    wr.warranty_km                               AS warranty_km_limit,
    -- Còn trong thời gian bảo hành?
    CASE WHEN CAST(GETDATE() AS DATE) <= wr.warranty_end_date
         THEN 1 ELSE 0 END                        AS within_warranty_period,
    -- Còn trong giới hạn km bảo hành?
    CASE WHEN v.current_km <= wr.warranty_km
         THEN 1 ELSE 0 END                        AS within_warranty_km,
    -- KẾT QUẢ TỔNG: còn bảo hành khi CẢ HAI điều kiện thỏa
    CASE WHEN CAST(GETDATE() AS DATE) <= wr.warranty_end_date
              AND v.current_km <= wr.warranty_km
         THEN 1 ELSE 0 END                        AS is_under_warranty,
    -- Số ngày còn lại
    DATEDIFF(DAY, CAST(GETDATE() AS DATE), wr.warranty_end_date)
                                                  AS days_remaining,
    -- Số km còn lại trong bảo hành
    wr.warranty_km - v.current_km                 AS km_remaining,
    -- Xe được bảo hành tại chi nhánh nào
    br_pur.branch_name                            AS purchase_branch_name,
    -- Chủ xe hiện tại
    c.full_name                                   AS current_owner,
    c.phone                                       AS owner_phone
FROM vehicles v
JOIN  warranty_records  wr     ON wr.vehicle_id = v.id
JOIN  brands            b      ON b.id = wr.brand_id
LEFT JOIN branches      br_pur ON br_pur.id = wr.purchase_branch_id
LEFT JOIN customers     c      ON c.id = v.customer_id;
GO
/****** Object:  Table [dbo].[after_service_care]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[after_service_care](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[service_order_id] [bigint] NULL,
	[customer_id] [bigint] NOT NULL,
	[vehicle_id] [bigint] NULL,
	[branch_id] [bigint] NOT NULL,
	[care_type] [varchar](50) NULL,
	[scheduled_date] [date] NULL,
	[actual_date] [datetime] NULL,
	[done_by] [bigint] NULL,
	[result] [nvarchar](300) NULL,
	[status] [varchar](20) NOT NULL,
	[notes] [nvarchar](500) NULL,
	[created_at] [datetime] NOT NULL,
 CONSTRAINT [asc_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[audit_logs]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[audit_logs](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[user_name] [nvarchar](128) NOT NULL,
	[action] [varchar](10) NOT NULL,
	[table_name] [varchar](50) NOT NULL,
	[record_id] [bigint] NULL,
	[old_value] [nvarchar](max) NULL,
	[new_value] [nvarchar](max) NULL,
	[logged_at] [datetime] NOT NULL,
 CONSTRAINT [audit_logs_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[contracts]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[contracts](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[contract_code] [varchar](50) NOT NULL,
	[branch_id] [bigint] NULL,
	[brand_id] [bigint] NULL,
	[customer_id] [bigint] NULL,
	[vehicle_id] [bigint] NULL,
	[purchase_date] [date] NOT NULL,
	[sale_price] [decimal](18, 2) NULL,
	[dealership_name] [nvarchar](200) NULL,
	[created_by] [bigint] NULL,
	[import_file] [nvarchar](255) NULL,
	[notes] [nvarchar](500) NULL,
	[created_at] [datetime] NOT NULL,
 CONSTRAINT [ct_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [ct_code_uq] UNIQUE NONCLUSTERED 
(
	[contract_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[customer_feedback]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[customer_feedback](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[service_order_id] [bigint] NULL,
	[customer_id] [bigint] NOT NULL,
	[branch_id] [bigint] NOT NULL,
	[rating] [int] NULL,
	[comment] [nvarchar](1000) NULL,
	[feedback_date] [datetime] NOT NULL,
	[is_resolved] [bit] NOT NULL,
	[resolved_by] [bigint] NULL,
	[resolution_note] [nvarchar](500) NULL,
 CONSTRAINT [cf_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[import_request_items]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[import_request_items](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[import_request_id] [bigint] NOT NULL,
	[product_id] [bigint] NULL,
	[product_code] [varchar](30) NULL,
	[product_name] [nvarchar](200) NULL,
	[unit] [varchar](20) NULL,
	[quantity] [int] NOT NULL,
 CONSTRAINT [iri_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[import_requests]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[import_requests](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[request_code] [varchar](30) NOT NULL,
	[branch_id] [bigint] NOT NULL,
	[supplier_id] [bigint] NULL,
	[supplier_invoice_no] [varchar](50) NULL,
	[requested_by] [bigint] NOT NULL,
	[approved_by] [bigint] NULL,
	[import_date] [date] NULL,
	[status] [varchar](20) NOT NULL,
	[reject_reason] [nvarchar](500) NULL,
	[notes] [nvarchar](500) NULL,
	[created_at] [datetime] NOT NULL,
 CONSTRAINT [ir_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [ir_code_uq] UNIQUE NONCLUSTERED 
(
	[request_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[inventory_transactions]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[inventory_transactions](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[transaction_code] [varchar](30) NOT NULL,
	[transaction_type] [varchar](10) NOT NULL,
	[branch_id] [bigint] NOT NULL,
	[product_id] [bigint] NOT NULL,
	[quantity] [int] NOT NULL,
	[import_request_id] [bigint] NULL,
	[service_order_id] [bigint] NULL,
	[team_leader_id] [bigint] NULL,
	[performed_by] [bigint] NOT NULL,
	[transaction_date] [date] NOT NULL,
	[status] [varchar](20) NOT NULL,
	[notes] [nvarchar](500) NULL,
 CONSTRAINT [it_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [it_code_uq] UNIQUE NONCLUSTERED 
(
	[transaction_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[invoices]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[invoices](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[invoice_code] [varchar](30) NOT NULL,
	[service_order_id] [bigint] NULL,
	[branch_id] [bigint] NOT NULL,
	[customer_id] [bigint] NOT NULL,
	[amount] [decimal](18, 2) NOT NULL,
	[paid] [decimal](18, 2) NOT NULL,
	[payment_method] [nvarchar](50) NULL,
	[status] [varchar](20) NOT NULL,
	[issued_at] [datetime] NOT NULL,
	[issued_by] [bigint] NULL,
	[qr_data] [nvarchar](500) NULL,
 CONSTRAINT [inv_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [inv_code_uq] UNIQUE NONCLUSTERED 
(
	[invoice_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[maintenance_reminders]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[maintenance_reminders](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[vehicle_id] [bigint] NOT NULL,
	[customer_id] [bigint] NOT NULL,
	[branch_id] [bigint] NOT NULL,
	[reminder_type] [nvarchar](100) NULL,
	[due_date] [date] NULL,
	[due_km] [int] NULL,
	[is_sent] [bit] NOT NULL,
	[sent_at] [datetime] NULL,
	[is_confirmed] [bit] NOT NULL,
	[confirmed_date] [date] NULL,
	[notes] [nvarchar](500) NULL,
	[created_at] [datetime] NOT NULL,
 CONSTRAINT [mr_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[products]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[products](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[product_code] [varchar](30) NOT NULL,
	[product_name] [nvarchar](200) NOT NULL,
	[category] [nvarchar](100) NULL,
	[brand_name] [nvarchar](100) NULL,
	[compatible_brand_id] [bigint] NULL,
	[unit] [varchar](20) NOT NULL,
	[supplier_id] [bigint] NULL,
	[location] [varchar](50) NULL,
	[branch_id] [bigint] NOT NULL,
	[stock_quantity] [int] NOT NULL,
	[min_stock] [int] NOT NULL,
	[status] [varchar](20) NOT NULL,
	[unit_price] [decimal](18, 2) NULL,
 CONSTRAINT [products_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [products_code_branch] UNIQUE NONCLUSTERED 
(
	[product_code] ASC,
	[branch_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[repair_order_tasks]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[repair_order_tasks](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[repair_order_id] [bigint] NOT NULL,
	[task_name] [nvarchar](300) NOT NULL,
	[task_type] [varchar](10) NOT NULL,
	[product_id] [bigint] NULL,
	[quantity] [int] NOT NULL,
	[unit_price] [decimal](18, 2) NULL,
	[is_done] [bit] NOT NULL,
 CONSTRAINT [rot_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[repair_orders]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[repair_orders](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[repair_code] [varchar](30) NOT NULL,
	[service_order_id] [bigint] NULL,
	[branch_id] [bigint] NOT NULL,
	[team_leader_id] [bigint] NOT NULL,
	[vehicle_id] [bigint] NULL,
	[created_by] [bigint] NOT NULL,
	[status] [varchar](20) NOT NULL,
	[notes] [nvarchar](500) NULL,
	[created_at] [datetime] NOT NULL,
	[completed_at] [datetime] NULL,
 CONSTRAINT [ro_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [ro_code_uq] UNIQUE NONCLUSTERED 
(
	[repair_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[role_security_mapping]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[role_security_mapping](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[business_role] [varchar](50) NOT NULL,
	[security_group] [varchar](30) NOT NULL,
 CONSTRAINT [rsm_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [rsm_role_uq] UNIQUE NONCLUSTERED 
(
	[business_role] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[roles]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[roles](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[role_name] [varchar](50) NOT NULL,
	[role_label] [nvarchar](100) NULL,
 CONSTRAINT [roles_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [roles_name_uq] UNIQUE NONCLUSTERED 
(
	[role_name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[service_categories]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[service_categories](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[category_name] [nvarchar](100) NOT NULL,
 CONSTRAINT [sc_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[service_order_items]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[service_order_items](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[service_order_id] [bigint] NOT NULL,
	[item_type] [varchar](10) NOT NULL,
	[product_id] [bigint] NULL,
	[service_id] [bigint] NULL,
	[item_code] [varchar](30) NULL,
	[item_description] [nvarchar](300) NOT NULL,
	[lhsc] [varchar](10) NULL,
	[httt] [varchar](10) NULL,
	[unit] [varchar](20) NULL,
	[quantity] [int] NOT NULL,
	[unit_price] [decimal](18, 2) NOT NULL,
	[discount_pct] [decimal](5, 2) NOT NULL,
	[is_free] [bit] NOT NULL,
	[total] [decimal](18, 2) NOT NULL,
 CONSTRAINT [soi_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[service_orders]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[service_orders](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[order_code] [varchar](30) NOT NULL,
	[branch_id] [bigint] NOT NULL,
	[vehicle_id] [bigint] NOT NULL,
	[customer_id] [bigint] NOT NULL,
	[advisor_id] [bigint] NOT NULL,
	[team_leader_id] [bigint] NULL,
	[customer_request] [nvarchar](1000) NULL,
	[current_km] [int] NULL,
	[status] [varchar](30) NOT NULL,
	[subtotal] [decimal](18, 2) NOT NULL,
	[discount_amount] [decimal](18, 2) NOT NULL,
	[after_discount] [decimal](18, 2) NOT NULL,
	[vat] [decimal](18, 2) NOT NULL,
	[free_amount] [decimal](18, 2) NOT NULL,
	[total] [decimal](18, 2) NOT NULL,
	[next_maintenance_km] [int] NULL,
	[next_maintenance_date] [date] NULL,
	[is_warranty] [bit] NOT NULL,
	[intake_date] [datetime] NOT NULL,
	[completed_date] [datetime] NULL,
	[delivery_date] [date] NULL,
 CONSTRAINT [so_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [so_code_uq] UNIQUE NONCLUSTERED 
(
	[order_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[service_package_items]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[service_package_items](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[package_id] [bigint] NOT NULL,
	[service_id] [bigint] NOT NULL,
 CONSTRAINT [spi_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[service_packages]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[service_packages](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[package_code] [varchar](30) NOT NULL,
	[package_name] [nvarchar](200) NOT NULL,
	[category_id] [bigint] NULL,
	[applicable_km] [int] NULL,
	[total_price] [decimal](18, 2) NOT NULL,
	[description] [nvarchar](500) NULL,
	[is_active] [bit] NOT NULL,
	[branch_id] [bigint] NOT NULL,
 CONSTRAINT [sp_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [sp_code_uq] UNIQUE NONCLUSTERED 
(
	[package_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[services]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[services](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[service_code] [varchar](30) NOT NULL,
	[service_name] [nvarchar](200) NOT NULL,
	[category_id] [bigint] NULL,
	[unit_price] [decimal](18, 2) NOT NULL,
	[duration_min] [int] NULL,
	[description] [nvarchar](500) NULL,
	[is_active] [bit] NOT NULL,
	[branch_id] [bigint] NOT NULL,
 CONSTRAINT [svc_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [svc_code_uq] UNIQUE NONCLUSTERED 
(
	[service_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[specialties]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[specialties](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[specialty_code] [varchar](20) NOT NULL,
	[specialty_name] [nvarchar](100) NOT NULL,
 CONSTRAINT [specialties_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [specialties_code_uq] UNIQUE NONCLUSTERED 
(
	[specialty_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[suppliers]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[suppliers](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[supplier_code] [varchar](20) NOT NULL,
	[supplier_name] [nvarchar](150) NOT NULL,
	[contact_name] [nvarchar](100) NULL,
	[phone] [varchar](20) NULL,
	[email] [varchar](100) NULL,
	[address] [nvarchar](255) NULL,
	[tax_code] [varchar](20) NULL,
	[status] [varchar](20) NOT NULL,
 CONSTRAINT [sup_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [sup_code_uq] UNIQUE NONCLUSTERED 
(
	[supplier_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[user_role]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[user_role](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[user_id] [bigint] NOT NULL,
	[role_id] [bigint] NOT NULL,
 CONSTRAINT [ur_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [ur_uq] UNIQUE NONCLUSTERED 
(
	[user_id] ASC,
	[role_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[user_specialty]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[user_specialty](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[user_id] [bigint] NOT NULL,
	[specialty_id] [bigint] NOT NULL,
 CONSTRAINT [us_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [us_uq] UNIQUE NONCLUSTERED 
(
	[user_id] ASC,
	[specialty_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[users]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[users](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[pseudo_id] [varchar](20) NOT NULL,
	[user_name] [nvarchar](250) NOT NULL,
	[email] [varchar](100) MASKED WITH (FUNCTION = 'email()') NULL,
	[user_password] [varchar](250) NOT NULL,
	[first_name] [nvarchar](50) NULL,
	[last_name] [nvarchar](50) NULL,
	[phone] [varchar](20) MASKED WITH (FUNCTION = 'partial(3, "*****", 2)') NULL,
	[branch_id] [bigint] NULL,
	[team_size] [int] NOT NULL,
	[status] [varchar](20) NOT NULL,
	[avatar] [varchar](255) NULL,
	[notes] [nvarchar](500) NULL,
	[created_at] [datetime] NOT NULL,
	[team_leader_id] [bigint] NULL,
 CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [users_code_uq] UNIQUE NONCLUSTERED 
(
	[pseudo_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Index [idx_ct_customer]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_ct_customer] ON [dbo].[contracts]
(
	[customer_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_ct_purchase_date]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_ct_purchase_date] ON [dbo].[contracts]
(
	[purchase_date] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_ct_vehicle]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_ct_vehicle] ON [dbo].[contracts]
(
	[vehicle_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_cust_contract]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_cust_contract] ON [dbo].[customers]
(
	[contract_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [idx_cust_phone]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_cust_phone] ON [dbo].[customers]
(
	[phone] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_it_date]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_it_date] ON [dbo].[inventory_transactions]
(
	[transaction_date] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [idx_it_type]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_it_type] ON [dbo].[inventory_transactions]
(
	[transaction_type] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_mr_due_date]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_mr_due_date] ON [dbo].[maintenance_reminders]
(
	[due_date] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_products_branch]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_products_branch] ON [dbo].[products]
(
	[branch_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [idx_products_code]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_products_code] ON [dbo].[products]
(
	[product_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [idx_products_name]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_products_name] ON [dbo].[products]
(
	[product_name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [idx_products_status]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_products_status] ON [dbo].[products]
(
	[status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_products_supplier]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_products_supplier] ON [dbo].[products]
(
	[supplier_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_soi_order]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_soi_order] ON [dbo].[service_order_items]
(
	[service_order_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_so_branch]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_so_branch] ON [dbo].[service_orders]
(
	[branch_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_so_customer]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_so_customer] ON [dbo].[service_orders]
(
	[customer_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [idx_so_status]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_so_status] ON [dbo].[service_orders]
(
	[status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_so_vehicle]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_so_vehicle] ON [dbo].[service_orders]
(
	[vehicle_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_service_packages_branch]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_service_packages_branch] ON [dbo].[service_packages]
(
	[branch_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_services_branch]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_services_branch] ON [dbo].[services]
(
	[branch_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [users_email_uq]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE UNIQUE NONCLUSTERED INDEX [users_email_uq] ON [dbo].[users]
(
	[email] ASC
)
WHERE ([email] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_vehicles_brand]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_vehicles_brand] ON [dbo].[vehicles]
(
	[brand_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_vehicles_customer]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_vehicles_customer] ON [dbo].[vehicles]
(
	[customer_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [idx_vehicles_plate]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_vehicles_plate] ON [dbo].[vehicles]
(
	[license_plate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [idx_wr_vehicle]    Script Date: 7/12/2026 12:12:59 AM ******/
CREATE NONCLUSTERED INDEX [idx_wr_vehicle] ON [dbo].[warranty_records]
(
	[vehicle_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[after_service_care] ADD  DEFAULT ('pending') FOR [status]
GO
ALTER TABLE [dbo].[after_service_care] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[audit_logs] ADD  DEFAULT (getdate()) FOR [logged_at]
GO
ALTER TABLE [dbo].[branches] ADD  DEFAULT ((1)) FOR [is_active]
GO
ALTER TABLE [dbo].[contracts] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[customer_feedback] ADD  DEFAULT (getdate()) FOR [feedback_date]
GO
ALTER TABLE [dbo].[customer_feedback] ADD  DEFAULT ((0)) FOR [is_resolved]
GO
ALTER TABLE [dbo].[customers] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[import_request_items] ADD  DEFAULT ((0)) FOR [quantity]
GO
ALTER TABLE [dbo].[import_requests] ADD  DEFAULT ('pending') FOR [status]
GO
ALTER TABLE [dbo].[import_requests] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[inventory_transactions] ADD  DEFAULT ('completed') FOR [status]
GO
ALTER TABLE [dbo].[invoices] ADD  DEFAULT ((0)) FOR [amount]
GO
ALTER TABLE [dbo].[invoices] ADD  DEFAULT ((0)) FOR [paid]
GO
ALTER TABLE [dbo].[invoices] ADD  DEFAULT ('unpaid') FOR [status]
GO
ALTER TABLE [dbo].[invoices] ADD  DEFAULT (getdate()) FOR [issued_at]
GO
ALTER TABLE [dbo].[maintenance_reminders] ADD  DEFAULT ((0)) FOR [is_sent]
GO
ALTER TABLE [dbo].[maintenance_reminders] ADD  DEFAULT ((0)) FOR [is_confirmed]
GO
ALTER TABLE [dbo].[maintenance_reminders] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[products] ADD  DEFAULT (N'Cái') FOR [unit]
GO
ALTER TABLE [dbo].[products] ADD  DEFAULT ((0)) FOR [stock_quantity]
GO
ALTER TABLE [dbo].[products] ADD  DEFAULT ((0)) FOR [min_stock]
GO
ALTER TABLE [dbo].[products] ADD  DEFAULT ('active') FOR [status]
GO
ALTER TABLE [dbo].[repair_order_tasks] ADD  DEFAULT ('DV') FOR [task_type]
GO
ALTER TABLE [dbo].[repair_order_tasks] ADD  DEFAULT ((1)) FOR [quantity]
GO
ALTER TABLE [dbo].[repair_order_tasks] ADD  DEFAULT ((0)) FOR [is_done]
GO
ALTER TABLE [dbo].[repair_orders] ADD  DEFAULT ('inprogress') FOR [status]
GO
ALTER TABLE [dbo].[repair_orders] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[service_order_items] ADD  DEFAULT ((1)) FOR [quantity]
GO
ALTER TABLE [dbo].[service_order_items] ADD  DEFAULT ((0)) FOR [unit_price]
GO
ALTER TABLE [dbo].[service_order_items] ADD  DEFAULT ((0)) FOR [discount_pct]
GO
ALTER TABLE [dbo].[service_order_items] ADD  DEFAULT ((0)) FOR [is_free]
GO
ALTER TABLE [dbo].[service_order_items] ADD  DEFAULT ((0)) FOR [total]
GO
ALTER TABLE [dbo].[service_orders] ADD  DEFAULT ('waiting_repair') FOR [status]
GO
ALTER TABLE [dbo].[service_orders] ADD  DEFAULT ((0)) FOR [subtotal]
GO
ALTER TABLE [dbo].[service_orders] ADD  DEFAULT ((0)) FOR [discount_amount]
GO
ALTER TABLE [dbo].[service_orders] ADD  DEFAULT ((0)) FOR [after_discount]
GO
ALTER TABLE [dbo].[service_orders] ADD  DEFAULT ((0)) FOR [vat]
GO
ALTER TABLE [dbo].[service_orders] ADD  DEFAULT ((0)) FOR [free_amount]
GO
ALTER TABLE [dbo].[service_orders] ADD  DEFAULT ((0)) FOR [total]
GO
ALTER TABLE [dbo].[service_orders] ADD  DEFAULT ((0)) FOR [is_warranty]
GO
ALTER TABLE [dbo].[service_orders] ADD  DEFAULT (getdate()) FOR [intake_date]
GO
ALTER TABLE [dbo].[service_packages] ADD  DEFAULT ((0)) FOR [total_price]
GO
ALTER TABLE [dbo].[service_packages] ADD  DEFAULT ((1)) FOR [is_active]
GO
ALTER TABLE [dbo].[services] ADD  DEFAULT ((0)) FOR [unit_price]
GO
ALTER TABLE [dbo].[services] ADD  DEFAULT ((1)) FOR [is_active]
GO
ALTER TABLE [dbo].[suppliers] ADD  DEFAULT ('active') FOR [status]
GO
ALTER TABLE [dbo].[users] ADD  DEFAULT ((0)) FOR [team_size]
GO
ALTER TABLE [dbo].[users] ADD  DEFAULT ('active') FOR [status]
GO
ALTER TABLE [dbo].[users] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[vehicles] ADD  DEFAULT ((0)) FOR [current_km]
GO
ALTER TABLE [dbo].[after_service_care]  WITH CHECK ADD  CONSTRAINT [asc_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[after_service_care] CHECK CONSTRAINT [asc_branch_fkey]
GO
ALTER TABLE [dbo].[after_service_care]  WITH CHECK ADD  CONSTRAINT [asc_cust_fkey] FOREIGN KEY([customer_id])
REFERENCES [dbo].[customers] ([id])
GO
ALTER TABLE [dbo].[after_service_care] CHECK CONSTRAINT [asc_cust_fkey]
GO
ALTER TABLE [dbo].[after_service_care]  WITH CHECK ADD  CONSTRAINT [asc_so_fkey] FOREIGN KEY([service_order_id])
REFERENCES [dbo].[service_orders] ([id])
GO
ALTER TABLE [dbo].[after_service_care] CHECK CONSTRAINT [asc_so_fkey]
GO
ALTER TABLE [dbo].[after_service_care]  WITH CHECK ADD  CONSTRAINT [asc_user_fkey] FOREIGN KEY([done_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[after_service_care] CHECK CONSTRAINT [asc_user_fkey]
GO
ALTER TABLE [dbo].[branches]  WITH CHECK ADD  CONSTRAINT [branches_manager_fkey] FOREIGN KEY([manager_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[branches] CHECK CONSTRAINT [branches_manager_fkey]
GO
ALTER TABLE [dbo].[contracts]  WITH CHECK ADD  CONSTRAINT [ct_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[contracts] CHECK CONSTRAINT [ct_branch_fkey]
GO
ALTER TABLE [dbo].[contracts]  WITH CHECK ADD  CONSTRAINT [ct_brand_fkey] FOREIGN KEY([brand_id])
REFERENCES [dbo].[brands] ([id])
GO
ALTER TABLE [dbo].[contracts] CHECK CONSTRAINT [ct_brand_fkey]
GO
ALTER TABLE [dbo].[contracts]  WITH CHECK ADD  CONSTRAINT [ct_customer_fkey] FOREIGN KEY([customer_id])
REFERENCES [dbo].[customers] ([id])
GO
ALTER TABLE [dbo].[contracts] CHECK CONSTRAINT [ct_customer_fkey]
GO
ALTER TABLE [dbo].[contracts]  WITH CHECK ADD  CONSTRAINT [ct_user_fkey] FOREIGN KEY([created_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[contracts] CHECK CONSTRAINT [ct_user_fkey]
GO
ALTER TABLE [dbo].[contracts]  WITH CHECK ADD  CONSTRAINT [ct_vehicle_fkey] FOREIGN KEY([vehicle_id])
REFERENCES [dbo].[vehicles] ([id])
GO
ALTER TABLE [dbo].[contracts] CHECK CONSTRAINT [ct_vehicle_fkey]
GO
ALTER TABLE [dbo].[customer_feedback]  WITH CHECK ADD  CONSTRAINT [cf_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[customer_feedback] CHECK CONSTRAINT [cf_branch_fkey]
GO
ALTER TABLE [dbo].[customer_feedback]  WITH CHECK ADD  CONSTRAINT [cf_cust_fkey] FOREIGN KEY([customer_id])
REFERENCES [dbo].[customers] ([id])
GO
ALTER TABLE [dbo].[customer_feedback] CHECK CONSTRAINT [cf_cust_fkey]
GO
ALTER TABLE [dbo].[customer_feedback]  WITH CHECK ADD  CONSTRAINT [cf_so_fkey] FOREIGN KEY([service_order_id])
REFERENCES [dbo].[service_orders] ([id])
GO
ALTER TABLE [dbo].[customer_feedback] CHECK CONSTRAINT [cf_so_fkey]
GO
ALTER TABLE [dbo].[customer_feedback]  WITH CHECK ADD  CONSTRAINT [cf_user_fkey] FOREIGN KEY([resolved_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[customer_feedback] CHECK CONSTRAINT [cf_user_fkey]
GO
ALTER TABLE [dbo].[customers]  WITH CHECK ADD  CONSTRAINT [customers_ct_fkey] FOREIGN KEY([contract_id])
REFERENCES [dbo].[contracts] ([id])
GO
ALTER TABLE [dbo].[customers] CHECK CONSTRAINT [customers_ct_fkey]
GO
ALTER TABLE [dbo].[import_request_items]  WITH CHECK ADD  CONSTRAINT [iri_product_fkey] FOREIGN KEY([product_id])
REFERENCES [dbo].[products] ([id])
GO
ALTER TABLE [dbo].[import_request_items] CHECK CONSTRAINT [iri_product_fkey]
GO
ALTER TABLE [dbo].[import_request_items]  WITH CHECK ADD  CONSTRAINT [iri_request_fkey] FOREIGN KEY([import_request_id])
REFERENCES [dbo].[import_requests] ([id])
GO
ALTER TABLE [dbo].[import_request_items] CHECK CONSTRAINT [iri_request_fkey]
GO
ALTER TABLE [dbo].[import_requests]  WITH CHECK ADD  CONSTRAINT [ir_apv_fkey] FOREIGN KEY([approved_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[import_requests] CHECK CONSTRAINT [ir_apv_fkey]
GO
ALTER TABLE [dbo].[import_requests]  WITH CHECK ADD  CONSTRAINT [ir_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[import_requests] CHECK CONSTRAINT [ir_branch_fkey]
GO
ALTER TABLE [dbo].[import_requests]  WITH CHECK ADD  CONSTRAINT [ir_req_fkey] FOREIGN KEY([requested_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[import_requests] CHECK CONSTRAINT [ir_req_fkey]
GO
ALTER TABLE [dbo].[import_requests]  WITH CHECK ADD  CONSTRAINT [ir_supplier_fkey] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[import_requests] CHECK CONSTRAINT [ir_supplier_fkey]
GO
ALTER TABLE [dbo].[inventory_transactions]  WITH CHECK ADD  CONSTRAINT [it_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[inventory_transactions] CHECK CONSTRAINT [it_branch_fkey]
GO
ALTER TABLE [dbo].[inventory_transactions]  WITH CHECK ADD  CONSTRAINT [it_import_fkey] FOREIGN KEY([import_request_id])
REFERENCES [dbo].[import_requests] ([id])
GO
ALTER TABLE [dbo].[inventory_transactions] CHECK CONSTRAINT [it_import_fkey]
GO
ALTER TABLE [dbo].[inventory_transactions]  WITH CHECK ADD  CONSTRAINT [it_leader_fkey] FOREIGN KEY([team_leader_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[inventory_transactions] CHECK CONSTRAINT [it_leader_fkey]
GO
ALTER TABLE [dbo].[inventory_transactions]  WITH CHECK ADD  CONSTRAINT [it_product_fkey] FOREIGN KEY([product_id])
REFERENCES [dbo].[products] ([id])
GO
ALTER TABLE [dbo].[inventory_transactions] CHECK CONSTRAINT [it_product_fkey]
GO
ALTER TABLE [dbo].[inventory_transactions]  WITH CHECK ADD  CONSTRAINT [it_so_fkey] FOREIGN KEY([service_order_id])
REFERENCES [dbo].[service_orders] ([id])
GO
ALTER TABLE [dbo].[inventory_transactions] CHECK CONSTRAINT [it_so_fkey]
GO
ALTER TABLE [dbo].[inventory_transactions]  WITH CHECK ADD  CONSTRAINT [it_user_fkey] FOREIGN KEY([performed_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[inventory_transactions] CHECK CONSTRAINT [it_user_fkey]
GO
ALTER TABLE [dbo].[invoices]  WITH CHECK ADD  CONSTRAINT [inv_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[invoices] CHECK CONSTRAINT [inv_branch_fkey]
GO
ALTER TABLE [dbo].[invoices]  WITH CHECK ADD  CONSTRAINT [inv_cust_fkey] FOREIGN KEY([customer_id])
REFERENCES [dbo].[customers] ([id])
GO
ALTER TABLE [dbo].[invoices] CHECK CONSTRAINT [inv_cust_fkey]
GO
ALTER TABLE [dbo].[invoices]  WITH CHECK ADD  CONSTRAINT [inv_so_fkey] FOREIGN KEY([service_order_id])
REFERENCES [dbo].[service_orders] ([id])
GO
ALTER TABLE [dbo].[invoices] CHECK CONSTRAINT [inv_so_fkey]
GO
ALTER TABLE [dbo].[invoices]  WITH CHECK ADD  CONSTRAINT [inv_user_fkey] FOREIGN KEY([issued_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[invoices] CHECK CONSTRAINT [inv_user_fkey]
GO
ALTER TABLE [dbo].[maintenance_reminders]  WITH CHECK ADD  CONSTRAINT [mr_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[maintenance_reminders] CHECK CONSTRAINT [mr_branch_fkey]
GO
ALTER TABLE [dbo].[maintenance_reminders]  WITH CHECK ADD  CONSTRAINT [mr_cust_fkey] FOREIGN KEY([customer_id])
REFERENCES [dbo].[customers] ([id])
GO
ALTER TABLE [dbo].[maintenance_reminders] CHECK CONSTRAINT [mr_cust_fkey]
GO
ALTER TABLE [dbo].[maintenance_reminders]  WITH CHECK ADD  CONSTRAINT [mr_vehicle_fkey] FOREIGN KEY([vehicle_id])
REFERENCES [dbo].[vehicles] ([id])
GO
ALTER TABLE [dbo].[maintenance_reminders] CHECK CONSTRAINT [mr_vehicle_fkey]
GO
ALTER TABLE [dbo].[products]  WITH CHECK ADD  CONSTRAINT [products_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[products] CHECK CONSTRAINT [products_branch_fkey]
GO
ALTER TABLE [dbo].[products]  WITH CHECK ADD  CONSTRAINT [products_brand_fkey] FOREIGN KEY([compatible_brand_id])
REFERENCES [dbo].[brands] ([id])
GO
ALTER TABLE [dbo].[products] CHECK CONSTRAINT [products_brand_fkey]
GO
ALTER TABLE [dbo].[products]  WITH CHECK ADD  CONSTRAINT [products_sup_fkey] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[products] CHECK CONSTRAINT [products_sup_fkey]
GO
ALTER TABLE [dbo].[repair_order_tasks]  WITH CHECK ADD  CONSTRAINT [rot_order_fkey] FOREIGN KEY([repair_order_id])
REFERENCES [dbo].[repair_orders] ([id])
GO
ALTER TABLE [dbo].[repair_order_tasks] CHECK CONSTRAINT [rot_order_fkey]
GO
ALTER TABLE [dbo].[repair_order_tasks]  WITH CHECK ADD  CONSTRAINT [rot_product_fkey] FOREIGN KEY([product_id])
REFERENCES [dbo].[products] ([id])
GO
ALTER TABLE [dbo].[repair_order_tasks] CHECK CONSTRAINT [rot_product_fkey]
GO
ALTER TABLE [dbo].[repair_orders]  WITH CHECK ADD  CONSTRAINT [ro_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[repair_orders] CHECK CONSTRAINT [ro_branch_fkey]
GO
ALTER TABLE [dbo].[repair_orders]  WITH CHECK ADD  CONSTRAINT [ro_creator_fkey] FOREIGN KEY([created_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[repair_orders] CHECK CONSTRAINT [ro_creator_fkey]
GO
ALTER TABLE [dbo].[repair_orders]  WITH CHECK ADD  CONSTRAINT [ro_leader_fkey] FOREIGN KEY([team_leader_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[repair_orders] CHECK CONSTRAINT [ro_leader_fkey]
GO
ALTER TABLE [dbo].[repair_orders]  WITH CHECK ADD  CONSTRAINT [ro_so_fkey] FOREIGN KEY([service_order_id])
REFERENCES [dbo].[service_orders] ([id])
GO
ALTER TABLE [dbo].[repair_orders] CHECK CONSTRAINT [ro_so_fkey]
GO
ALTER TABLE [dbo].[repair_orders]  WITH CHECK ADD  CONSTRAINT [ro_vehicle_fkey] FOREIGN KEY([vehicle_id])
REFERENCES [dbo].[vehicles] ([id])
GO
ALTER TABLE [dbo].[repair_orders] CHECK CONSTRAINT [ro_vehicle_fkey]
GO
ALTER TABLE [dbo].[service_order_items]  WITH CHECK ADD  CONSTRAINT [soi_order_fkey] FOREIGN KEY([service_order_id])
REFERENCES [dbo].[service_orders] ([id])
GO
ALTER TABLE [dbo].[service_order_items] CHECK CONSTRAINT [soi_order_fkey]
GO
ALTER TABLE [dbo].[service_order_items]  WITH CHECK ADD  CONSTRAINT [soi_product_fkey] FOREIGN KEY([product_id])
REFERENCES [dbo].[products] ([id])
GO
ALTER TABLE [dbo].[service_order_items] CHECK CONSTRAINT [soi_product_fkey]
GO
ALTER TABLE [dbo].[service_order_items]  WITH CHECK ADD  CONSTRAINT [soi_service_fkey] FOREIGN KEY([service_id])
REFERENCES [dbo].[services] ([id])
GO
ALTER TABLE [dbo].[service_order_items] CHECK CONSTRAINT [soi_service_fkey]
GO
ALTER TABLE [dbo].[service_orders]  WITH CHECK ADD  CONSTRAINT [so_advisor_fkey] FOREIGN KEY([advisor_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[service_orders] CHECK CONSTRAINT [so_advisor_fkey]
GO
ALTER TABLE [dbo].[service_orders]  WITH CHECK ADD  CONSTRAINT [so_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[service_orders] CHECK CONSTRAINT [so_branch_fkey]
GO
ALTER TABLE [dbo].[service_orders]  WITH CHECK ADD  CONSTRAINT [so_customer_fkey] FOREIGN KEY([customer_id])
REFERENCES [dbo].[customers] ([id])
GO
ALTER TABLE [dbo].[service_orders] CHECK CONSTRAINT [so_customer_fkey]
GO
ALTER TABLE [dbo].[service_orders]  WITH CHECK ADD  CONSTRAINT [so_leader_fkey] FOREIGN KEY([team_leader_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[service_orders] CHECK CONSTRAINT [so_leader_fkey]
GO
ALTER TABLE [dbo].[service_orders]  WITH CHECK ADD  CONSTRAINT [so_vehicle_fkey] FOREIGN KEY([vehicle_id])
REFERENCES [dbo].[vehicles] ([id])
GO
ALTER TABLE [dbo].[service_orders] CHECK CONSTRAINT [so_vehicle_fkey]
GO
ALTER TABLE [dbo].[service_package_items]  WITH CHECK ADD  CONSTRAINT [spi_package_fkey] FOREIGN KEY([package_id])
REFERENCES [dbo].[service_packages] ([id])
GO
ALTER TABLE [dbo].[service_package_items] CHECK CONSTRAINT [spi_package_fkey]
GO
ALTER TABLE [dbo].[service_package_items]  WITH CHECK ADD  CONSTRAINT [spi_service_fkey] FOREIGN KEY([service_id])
REFERENCES [dbo].[services] ([id])
GO
ALTER TABLE [dbo].[service_package_items] CHECK CONSTRAINT [spi_service_fkey]
GO
ALTER TABLE [dbo].[service_packages]  WITH CHECK ADD  CONSTRAINT [service_packages_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[service_packages] CHECK CONSTRAINT [service_packages_branch_fkey]
GO
ALTER TABLE [dbo].[service_packages]  WITH CHECK ADD  CONSTRAINT [sp_cat_fkey] FOREIGN KEY([category_id])
REFERENCES [dbo].[service_categories] ([id])
GO
ALTER TABLE [dbo].[service_packages] CHECK CONSTRAINT [sp_cat_fkey]
GO
ALTER TABLE [dbo].[services]  WITH CHECK ADD  CONSTRAINT [services_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[services] CHECK CONSTRAINT [services_branch_fkey]
GO
ALTER TABLE [dbo].[services]  WITH CHECK ADD  CONSTRAINT [svc_cat_fkey] FOREIGN KEY([category_id])
REFERENCES [dbo].[service_categories] ([id])
GO
ALTER TABLE [dbo].[services] CHECK CONSTRAINT [svc_cat_fkey]
GO
ALTER TABLE [dbo].[user_role]  WITH CHECK ADD  CONSTRAINT [ur_role_fkey] FOREIGN KEY([role_id])
REFERENCES [dbo].[roles] ([id])
GO
ALTER TABLE [dbo].[user_role] CHECK CONSTRAINT [ur_role_fkey]
GO
ALTER TABLE [dbo].[user_role]  WITH CHECK ADD  CONSTRAINT [ur_user_fkey] FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[user_role] CHECK CONSTRAINT [ur_user_fkey]
GO
ALTER TABLE [dbo].[user_specialty]  WITH CHECK ADD  CONSTRAINT [us_specialty_fkey] FOREIGN KEY([specialty_id])
REFERENCES [dbo].[specialties] ([id])
GO
ALTER TABLE [dbo].[user_specialty] CHECK CONSTRAINT [us_specialty_fkey]
GO
ALTER TABLE [dbo].[user_specialty]  WITH CHECK ADD  CONSTRAINT [us_user_fkey] FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[user_specialty] CHECK CONSTRAINT [us_user_fkey]
GO
ALTER TABLE [dbo].[users]  WITH CHECK ADD  CONSTRAINT [users_branch_fkey] FOREIGN KEY([branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[users] CHECK CONSTRAINT [users_branch_fkey]
GO
ALTER TABLE [dbo].[users]  WITH CHECK ADD  CONSTRAINT [users_team_leader_fkey] FOREIGN KEY([team_leader_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[users] CHECK CONSTRAINT [users_team_leader_fkey]
GO
ALTER TABLE [dbo].[vehicles]  WITH CHECK ADD  CONSTRAINT [vehicles_brand_fkey] FOREIGN KEY([brand_id])
REFERENCES [dbo].[brands] ([id])
GO
ALTER TABLE [dbo].[vehicles] CHECK CONSTRAINT [vehicles_brand_fkey]
GO
ALTER TABLE [dbo].[vehicles]  WITH CHECK ADD  CONSTRAINT [vehicles_cust_fkey] FOREIGN KEY([customer_id])
REFERENCES [dbo].[customers] ([id])
GO
ALTER TABLE [dbo].[vehicles] CHECK CONSTRAINT [vehicles_cust_fkey]
GO
ALTER TABLE [dbo].[warranty_records]  WITH CHECK ADD  CONSTRAINT [wr_branch_fkey] FOREIGN KEY([purchase_branch_id])
REFERENCES [dbo].[branches] ([id])
GO
ALTER TABLE [dbo].[warranty_records] CHECK CONSTRAINT [wr_branch_fkey]
GO
ALTER TABLE [dbo].[warranty_records]  WITH CHECK ADD  CONSTRAINT [wr_brand_fkey] FOREIGN KEY([brand_id])
REFERENCES [dbo].[brands] ([id])
GO
ALTER TABLE [dbo].[warranty_records] CHECK CONSTRAINT [wr_brand_fkey]
GO
ALTER TABLE [dbo].[warranty_records]  WITH CHECK ADD  CONSTRAINT [wr_vehicle_fkey] FOREIGN KEY([vehicle_id])
REFERENCES [dbo].[vehicles] ([id])
GO
ALTER TABLE [dbo].[warranty_records] CHECK CONSTRAINT [wr_vehicle_fkey]
GO
ALTER TABLE [dbo].[users]  WITH CHECK ADD  CONSTRAINT [users_no_self_leader_chk] CHECK  (([team_leader_id] IS NULL OR [team_leader_id]<>[id]))
GO
ALTER TABLE [dbo].[users] CHECK CONSTRAINT [users_no_self_leader_chk]
GO
/****** Object:  StoredProcedure [dbo].[sp_check_warranty]    Script Date: 7/12/2026 12:12:59 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
--  PHẦN 10: STORED PROCEDURE – Kiểm tra bảo hành
-- ============================================================

-- Dùng khi xe vào sửa: truyền biển số xe, trả về kết quả bảo hành
CREATE PROCEDURE [dbo].[sp_check_warranty]
    @license_plate VARCHAR(20)
AS
BEGIN
    SELECT
        ws.vehicle_id,
        ws.license_plate,
        ws.frame_number,
        ws.vehicle_model_text,
        ws.current_km,
        ws.brand_name,
        ws.warranty_years,
        ws.max_warranty_km,
        ws.purchase_date,
        ws.warranty_end_date,
        ws.warranty_km_limit,
        ws.within_warranty_period,
        ws.within_warranty_km,
        ws.is_under_warranty,
        ws.days_remaining,
        ws.km_remaining,
        ws.purchase_branch_name,
        ws.current_owner,
        ws.owner_phone,
        CASE ws.is_under_warranty
            WHEN 1 THEN N'Xe con trong thoi han bao hanh'
            ELSE        N'Xe da het bao hanh'
        END AS warranty_message
    FROM v_warranty_status ws
    WHERE ws.license_plate = @license_plate;
END;
GO
USE [master]
GO
ALTER DATABASE [AutoGaraDB] SET  READ_WRITE 
GO


