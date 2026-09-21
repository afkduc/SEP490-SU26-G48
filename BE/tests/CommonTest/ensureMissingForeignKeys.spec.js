// Kiem tra khai bao migration khoa ngoai (khong cham DB): moi FK deu co ten
// rieng, don mo coi dung cach, va audit_logs.user_id CO Y khong duoc noi.
jest.mock('mssql', () => ({ Transaction: jest.fn() }));
jest.mock('../../src/infrastructure/database/sqlServer', () => ({ getPool: jest.fn() }));

const { FKS, STEPS, countOrphans } = require('../../src/infrastructure/database/ensureMissingForeignKeys');

describe('ensureMissingForeignKeys - khai bao', () => {
  test('15 FK, ten khong trung, moi FK 1 buoc + 1 buoc doi kieu cot', () => {
    expect(FKS).toHaveLength(15);
    expect(new Set(FKS.map(([, , , fk]) => fk)).size).toBe(15);
    expect(STEPS).toHaveLength(16);
    expect(STEPS[0][0]).toMatch(/password_reset_tokens\.user_id INT -> BIGINT/);
  });

  test('moi buoc them FK deu idempotent va don mo coi TRUOC khi ADD CONSTRAINT', () => {
    for (const [label, statement] of STEPS.slice(1)) {
      expect(statement).toContain("IF OBJECT_ID('dbo.");
      expect(statement).toContain('IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys');
      const don = Math.max(statement.indexOf('DELETE c FROM'), statement.indexOf('UPDATE c SET'));
      const add = statement.indexOf('ADD CONSTRAINT');
      expect(don).toBeGreaterThan(-1);
      expect(add).toBeGreaterThan(don);
      expect(label).toMatch(/ -> /);
    }
  });

  test('CASCADE chi cho 4 bang con thuan cua users; repair_orders.bay_id SET NULL', () => {
    const cascade = FKS.filter(([, , , , del]) => del === 'CASCADE').map(([bang]) => bang).sort();
    expect(cascade).toEqual(['login_sessions', 'notifications', 'password_reset_tokens', 'security_alerts']);
    const bay = FKS.find(([bang, cot]) => bang === 'repair_orders' && cot === 'bay_id');
    expect(bay[4]).toBe('SET NULL');
    for (const [, , , , del] of FKS) expect(['CASCADE', 'SET NULL', 'NO ACTION']).toContain(del);
  });

  test('audit_logs: chi noi branch_id, KHONG noi user_id (giu log khi xoa user)', () => {
    const audit = FKS.filter(([bang]) => bang === 'audit_logs');
    expect(audit.map(([, cot]) => cot)).toEqual(['branch_id']);
  });

  test('countOrphans bo qua bang chua ton tai (-1) va chi bao FK co mo coi', async () => {
    const traLoi = Array(15).fill(0);
    traLoi[3] = 5;   // FK thu 4 co 5 dong mo coi
    traLoi[4] = -1;  // bang cua FK thu 5 chua ton tai
    const request = { query: jest.fn(async () => ({ recordset: [{ n: traLoi.shift() }] })) };
    const out = await countOrphans(request);
    expect(request.query).toHaveBeenCalledTimes(15);
    expect(out).toEqual([{ fk: FKS[3][3], bang: FKS[3][0], cot: FKS[3][1], n: 5, don: FKS[3][5] }]);
  });
});
