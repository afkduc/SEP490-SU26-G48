const { getPool } = require('./sqlServer');

// payment_method: 'TRANSFER' (PayOS, tu dong qua webhook) | 'CASH' (CVDV bam
// xac nhan da thu tien mat tay) - xem RepairSettlementService.updateStatus/
// handlePayosWebhook.
async function ensureInvoicePaymentMethod() {
  const pool = await getPool();
  await pool.request().query(`
    IF COL_LENGTH('dbo.invoices', 'payment_method') IS NULL
      ALTER TABLE dbo.invoices ADD payment_method NVARCHAR(20) NULL;
  `);
}

module.exports = { ensureInvoicePaymentMethod };
