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

-- ============================================================
--  PHẦN 1: NỀN TẢNG (Hãng xe, Chi nhánh, Phân quyền)
-- ============================================================

-- ------------------------------------------------------------
--  1.1  BRANDS – Hãng xe (Mazda & Kia, dữ liệu fix cứng)
--       warranty_years : số năm bảo hành tính từ ngày mua
--       warranty_km    : số km bảo hành
--  Kiểm tra bảo hành: còn BH khi CẢ HAI điều kiện đều thỏa
-- ------------------------------------------------------------
CREATE TABLE brands (
    id             BIGINT IDENTITY(1,1) NOT NULL,
    brand_code     VARCHAR(20)          NOT NULL,
    brand_name     NVARCHAR(100)        NOT NULL,
    logo_url       VARCHAR(255)             NULL,
    warranty_years INT                  NOT NULL,   -- năm bảo hành
    warranty_km    INT                  NOT NULL,   -- km bảo hành
    CONSTRAINT brands_pkey    PRIMARY KEY (id),
    CONSTRAINT brands_code_uq UNIQUE (brand_code)
);

-- Dữ liệu cố định 2 hãng ủy quyền
INSERT INTO brands (brand_code, brand_name, warranty_years, warranty_km) VALUES
    ('MAZDA', N'Mazda', 5, 100000),   -- Mazda: 5 năm hoặc 100.000 km
    ('KIA',   N'Kia',   5, 150000);   -- Kia  : 5 năm hoặc 150.000 km
GO

-- ------------------------------------------------------------
--  1.2  BRANCHES – Chi nhánh
-- ------------------------------------------------------------
CREATE TABLE branches (
    id           BIGINT IDENTITY(1,1) NOT NULL,
    branch_code  VARCHAR(20)          NOT NULL,
    branch_name  NVARCHAR(150)        NOT NULL,
    address      NVARCHAR(255)            NULL,
    phone        VARCHAR(20)              NULL,
    email        VARCHAR(100)             NULL,
    manager_id   BIGINT                   NULL,   -- FK → users (set sau)
    is_active    BIT NOT NULL DEFAULT 1,
    CONSTRAINT branches_pkey    PRIMARY KEY (id),
    CONSTRAINT branches_code_uq UNIQUE (branch_code)
);

INSERT INTO branches (branch_code, branch_name, address, phone) VALUES
    ('HN',  N'AutoGara Hà Nội',  N'123 Nguyễn Trãi, Thanh Xuân, Hà Nội',     N'024-3333-1111'),
    ('HCM', N'AutoGara TP.HCM',  N'456 Điện Biên Phủ, Bình Thạnh, TP.HCM',   N'028-3333-2222'),
    ('DNA', N'AutoGara Đà Nẵng', N'789 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',  N'0236-3333-3333');
GO

-- ------------------------------------------------------------
--  1.3  ROLES – Vai trò
-- ------------------------------------------------------------
CREATE TABLE roles (
    id         BIGINT IDENTITY(1,1) NOT NULL,
    role_name  VARCHAR(50)          NOT NULL,   -- khóa hệ thống
    role_label NVARCHAR(100)            NULL,   -- tên hiển thị
    CONSTRAINT roles_pkey    PRIMARY KEY (id),
    CONSTRAINT roles_name_uq UNIQUE (role_name)
);

INSERT INTO roles (role_name, role_label) VALUES
    ('general_director', N'Giám đốc'),
    ('manager',          N'Quản lý chi nhánh'),
    ('warehouse_staff',  N'Nhân viên kho'),
    ('accountant',       N'Kế toán'),
    ('service_advisor',  N'Cố vấn dịch vụ'),
    ('team_leader',      N'Tổ trưởng kỹ thuật');
GO

-- ------------------------------------------------------------
--  1.4  USERS – Nhân viên (gộp cả tổ trưởng kỹ thuật, phân biệt qua user_role)
--       pseudo_id: mã định danh nội bộ (thay cho employee_code / leader_code cũ)
--       specialty, team_size: chỉ có giá trị với nhân viên giữ vai trò team_leader
-- ------------------------------------------------------------
CREATE TABLE users (
    id            BIGINT IDENTITY(1,1) NOT NULL,
    pseudo_id     VARCHAR(20)          NOT NULL,   -- mã định danh (VD: NV-HN-001, TT-HN-001)
    user_name     NVARCHAR(250)        NOT NULL,
    email         VARCHAR(100)             NULL,
    user_password VARCHAR(250)         NOT NULL,
    first_name    NVARCHAR(50)             NULL,
    last_name     NVARCHAR(50)             NULL,
    phone         VARCHAR(20)              NULL,
    branch_id     BIGINT                   NULL,
    specialty     NVARCHAR(100)            NULL,   -- chuyên môn (chỉ dùng cho tổ trưởng: Động cơ, Điện tử, Gầm-Phanh...)
    team_size     INT         NOT NULL DEFAULT 0,  -- số nhân viên trong tổ (chỉ dùng cho tổ trưởng)
    status        VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | inactive
    avatar        VARCHAR(255)             NULL,
    notes         NVARCHAR(500)            NULL,
    created_at    DATETIME    NOT NULL DEFAULT GETDATE(),
    CONSTRAINT users_pkey        PRIMARY KEY (id),
    CONSTRAINT users_code_uq     UNIQUE (pseudo_id),
    CONSTRAINT users_email_uq    UNIQUE (email),
    CONSTRAINT users_branch_fkey FOREIGN KEY (branch_id) REFERENCES branches(id)
);
GO

-- Liên kết manager_id sau khi có bảng users
ALTER TABLE branches
    ADD CONSTRAINT branches_manager_fkey FOREIGN KEY (manager_id) REFERENCES users(id);
GO

-- ------------------------------------------------------------
--  1.5  USER_ROLE – Một nhân viên có thể có nhiều vai trò
-- ------------------------------------------------------------
CREATE TABLE user_role (
    id      BIGINT IDENTITY(1,1) NOT NULL,
    user_id BIGINT               NOT NULL,
    role_id BIGINT               NOT NULL,
    CONSTRAINT ur_pkey      PRIMARY KEY (id),
    CONSTRAINT ur_uq        UNIQUE (user_id, role_id),
    CONSTRAINT ur_user_fkey FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT ur_role_fkey FOREIGN KEY (role_id) REFERENCES roles(id)
);
GO

-- ============================================================
--  PHẦN 2: KHÁCH HÀNG & XE
-- ============================================================

-- ------------------------------------------------------------
--  2.1  CONTRACTS – Hợp đồng mua xe
--       Mỗi hợp đồng = 1 khách hàng mua 1 xe từ đại lý Mazda/Kia.
--       Là nguồn gốc dữ liệu khách hàng & xe khi import từ Excel:
--         - Import thủ công: nhập từng hợp đồng một
--         - Import hàng loạt: mỗi dòng Excel = 1 hợp đồng, lưu file_name để trace
--       Từ hợp đồng → tạo customers, vehicles, vehicle_ownership, warranty_records
-- ------------------------------------------------------------
CREATE TABLE contracts (
    id              BIGINT IDENTITY(1,1) NOT NULL,
    contract_code   VARCHAR(50)          NOT NULL,   -- mã hợp đồng gốc từ đại lý
    branch_id       BIGINT                   NULL,   -- chi nhánh AutoGara quản lý
    brand_id        BIGINT                   NULL,   -- hãng xe trong hợp đồng
    customer_id     BIGINT                   NULL,   -- FK → customers (set sau khi tạo KH)
    vehicle_id      BIGINT                   NULL,   -- FK → vehicles (set sau khi tạo xe)
    purchase_date   DATE                 NOT NULL,   -- ngày ký hợp đồng / ngày mua xe
    sale_price      DECIMAL(18,2)            NULL,   -- giá mua xe (nếu có)
    dealership_name NVARCHAR(200)            NULL,   -- tên đại lý bán xe (có thể khác AutoGara)
    created_by      BIGINT                   NULL,   -- nhân viên nhập hợp đồng vào hệ thống
    import_file     NVARCHAR(255)            NULL,   -- tên file Excel (nếu import hàng loạt, NULL nếu nhập tay)
    notes           NVARCHAR(500)            NULL,
    created_at      DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT ct_pkey         PRIMARY KEY (id),
    CONSTRAINT ct_code_uq      UNIQUE (contract_code),
    CONSTRAINT ct_brand_fkey   FOREIGN KEY (brand_id)   REFERENCES brands(id),
    CONSTRAINT ct_branch_fkey  FOREIGN KEY (branch_id)  REFERENCES branches(id),
    CONSTRAINT ct_user_fkey    FOREIGN KEY (created_by) REFERENCES users(id)
    -- customer_id, vehicle_id FK thêm sau (circular dependency)
);
GO

-- ------------------------------------------------------------
--  2.2  CUSTOMERS – Khách hàng
--       Có thể tạo thủ công hoặc sinh ra từ import hợp đồng (Excel).
--       avatar_url: đường dẫn ảnh khách hàng.
-- ------------------------------------------------------------
CREATE TABLE customers (
    id            BIGINT IDENTITY(1,1) NOT NULL,
    customer_code VARCHAR(20)              NULL,
    full_name     NVARCHAR(150)        NOT NULL,
    phone         VARCHAR(20)          NOT NULL,
    email         VARCHAR(100)             NULL,
    cccd          VARCHAR(20)              NULL,   -- CCCD/CMND
    date_of_birth DATE                     NULL,
    address       NVARCHAR(255)            NULL,
    tax_code      VARCHAR(20)              NULL,   -- MST (mã số thuế doanh nghiệp)
    contact_name  NVARCHAR(100)            NULL,   -- Người liên hệ (nếu là công ty)
    contact_phone VARCHAR(20)              NULL,   -- Điện thoại người liên hệ
    avatar_url    VARCHAR(500)             NULL,   -- Đường dẫn ảnh khách hàng
    contract_id   BIGINT                   NULL,   -- Hợp đồng tạo ra KH này (NULL = nhập thủ công)
    created_at    DATETIME    NOT NULL DEFAULT GETDATE(),
    CONSTRAINT customers_pkey      PRIMARY KEY (id),
    CONSTRAINT customers_ct_fkey   FOREIGN KEY (contract_id) REFERENCES contracts(id)
);
GO

-- ------------------------------------------------------------
--  2.3  VEHICLES – Xe
--       customer_id: chủ xe hiện tại. Khi xe đổi chủ chỉ cần UPDATE trường này.
--       Bảo hành vẫn tính theo purchase_date gốc trong warranty_records (không đổi).
--       vehicle_model_text: lưu dạng text tự do (VD: "Mazda CX-8 2.5 Luxury 2022").
-- ------------------------------------------------------------
CREATE TABLE vehicles (
    id                 BIGINT IDENTITY(1,1) NOT NULL,
    license_plate      VARCHAR(20)          NOT NULL,
    brand_id           BIGINT                   NULL,   -- hãng xe (Mazda/Kia)
    customer_id        BIGINT                   NULL,   -- chủ xe hiện tại
    vehicle_model_text NVARCHAR(200)            NULL,   -- tên dòng xe tự do
    frame_number       VARCHAR(50)              NULL,   -- Số khung (VIN – 17 ký tự)
    engine_number      VARCHAR(50)              NULL,   -- Số máy
    manufacture_year   INT                      NULL,   -- Năm sản xuất
    color              NVARCHAR(50)             NULL,
    current_km         INT          NOT NULL DEFAULT 0, -- Số km hiện tại (cập nhật mỗi lần vào)
    CONSTRAINT vehicles_pkey        PRIMARY KEY (id),
    CONSTRAINT vehicles_plate_uq    UNIQUE (license_plate),
    CONSTRAINT vehicles_brand_fkey  FOREIGN KEY (brand_id)   REFERENCES brands(id),
    CONSTRAINT vehicles_cust_fkey   FOREIGN KEY (customer_id) REFERENCES customers(id)
);
GO

-- Bổ sung FK cho contracts → customers và vehicles (sau khi cả 2 bảng đã tạo)
ALTER TABLE contracts
    ADD CONSTRAINT ct_customer_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE contracts
    ADD CONSTRAINT ct_vehicle_fkey  FOREIGN KEY (vehicle_id)  REFERENCES vehicles(id);
GO

-- ============================================================
--  PHẦN 3: BẢO HÀNH
-- ============================================================

-- ------------------------------------------------------------
--  3.1  WARRANTY_RECORDS – Hồ sơ bảo hành từng xe
--       Được tạo khi nhập thông tin xe lần đầu (import Excel hoặc thủ công).
--       purchase_date dùng để tính warranty_end_date = purchase_date + warranty_years.
--       Thông tin bảo hành gốc (warranty_years, warranty_km) lấy từ bảng brands.
-- ------------------------------------------------------------
CREATE TABLE warranty_records (
    id                 BIGINT IDENTITY(1,1) NOT NULL,
    vehicle_id         BIGINT               NOT NULL,
    brand_id           BIGINT               NOT NULL,
    purchase_date      DATE                 NOT NULL,   -- ngày mua xe mới từ đại lý
    purchase_branch_id BIGINT                   NULL,   -- chi nhánh nào bán xe cho khách
    warranty_end_date  DATE                 NOT NULL,   -- = purchase_date + warranty_years
    warranty_km        INT                  NOT NULL,   -- giới hạn km (từ brands.warranty_km)
    notes              NVARCHAR(500)            NULL,
    CONSTRAINT wr_pkey         PRIMARY KEY (id),
    CONSTRAINT wr_vehicle_fkey FOREIGN KEY (vehicle_id)        REFERENCES vehicles(id),
    CONSTRAINT wr_brand_fkey   FOREIGN KEY (brand_id)           REFERENCES brands(id),
    CONSTRAINT wr_branch_fkey  FOREIGN KEY (purchase_branch_id) REFERENCES branches(id)
);
GO

-- ------------------------------------------------------------
--  3.2  VIEW – Kiểm tra bảo hành real-time
--       Dùng khi xe vào sửa: tra theo license_plate hoặc vehicle_id
-- ------------------------------------------------------------
CREATE VIEW v_warranty_status AS
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

-- ============================================================
--  PHẦN 4: TỔ TRƯỞNG KỸ THUẬT
--  (đã gộp vào bảng users – xem mục 1.4; vai trò 'team_leader' trong
--   roles/user_role xác định nhân viên nào là tổ trưởng)
-- ============================================================

-- ============================================================
--  PHẦN 5: DỊCH VỤ & GÓI DỊCH VỤ
-- ============================================================

-- ------------------------------------------------------------
--  5.1  SERVICE_CATEGORIES – Danh mục dịch vụ
-- ------------------------------------------------------------
CREATE TABLE service_categories (
    id            BIGINT IDENTITY(1,1) NOT NULL,
    category_name NVARCHAR(100)        NOT NULL,
    CONSTRAINT sc_pkey PRIMARY KEY (id)
);

INSERT INTO service_categories (category_name) VALUES
    (N'Bảo dưỡng cơ bản'), (N'Phanh & Gầm'), (N'Điện - Điện tử'),
    (N'Điều hòa'), (N'Làm mát'), (N'Truyền động'), (N'Chăm sóc xe'),
    (N'Bảo dưỡng định kỳ');
GO

-- ------------------------------------------------------------
--  5.2  SERVICES – Dịch vụ đơn lẻ
-- ------------------------------------------------------------
CREATE TABLE services (
    id           BIGINT IDENTITY(1,1) NOT NULL,
    service_code VARCHAR(30)          NOT NULL,
    service_name NVARCHAR(200)        NOT NULL,
    category_id  BIGINT                   NULL,
    unit_price   DECIMAL(18,2)        NOT NULL DEFAULT 0,
    duration_min INT                      NULL,   -- thời gian thực hiện (phút)
    description  NVARCHAR(500)            NULL,
    is_active    BIT          NOT NULL DEFAULT 1,
    CONSTRAINT svc_pkey     PRIMARY KEY (id),
    CONSTRAINT svc_code_uq  UNIQUE (service_code),
    CONSTRAINT svc_cat_fkey FOREIGN KEY (category_id) REFERENCES service_categories(id)
);
GO

-- ------------------------------------------------------------
--  5.3  SERVICE_PACKAGES – Gói dịch vụ bảo dưỡng định kỳ
-- ------------------------------------------------------------
CREATE TABLE service_packages (
    id           BIGINT IDENTITY(1,1) NOT NULL,
    package_code VARCHAR(30)          NOT NULL,
    package_name NVARCHAR(200)        NOT NULL,
    category_id  BIGINT                   NULL,
    applicable_km INT                     NULL,   -- áp dụng tại mốc km nào (VD: 5000, 10000)
    total_price  DECIMAL(18,2)        NOT NULL DEFAULT 0,
    description  NVARCHAR(500)            NULL,
    is_active    BIT          NOT NULL DEFAULT 1,
    CONSTRAINT sp_pkey     PRIMARY KEY (id),
    CONSTRAINT sp_code_uq  UNIQUE (package_code),
    CONSTRAINT sp_cat_fkey FOREIGN KEY (category_id) REFERENCES service_categories(id)
);
GO

-- ------------------------------------------------------------
--  5.4  SERVICE_PACKAGE_ITEMS – Chi tiết gói dịch vụ
-- ------------------------------------------------------------
CREATE TABLE service_package_items (
    id         BIGINT IDENTITY(1,1) NOT NULL,
    package_id BIGINT               NOT NULL,
    service_id BIGINT                   NULL,
    item_name  NVARCHAR(200)        NOT NULL,
    unit_price DECIMAL(18,2)        NOT NULL DEFAULT 0,
    CONSTRAINT spi_pkey         PRIMARY KEY (id),
    CONSTRAINT spi_package_fkey FOREIGN KEY (package_id) REFERENCES service_packages(id),
    CONSTRAINT spi_service_fkey FOREIGN KEY (service_id)  REFERENCES services(id)
);
GO

-- ============================================================
--  PHẦN 6: KHO PHỤ TÙNG / SẢN PHẨM
-- ============================================================

-- ------------------------------------------------------------
--  6.1  SUPPLIERS – Nhà cung cấp phụ tùng
-- ------------------------------------------------------------
CREATE TABLE suppliers (
    id            BIGINT IDENTITY(1,1) NOT NULL,
    supplier_code VARCHAR(20)          NOT NULL,
    supplier_name NVARCHAR(150)        NOT NULL,
    contact_name  NVARCHAR(100)            NULL,
    phone         VARCHAR(20)              NULL,
    email         VARCHAR(100)             NULL,
    address       NVARCHAR(255)            NULL,
    tax_code      VARCHAR(20)              NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | inactive
    CONSTRAINT sup_pkey    PRIMARY KEY (id),
    CONSTRAINT sup_code_uq UNIQUE (supplier_code)
);
GO

-- ------------------------------------------------------------
--  6.2  PRODUCTS – Phụ tùng / sản phẩm (tồn kho theo từng chi nhánh)
--       Mỗi chi nhánh quản lý kho độc lập; không chia sẻ giữa chi nhánh.
-- ------------------------------------------------------------
CREATE TABLE products (
    id                  BIGINT IDENTITY(1,1) NOT NULL,
    product_code        VARCHAR(30)          NOT NULL,
    product_name        NVARCHAR(200)        NOT NULL,
    category            NVARCHAR(100)            NULL,
    brand_name          NVARCHAR(100)            NULL,   -- thương hiệu sản phẩm (Bosch, 3M...)
    compatible_brand_id BIGINT                   NULL,   -- tương thích hãng xe nào
    unit                VARCHAR(20) NOT NULL DEFAULT N'Cái',
    supplier_id         BIGINT                   NULL,
    location            VARCHAR(50)              NULL,   -- vị trí kho (VD: K1-A1)
    branch_id           BIGINT               NOT NULL,
    stock_quantity      INT         NOT NULL DEFAULT 0,
    min_stock           INT         NOT NULL DEFAULT 0,  -- ngưỡng cảnh báo sắp hết
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    -- active | low_stock | inactive
    CONSTRAINT products_pkey        PRIMARY KEY (id),
    CONSTRAINT products_code_branch UNIQUE (product_code, branch_id),
    CONSTRAINT products_sup_fkey    FOREIGN KEY (supplier_id)         REFERENCES suppliers(id),
    CONSTRAINT products_branch_fkey FOREIGN KEY (branch_id)           REFERENCES branches(id),
    CONSTRAINT products_brand_fkey  FOREIGN KEY (compatible_brand_id) REFERENCES brands(id)
);
GO

-- ------------------------------------------------------------
--  6.3  IMPORT_REQUESTS – Phiếu yêu cầu nhập kho
-- ------------------------------------------------------------
CREATE TABLE import_requests (
    id                  BIGINT IDENTITY(1,1) NOT NULL,
    request_code        VARCHAR(30)          NOT NULL,
    branch_id           BIGINT               NOT NULL,
    supplier_id         BIGINT                   NULL,
    supplier_invoice_no VARCHAR(50)              NULL,
    requested_by        BIGINT               NOT NULL,
    approved_by         BIGINT                   NULL,
    import_date         DATE                     NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected
    reject_reason       NVARCHAR(500)            NULL,
    notes               NVARCHAR(500)            NULL,
    created_at          DATETIME    NOT NULL DEFAULT GETDATE(),
    CONSTRAINT ir_pkey          PRIMARY KEY (id),
    CONSTRAINT ir_code_uq       UNIQUE (request_code),
    CONSTRAINT ir_branch_fkey   FOREIGN KEY (branch_id)    REFERENCES branches(id),
    CONSTRAINT ir_supplier_fkey FOREIGN KEY (supplier_id)  REFERENCES suppliers(id),
    CONSTRAINT ir_req_fkey      FOREIGN KEY (requested_by) REFERENCES users(id),
    CONSTRAINT ir_apv_fkey      FOREIGN KEY (approved_by)  REFERENCES users(id)
);
GO

-- ------------------------------------------------------------
--  6.4  IMPORT_REQUEST_ITEMS – Chi tiết phiếu nhập kho
-- ------------------------------------------------------------
CREATE TABLE import_request_items (
    id                BIGINT IDENTITY(1,1) NOT NULL,
    import_request_id BIGINT               NOT NULL,
    product_id        BIGINT                   NULL,
    product_code      VARCHAR(30)              NULL,
    product_name      NVARCHAR(200)            NULL,
    unit              VARCHAR(20)              NULL,
    quantity          INT          NOT NULL DEFAULT 0,
    CONSTRAINT iri_pkey         PRIMARY KEY (id),
    CONSTRAINT iri_request_fkey FOREIGN KEY (import_request_id) REFERENCES import_requests(id),
    CONSTRAINT iri_product_fkey FOREIGN KEY (product_id)         REFERENCES products(id)
);
GO

-- ------------------------------------------------------------
--  6.5  INVENTORY_TRANSACTIONS – Lịch sử xuất / nhập kho
-- ------------------------------------------------------------
CREATE TABLE inventory_transactions (
    id               BIGINT IDENTITY(1,1) NOT NULL,
    transaction_code VARCHAR(30)          NOT NULL,
    transaction_type VARCHAR(10)          NOT NULL,   -- import | export
    branch_id        BIGINT               NOT NULL,
    product_id       BIGINT               NOT NULL,
    quantity         INT                  NOT NULL,
    import_request_id BIGINT                  NULL,   -- nhập: liên kết phiếu nhập kho
    service_order_id  BIGINT                  NULL,   -- xuất: liên kết phiếu RO
    team_leader_id    BIGINT                  NULL,   -- xuất cho tổ trưởng nào
    performed_by      BIGINT               NOT NULL,
    transaction_date  DATE                 NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'completed',
    notes             NVARCHAR(500)            NULL,
    CONSTRAINT it_pkey         PRIMARY KEY (id),
    CONSTRAINT it_code_uq      UNIQUE (transaction_code),
    CONSTRAINT it_branch_fkey  FOREIGN KEY (branch_id)         REFERENCES branches(id),
    CONSTRAINT it_product_fkey FOREIGN KEY (product_id)         REFERENCES products(id),
    CONSTRAINT it_import_fkey  FOREIGN KEY (import_request_id)  REFERENCES import_requests(id),
    CONSTRAINT it_user_fkey    FOREIGN KEY (performed_by)       REFERENCES users(id),
    CONSTRAINT it_leader_fkey  FOREIGN KEY (team_leader_id)     REFERENCES users(id)
    -- service_order_id FK thêm sau (tránh circular dependency)
);
GO

-- ============================================================
--  PHẦN 7: TIẾP NHẬN & SỬA CHỮA
-- ============================================================

-- ------------------------------------------------------------
--  7.1  SERVICE_ORDERS – Phiếu quyết toán sửa chữa (RO)
--  Luồng trạng thái:
--    waiting_repair → inprogress → waiting_payment → invoiced
-- ------------------------------------------------------------
CREATE TABLE service_orders (
    id                    BIGINT IDENTITY(1,1) NOT NULL,
    order_code            VARCHAR(30)          NOT NULL,   -- VD: RO-2024-001
    branch_id             BIGINT               NOT NULL,
    vehicle_id            BIGINT               NOT NULL,
    customer_id           BIGINT               NOT NULL,
    advisor_id            BIGINT               NOT NULL,   -- cố vấn dịch vụ
    team_leader_id        BIGINT                   NULL,   -- NULL = chưa gán → Chờ sửa chữa
    customer_request      NVARCHAR(1000)           NULL,   -- yêu cầu của khách
    current_km            INT                      NULL,   -- km khi tiếp nhận
    status                VARCHAR(30) NOT NULL DEFAULT 'waiting_repair',
    -- waiting_repair | inprogress | waiting_payment | invoiced
    subtotal              DECIMAL(18,2) NOT NULL DEFAULT 0,
    discount_amount       DECIMAL(18,2) NOT NULL DEFAULT 0,
    after_discount        DECIMAL(18,2) NOT NULL DEFAULT 0,
    vat                   DECIMAL(18,2) NOT NULL DEFAULT 0,
    free_amount           DECIMAL(18,2) NOT NULL DEFAULT 0,   -- phần bảo hành/hãng đài
    total                 DECIMAL(18,2) NOT NULL DEFAULT 0,
    next_maintenance_km   INT               NULL,
    next_maintenance_date DATE              NULL,
    is_warranty           BIT          NOT NULL DEFAULT 0,    -- xe còn bảo hành khi vào
    intake_date           DATETIME     NOT NULL DEFAULT GETDATE(),
    completed_date        DATETIME             NULL,
    delivery_date         DATE                 NULL,
    CONSTRAINT so_pkey          PRIMARY KEY (id),
    CONSTRAINT so_code_uq       UNIQUE (order_code),
    CONSTRAINT so_branch_fkey   FOREIGN KEY (branch_id)      REFERENCES branches(id),
    CONSTRAINT so_vehicle_fkey  FOREIGN KEY (vehicle_id)     REFERENCES vehicles(id),
    CONSTRAINT so_customer_fkey FOREIGN KEY (customer_id)    REFERENCES customers(id),
    CONSTRAINT so_advisor_fkey  FOREIGN KEY (advisor_id)     REFERENCES users(id),
    CONSTRAINT so_leader_fkey   FOREIGN KEY (team_leader_id) REFERENCES users(id)
);
GO

-- Thêm FK cho inventory_transactions → service_orders
ALTER TABLE inventory_transactions
    ADD CONSTRAINT it_so_fkey FOREIGN KEY (service_order_id) REFERENCES service_orders(id);
GO

-- ------------------------------------------------------------
--  7.2  SERVICE_ORDER_ITEMS – Chi tiết hạng mục trong phiếu RO
--       lhsc: DV (dịch vụ) | PT (phụ tùng) | BH (bảo hành) | HD (hãng đài)
--       httt: KHT (khách hàng trả) | BH | HD | NB (nội bộ)
-- ------------------------------------------------------------
CREATE TABLE service_order_items (
    id               BIGINT IDENTITY(1,1) NOT NULL,
    service_order_id BIGINT               NOT NULL,
    item_type        VARCHAR(10)          NOT NULL,   -- PT | DV
    product_id       BIGINT                   NULL,   -- NULL nếu là dịch vụ
    service_id       BIGINT                   NULL,   -- NULL nếu là phụ tùng
    item_code        VARCHAR(30)              NULL,
    item_description NVARCHAR(300)        NOT NULL,
    lhsc             VARCHAR(10)              NULL,
    httt             VARCHAR(10)              NULL,
    unit             VARCHAR(20)              NULL,
    quantity         INT         NOT NULL DEFAULT 1,
    unit_price       DECIMAL(18,2) NOT NULL DEFAULT 0,
    discount_pct     DECIMAL(5,2)  NOT NULL DEFAULT 0,
    is_free          BIT           NOT NULL DEFAULT 0,
    total            DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT soi_pkey         PRIMARY KEY (id),
    CONSTRAINT soi_order_fkey   FOREIGN KEY (service_order_id) REFERENCES service_orders(id),
    CONSTRAINT soi_product_fkey FOREIGN KEY (product_id)        REFERENCES products(id),
    CONSTRAINT soi_service_fkey FOREIGN KEY (service_id)        REFERENCES services(id)
);
GO

-- ------------------------------------------------------------
--  7.3  REPAIR_ORDERS – Lệnh sửa chữa (gán cho tổ trưởng)
-- ------------------------------------------------------------
CREATE TABLE repair_orders (
    id               BIGINT IDENTITY(1,1) NOT NULL,
    repair_code      VARCHAR(30)          NOT NULL,
    service_order_id BIGINT                   NULL,   -- liên kết phiếu RO
    branch_id        BIGINT               NOT NULL,
    team_leader_id   BIGINT               NOT NULL,
    vehicle_id       BIGINT                   NULL,
    created_by       BIGINT               NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'inprogress',
    -- inprogress | completed | cancelled
    notes            NVARCHAR(500)            NULL,
    created_at       DATETIME    NOT NULL DEFAULT GETDATE(),
    completed_at     DATETIME                 NULL,
    CONSTRAINT ro_pkey         PRIMARY KEY (id),
    CONSTRAINT ro_code_uq      UNIQUE (repair_code),
    CONSTRAINT ro_so_fkey      FOREIGN KEY (service_order_id) REFERENCES service_orders(id),
    CONSTRAINT ro_branch_fkey  FOREIGN KEY (branch_id)        REFERENCES branches(id),
    CONSTRAINT ro_leader_fkey  FOREIGN KEY (team_leader_id)   REFERENCES users(id),
    CONSTRAINT ro_vehicle_fkey FOREIGN KEY (vehicle_id)       REFERENCES vehicles(id),
    CONSTRAINT ro_creator_fkey FOREIGN KEY (created_by)       REFERENCES users(id)
);
GO

-- ------------------------------------------------------------
--  7.4  REPAIR_ORDER_TASKS – Danh sách công việc trong lệnh SC
-- ------------------------------------------------------------
CREATE TABLE repair_order_tasks (
    id              BIGINT IDENTITY(1,1) NOT NULL,
    repair_order_id BIGINT               NOT NULL,
    task_name       NVARCHAR(300)        NOT NULL,
    task_type       VARCHAR(10) NOT NULL DEFAULT 'DV',   -- DV | PT
    product_id      BIGINT                   NULL,
    quantity        INT         NOT NULL DEFAULT 1,
    unit_price      DECIMAL(18,2)            NULL,
    is_done         BIT         NOT NULL DEFAULT 0,
    CONSTRAINT rot_pkey         PRIMARY KEY (id),
    CONSTRAINT rot_order_fkey   FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id),
    CONSTRAINT rot_product_fkey FOREIGN KEY (product_id)       REFERENCES products(id)
);
GO

-- ============================================================
--  PHẦN 8: HÓA ĐƠN & TÀI CHÍNH
-- ============================================================
CREATE TABLE invoices (
    id               BIGINT IDENTITY(1,1) NOT NULL,
    invoice_code     VARCHAR(30)          NOT NULL,
    service_order_id BIGINT                   NULL,   -- phiếu RO tạo ra hóa đơn này
    branch_id        BIGINT               NOT NULL,
    customer_id      BIGINT               NOT NULL,
    amount           DECIMAL(18,2) NOT NULL DEFAULT 0,
    paid             DECIMAL(18,2) NOT NULL DEFAULT 0,
    payment_method   NVARCHAR(50)             NULL,   -- Tiền mặt | Chuyển khoản | Quẹt thẻ
    status           VARCHAR(20)  NOT NULL DEFAULT 'unpaid',   -- unpaid | paid
    issued_at        DATETIME     NOT NULL DEFAULT GETDATE(),
    issued_by        BIGINT                   NULL,
    qr_data          NVARCHAR(500)            NULL,   -- dữ liệu QR thanh toán
    CONSTRAINT inv_pkey        PRIMARY KEY (id),
    CONSTRAINT inv_code_uq     UNIQUE (invoice_code),
    CONSTRAINT inv_branch_fkey FOREIGN KEY (branch_id)       REFERENCES branches(id),
    CONSTRAINT inv_cust_fkey   FOREIGN KEY (customer_id)     REFERENCES customers(id),
    CONSTRAINT inv_so_fkey     FOREIGN KEY (service_order_id) REFERENCES service_orders(id),
    CONSTRAINT inv_user_fkey   FOREIGN KEY (issued_by)       REFERENCES users(id)
);
GO

-- ============================================================
--  PHẦN 9: CHĂM SÓC KHÁCH HÀNG
-- ============================================================

-- ------------------------------------------------------------
--  9.1  MAINTENANCE_REMINDERS – Nhắc lịch bảo dưỡng định kỳ
-- ------------------------------------------------------------
CREATE TABLE maintenance_reminders (
    id             BIGINT IDENTITY(1,1) NOT NULL,
    vehicle_id     BIGINT               NOT NULL,
    customer_id    BIGINT               NOT NULL,
    branch_id      BIGINT               NOT NULL,
    reminder_type  NVARCHAR(100)            NULL,   -- Bảo dưỡng định kỳ | Thay dầu | Kiểm tra lốp
    due_date       DATE                     NULL,
    due_km         INT                      NULL,
    is_sent        BIT          NOT NULL DEFAULT 0,
    sent_at        DATETIME                 NULL,
    is_confirmed   BIT          NOT NULL DEFAULT 0,
    confirmed_date DATE                     NULL,
    notes          NVARCHAR(500)            NULL,
    created_at     DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT mr_pkey         PRIMARY KEY (id),
    CONSTRAINT mr_vehicle_fkey FOREIGN KEY (vehicle_id)  REFERENCES vehicles(id),
    CONSTRAINT mr_cust_fkey    FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT mr_branch_fkey  FOREIGN KEY (branch_id)   REFERENCES branches(id)
);
GO

-- ------------------------------------------------------------
--  9.2  AFTER_SERVICE_CARE – Chăm sóc sau dịch vụ
-- ------------------------------------------------------------
CREATE TABLE after_service_care (
    id               BIGINT IDENTITY(1,1) NOT NULL,
    service_order_id BIGINT                   NULL,
    customer_id      BIGINT               NOT NULL,
    vehicle_id       BIGINT                   NULL,
    branch_id        BIGINT               NOT NULL,
    care_type        VARCHAR(50)              NULL,   -- call | message | email
    scheduled_date   DATE                     NULL,
    actual_date      DATETIME                 NULL,
    done_by          BIGINT                   NULL,
    result           NVARCHAR(300)            NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending | done | failed
    notes            NVARCHAR(500)            NULL,
    created_at       DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT asc_pkey        PRIMARY KEY (id),
    CONSTRAINT asc_so_fkey     FOREIGN KEY (service_order_id) REFERENCES service_orders(id),
    CONSTRAINT asc_cust_fkey   FOREIGN KEY (customer_id)      REFERENCES customers(id),
    CONSTRAINT asc_branch_fkey FOREIGN KEY (branch_id)        REFERENCES branches(id),
    CONSTRAINT asc_user_fkey   FOREIGN KEY (done_by)          REFERENCES users(id)
);
GO

-- ------------------------------------------------------------
--  9.3  CUSTOMER_FEEDBACK – Phản hồi / đánh giá của khách hàng
-- ------------------------------------------------------------
CREATE TABLE customer_feedback (
    id               BIGINT IDENTITY(1,1) NOT NULL,
    service_order_id BIGINT                   NULL,
    customer_id      BIGINT               NOT NULL,
    branch_id        BIGINT               NOT NULL,
    rating           INT                      NULL,   -- 1-5 sao
    comment          NVARCHAR(1000)           NULL,
    feedback_date    DATETIME     NOT NULL DEFAULT GETDATE(),
    is_resolved      BIT          NOT NULL DEFAULT 0,
    resolved_by      BIGINT                   NULL,
    resolution_note  NVARCHAR(500)            NULL,
    CONSTRAINT cf_pkey        PRIMARY KEY (id),
    CONSTRAINT cf_so_fkey     FOREIGN KEY (service_order_id) REFERENCES service_orders(id),
    CONSTRAINT cf_cust_fkey   FOREIGN KEY (customer_id)      REFERENCES customers(id),
    CONSTRAINT cf_branch_fkey FOREIGN KEY (branch_id)        REFERENCES branches(id),
    CONSTRAINT cf_user_fkey   FOREIGN KEY (resolved_by)      REFERENCES users(id)
);
GO

-- ============================================================
--  PHẦN 10: STORED PROCEDURE – Kiểm tra bảo hành
-- ============================================================

-- Dùng khi xe vào sửa: truyền biển số xe, trả về kết quả bảo hành
CREATE PROCEDURE sp_check_warranty
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

-- ============================================================
--  PHẦN 11: INDEXES – Tối ưu truy vấn
-- ============================================================
CREATE INDEX idx_vehicles_plate    ON vehicles             (license_plate);
CREATE INDEX idx_vehicles_brand    ON vehicles             (brand_id);
CREATE INDEX idx_vehicles_customer ON vehicles             (customer_id);
CREATE INDEX idx_wr_vehicle        ON warranty_records     (vehicle_id);
CREATE INDEX idx_so_status         ON service_orders       (status);
CREATE INDEX idx_so_branch         ON service_orders       (branch_id);
CREATE INDEX idx_so_vehicle        ON service_orders       (vehicle_id);
CREATE INDEX idx_so_customer       ON service_orders       (customer_id);
CREATE INDEX idx_soi_order         ON service_order_items  (service_order_id);
CREATE INDEX idx_products_branch   ON products             (branch_id);
CREATE INDEX idx_products_code     ON products             (product_code);
CREATE INDEX idx_it_date           ON inventory_transactions (transaction_date);
CREATE INDEX idx_it_type           ON inventory_transactions (transaction_type);
CREATE INDEX idx_mr_due_date       ON maintenance_reminders (due_date);
CREATE INDEX idx_cust_phone        ON customers            (phone);
CREATE INDEX idx_cust_contract     ON customers            (contract_id);
CREATE INDEX idx_ct_customer       ON contracts            (customer_id);
CREATE INDEX idx_ct_vehicle        ON contracts            (vehicle_id);
CREATE INDEX idx_ct_purchase_date  ON contracts            (purchase_date);
GO

PRINT N'AutoGara Database v2.3 tao thanh cong!';
PRINT N'Tong bang: 25 bang + 1 VIEW + 1 Stored Procedure';
GO

-- ============================================================
--  PHẦN 12: SEED DATA – TÀI KHOẢN NHÂN VIÊN
--  Tổng: 17 tài khoản (1 Admin, 1 Giám đốc, 3 Quản lý chi nhánh,
--         6 Cố vấn dịch vụ, 6 Nhân viên kho)
-- ============================================================

-- Mật khẩu mặc định cho TẤT CẢ tài khoản: 123456
-- Hash bcrypt (cost 10) của '123456', sinh bằng:
--   node -e "const b=require('bcryptjs');console.log(b.hashSync('123456',10))"

-- Thêm role Admin (không có trong bảng roles ban đầu)
INSERT INTO roles (role_name, role_label) VALUES
    ('admin', N'Quản trị hệ thống');
GO

-- ──────────────────────────────────────────────────────────────────────────────
--  Toàn bộ INSERT users + user_role + UPDATE branches trong 1 batch
-- ──────────────────────────────────────────────────────────────────────────────
DECLARE @pwd VARCHAR(250) = '$2b$10$IqMConyESFmhlrGkQGb82O9re0G6jiKem6mNi4dX26k5tYGemrREW';

-- ── ADMIN HỆ THỐNG & GIÁM ĐỐC ────────────────────────────────────────────────
INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, status) VALUES
('ADMIN-001', N'Admin',    'admin@autogara.vn',           @pwd, N'Admin',  N'System',  '0900000001', NULL, 'active'),
('GD-001',    N'Giám Đốc', 'generaldirecter@autogara.vn', @pwd, N'Giám',   N'Đốc',     '0900000002', NULL, 'active');

-- ── CHI NHÁNH 1 – HÀ NỘI (branch_id = 1) ─────────────────────────────────────
INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, status) VALUES
('QL-HN-001',   N'Nguyễn Văn E', 'qlcn1@autogara.vn',        @pwd, N'Văn E', N'Nguyễn', '0901001001', 1, 'active'),
('CVDV-HN-001', N'Nguyễn Văn A', 'cvdvcn1nv1@autogara.vn',   @pwd, N'Văn A', N'Nguyễn', '0901001002', 1, 'active'),
('CVDV-HN-002', N'Nguyễn Văn B', 'cvdvcn1nv2@autogara.vn',   @pwd, N'Văn B', N'Nguyễn', '0901001003', 1, 'active'),
('NVK-HN-001',  N'Nguyễn Văn C', 'nvkcn1nv1@autogara.vn',    @pwd, N'Văn C', N'Nguyễn', '0901001004', 1, 'active'),
('NVK-HN-002',  N'Nguyễn Văn D', 'nvkcn1nv2@autogara.vn',    @pwd, N'Văn D', N'Nguyễn', '0901001005', 1, 'active');

-- ── CHI NHÁNH 2 – TP.HCM (branch_id = 2) ─────────────────────────────────────
INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, status) VALUES
('QL-HCM-001',   N'Nguyễn Văn K', 'qlcn2@autogara.vn',       @pwd, N'Văn K', N'Nguyễn', '0902001001', 2, 'active'),
('CVDV-HCM-001', N'Nguyễn Văn F', 'cvdvcn2nv1@autogara.vn',  @pwd, N'Văn F', N'Nguyễn', '0902001002', 2, 'active'),
('CVDV-HCM-002', N'Nguyễn Văn G', 'cvdvcn2nv2@autogara.vn',  @pwd, N'Văn G', N'Nguyễn', '0902001003', 2, 'active'),
('NVK-HCM-001',  N'Nguyễn Văn H', 'nvkcn2nv1@autogara.vn',   @pwd, N'Văn H', N'Nguyễn', '0902001004', 2, 'active'),
('NVK-HCM-002',  N'Nguyễn Văn I', 'nvkcn2nv2@autogara.vn',   @pwd, N'Văn I', N'Nguyễn', '0902001005', 2, 'active');

-- ── CHI NHÁNH 3 – ĐÀ NẴNG (branch_id = 3) ────────────────────────────────────
INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, status) VALUES
('QL-DNA-001',   N'Nguyễn Văn P', 'qlcn3@autogara.vn',        @pwd, N'Văn P', N'Nguyễn', '0903001001', 3, 'active'),
('CVDV-DNA-001', N'Nguyễn Văn L', 'cvdvcn3nv1@autogara.vn',   @pwd, N'Văn L', N'Nguyễn', '0903001002', 3, 'active'),
('CVDV-DNA-002', N'Nguyễn Văn M', 'cvdvcn3nv2@autogara.vn',   @pwd, N'Văn M', N'Nguyễn', '0903001003', 3, 'active'),
('NVK-DNA-001',  N'Nguyễn Văn N', 'nvkcn3nv1@autogara.vn',    @pwd, N'Văn N', N'Nguyễn', '0903001004', 3, 'active'),
('NVK-DNA-002',  N'Nguyễn Văn O', 'nvkcn3nv2@autogara.vn',    @pwd, N'Văn O', N'Nguyễn', '0903001005', 3, 'active');

-- ── PHÂN QUYỀN user_role ──────────────────────────────────────────────────────
-- Dùng subquery theo email → không phụ thuộc IDENTITY id cứng
INSERT INTO user_role (user_id, role_id)
SELECT u.id, r.id
FROM   users u
CROSS  JOIN roles r
WHERE
    (u.email = 'admin@autogara.vn'            AND r.role_name = 'admin')
 OR (u.email = 'generaldirecter@autogara.vn'  AND r.role_name = 'general_director')
 OR (u.email IN ('qlcn1@autogara.vn', 'qlcn2@autogara.vn', 'qlcn3@autogara.vn')
                                               AND r.role_name = 'manager')
 OR (u.email IN ('cvdvcn1nv1@autogara.vn', 'cvdvcn1nv2@autogara.vn',
                 'cvdvcn2nv1@autogara.vn', 'cvdvcn2nv2@autogara.vn',
                 'cvdvcn3nv1@autogara.vn', 'cvdvcn3nv2@autogara.vn')
                                               AND r.role_name = 'service_advisor')
 OR (u.email IN ('nvkcn1nv1@autogara.vn', 'nvkcn1nv2@autogara.vn',
                 'nvkcn2nv1@autogara.vn', 'nvkcn2nv2@autogara.vn',
                 'nvkcn3nv1@autogara.vn', 'nvkcn3nv2@autogara.vn')
                                               AND r.role_name = 'warehouse_staff');

-- ── Gán manager_id cho từng chi nhánh ────────────────────────────────────────
UPDATE branches SET manager_id = (SELECT id FROM users WHERE email = 'qlcn1@autogara.vn') WHERE branch_code = 'HN';
UPDATE branches SET manager_id = (SELECT id FROM users WHERE email = 'qlcn2@autogara.vn') WHERE branch_code = 'HCM';
UPDATE branches SET manager_id = (SELECT id FROM users WHERE email = 'qlcn3@autogara.vn') WHERE branch_code = 'DNA';
GO

PRINT N'Seed users hoan tat! Tong 17 tai khoan (Admin, Giam doc, 3 QL, 6 CVDV, 6 NVK).';
PRINT N'Mat khau mac dinh cho tat ca tai khoan: 123456';
GO
