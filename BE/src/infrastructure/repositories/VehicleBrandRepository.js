const { query } = require('../database/sqlServer');

/** brand_code varchar(20) trong DB */
const BRAND_CODE_MAX = 20;
/** Default theo seed DB: Mazda 5 năm / 100000 km */
const DEFAULT_WARRANTY_YEARS = 5;
const DEFAULT_WARRANTY_KM = 100000;

/**
 * Sinh brand_code tu ten hang (DB brands.brand_code NOT NULL varchar(20)).
 * Vi du: "Toyota" -> "TOYOTA", "Mercedes-Benz" -> "MERCEDES_BENZ"
 */
function toBrandCode(name, maxLen = BRAND_CODE_MAX) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen);
  return base || 'BRAND';
}

function mapBrandRow(row) {
  return {
    id: row.id,
    brandCode: row.brand_code,
    brandName: row.brand_name,
    warrantyYears: Number(row.warranty_years) || DEFAULT_WARRANTY_YEARS,
    warrantyKm: Number(row.warranty_km) || DEFAULT_WARRANTY_KM,
    isActive: row.is_active === 1 || row.is_active === true,
    sortOrder: Number(row.sort_order) || 0,
  };
}

class VehicleBrandRepository {
  async ensureColumns() {
    await query(`
      IF COL_LENGTH('brands', 'is_active') IS NULL
        ALTER TABLE brands ADD is_active BIT NOT NULL CONSTRAINT DF_brands_is_active DEFAULT 1;
    `);
    await query(`
      IF COL_LENGTH('brands', 'sort_order') IS NULL
        ALTER TABLE brands ADD sort_order INT NOT NULL CONSTRAINT DF_brands_sort_order DEFAULT 0;
    `);
  }

  async list({ includeInactive = true } = {}) {
    await this.ensureColumns();
    const where = includeInactive ? '1=1' : 'ISNULL(b.is_active, 1) = 1';
    const result = await query(`
      SELECT b.id, b.brand_code, b.brand_name,
             b.warranty_years, b.warranty_km,
             ISNULL(b.is_active, 1) AS is_active,
             ISNULL(b.sort_order, 0) AS sort_order
      FROM brands b
      WHERE ${where}
      ORDER BY ISNULL(b.sort_order, 0) ASC, b.brand_name ASC
    `);
    return result.recordset.map(mapBrandRow);
  }

  /**
   * Tao brand_code duy nhat (neu trung thi them _2, _3...), max 20 ky tu.
   */
  async allocateBrandCode(brandName, preferredCode) {
    const preferred = preferredCode
      ? toBrandCode(preferredCode)
      : toBrandCode(brandName);
    let candidate = preferred;
    let n = 1;
    while (n <= 50) {
      const existing = await query(
        `SELECT TOP 1 id FROM brands WHERE brand_code = @p1`,
        { p1: candidate }
      );
      if (!existing.recordset.length) return candidate;
      n += 1;
      const suffix = `_${n}`;
      candidate = `${preferred.slice(0, BRAND_CODE_MAX - suffix.length)}${suffix}`;
    }
    const stamp = Date.now().toString(36).toUpperCase();
    return toBrandCode(`${preferred}_${stamp}`);
  }

  async create({
    brandName,
    brandCode,
    sortOrder = 0,
    warrantyYears = DEFAULT_WARRANTY_YEARS,
    warrantyKm = DEFAULT_WARRANTY_KM,
  }) {
    await this.ensureColumns();
    const code = await this.allocateBrandCode(brandName, brandCode);
    const years = Number(warrantyYears);
    const km = Number(warrantyKm);
    const result = await query(
      `
      INSERT INTO brands (brand_code, brand_name, warranty_years, warranty_km, is_active, sort_order)
      OUTPUT INSERTED.id, INSERTED.brand_code, INSERTED.brand_name,
             INSERTED.warranty_years, INSERTED.warranty_km,
             INSERTED.is_active, INSERTED.sort_order
      VALUES (@p0, @p1, @pYears, @pKm, 1, @p2)
      `,
      {
        p0: code,
        p1: brandName,
        pYears: Number.isFinite(years) && years > 0 ? years : DEFAULT_WARRANTY_YEARS,
        pKm: Number.isFinite(km) && km > 0 ? km : DEFAULT_WARRANTY_KM,
        p2: Number(sortOrder) || 0,
      }
    );
    return mapBrandRow(result.recordset[0]);
  }

  async update(id, { brandName, brandCode, sortOrder, warrantyYears, warrantyKm }) {
    await this.ensureColumns();
    const updates = [];
    const params = { pId: id };
    if (brandName !== undefined) {
      updates.push('brand_name = @pName');
      params.pName = brandName;
    }
    if (brandCode !== undefined && String(brandCode).trim()) {
      updates.push('brand_code = @pCode');
      params.pCode = toBrandCode(brandCode);
    }
    if (sortOrder !== undefined) {
      updates.push('sort_order = @pSort');
      params.pSort = Number(sortOrder) || 0;
    }
    if (warrantyYears !== undefined) {
      updates.push('warranty_years = @pYears');
      params.pYears = Number(warrantyYears) || DEFAULT_WARRANTY_YEARS;
    }
    if (warrantyKm !== undefined) {
      updates.push('warranty_km = @pKm');
      params.pKm = Number(warrantyKm) || DEFAULT_WARRANTY_KM;
    }
    if (!updates.length) {
      const list = await this.list();
      return list.find((b) => b.id === Number(id)) || null;
    }
    await query(`UPDATE brands SET ${updates.join(', ')} WHERE id = @pId`, params);
    const list = await this.list();
    return list.find((b) => b.id === Number(id)) || null;
  }

  async toggleStatus(id) {
    await this.ensureColumns();
    await query(
      `UPDATE brands SET is_active = CASE WHEN ISNULL(is_active, 1) = 1 THEN 0 ELSE 1 END WHERE id = @p1`,
      { p1: id }
    );
    const list = await this.list();
    return list.find((b) => b.id === Number(id)) || null;
  }
}

module.exports = VehicleBrandRepository;
