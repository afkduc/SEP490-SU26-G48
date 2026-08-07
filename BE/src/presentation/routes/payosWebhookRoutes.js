const express = require('express');
const { makeRepairSettlementService } = require('../../application/services');

// PayOS goi endpoint nay truc tiep tu server cua ho (khong co JWT) nen KHONG
// duoc dat sau middleware authenticate() - xac thuc that su nam o chu ky
// HMAC trong service.handlePayosWebhook (payos.webhooks.verify). Luon tra ve
// 2xx du thanh cong hay khong de PayOS khong retry lien tuc; loi (vd sai chu
// ky, khong tim thay giao dich) chi log lai de dieu tra.
function buildPayosWebhookRouter() {
  const router = express.Router();
  const repairSettlementService = makeRepairSettlementService();

  router.post('/webhook', async (req, res) => {
    try {
      await repairSettlementService.handlePayosWebhook(req.body, req);
    } catch (err) {
      console.warn('[payos webhook]', err.message);
    }
    return res.status(200).json({ success: true });
  });

  return router;
}

module.exports = buildPayosWebhookRouter;
