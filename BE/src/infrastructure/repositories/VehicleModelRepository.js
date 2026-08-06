const { query } = require('../database/sqlServer');

/**
 * Danh sach ten xe (doi xe) goi y khi CVDV tao phieu quyet toan cho xe MOI
 * (chua co trong DB) - xem RepairSettlementPage.jsx o cua so "Tên xe". Bang
 * rieng, khong gan cung cot vehicles.vehicle_model_text (van la text tu do
 * luu tren tung xe) - day chi la nguon goi y de go nhanh + tranh sai chinh ta
 * lam trung 1 mau xe voi nhieu ten khac nhau.
 */
function mapModelRow(row) {
  return {
    id: row.id,
    brandId: row.brand_id,
    modelName: row.model_name,
  };
}

class VehicleModelRepository {
  async ensureTable() {
    await query(`
      IF OBJECT_ID('vehicle_models', 'U') IS NULL
      CREATE TABLE vehicle_models (
        id INT IDENTITY(1,1) PRIMARY KEY,
        brand_id INT NULL,
        model_name NVARCHAR(150) NOT NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_vehicle_models_created_at DEFAULT GETDATE()
      );
    `);
  }

  // brandId khi co se uu tien khop dung hang xe da chon tren form truoc,
  // khong truyen thi tim tren toan bo bang (vd luc chua chon Hang xe).
  async search({ brandId, q, limit = 20 } = {}) {
    await this.ensureTable();
    const conditions = [];
    const params = { pLimit: Number(limit) || 20 };
    if (brandId) {
      conditions.push('brand_id = @pBrandId');
      params.pBrandId = Number(brandId);
    }
    if (q && q.trim()) {
      conditions.push('model_name LIKE @pQ');
      params.pQ = `%${q.trim()}%`;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT TOP (@pLimit) id, brand_id, model_name
       FROM vehicle_models
       ${where}
       ORDER BY model_name ASC`,
      params
    );
    return result.recordset.map(mapModelRow);
  }

  // Tranh tao trung ten trong cung 1 hang xe (khong phan biet hoa/thuong,
  // khong phan biet khoang trang thua) - CVDV bam "+ Thêm tên xe mới" 2 lan
  // hoac o 2 phien lam viec khac nhau cho cung 1 mau xe se chi tra ve dong da
  // co thay vi tao ban ghi trung.
  async create({ brandId, modelName }) {
    await this.ensureTable();
    const name = String(modelName || '').trim();
    if (!name) return null;
    const brandIdNum = brandId ? Number(brandId) : null;

    const existing = brandIdNum
      ? await query(
          `SELECT TOP 1 id, brand_id, model_name FROM vehicle_models
           WHERE brand_id = @pBrandId AND LTRIM(RTRIM(model_name)) = @pName`,
          { pBrandId: brandIdNum, pName: name }
        )
      : await query(
          `SELECT TOP 1 id, brand_id, model_name FROM vehicle_models
           WHERE brand_id IS NULL AND LTRIM(RTRIM(model_name)) = @pName`,
          { pName: name }
        );
    if (existing.recordset.length) return mapModelRow(existing.recordset[0]);

    const result = brandIdNum
      ? await query(
          `INSERT INTO vehicle_models (brand_id, model_name)
           OUTPUT INSERTED.id, INSERTED.brand_id, INSERTED.model_name
           VALUES (@pBrandId, @pName)`,
          { pBrandId: brandIdNum, pName: name }
        )
      : await query(
          `INSERT INTO vehicle_models (brand_id, model_name)
           OUTPUT INSERTED.id, INSERTED.brand_id, INSERTED.model_name
           VALUES (NULL, @pName)`,
          { pName: name }
        );
    return mapModelRow(result.recordset[0]);
  }
}

module.exports = VehicleModelRepository;
