# Checklist

## Código
✅ Errores de consola  
✅ Email al asignar admin de tienda  
✅ Vista Staff — errores y estética  
✅ Roles reales en Staff  
✅ Error al agregar usuario como admin  
✅ Login y token refresh  
✅ Cerrar sesión  
✅ Flujo de invitaciones  
✅ Error al generar tienda  
✅ Email manager — botón guardar  
✅ Mercado Pago — webhook automático y validación de Public Key  
✅ Cambio de dominio — funciones verificadas  
✅ Instalación automática de extensión de email por tienda  
✅ Cobertura vitest functions vertex-platform  
✅ Bundle size budget corregido  
✅ Staff duplicado — guard de email ya autorizado  
✅ Domain regex — rechaza doble punto y punto al final  
✅ storeId validation en connectDomain y verifyDomain  
✅ projectId null-guard en funciones de dominio  
✅ autoSlug — normalización unicode (acentos)  
✅ customDomain validator en store-create  

## Tests unitarios
✅ ecommerce-vertex — 125 tests  
✅ vertex-platform functions — 28 tests  
✅ vertex-platform app — 28 tests  
✅ connectDomain — 3 casos  
✅ verifyDomain — 4 casos  

## E2E
✅ Login y autenticación (ambos repos)  
✅ Crear / listar / eliminar tiendas  
✅ Catálogo, carrito, checkout  
✅ Protección de rutas  
✅ Staff management (4 suites: list, add, duplicate, self-remove)  
✅ Email manager (load, dirty, save, restore defaults, test modal)  
✅ Cerrar sesión (guard redirect + header logout)  
✅ Mercado Pago — warning Public Key  
✅ Cambio de dominio (connect, DNS records, pending/live status, invalid format)  
✅ Staff invitaciones vertex-platform (send, validation, list)  

## Acciones manuales
❌ SMTP — crear App Password en myaccount.google.com/apppasswords (`vertex.tech.dev@gmail.com`)  
❌ SMTP — subir secreto `ext-firestore-send-email-SMTP_PASSWORD` en dev y prod  
❌ Verificar que las credenciales OAuth de aprovisionamiento no expiraron  
❌ Probar aprovisionamiento de tienda en dev y confirmar que el paso 8 completa  

## Deploy
❌ ecommerce-vertex → develop → main  
❌ vertex-platform → develop → main  
