-- ============================================================
--  V5 - Bo sung them to truong (team_leader) cho tung chi nhanh
--  De phuc vu tinh nang "Lenh sua chua": gan lenh sua chua cho
--  1 to truong dang thuoc cung chi nhanh voi cham hang.
--
--  Truoc migration nay, moi chi nhanh (HN/HCM/DNA) moi chi co
--  DUY NHAT 1 to truong (TT-HN-001, TT-HCM-001, TT-DNA-001).
--  Migration nay them 3 to truong nua cho MOI chi nhanh (id 21..29).
--
--  Mat khau dung chung voi cac tai khoan demo khac da co san
--  trong DB (hash bcrypt cua mat khau demo dang dung toan he thong).
-- ============================================================

USE AutoGaraDB;
GO

DECLARE @pwd VARCHAR(250) = '$2b$10$IqMConyESFmhlrGkQGb82O9re0G6jiKem6mNi4dX26k5tYGemrREW';
DECLARE @teamLeaderRoleId BIGINT = (SELECT id FROM roles WHERE role_name = 'team_leader');

-- Chi nhanh Ha Noi (branch_id = 1, ma chi nhanh cn1) - da co TT-HN-001
INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, specialty, team_size, status, created_at)
VALUES
  (N'TT-HN-002', N'Nguyễn Đình Khương', 'ttcn1nv2@autogara.vn', @pwd, N'Đình Khương', N'Nguyễn', '0901002002', 1, N'Điện - Điện tử',        4, 'active', GETDATE()),
  (N'TT-HN-003', N'Vũ Trọng Nghĩa',     'ttcn1nv3@autogara.vn', @pwd, N'Trọng Nghĩa',  N'Vũ',      '0901002003', 1, N'Gầm - Phanh',           3, 'active', GETDATE()),
  (N'TT-HN-004', N'Hoàng Minh Tuấn',    'ttcn1nv4@autogara.vn', @pwd, N'Minh Tuấn',    N'Hoàng',   '0901002004', 1, N'Điều hòa - Làm lạnh',   3, 'active', GETDATE());

-- Chi nhanh TP.HCM (branch_id = 2, ma chi nhanh cn2) - da co TT-HCM-001
INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, specialty, team_size, status, created_at)
VALUES
  (N'TT-HCM-002', N'Đặng Văn Hòa',    'ttcn2nv2@autogara.vn', @pwd, N'Văn Hòa',   N'Đặng',  '0902002002', 2, N'Động cơ - Hộp số',      5, 'active', GETDATE()),
  (N'TT-HCM-003', N'Bùi Thanh Sang',  'ttcn2nv3@autogara.vn', @pwd, N'Thanh Sang', N'Bùi',   '0902002003', 2, N'Gầm - Phanh',           4, 'active', GETDATE()),
  (N'TT-HCM-004', N'Đỗ Quang Huy',    'ttcn2nv4@autogara.vn', @pwd, N'Quang Huy', N'Đỗ',     '0902002004', 2, N'Đa năng',               3, 'active', GETDATE());

-- Chi nhanh Da Nang (branch_id = 3, ma chi nhanh cn3) - da co TT-DNA-001
INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, specialty, team_size, status, created_at)
VALUES
  (N'TT-DNA-002', N'Trương Công Danh', 'ttcn3nv2@autogara.vn', @pwd, N'Công Danh', N'Trương', '0903002002', 3, N'Động cơ - Hộp số',      4, 'active', GETDATE()),
  (N'TT-DNA-003', N'Phan Hữu Đạt',     'ttcn3nv3@autogara.vn', @pwd, N'Hữu Đạt',   N'Phan',   '0903002003', 3, N'Điện - Điện tử',        3, 'active', GETDATE()),
  (N'TT-DNA-004', N'Ngô Bảo Long',     'ttcn3nv4@autogara.vn', @pwd, N'Bảo Long',  N'Ngô',    '0903002004', 3, N'Điều hòa - Làm lạnh',   3, 'active', GETDATE());

-- Gan role team_leader cho 9 user vua tao (nhung pseudo_id o tren, chua co user_role).
INSERT INTO user_role (user_id, role_id)
SELECT u.id, @teamLeaderRoleId
FROM users u
WHERE u.pseudo_id IN (
  N'TT-HN-002', N'TT-HN-003', N'TT-HN-004',
  N'TT-HCM-002', N'TT-HCM-003', N'TT-HCM-004',
  N'TT-DNA-002', N'TT-DNA-003', N'TT-DNA-004'
)
AND NOT EXISTS (
  SELECT 1 FROM user_role ur WHERE ur.user_id = u.id AND ur.role_id = @teamLeaderRoleId
);
GO
