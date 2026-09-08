const ApiError = require('../../utils/ApiError');
const { normalizeVietnamese } = require('../../utils/vietnamese');
const { toServiceDto, groupPackageRows, groupPartsByServiceId } = require('../dto/CatalogSearchDto');

class CatalogSearchService {
  constructor(catalogSearchRepository) {
    this.catalogSearchRepository = catalogSearchRepository;
  }

  // modelId: doi xe cua chiec dang lap phieu. Loc o DAY chu khong de FE loc,
  // vi danh sach dich vu bi cat con 10 dong - de FE loc thi 10 dong lay ve co
  // the toan dich vu cua doi xe khac, dung cai can tim thi da bi cat mat.
  //
  // Chi loc bo dich vu/goi cua doi xe KHAC; loai dung chung (model_id NULL)
  // van giu vi ap cho moi xe.
  async search(term, branchId, modelId = null) {
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

    const dungChoXeNay = (idOfRow) => !modelId || !idOfRow || String(idOfRow) === String(modelId);

    const services = allServices
      .filter(
        (s) =>
          normalizeVietnamese(s.service_code).includes(needle) ||
          normalizeVietnamese(s.service_name).includes(needle)
      )
      .filter((s) => dungChoXeNay(s.model_id))
      .slice(0, 10)
      .map((s) => toServiceDto(s, partsByServiceId));

    const packages = groupPackageRows(allPackageRows, partsByServiceId)
      .filter((p) => normalizeVietnamese(p.code).includes(needle) || normalizeVietnamese(p.name).includes(needle))
      .filter((p) => dungChoXeNay(p.modelId));

    return { services, packages };
  }
}

module.exports = CatalogSearchService;
