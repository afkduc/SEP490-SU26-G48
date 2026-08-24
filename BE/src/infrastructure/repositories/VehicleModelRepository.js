const { query } = require('../database/sqlServer');

// Catalog dong xe/doi xe that (vehicle_models) - dung de CVDV chon dung khi
// dang ky xe MOI, thay vi go tu do vao "Loai xe" nhu truoc (khong lien ket
// duoc voi catalog, khong biet dung phu tung theo doi nao). Chi ~50-60 dong
// nen tra ve TOAN BO 1 lan, FE tu loc/goi y khi go - khong can API search
// rieng/debounce.
//
// Khong con loc theo hang xe: AutoGara chi nhan Mazda nen bang `brands` da
// duoc bo (xem ensureDropBrands.js), moi dong o day deu la Mazda.
function mapRow(row) {
  return {
    id: row.id,
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
  async list() {
    const result = await query(
      `SELECT id, model_line, generation_code, body_type, segment,
              engine_displacement, drivetrain, trim_name, year_from, year_to, display_name
       FROM   vehicle_models
       ORDER  BY model_line ASC, generation_code ASC, trim_name ASC`
    );
    return result.recordset.map(mapRow);
  }
}

module.exports = VehicleModelRepository;
