/**
 * Lệnh sửa chữa – mock API để làm trước phần giao diện, chưa có BE.
 * Khi BE sẵn sàng, thay bằng services/repairOrderApi.js (gọi /api/repair-orders/*).
 */

import { mockQuotes, mockRepairOrders, mockTechnicians } from '../mocks/repairOrderMockData';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (data) => JSON.parse(JSON.stringify(data));

const notFound = (msg) => {
  const err = new Error(msg);
  err.status = 404;
  return err;
};

let repairOrderStore = clone(mockRepairOrders);

export async function listTechniciansApi() {
  await delay();
  return { data: clone(mockTechnicians) };
}

export async function listQuotesApi() {
  await delay();
  return { data: clone(mockQuotes) };
}

export async function getQuoteApi(id) {
  await delay();
  const found = mockQuotes.find((q) => q.id === Number(id));
  if (!found) throw notFound(`Không tìm thấy phiếu báo giá id=${id}`);
  return { data: clone(found) };
}

export async function listRepairOrdersApi() {
  await delay();
  return { data: clone(repairOrderStore) };
}

export async function createRepairOrderApi(payload) {
  await delay();
  const quote = mockQuotes.find((q) => q.id === Number(payload.quoteId));
  if (!quote) throw notFound(`Không tìm thấy phiếu báo giá id=${payload.quoteId}`);
  const nextId = Math.max(...repairOrderStore.map((o) => o.id), 0) + 1;
  const created = {
    id: nextId,
    code: `LSC-2024-${String(nextId).padStart(3, '0')}`,
    quoteId: quote.id,
    customer: quote.customer,
    vehicle: quote.vehicle,
    priority: payload.priority,
    note: payload.note || '',
    technicians: payload.technicians,
    createdAt: new Date().toLocaleDateString('vi-VN'),
  };
  repairOrderStore.push(created);
  return { data: clone(created) };
}
