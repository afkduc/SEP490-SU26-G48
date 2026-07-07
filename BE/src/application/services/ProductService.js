const ApiError = require('../../utils/ApiError');
const ProductResponseDto = require('../dto/ProductResponseDto');

class ProductService {
  constructor({ productRepository }) {
    this.productRepository = productRepository;
  }

  async getAllProducts({ branchId, status, search, category, page, limit } = {}) {
    const [items, total] = await Promise.all([
      this.productRepository.findAll({ branchId, status, search, category, page, limit }),
      this.productRepository.count({ branchId, status, search, category }),
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

  async getProductByCode(code) {
    const product = await this.productRepository.findByCode(code);
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
    const existing = await this.productRepository.findByCode(payload.productCode);
    if (existing) {
      throw new ApiError(409, 'Product code already exists');
    }
    const product = await this.productRepository.create(payload);
    return ProductResponseDto.fromEntity(product);
  }

  async updateProduct(id, payload) {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Product not found');

    if (payload.productCode && payload.productCode !== existing.productCode) {
      const dup = await this.productRepository.findByCode(payload.productCode);
      if (dup) throw new ApiError(409, 'Product code already exists');
    }

    const product = await this.productRepository.update(id, payload);
    return ProductResponseDto.fromEntity(product);
  }

  async deleteProduct(id) {
    const deleted = await this.productRepository.delete(id);
    if (!deleted) throw new ApiError(404, 'Product not found');
    return ProductResponseDto.fromEntity(deleted);
  }
}

module.exports = ProductService;
