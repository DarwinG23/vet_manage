import type { PermissionDefinition } from '../permissions.catalog.js';

const define = (entries: readonly [PermissionDefinition['key'], string][]): readonly PermissionDefinition[] =>
  entries.map(([key, displayName]) => ({ key, displayName, description: `Permite: ${displayName.toLowerCase()}`, visible: true }));

// HU-27: órdenes de compra a proveedores.
export const PURCHASE_ORDERS_PERMISSIONS = define([
  ['purchase-orders:create', 'Elaborar órdenes de compra'],
  ['purchase-orders:read', 'Consultar órdenes de compra'],
]);
