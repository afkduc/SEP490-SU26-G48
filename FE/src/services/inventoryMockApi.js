/**
 * Mock API cho module Inventory.
 * Gia lap delay network, validate don gian, loi giong server that.
 *
 * Khi Backend co API that -> thay bang services/supplierApi.js.
 */

import {
  mockSuppliers,
  mockParts,
  mockPartCategories,
  mockStockTransactions,
} from '../mocks/inventoryMockData';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (data) => JSON.parse(JSON.stringify(data));

const notFound = (msg) => {
  const err = new Error(msg);
  err.status = 404;
  return err;
};

const conflict = (msg) => {
  const err = new Error(msg);
  err.status = 409;
  return err;
};

let supplierStore = clone(mockSuppliers);
let partStore = clone(mockParts);

// ===== Suppliers =====

export async function getSuppliersApi(params = {}) {
  await delay();
  let result = clone(supplierStore);
  if (params.status) result = result.filter((s) => s.status === params.status);
  if (params.search) {
    const kw = String(params.search).toLowerCase();
    result = result.filter(
      (s) => s.supplierName.toLowerCase().includes(kw) || s.supplierCode.toLowerCase().includes(kw),
    );
  }
  return { data: result, total: result.length };
}

export async function getSupplierByIdApi(id) {
  await delay();
  const found = supplierStore.find((s) => s.id === Number(id));
  if (!found) throw notFound(`Khong tim thay nha cung cap id=${id}`);
  return { data: clone(found) };
}

export async function createSupplierApi(payload) {
  await delay();
  const exists = supplierStore.find((s) => s.supplierCode === payload.supplierCode);
  if (exists) throw conflict(`Ma nha cung cap "${payload.supplierCode}" da ton tai`);
  const nextId = Math.max(...supplierStore.map((s) => s.id), 0) + 1;
  const created = { id: nextId, ...payload, createdAt: new Date().toISOString() };
  supplierStore.push(created);
  return { data: clone(created) };
}

export async function updateSupplierApi(id, payload) {
  await delay();
  const idx = supplierStore.findIndex((s) => s.id === Number(id));
  if (idx === -1) throw notFound(`Khong tim thay nha cung cap id=${id}`);
  supplierStore[idx] = { ...supplierStore[idx], ...payload, id: Number(id) };
  return { data: clone(supplierStore[idx]) };
}

export async function deleteSupplierApi(id) {
  await delay();
  const idx = supplierStore.findIndex((s) => s.id === Number(id));
  if (idx === -1) throw notFound(`Khong tim thay nha cung cap id=${id}`);
  supplierStore.splice(idx, 1);
  return { data: { id: Number(id), deleted: true } };
}

// ===== Parts =====

export async function getPartsApi(params = {}) {
  await delay();
  let result = clone(partStore);
  if (params.lowStockOnly) result = result.filter((p) => p.stockQuantity < p.minStock);
  if (params.category) result = result.filter((p) => p.category === params.category);
  if (params.search) {
    const kw = String(params.search).toLowerCase();
    result = result.filter(
      (p) => p.partName.toLowerCase().includes(kw) || p.partCode.toLowerCase().includes(kw),
    );
  }
  return { data: result, total: result.length };
}

export async function getPartCategoriesApi() {
  await delay();
  return { data: clone(mockPartCategories) };
}

// ===== Stock / Dashboard =====

export async function getStockSummaryApi() {
  await delay();
  const totalParts = partStore.length;
  const totalStockValue = partStore.reduce(
    (sum, p) => sum + p.stockQuantity * (p.unitPrice ?? 0),
    0,
  );
  const lowStockCount = partStore.filter((p) => p.stockQuantity < p.minStock).length;
  const outOfStockCount = partStore.filter((p) => p.stockQuantity === 0).length;
  return { data: { totalParts, totalStockValue, lowStockCount, outOfStockCount } };
}

export async function getStockHistoryApi(partId) {
  await delay();
  const result = mockStockTransactions.filter((t) => t.partId === Number(partId));
  return { data: clone(result) };
}
