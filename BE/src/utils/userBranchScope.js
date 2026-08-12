const { query } = require('../infrastructure/database/sqlServer');

/**
 * Phạm vi chi nhánh user — chỉ dựa trên users.branch_id (không dùng user_branches).
 * branch_id = NULL => tất cả chi nhánh active (scopeAllBranches).
 */
async function getActiveBranchRows() {
  const r = await query(
    `SELECT id AS branch_id, branch_name
     FROM   branches
     WHERE  is_active = 1
     ORDER  BY branch_name ASC`
  );
  return r.recordset.map((row) => ({
    branchId: row.branch_id,
    branchName: row.branch_name || null,
  }));
}

/** SQL expression for list/detail queries (replaces COUNT from user_branches). */
function assignedBranchCountSql(userAlias = 'u') {
  return `CASE
    WHEN ${userAlias}.branch_id IS NULL THEN (
      SELECT COUNT(*) FROM branches b_scope_cnt WHERE b_scope_cnt.is_active = 1
    )
    ELSE 1
  END AS assigned_branch_count`;
}

async function resolveAssignedBranchIds(branchId) {
  if (branchId === null || branchId === undefined) {
    const rows = await getActiveBranchRows();
    return rows.map((b) => b.branchId);
  }
  const id = Number(branchId);
  return Number.isFinite(id) && id > 0 ? [id] : [];
}

async function resolveAssignedBranches(branchId) {
  if (branchId === null || branchId === undefined) {
    return getActiveBranchRows();
  }
  const id = Number(branchId);
  if (!Number.isFinite(id) || id <= 0) return [];
  const r = await query(
    `SELECT b.id AS branch_id, b.branch_name
     FROM   branches b
     WHERE  b.id = @p1`,
    { p1: id }
  );
  const row = r.recordset[0];
  if (!row) return [];
  return [{ branchId: row.branch_id, branchName: row.branch_name || null }];
}

module.exports = {
  getActiveBranchRows,
  assignedBranchCountSql,
  resolveAssignedBranchIds,
  resolveAssignedBranches,
};
