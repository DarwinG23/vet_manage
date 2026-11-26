import { getJson, postJson } from '../../../infrastructure/api/http-client';
import type { PurchaseOrder, PurchaseOrderInput, PurchaseOrderListResponse } from '../types';

export const purchaseOrdersApi = {
  list(query: { page: number; pageSize: number }) {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    return getJson<PurchaseOrderListResponse>(`/purchase-orders?${params.toString()}`);
  },

  get(id: string) {
    return getJson<PurchaseOrder>(`/purchase-orders/${encodeURIComponent(id)}`);
  },

  create(input: PurchaseOrderInput) {
    return postJson<PurchaseOrder, PurchaseOrderInput>('/purchase-orders', input);
  },
};
