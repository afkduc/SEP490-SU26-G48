-- ============================================================
-- V3 STEP 1/3: Kiem tra cot updated_at da ton tai chua
-- Chay truoc de biet trang thai hien tai.
-- Ket qua mong doi:
--   - Neu cot CHUA ton tai: NULL (chay tiep step 2)
--   - Neu cot DA ton tai: gia tri datetime (da chay V3 thanh cong,
--     chi can chay step 3 de tao trigger neu chua co)
-- ============================================================

SELECT
  COL_LENGTH('users', 'updated_at') AS column_exists,
  OBJECT_ID('TR_users_updated_at', 'TR') AS trigger_exists;
