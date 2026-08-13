# UX Guidelines — Vertex Platform

Estándares de estados de carga y feedback del panel SaaS.

## Reglas generales

1. **Todo botón que dispara una operación async** debe:
   - Deshabilitarse mientras corre (`[disabled]="isX()"`).
   - Mostrar un `<span class="spinner-sm"></span>` + texto en progreso ("Guardando…",
     "Desplegando…", etc.).
2. **Listas y datos bajo demanda** deben mostrar un **skeleton** mientras cargan
   (no "vacío" prematuro). Ver `stores-list` → `stores.isLoading()`.
3. **Errores** siempre visibles cerca de la acción (`.feedback--error`), con `errorMessage()`
   de `@core/utils/error.util`.
4. **Éxitos** confirmados con `.feedback--success` (ej. "Actualización a v0.2.0 iniciada…").
5. **Modales destructivos** requieren confirmación con el valor exacto (ej. el projectId)
   y spinner en el botón de confirmar.

## Inventario de estados de carga (store-detail)

| Acción | Signal | Spinner |
|---|---|---|
| Reintentar aprovisionamiento | `isRetrying` | ✅ |
| Eliminar tienda | `isDeleting` | ✅ |
| Auto-update toggle | `isUpdatingAutoUpdate` | ✅ |
| Cargar versiones disponibles | `isLoadingVersions` | ✅ (texto) |
| Aplicar versión | `isUpdatingVersion` | ✅ "Iniciando deploy…" |
| Re-desplegar versión activa | `isRedeploying` | ✅ "Desplegando…" |
| Semillar datos | `isSeeding` | ✅ |
| Dormir/activar tienda | `isSuspending` | ✅ (modal) |
| Cargar config | `isLoadingConfig` | ✅ spinner |
| Guardar ajustes reactivos | `isSavingConfig` | ✅ |
| Cargar staff | `isLoadingStaff` | ✅ |
| Enviar invitación | — | ✅ |
| Vincular dominio | `isConnectingDomain` | ✅ |

## Listas

- `stores-list`: skeleton shimmer mientras `StoresService.isLoading()` (primer snapshot).

## Patrón skeleton (SCSS)

```scss
.skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,.06) 25%, rgba(255,255,255,.14) 50%, rgba(255,255,255,.06) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```
