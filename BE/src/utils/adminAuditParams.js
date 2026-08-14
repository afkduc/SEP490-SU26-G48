/**
 * Serialize / deserialize Audit Logs URL filters (Report 5.1 — Admin Audit Logs).
 */

function readAuditParamsFromSearch(sp) {
  const out = {};
  const keys = [
    'keyword',
    'userName',
    'phone',
    'action',
    'tableName',
    'entityName',
    'entityCode',
    'ipAddress',
    'requestMethod',
    'responseStatus',
    'startDate',
    'endDate',
    'branchId',
    'page',
  ];
  keys.forEach((k) => {
    const v = sp.get(k);
    if (v == null || v === '') return;
    if (k === 'page' || k === 'branchId' || k === 'responseStatus') {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
      return;
    }
    out[k] = v;
  });
  return out;
}

function writeAuditParamsToSearch(params) {
  const next = new URLSearchParams();
  const put = (k, v) => {
    if (v === undefined || v === null || v === '') return;
    next.set(k, String(v));
  };
  put('keyword', params.keyword);
  put('userName', params.userName);
  put('phone', params.phone);
  put('action', params.action);
  put('tableName', params.tableName);
  put('entityName', params.entityName);
  put('entityCode', params.entityCode);
  put('ipAddress', params.ipAddress);
  put('requestMethod', params.requestMethod);
  put('responseStatus', params.responseStatus);
  put('startDate', params.startDate);
  put('endDate', params.endDate);
  put('branchId', params.branchId);
  if (params.page > 1) put('page', params.page);
  return next.toString();
}

module.exports = {
  readAuditParamsFromSearch,
  writeAuditParamsToSearch,
};
