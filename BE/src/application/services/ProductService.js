const ApiError = require('../../utils/ApiError');
const ProductResponseDto = require('../dto/ProductResponseDto');

/**
 * ProductService - quan ly phu tung.
 * Luu y: KHONG cap nhat stock_quantity qua service nay - stock chi duoc
 * thay doi qua cac thao tac nhap/xuat kho (se lam o phase sau).
 */
const STOCK_FIELDS_NOT_ALLOWED = ['stockQuantity', 'stock_quantity'];

// dd/mm/yyyy HH:mm - dung getter UTC vi mssql (useUTC) doc cot datetime theo
// truc UTC cua JS Date, giong cac DTO khac trong du an.
function toDDMMYYYYHHmm(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()} ${hh}:${mi}`;
}

function stripStockFields(payload) {
  const out = { ...payload };
  for (const f of STOCK_FIELDS_NOT_ALLOWED) {
    delete out[f];
  }
  return out;
}

class ProductService {
  constructor({ productRepository }) {
    this.productRepository = productRepository;
  }

  async getAllProducts({ branchId, status, search, category, lowStockOnly, page, limit } = {}) {
    const [items, total] = await Promise.all([
      this.productRepository.findAll({ branchId, status, search, category, lowStockOnly, page, limit }),
      this.productRepository.count({ branchId, status, search, category, lowStockOnly }),
    ]);
    return {
      items: ProductResponseDto.fromEntityList(items),
      total,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    };
  }

  async getProductById(id) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new ApiError(404, 'Product not found');
    return ProductResponseDto.fromEntity(product);
  }

  async getProductByCode(code, branchId) {
    const product = await this.productRepository.findByCode(code, branchId);
    if (!product) throw new ApiError(404, 'Product not found');
    return ProductResponseDto.fromEntity(product);
  }

  // Bien dong ton kho cua 1 phu tung: tung giao dich nhap (+), hoan (+),
  // xuat (-) kem so du SAU giao dich do. So du tinh NGUOC tu ton hien tai
  // (nguon chan ly) tru dan cac giao dich, khong tin 1 so "ton ban dau" nao
  // ca - vi ton kho co the da bi chinh tay ngoai so cai o giai doan seed.
  async getStockHistory(id) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new ApiError(404, 'Product not found');

    const events = await this.productRepository.findStockHistory(Number(id));
    const currentStock = Number(product.stockQuantity) || 0;

    const signed = events.map((e) => ({
      ...e,
      delta: e.type === 'export' ? -e.quantity : e.quantity,
    }));
    const totalDelta = signed.reduce((s, e) => s + e.delta, 0);
    let balance = currentStock - totalDelta;
    const openingStock = balance;
    const withBalance = signed.map((e) => {
      balance += e.delta;
      return { ...e, balanceAfter: balance, happenedAtLabel: toDDMMYYYYHHmm(e.happenedAt) };
    });

    return {
      productId: product.id,
      currentStock,
      openingStock,
      events: withBalance,
    };
  }

  async createProduct(payload) {
    if (!payload.productName) {
      throw new ApiError(400, 'Product name is required');
    }
    if (!payload.productCode) {
      throw new ApiError(400, 'Product code is required');
    }
    if (!payload.branchId) {
      throw new ApiError(400, 'branchId is required');
    }
    if (!payload.unitId) {
      throw new ApiError(400, 'unitId is required');
    }
    const existing = await this.productRepository.findByCode(payload.productCode, payload.branchId);
    if (existing) {
      throw new ApiError(409, 'Product code already exists in this branch');
    }
    // Dam bao stock_quantity luon bat dau tu 0 khi tao moi (khi chua co phieu nhap).
    const safePayload = stripStockFields(payload);
    const product = await this.productRepository.create(safePayload);
    return ProductResponseDto.fromEntity(product);
  }

  async updateProduct(id, payload) {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Product not found');

    if (payload.productCode && payload.productCode !== existing.productCode) {
      const dup = await this.productRepository.findByCode(
        payload.productCode,
        existing.branchId,
      );
      if (dup) throw new ApiError(409, 'Product code already exists in this branch');
    }

    // Loai bo stock khoi payload de khong cho sua qua API nay.
    const safePayload = stripStockFields(payload);
    const product = await this.productRepository.update(id, safePayload);
    return ProductResponseDto.fromEntity(product);
  }

  async deleteProduct(id) {
    // Soft-disable (status=inactive). Giữ tên method để tương thích controller cũ.
    const deactivated = await this.productRepository.delete(id);
    if (!deactivated) throw new ApiError(404, 'Product not found');
    return ProductResponseDto.fromEntity(deactivated);
  }

  async reactivateProduct(id) {
    const product = await this.productRepository.reactivate(id);
    if (!product) throw new ApiError(404, 'Product not found');
    return ProductResponseDto.fromEntity(product);
  }

  async getCategories() {
    return this.productRepository.getDistinctCategories();
  }

  async markSeenByManager(id) {
    const product = await this.productRepository.markSeenByManager(id);
    if (!product) throw new ApiError(404, 'Product not found');
    return ProductResponseDto.fromEntity(product);
  }

  async countNewForManager(branchId) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    return this.productRepository.countNewForManager(branchId);
  }

  async listUnits() {
    return this.productRepository.listUnits();
  }
}

module.exports = ProductService;