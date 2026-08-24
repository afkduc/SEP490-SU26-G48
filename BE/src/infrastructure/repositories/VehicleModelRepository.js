const { query } = require('../database/sqlServer');

// Catalog dong xe/doi xe that (vehicle_models) - dung de CVDV chon dung khi
// dang ky xe MOI, thay vi go tu do vao "Loai xe" nhu truoc (khong lien ket
// duoc voi catalog, khong biet dung phu tung theo doi nao). Chi ~50-60 dong
// (1 brand Mazda hien tai) nen tra ve TOAN BO 1 lan, FE tu loc/goi y khi go -
// khong can API search rieng/debounce.
function mapRow(row) {
  return {
    id: row.id,
    brandId: row.brand_id,
    modelLine: row.model_line,
    generationCode: row.generation_code,
    bodyType: row.body_type,
    segment: row.segment,
    engineDisplacement: row.engine_displacement != null ? Number(row.engine_displacement) : null,
    drivetrain: row.drivetrain,
    trimName: row.trim_name,
    yearFrom: row.year_from,
    yearTo: row.year_to,
    displayName: row.display_name,
  };
}

class VehicleModelRepository {
  async list({ brandId } = {}) {
    const params = {};
    let where = '1=1';
    if (brandId) {
      where = 'brand_id = @brandId';
      params.brandId = Number(brandId);
    }
    const result = await query(
      `SELECT id, brand_id, model_line, generation_code, body_type, segment,
              engine_displacement, drivetrain, trim_name, year_from, year_to, display_name
       FROM   vehicle_models
       WHERE  ${where}
       ORDER  BY model_line ASC, generation_code ASC, trim_name ASC`,
      params
    );
    return result.recordset.map(mapRow);
  }
}

module.exports = VehicleModelRepository;
