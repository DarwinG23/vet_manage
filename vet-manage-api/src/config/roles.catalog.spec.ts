import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from './permissions.catalog.js';
import { ROLES } from './roles.catalog.js';

const SUPPLIER_PERMISSIONS = [
  'suppliers:create',
  'suppliers:read',
  'suppliers:update',
  'suppliers:deactivate',
] as const;

describe('RBAC de proveedores', () => {
  it('incluye el catálogo de permisos de proveedores', () => {
    expect(PERMISSIONS.filter(({ key }) => key.startsWith('suppliers:')).map(({ key }) => key))
      .toEqual(SUPPLIER_PERMISSIONS);
  });

  it('asigna permisos de proveedores al Gerente y los incorpora al Superadministrador de pruebas', () => {
    const manager = ROLES.find(({ name }) => name === 'manager');
    const superadmin = ROLES.find(({ name }) => name === 'superadmin');

    expect(manager?.permissions).toEqual(expect.arrayContaining(SUPPLIER_PERMISSIONS));
    expect(superadmin?.permissions).toEqual(expect.arrayContaining(SUPPLIER_PERMISSIONS));
  });

  it('no concede permisos de proveedores automáticamente a otros roles operativos', () => {
    const otherOperationalRoles = ROLES.filter(({ name }) =>
      !['manager', 'superadmin', 'client'].includes(name),
    );

    for (const role of otherOperationalRoles) {
      expect(role.permissions.filter((key) => key.startsWith('suppliers:')), role.name).toEqual([]);
    }
  });
});

describe('RBAC de órdenes de compra (HU-27)', () => {
  const PURCHASE_ORDER_PERMISSIONS = ['purchase-orders:create', 'purchase-orders:read'] as const;

  it('incluye el catálogo de permisos de órdenes de compra', () => {
    expect(PERMISSIONS.filter(({ key }) => key.startsWith('purchase-orders:')).map(({ key }) => key))
      .toEqual(PURCHASE_ORDER_PERMISSIONS);
  });

  it('asigna los permisos al Gerente y al Superadministrador de pruebas, y a ningún otro rol', () => {
    for (const role of ROLES) {
      const granted = role.permissions.filter((key) => key.startsWith('purchase-orders:'));
      expect(granted, role.name).toEqual(['manager', 'superadmin'].includes(role.name) ? PURCHASE_ORDER_PERMISSIONS : []);
    }
  });
});
