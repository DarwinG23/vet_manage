-- HU-11: aplica el permiso nuevo a roles estándar ya existentes sin modificar
-- asignaciones de roles cuyos permisos se personalizaron desde la aplicación.
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at", "updated_at")
SELECT role."id", permission."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" AS role
JOIN "permissions" AS permission
  ON permission."module" = 'inventory'
 AND permission."action" = 'adjust-stock'
WHERE role."name" IN ('manager', 'warehouse_keeper')
  AND role."permissions_customized" = false
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
