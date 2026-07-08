-- ============================================================
--  Seed catalog hang muc cong viec + goi dich vu bao duong/sua chua
--  Migration V3 - chay SAU V2__add_inventory_columns.sql
--  Idempotent: co the chay lai nhieu lan, khong tao du lieu trung.
-- ============================================================

USE AutoGaraDB;
GO

-- ─── 1. Catalog `services` - hang muc cong viec dung chung ───────────
INSERT INTO services (service_code, service_name, category_id, unit_price, duration_min, description, is_active)
SELECT v.service_code, v.service_name, v.category_id, v.unit_price, v.duration_min, v.description, 1
FROM (VALUES
    ('SVC-OIL-ENGINE',        N'Thay dầu động cơ',                      1, 350000,  30, N'Thay dầu động cơ định kỳ'),
    ('SVC-OIL-FILTER',        N'Thay lọc dầu động cơ',                   1, 120000,  15, N'Thay lọc dầu động cơ'),
    ('SVC-AIR-FILTER',        N'Thay lọc gió động cơ',                   1, 150000,  15, N'Thay lọc gió động cơ'),
    ('SVC-CABIN-FILTER',      N'Thay lọc gió cabin',                     4, 180000,  15, N'Thay lọc gió khoang cabin (điều hòa)'),
    ('SVC-GENERAL-CHECK30',   N'Kiểm tra tổng quát 30 hạng mục',         8, 250000,  40, N'Kiểm tra tổng quát 30 hạng mục theo tiêu chuẩn bảo dưỡng'),
    ('SVC-CAR-WASH',          N'Rửa xe & dọn nội thất',                  7, 150000,  30, N'Rửa xe ngoại thất và dọn vệ sinh nội thất cơ bản'),
    ('SVC-INTERIOR-VACUUM',   N'Hút bụi & vệ sinh nội thất chuyên sâu',  7, 200000,  45, N'Hút bụi, vệ sinh ghế và thảm sàn chuyên sâu'),
    ('SVC-EXTERIOR-POLISH',   N'Đánh bóng ngoại thất',                   7, 450000,  90, N'Đánh bóng sơn xe, phủ bảo vệ ngoại thất'),
    ('SVC-TIRE-ROTATE',       N'Đảo lốp xe',                             2, 150000,  20, N'Đảo vị trí 4 lốp để mòn đều'),
    ('SVC-BRAKE-CHECK',       N'Kiểm tra hệ thống phanh',                2, 200000,  30, N'Kiểm tra má phanh, đĩa phanh, dầu phanh'),
    ('SVC-BRAKE-PAD-FRONT',   N'Thay má phanh trước',                    2, 650000,  45, N'Thay bộ má phanh trước'),
    ('SVC-BRAKE-FLUID',       N'Thay dầu phanh (DOT4)',                  2, 280000,  30, N'Thay dầu phanh theo tiêu chuẩn DOT4'),
    ('SVC-SUSPENSION-CHECK',  N'Kiểm tra hệ thống treo & gầm xe',        2, 220000,  40, N'Kiểm tra hệ thống treo, gầm, cao su giảm chấn'),
    ('SVC-TRANS-OIL',         N'Thay dầu hộp số',                        6, 850000,  60, N'Thay dầu hộp số tự động/số sàn'),
    ('SVC-POWER-STEERING-OIL',N'Thay dầu trợ lực lái',                   6, 320000,  30, N'Thay dầu trợ lực tay lái'),
    ('SVC-COOLANT-FLUSH',     N'Súc rửa & thay nước làm mát',            5, 300000,  40, N'Súc rửa két nước và thay nước làm mát động cơ'),
    ('SVC-TIMING-BELT',       N'Thay dây curoa cam',                     6, 1500000, 120, N'Thay dây curoa cam theo mốc bảo dưỡng lớn'),
    ('SVC-SPARK-PLUG',        N'Thay bugi (bộ 4)',                       3, 400000,  40, N'Thay bộ 4 bugi đánh lửa'),
    ('SVC-INJECTOR-CLEAN',    N'Vệ sinh kim phun',                       1, 350000,  45, N'Vệ sinh kim phun nhiên liệu bằng máy chuyên dụng'),
    ('SVC-BATTERY-CHECK',     N'Kiểm tra & đo bình ắc quy',              3, 100000,  15, N'Kiểm tra điện áp và tình trạng ắc quy'),
    ('SVC-LIGHT-CHECK',       N'Kiểm tra hệ thống đèn chiếu sáng',       3, 100000,  15, N'Kiểm tra đèn pha, đèn hậu, đèn xi-nhan'),
    ('SVC-AC-CLEAN',          N'Vệ sinh dàn lạnh điều hòa',              4, 400000,  60, N'Vệ sinh dàn lạnh, khử mùi hệ thống điều hòa'),
    ('SVC-AC-GAS',            N'Nạp gas lạnh điều hòa',                  4, 350000,  30, N'Nạp bổ sung gas lạnh điều hòa'),
    ('SVC-TIRE-PRESSURE',     N'Kiểm tra & bơm lốp đúng áp suất',        2, 50000,   10, N'Kiểm tra và bơm lốp đúng áp suất tiêu chuẩn'),
    ('SVC-ENGINE-BAY-CLEAN',  N'Vệ sinh khoang máy',                     7, 250000,  30, N'Vệ sinh khoang động cơ')
) AS v(service_code, service_name, category_id, unit_price, duration_min, description)
WHERE NOT EXISTS (SELECT 1 FROM services s WHERE s.service_code = v.service_code);
GO

-- ─── 2. 5 goi bao duong theo moc km (tao neu chua co) ────────────────
INSERT INTO service_packages (package_code, package_name, category_id, applicable_km, total_price, description, is_active)
SELECT v.package_code, v.package_name, v.category_id, v.applicable_km, v.total_price, v.description, 1
FROM (VALUES
    ('PKG-5K',  N'Gói bảo dưỡng 5.000 km',  8, 5000,  750000,  N'Thay dầu, kiểm tra tổng quát, rửa xe'),
    ('PKG-10K', N'Gói bảo dưỡng 10.000 km', 8, 10000, 1250000, N'Gói 5K + thay lọc dầu, lọc gió'),
    ('PKG-20K', N'Gói bảo dưỡng 20.000 km', 8, 20000, 2500000, N'Gói 10K + đảo lốp, kiểm tra phanh'),
    ('PKG-40K', N'Gói bảo dưỡng 40.000 km', 8, 40000, 4500000, N'Gói 20K + thay dầu hộp số, nước làm mát'),
    ('PKG-80K', N'Gói bảo dưỡng 80.000 km', 8, 80000, 8000000, N'Bảo dưỡng lớn toàn diện')
) AS v(package_code, package_name, category_id, applicable_km, total_price, description)
WHERE NOT EXISTS (SELECT 1 FROM service_packages sp WHERE sp.package_code = v.package_code);
GO

-- ─── 3. Bo sung hang muc con thieu cho 5 goi tren (cumulative) ───────
-- PKG-5K da du 3 hang muc (Thay dau dong co, Kiem tra tong quat, Rua xe) - khong can them.
-- PKG-10K: giu 2 dong tu do da co (Thay dau dong co, Thay loc gio dong co), them phan con thieu.
-- PKG-20K/40K/80K hien chua co dong nao - them day du theo mo ta cumulative.
INSERT INTO service_package_items (package_id, service_id, item_name, unit_price)
SELECT sp.id, sv.id, v.item_name, v.unit_price
FROM (VALUES
    -- PKG-10K: bo sung
    ('PKG-10K', 'SVC-GENERAL-CHECK30', N'Kiểm tra tổng quát 30 hạng mục', 250000),
    ('PKG-10K', 'SVC-CAR-WASH',        N'Rửa xe & dọn nội thất',          150000),
    ('PKG-10K', 'SVC-OIL-FILTER',      N'Thay lọc dầu động cơ',           120000),
    -- PKG-20K: toan bo hang muc cua PKG-10K + hang muc rieng
    ('PKG-20K', 'SVC-OIL-ENGINE',      N'Thay dầu động cơ',               350000),
    ('PKG-20K', 'SVC-GENERAL-CHECK30', N'Kiểm tra tổng quát 30 hạng mục', 250000),
    ('PKG-20K', 'SVC-CAR-WASH',        N'Rửa xe & dọn nội thất',          150000),
    ('PKG-20K', 'SVC-AIR-FILTER',      N'Thay lọc gió động cơ',           150000),
    ('PKG-20K', 'SVC-OIL-FILTER',      N'Thay lọc dầu động cơ',           120000),
    ('PKG-20K', 'SVC-TIRE-ROTATE',     N'Đảo lốp xe',                     150000),
    ('PKG-20K', 'SVC-BRAKE-CHECK',     N'Kiểm tra hệ thống phanh',        200000),
    -- PKG-40K: toan bo hang muc cua PKG-20K + hang muc rieng
    ('PKG-40K', 'SVC-OIL-ENGINE',      N'Thay dầu động cơ',               350000),
    ('PKG-40K', 'SVC-GENERAL-CHECK30', N'Kiểm tra tổng quát 30 hạng mục', 250000),
    ('PKG-40K', 'SVC-CAR-WASH',        N'Rửa xe & dọn nội thất',          150000),
    ('PKG-40K', 'SVC-AIR-FILTER',      N'Thay lọc gió động cơ',           150000),
    ('PKG-40K', 'SVC-OIL-FILTER',      N'Thay lọc dầu động cơ',           120000),
    ('PKG-40K', 'SVC-TIRE-ROTATE',     N'Đảo lốp xe',                     150000),
    ('PKG-40K', 'SVC-BRAKE-CHECK',     N'Kiểm tra hệ thống phanh',        200000),
    ('PKG-40K', 'SVC-TRANS-OIL',       N'Thay dầu hộp số',                850000),
    ('PKG-40K', 'SVC-COOLANT-FLUSH',   N'Súc rửa & thay nước làm mát',    300000),
    -- PKG-80K: toan bo hang muc cua PKG-40K + hang muc rieng (bao duong lon)
    ('PKG-80K', 'SVC-OIL-ENGINE',      N'Thay dầu động cơ',               350000),
    ('PKG-80K', 'SVC-GENERAL-CHECK30', N'Kiểm tra tổng quát 30 hạng mục', 250000),
    ('PKG-80K', 'SVC-CAR-WASH',        N'Rửa xe & dọn nội thất',          150000),
    ('PKG-80K', 'SVC-AIR-FILTER',      N'Thay lọc gió động cơ',           150000),
    ('PKG-80K', 'SVC-OIL-FILTER',      N'Thay lọc dầu động cơ',           120000),
    ('PKG-80K', 'SVC-TIRE-ROTATE',     N'Đảo lốp xe',                     150000),
    ('PKG-80K', 'SVC-BRAKE-CHECK',     N'Kiểm tra hệ thống phanh',        200000),
    ('PKG-80K', 'SVC-TRANS-OIL',       N'Thay dầu hộp số',                850000),
    ('PKG-80K', 'SVC-COOLANT-FLUSH',   N'Súc rửa & thay nước làm mát',    300000),
    ('PKG-80K', 'SVC-TIMING-BELT',     N'Thay dây curoa cam',             1500000),
    ('PKG-80K', 'SVC-SPARK-PLUG',      N'Thay bugi (bộ 4)',               400000),
    ('PKG-80K', 'SVC-INJECTOR-CLEAN',  N'Vệ sinh kim phun',               350000)
) AS v(package_code, service_code, item_name, unit_price)
JOIN service_packages sp ON sp.package_code = v.package_code
LEFT JOIN services sv ON sv.service_code = v.service_code
WHERE NOT EXISTS (
    SELECT 1 FROM service_package_items spi
    WHERE spi.package_id = sp.id AND spi.item_name = v.item_name
);
GO

-- ─── 4. 4 goi dich vu moi (da dang, ngoai moc km) ────────────────────
INSERT INTO service_packages (package_code, package_name, category_id, applicable_km, total_price, description, is_active)
SELECT v.package_code, v.package_name, v.category_id, v.applicable_km, v.total_price, v.description, 1
FROM (VALUES
    ('PKG-CARE-BASIC', N'Gói chăm sóc xe cơ bản',                7, NULL, 600000, N'Rửa xe, hút bụi nội thất, vệ sinh khoang máy'),
    ('PKG-BRAKE-FULL', N'Gói kiểm tra & bảo dưỡng phanh toàn diện', 2, NULL, 1130000, N'Kiểm tra phanh, thay má phanh trước, thay dầu phanh'),
    ('PKG-AC-SERVICE', N'Gói bảo dưỡng điều hòa',                 4, NULL, 930000, N'Vệ sinh dàn lạnh, nạp gas lạnh, thay lọc gió cabin'),
    ('PKG-ROADTRIP',   N'Gói kiểm tra trước chuyến đi xa',        8, NULL, 500000, N'Kiểm tra tổng quát, ắc quy, áp suất lốp, đèn chiếu sáng')
) AS v(package_code, package_name, category_id, applicable_km, total_price, description)
WHERE NOT EXISTS (SELECT 1 FROM service_packages sp WHERE sp.package_code = v.package_code);
GO

INSERT INTO service_package_items (package_id, service_id, item_name, unit_price)
SELECT sp.id, sv.id, v.item_name, v.unit_price
FROM (VALUES
    ('PKG-CARE-BASIC', 'SVC-CAR-WASH',        N'Rửa xe & dọn nội thất',                  150000),
    ('PKG-CARE-BASIC', 'SVC-INTERIOR-VACUUM', N'Hút bụi & vệ sinh nội thất chuyên sâu',  200000),
    ('PKG-CARE-BASIC', 'SVC-ENGINE-BAY-CLEAN',N'Vệ sinh khoang máy',                     250000),

    ('PKG-BRAKE-FULL', 'SVC-BRAKE-CHECK',     N'Kiểm tra hệ thống phanh',                200000),
    ('PKG-BRAKE-FULL', 'SVC-BRAKE-PAD-FRONT', N'Thay má phanh trước',                    650000),
    ('PKG-BRAKE-FULL', 'SVC-BRAKE-FLUID',     N'Thay dầu phanh (DOT4)',                  280000),

    ('PKG-AC-SERVICE',  'SVC-AC-CLEAN',        N'Vệ sinh dàn lạnh điều hòa',              400000),
    ('PKG-AC-SERVICE',  'SVC-AC-GAS',          N'Nạp gas lạnh điều hòa',                  350000),
    ('PKG-AC-SERVICE',  'SVC-CABIN-FILTER',    N'Thay lọc gió cabin',                     180000),

    ('PKG-ROADTRIP',    'SVC-GENERAL-CHECK30', N'Kiểm tra tổng quát 30 hạng mục',         250000),
    ('PKG-ROADTRIP',    'SVC-BATTERY-CHECK',   N'Kiểm tra & đo bình ắc quy',              100000),
    ('PKG-ROADTRIP',    'SVC-TIRE-PRESSURE',   N'Kiểm tra & bơm lốp đúng áp suất',        50000),
    ('PKG-ROADTRIP',    'SVC-LIGHT-CHECK',     N'Kiểm tra hệ thống đèn chiếu sáng',       100000)
) AS v(package_code, service_code, item_name, unit_price)
JOIN service_packages sp ON sp.package_code = v.package_code
LEFT JOIN services sv ON sv.service_code = v.service_code
WHERE NOT EXISTS (
    SELECT 1 FROM service_package_items spi
    WHERE spi.package_id = sp.id AND spi.item_name = v.item_name
);
GO

-- ─── 5. Tinh lai total_price = 80% tong unit_price hang muc ─────────
-- Ap dung cho MOI goi dich vu (ca goi cu lan goi moi), dua tren du lieu
-- service_package_items hien co - khong hard-code so tien.
UPDATE sp
SET sp.total_price = ROUND(t.item_sum * 0.8, 0)
FROM service_packages sp
JOIN (
    SELECT package_id, SUM(unit_price) AS item_sum
    FROM service_package_items
    GROUP BY package_id
) t ON t.package_id = sp.id;
GO

PRINT N'Migration V3 hoan tat - da seed catalog services (25 hang muc), hoan thien 5 goi bao duong theo km, them 4 goi moi, va tinh lai total_price = 80% tong hang muc cho tat ca goi.';
GO
