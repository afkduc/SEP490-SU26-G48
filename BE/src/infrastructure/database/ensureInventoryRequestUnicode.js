const { getPool } = require('./sqlServer');

async function ensureInventoryRequestUnicode() {
  const pool = await getPool();
  await pool.request().query(`
    IF EXISTS (
      SELECT 1
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID(N'dbo.import_request_items')
        AND c.name = N'unit'
        AND TYPE_NAME(c.user_type_id) <> N'nvarchar'
    )
    BEGIN
      ALTER TABLE dbo.import_request_items ALTER COLUMN unit NVARCHAR(20) NULL;
    END;

    IF COL_LENGTH('dbo.import_request_items', 'unit') IS NOT NULL
    BEGIN
      UPDATE iri
      SET iri.unit = u.unit_name
      FROM dbo.import_request_items iri
      JOIN dbo.products p ON p.id = iri.product_id
      JOIN dbo.units u ON u.id = p.unit_id
      WHERE iri.unit IS NULL OR iri.unit LIKE N'%?%';
    END;

    IF EXISTS (
      SELECT 1
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID(N'dbo.export_request_items')
        AND c.name = N'unit'
        AND TYPE_NAME(c.user_type_id) <> N'nvarchar'
    )
    BEGIN
      ALTER TABLE dbo.export_request_items ALTER COLUMN unit NVARCHAR(20) NULL;
    END;

    IF COL_LENGTH('dbo.export_request_items', 'unit') IS NOT NULL
    BEGIN
      UPDATE eri
      SET eri.unit = u.unit_name
      FROM dbo.export_request_items eri
      JOIN dbo.products p ON p.id = eri.product_id
      JOIN dbo.units u ON u.id = p.unit_id
      WHERE eri.unit IS NULL OR eri.unit LIKE N'%?%';
    END;
  `);
}

module.exports = { ensureInventoryRequestUnicode };
