const { query } = require('../../infrastructure/database/sqlServer');

/**
 * ProfileBranchService
 *
 * Gom cac query lien quan den chi nhanh cua user, phuc vu cho
 * ProfileController. Truoc day logic nay nam trong
 * ProfileRepositoryImpl.findById (goi leftJoinUserBranches).
 *
 * Tach ra service rieng de:
 *   - Repository chi chiu trach nhiem lay row user (Single Responsibility).
 *   - Controller co the gọi tuy ý khi can, khong phai mutate repository.
 *   - De test va sua sau (VD: cache, sort, filter is_active).
 */
class ProfileBranchService {
  /**
   * Lay chi nhanh chinh cua user (users.branch_id) + ten hien thi.
   * Tra ve { branchId, branchName } hoac null.
   */
  async getPrimaryBranch(userId) {
    const result = await query(
      `SELECT u.branch_id, b.branch_name
       FROM   users u
       LEFT   JOIN branches b ON b.id = u.branch_id
       WHERE  u.id = @p1`,
      { p1: userId }
    );
    const row = result.recordset[0];
    if (!row || !row.branch_id) return null;
    return { branchId: row.branch_id, branchName: row.branch_name || null };
  }

  /**
   * Lay danh sach chi nhanh user duoc gan qua bang user_branches.
   * Tra ve [{ branchId, branchName }] (co the rong neu user chua duoc gan).
   */
  async getAssignedBranches(userId) {
    const result = await query(
      `SELECT ub.branch_id, b.branch_name
       FROM   user_branches ub
       LEFT   JOIN branches b ON b.id = ub.branch_id
       WHERE  ub.user_id = @p1
       ORDER  BY b.branch_name ASC`,
      { p1: userId }
    );
    return result.recordset.map((row) => ({
      branchId: row.branch_id,
      branchName: row.branch_name || null,
    }));
  }

  /**
   * Ham tien ich: tra ve profile-branch payload day du cho 1 user.
   * - primary: { branchId, branchName } tu users.branch_id
   * - assignedBranches: [{ branchId, branchName }] tu user_branches
   * - branchName (display string): "Ten1, Ten2" neu co nhieu row,
   *   nguoc lai dung ten primary neu assignedBranches rong.
   *
   * Tra ve object luon co assignedBranches (co the la []).
   */
  async getProfileBranches(userId) {
    const [primary, assignedBranches] = await Promise.all([
      this.getPrimaryBranch(userId),
      this.getAssignedBranches(userId),
    ]);

    let branchName = null;
    if (assignedBranches.length === 1) {
      branchName = assignedBranches[0].branchName;
    } else if (assignedBranches.length > 1) {
      branchName = assignedBranches
        .map((b) => b.branchName)
        .filter(Boolean)
        .join(', ');
    } else if (primary) {
      branchName = primary.branchName;
    }

    return {
      branchId: primary ? primary.branchId : null,
      branchName,
      assignedBranches,
    };
  }
}

module.exports = ProfileBranchService;