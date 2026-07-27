const ApiError = require('../../utils/ApiError');
const ProductResponseDto = require('../dto/ProductResponseDto');

/**
 * ProductService - quan ly phu tung.
 * Luu y: KHONG cap nhat stock_quantity qua service nay - stock chi duoc
 * thay doi qua cac thao tac nhap/xuat kho (se lam o phase sau).
 */
const STOCK_FIELDS_NOT_ALLOWED = ['stockQuantity', 'stock_quantity'];

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

  async listUnits() {
    return this.productRepository.listUnits();
  }
}

module.exports = ProductService;