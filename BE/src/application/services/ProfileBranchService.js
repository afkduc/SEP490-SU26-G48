const { query } = require('../../infrastructure/database/sqlServer');
const { resolveAssignedBranches } = require('../../utils/userBranchScope');

/**
 * ProfileBranchService — chi nhánh user từ users.branch_id (NULL = tất cả CN active).
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
   * Lay danh sach chi nhanh user duoc gan (tu users.branch_id).
   */
  async getAssignedBranches(userId) {
    const result = await query(
      'SELECT branch_id FROM users WHERE id = @p1',
      { p1: userId }
    );
    const row = result.recordset[0];
    if (!row) return [];
    return resolveAssignedBranches(row.branch_id);
  }

  /**
   * Profile-branch payload: primary + assignedBranches + branchName hien thi.
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
