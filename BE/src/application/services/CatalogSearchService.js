const ApiError = require('../../utils/ApiError');
const { normalizeVietnamese } = require('../../utils/vietnamese');
const { toServiceDto, groupPackageRows } = require('../dto/CatalogSearchDto');

class CatalogSearchService {
  constructor(catalogSearchRepository) {
    this.catalogSearchRepository = catalogSearchRepository;
  }

  async search(term) {
    if (!term || term.trim().length < 2) {
      throw new ApiError(400, 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự');
    }
    const needle = normalizeVietnamese(term.trim());

    const [allServices, allPackageRows] = await Promise.all([
      this.catalogSearchRepository.findAllActiveServices(),
      this.catalogSearchRepository.findAllActivePackagesWithItems(),
    ]);

    const services = allServices
      .filter(
        (s) =>
          normalizeVietnamese(s.service_code).includes(needle) ||
          normalizeVietnamese(s.service_name).includes(needle)
      )
      .slice(0, 10)
      .map(toServiceDto);

    const packages = groupPackageRows(allPackageRows).filter(
      (p) => normalizeVietnamese(p.code).includes(needle) || normalizeVietnamese(p.name).includes(needle)
    );

    return { services, packages };
  }
}

module.exports = CatalogSearchService;
