-- ============================================================
--  Inventory Module - Migration V2 (bo sung cho Ngay 2)
--  Chay SAU khi schema goc AutoGara.sql da tao xong.
--  Khong tao bang moi - chi ALTER bang `products` co san.
--  Luu y: schema goc dung ten bang `products` (khong phai `parts`)
--         va cot ten la `product_name` (khong phai `part_name`).
--         File nay sua lai tu ban cu de khop voi AutoGara.sql.
-- ============================================================

USE AutoGaraDB;
GO

-- Guard an toan: neu chua chay AutoGara.sql thi bo qua,
-- khong de lenh ALTER loi nhu lan truoc.
IF OBJECT_ID('dbo.products', 'U') IS NULL
BEGIN
    PRINT N'BO QUA V2: bang [products] chua ton tai - hay chay Database/AutoGara.sql truoc.';
    RETURN;
END;
GO

-- 1) Bo sung cot don gia tham khao (tinh gia tri ton kho, bao cao)
IF COL_LENGTH('products', 'unit_price') IS NULL
BEGIN
    ALTER TABLE products ADD unit_price DECIMAL(18,2) NULL;
    PRINT N'  + Them cot products.unit_price';
END;
GO

-- 2) Index ho tro filter danh sach phu tung theo ten
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_products_name' AND object_id = OBJECT_ID('products'))
BEGIN
    CREATE INDEX idx_products_name ON products (product_name);
    PRINT N'  + Tao index idx_products_name';
END;
GO

-- 3) Index ho tro loc theo nha cung cap
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_products_supplier' AND object_id = OBJECT_ID('products'))
BEGIN
    CREATE INDEX idx_products_supplier ON products (supplier_id);
    PRINT N'  + Tao index idx_products_supplier';
END;
GO

-- 4) Index ho tro loc theo trang thai (low_stock, active...) trong trang Ton kho
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_products_status' AND object_id = OBJECT_ID('products'))
BEGIN
    CREATE INDEX idx_products_status ON products (status);
    PRINT N'  + Tao index idx_products_status';
END;
GO

PRINT N'Migration V2 (inventory) hoan tat - da bo sung: products.unit_price + 3 index.';
GO
