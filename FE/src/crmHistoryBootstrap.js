/**
 * Patch History API TRƯỚC mọi import react-router.
 * Marker __CRM_URL_BUILD__ dùng để kiểm tra prod đã nhận bundle mới chưa.
 */
import { ensureCrmHistoryBase } from './utils/ensureCrmHistoryBase';

if (typeof window !== 'undefined') {
  window.__CRM_URL_BUILD__ = '2026-08-07-crm-v3';
}

ensureCrmHistoryBase();
