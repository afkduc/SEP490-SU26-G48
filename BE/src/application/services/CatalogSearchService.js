const ApiError = require('../../utils/ApiError');
const { normalizeVietnamese } = require('../../utils/vietnamese');
const { toServiceDto, groupPackageRows, groupPartsByServiceId } = require('../dto/CatalogSearchDto');

class CatalogSearchService {
  constructor(catalogSearchRepository) {
    this.catalogSearchRepository = catalogSearchRepository;
  }

  async search(term, branchId) {
    if (!term || term.trim().length < 2) {
      throw new ApiError(400, 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự');
    }
    if (!branchId) {
      throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    }
    const needle = normalizeVietnamese(term.trim());

    const [allServices, allPackageRows, allPartRows] = await Promise.all([
      this.catalogSearchRepository.findAllActiveServices(branchId),
      this.catalogSearchRepository.findAllActivePackagesWithItems(branchId),
      this.catalogSearchRepository.findAllServiceParts(branchId),
    ]);
    const partsByServiceId = groupPartsByServiceId(allPartRows);

    const services = allServices
      .filter(
        (s) =>
          normalizeVietnamese(s.service_code).includes(needle) ||
          normalizeVietnamese(s.service_name).includes(needle)
      )
      .slice(0, 10)
      .map((s) => toServiceDto(s, partsByServiceId));

    const packages = groupPackageRows(allPackageRows, partsByServiceId).filter(
      (p) => normalizeVietnamese(p.code).includes(needle) || normalizeVietnamese(p.name).includes(needle)
    );

    return { services, packages };
  }
}

module.exports = CatalogSearchService;
