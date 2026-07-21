-- ============================================================
-- V3 STEP 2/3: ADD cot users.updated_at
-- Idempotent: chi them neu chua co.
-- Chay rieng (1 batch) de tranh parser resolve identifier.
-- Ket qua mong doi: "(1 row(s) affected)" hoac message skip.
-- ============================================================

IF COL_LENGTH('users', 'updated_at') IS NULL
BEGIN
  ALTER TABLE users ADD updated_at DATETIME2 NULL;
  PRINT '[V3 step 2] added users.updated_at';
END
ELSE
BEGIN
  PRINT '[V3 step 2] users.updated_at already exists, skip ALTER';
END
GO
