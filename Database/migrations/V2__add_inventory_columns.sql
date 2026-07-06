-- ============================================================
--  Inventory Module - Migration V2 (bo sung cho Ngay 2)
--  Chay SAU khi schema goc AutoGara.sql da tao xong.
--  Khong tao bang moi - chi ALTER bang `parts` co san.
-- ============================================================

USE AutoGaraDB;
GO

-- Bo sung cot thieu tren bang parts
-- Don gia tham khao - dung cho thong ke gia tri ton kho.
IF COL_LENGTH('parts', 'unit_price') IS NULL
BEGIN
    ALTER TABLE parts ADD unit_price DECIMAL(18,2) NULL;
END;
GO

-- Index bo tro - phuc vu filter danh sach phu tung
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_parts_name' AND object_id = OBJECT_ID('parts'))
BEGIN
    CREATE INDEX idx_parts_name ON parts (part_name);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_parts_supplier' AND object_id = OBJECT_ID('parts'))
BEGIN
    CREATE INDEX idx_parts_supplier ON parts (supplier_id);
END;
GO

PRINT N'Migration V2 (inventory) hoan tat - da bo sung: unit_price + 2 index.';
GO
