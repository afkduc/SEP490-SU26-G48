const { query } = require('../database/sqlServer');

// Catalog dong xe/doi xe that (vehicle_models) - dung de CVDV chon dung khi
// dang ky xe MOI, thay vi go tu do vao "Loai xe" nhu truoc (khong lien ket
// duoc voi catalog, khong biet dung phu tung theo doi nao). Catalog da duoc
// rut gon con ~12 dong (moi dong xe chi giu 1-2 ban dai dien Luxury/Premium)
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
    trimName: row.trim_name,
    segment: row.segment,
    yearFrom: row.year_from,
    yearTo: row.year_to,
    displayName: row.display_name,
  };
}

const SELECT_COLS = 'id, model_line, generation_code, trim_name, segment, year_from, year_to, display_name';

class VehicleModelRepository {
  async list() {
    const result = await query(
      `SELECT ${SELECT_COLS}
       FROM   vehicle_models
       ORDER  BY model_line ASC, generation_code ASC, trim_name ASC`
    );
    return result.recordset.map(mapRow);
  }

  // 3 phan khuc dang co - FE dung lam dropdown, khong hard-code de sau nay
  // them phan khuc moi (vd MPV) chi can co 1 dong trong DB.
  async listSegments() {
    const result = await query(`SELECT DISTINCT segment FROM vehicle_models ORDER BY segment`);
    return result.recordset.map((r) => r.segment);
  }

  // Trung bo (model_line, generation_code, trim_name) -> DB da co unique
  // index vehicle_models_uq; kiem truoc de bao ro thay vi loi trung khoa.
  async findByKey(modelLine, generationCode, trimName) {
    const result = await query(
      `SELECT ${SELECT_COLS} FROM vehicle_models
       WHERE model_line = @modelLine AND generation_code = @generationCode AND trim_name = @trimName`,
      { modelLine, generationCode, trimName }
    );
    return result.recordset[0] ? mapRow(result.recordset[0]) : null;
  }

  // year_from/year_to de NULL - chi la ghi chu, khong logic nao dung (xem
  // ensureVehicleModelYearOptional.js).
  async create({ modelLine, generationCode, trimName, segment, displayName }) {
    const result = await query(
      `INSERT INTO vehicle_models (model_line, generation_code, trim_name, segment, display_name)
       OUTPUT INSERTED.${SELECT_COLS.replace(/, /g, ', INSERTED.')}
       VALUES (@modelLine, @generationCode, @trimName, @segment, @displayName)`,
      { modelLine, generationCode, trimName, segment, displayName }
    );
    return mapRow(result.recordset[0]);
  }
}

module.exports = VehicleModelRepository;
