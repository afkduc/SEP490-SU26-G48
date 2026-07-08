-- ============================================================
--  Redesign: bo cot thua (item_name/unit_price) o service_package_items,
--  dedupe catalog services, rebuild sach du lieu goi dich vu.
--  Migration V4 - chay SAU V3__seed_service_catalog_and_packages.sql
--  Idempotent: co the chay lai nhieu lan.
-- ============================================================

USE AutoGaraDB;
GO

-- ─── 1. Xoa sach du lieu goi dich vu cu de rebuild lai toan bo ───────
-- Phai chay TRUOC buoc dedupe catalog ben duoi, vi cac dong hang muc cu
-- (tu lan chay truoc) co the dang tham chieu chinh cac dong SVC-xxx can
-- xoa - de lai se lam FK chan khong dedupe duoc catalog.
DELETE FROM service_package_items;
DELETE FROM service_packages;
GO

-- ─── 2. Dedupe catalog: bo 5 dong DV-00x trung/lech gia voi SVC-xxx ──
-- (DV-00x co truoc, trung ten nhung lech gia voi cac dong SVC-xxx moi
--  vd 'Thay ma phanh truoc' DV-002=450000 vs SVC-BRAKE-PAD-FRONT=650000)
-- Chi xoa DV-00x nao KHONG bi service_order_items (lenh sua chua) tham chieu.
DELETE s FROM services s
WHERE s.service_code IN ('DV-001', 'DV-002', 'DV-003', 'DV-004', 'DV-005')
  AND NOT EXISTS (SELECT 1 FROM service_order_items soi WHERE soi.service_id = s.id);
GO

-- Neu DV-00x nao "song sot" (dang duoc du lieu that tham chieu, khong xoa
-- duoc o tren) thi xoa ban SVC-xxx trung thay vi, tranh ton tai 2 catalog
-- entry cho cung 1 khai niem. Neu DV-00x da bi xoa (khong ai dung) thi
-- dieu kien EXISTS = false nen khong dong gi den SVC-xxx.
DELETE FROM services WHERE service_code = 'SVC-OIL-ENGINE'      AND EXISTS (SELECT 1 FROM services WHERE service_code = 'DV-001');
DELETE FROM services WHERE service_code = 'SVC-BRAKE-PAD-FRONT' AND EXISTS (SELECT 1 FROM services WHERE service_code = 'DV-002');
DELETE FROM services WHERE service_code = 'SVC-BATTERY-CHECK'   AND EXISTS (SELECT 1 FROM services WHERE service_code = 'DV-003');
DELETE FROM services WHERE service_code = 'SVC-AC-CLEAN'        AND EXISTS (SELECT 1 FROM services WHERE service_code = 'DV-004');
DELETE FROM services WHERE service_code = 'SVC-CAR-WASH'        AND EXISTS (SELECT 1 FROM services WHERE service_code = 'DV-005');
GO

-- ─── 3. Bo cot thua tren service_package_items ───────────────────────
-- item_name/unit_price la du lieu copy tu services - luon lay qua JOIN
-- thay vi luu lai rieng, tranh sai lech gia giua cac goi (nhu case cu).
-- Bang dang rong (buoc 1) nen set NOT NULL an toan.
IF COLUMNPROPERTY(OBJECT_ID('service_package_items'), 'service_id', 'AllowsNull') = 1
BEGIN
    ALTER TABLE service_package_items ALTER COLUMN service_id BIGINT NOT NULL;
END;
GO

IF COL_LENGTH('service_package_items', 'item_name') IS NOT NULL
BEGIN
    ALTER TABLE service_package_items DROP COLUMN item_name;
END;
GO

IF COL_LENGTH('service_package_items', 'unit_price') IS NOT NULL
BEGIN
    DECLARE @dfName NVARCHAR(200);
    SELECT @dfName = dc.name
    FROM sys.default_constraints dc
    WHERE dc.parent_object_id = OBJECT_ID('service_package_items')
      AND dc.parent_column_id = COLUMNPROPERTY(OBJECT_ID('service_package_items'), 'unit_price', 'ColumnId');
    IF @dfName IS NOT NULL
        EXEC('ALTER TABLE service_package_items DROP CONSTRAINT ' + @dfName);
    ALTER TABLE service_package_items DROP COLUMN unit_price;
END;
GO

-- ─── 4. Insert lai goi dich vu (5 goi theo km + 4 goi da dang) ───────
INSERT INTO service_packages (package_code, package_name, category_id, applicable_km, total_price, description, is_active)
VALUES
    ('PKG-5K',  N'Gói bảo dưỡng 5.000 km',  8, 5000,  0, N'Thay dầu, kiểm tra tổng quát, rửa xe', 1),
    ('PKG-10K', N'Gói bảo dưỡng 10.000 km', 8, 10000, 0, N'Gói 5K + thay lọc dầu, lọc gió', 1),
    ('PKG-20K', N'Gói bảo dưỡng 20.000 km', 8, 20000, 0, N'Gói 10K + đảo lốp, kiểm tra phanh', 1),
    ('PKG-40K', N'Gói bảo dưỡng 40.000 km', 8, 40000, 0, N'Gói 20K + thay dầu hộp số, nước làm mát', 1),
    ('PKG-80K', N'Gói bảo dưỡng 80.000 km', 8, 80000, 0, N'Bảo dưỡng lớn toàn diện', 1),
    ('PKG-CARE-BASIC', N'Gói chăm sóc xe cơ bản',                   7, NULL, 0, N'Rửa xe, hút bụi nội thất, vệ sinh khoang máy', 1),
    ('PKG-BRAKE-FULL', N'Gói kiểm tra & bảo dưỡng phanh toàn diện', 2, NULL, 0, N'Kiểm tra phanh, thay má phanh trước, thay dầu phanh', 1),
    ('PKG-AC-SERVICE', N'Gói bảo dưỡng điều hòa',                   4, NULL, 0, N'Vệ sinh dàn lạnh, nạp gas lạnh, thay lọc gió cabin', 1),
    ('PKG-ROADTRIP',   N'Gói kiểm tra trước chuyến đi xa',          8, NULL, 0, N'Kiểm tra tổng quát, ắc quy, áp suất lốp, đèn chiếu sáng', 1);
GO

-- ─── 5. Gan hang muc cho tung goi - chi qua service_id ───────────────
-- Cumulative: moi tier km giu nguyen hang muc cua tier truoc + them moi.
-- Dung CTE 'resolved' de tra cuu linh hoat: sau buoc 1, moi khai niem
-- trung (oil-engine, brake-pad-front, battery-check, ac-clean, car-wash)
-- chi con DUNG 1 trong 2 ma (DV- hoac SVC-) ton tai - khong biet truoc
-- cai nao, nen alias ve chung 1 ten SVC-xxx de JOIN khong doi ben duoi.
;WITH resolved AS (
    SELECT 'SVC-OIL-ENGINE' AS alias_code, id FROM services WHERE service_code IN ('DV-001', 'SVC-OIL-ENGINE')
    UNION ALL SELECT 'SVC-BRAKE-PAD-FRONT', id FROM services WHERE service_code IN ('DV-002', 'SVC-BRAKE-PAD-FRONT')
    UNION ALL SELECT 'SVC-BATTERY-CHECK', id FROM services WHERE service_code IN ('DV-003', 'SVC-BATTERY-CHECK')
    UNION ALL SELECT 'SVC-AC-CLEAN', id FROM services WHERE service_code IN ('DV-004', 'SVC-AC-CLEAN')
    UNION ALL SELECT 'SVC-CAR-WASH', id FROM services WHERE service_code IN ('DV-005', 'SVC-CAR-WASH')
    UNION ALL
    SELECT service_code, id FROM services
    WHERE service_code NOT IN ('DV-001', 'DV-002', 'DV-003', 'DV-004', 'DV-005',
                                'SVC-OIL-ENGINE', 'SVC-BRAKE-PAD-FRONT', 'SVC-BATTERY-CHECK', 'SVC-AC-CLEAN', 'SVC-CAR-WASH')
)
INSERT INTO service_package_items (package_id, service_id)
SELECT sp.id, r.id
FROM (VALUES
    ('PKG-5K', 'SVC-OIL-ENGINE'), ('PKG-5K', 'SVC-GENERAL-CHECK30'), ('PKG-5K', 'SVC-CAR-WASH'),

    ('PKG-10K', 'SVC-OIL-ENGINE'), ('PKG-10K', 'SVC-GENERAL-CHECK30'), ('PKG-10K', 'SVC-CAR-WASH'),
    ('PKG-10K', 'SVC-OIL-FILTER'), ('PKG-10K', 'SVC-AIR-FILTER'),

    ('PKG-20K', 'SVC-OIL-ENGINE'), ('PKG-20K', 'SVC-GENERAL-CHECK30'), ('PKG-20K', 'SVC-CAR-WASH'),
    ('PKG-20K', 'SVC-OIL-FILTER'), ('PKG-20K', 'SVC-AIR-FILTER'),
    ('PKG-20K', 'SVC-TIRE-ROTATE'), ('PKG-20K', 'SVC-BRAKE-CHECK'),

    ('PKG-40K', 'SVC-OIL-ENGINE'), ('PKG-40K', 'SVC-GENERAL-CHECK30'), ('PKG-40K', 'SVC-CAR-WASH'),
    ('PKG-40K', 'SVC-OIL-FILTER'), ('PKG-40K', 'SVC-AIR-FILTER'),
    ('PKG-40K', 'SVC-TIRE-ROTATE'), ('PKG-40K', 'SVC-BRAKE-CHECK'),
    ('PKG-40K', 'SVC-TRANS-OIL'), ('PKG-40K', 'SVC-COOLANT-FLUSH'),

    ('PKG-80K', 'SVC-OIL-ENGINE'), ('PKG-80K', 'SVC-GENERAL-CHECK30'), ('PKG-80K', 'SVC-CAR-WASH'),
    ('PKG-80K', 'SVC-OIL-FILTER'), ('PKG-80K', 'SVC-AIR-FILTER'),
    ('PKG-80K', 'SVC-TIRE-ROTATE'), ('PKG-80K', 'SVC-BRAKE-CHECK'),
    ('PKG-80K', 'SVC-TRANS-OIL'), ('PKG-80K', 'SVC-COOLANT-FLUSH'),
    ('PKG-80K', 'SVC-TIMING-BELT'), ('PKG-80K', 'SVC-SPARK-PLUG'), ('PKG-80K', 'SVC-INJECTOR-CLEAN'),

    ('PKG-CARE-BASIC', 'SVC-CAR-WASH'), ('PKG-CARE-BASIC', 'SVC-INTERIOR-VACUUM'), ('PKG-CARE-BASIC', 'SVC-ENGINE-BAY-CLEAN'),

    ('PKG-BRAKE-FULL', 'SVC-BRAKE-CHECK'), ('PKG-BRAKE-FULL', 'SVC-BRAKE-PAD-FRONT'), ('PKG-BRAKE-FULL', 'SVC-BRAKE-FLUID'),

    ('PKG-AC-SERVICE', 'SVC-AC-CLEAN'), ('PKG-AC-SERVICE', 'SVC-AC-GAS'), ('PKG-AC-SERVICE', 'SVC-CABIN-FILTER'),

    ('PKG-ROADTRIP', 'SVC-GENERAL-CHECK30'), ('PKG-ROADTRIP', 'SVC-BATTERY-CHECK'),
    ('PKG-ROADTRIP', 'SVC-TIRE-PRESSURE'), ('PKG-ROADTRIP', 'SVC-LIGHT-CHECK')
) AS v(package_code, service_code)
JOIN service_packages sp ON sp.package_code = v.package_code
JOIN resolved r ON r.alias_code = v.service_code;
GO

-- ─── 6. Tinh total_price = 80% tong unit_price cac hang muc ─────────
-- unit_price gio lay qua JOIN services (khong con luu rieng o
-- service_package_items) - dam bao gia luon nhat quan giua cac goi.
UPDATE sp
SET sp.total_price = ROUND(t.item_sum * 0.8, 0)
FROM service_packages sp
JOIN (
    SELECT spi.package_id, SUM(sv.unit_price) AS item_sum
    FROM service_package_items spi
    JOIN services sv ON sv.id = spi.service_id
    GROUP BY spi.package_id
) t ON t.package_id = sp.id;
GO

PRINT N'Migration V4 hoan tat - da bo cot item_name/unit_price thua o service_package_items, dedupe catalog services, rebuild sach 9 goi dich vu voi gia nhat quan tu 1 nguon duy nhat.';
GO
