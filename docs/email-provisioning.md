# Guía de Aprovisionamiento de Emails (Firebase Trigger Email)

Esta guía detalla los pasos críticos necesarios para garantizar la **provisión real y efectiva** del motor de emails (`firebase-trigger-email`) en cada tienda aprovisionada por la plataforma **Vertex**.

---

## ¿Por qué es necesario este proceso?

Durante la creación y aprovisionamiento de una tienda en la plataforma Vertex (ejecutado en `provisioning.ts`), el sistema siembra de manera automática los documentos iniciales en Firestore:
* `settings/emailTemplates`: Contiene el asunto y las plantillas HTML para la confirmación de pedidos al cliente y notificaciones al administrador.
* `settings/emailEngine`: Contiene metadatos indicando que el proveedor activo es `firebase-trigger-email`.

Sin embargo, para que los correos electrónicos se envíen **de forma real**, es estrictamente necesario que la extensión física **Trigger Email** esté instalada en el proyecto de Firebase correspondiente y configurada con credenciales SMTP válidas. De lo contrario, los documentos escritos en la colección `mail` quedarán encolados de forma indefinida en la base de datos sin enviarse.

---

## 🛠️ Paso a Paso: Instalación y Configuración del Proveedor

Los administradores de Vertex o los dueños de las tiendas deben realizar la siguiente provisión en la consola de Firebase o mediante la Firebase CLI:

### Opción A: Instalación Automática (Recomendada - Firebase CLI)

1. Abrí la terminal y asegurate de tener la última versión de Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Autenticate en Firebase si aún no lo hiciste:
   ```bash
   firebase login
   ```

3. Creá un archivo local con los parámetros del proveedor SMTP (por ejemplo, `mail-params.env`):
   ```env
   # Parámetros obligatorios para la extensión trigger-mail
   SMTP_CONNECTION_URI=smtps://username:apikey@smtp.sendgrid.net:465
   SMTP_PASSWORD=tusecretodeapikey
   MAIL_COLLECTION=mail
   DEFAULT_FROM=no-reply@tudominio.com
   DEFAULT_FROM_NAME="Tu Tienda Online"
   # Opcionales para debugging
   TEMPLATES_COLLECTION=emailTemplates
   ```

4. Ejecutá el comando de instalación de la extensión apuntando al proyecto de la tienda:
   ```bash
   firebase ext:install firebase/trigger-mail \
     --params=mail-params.env \
     --project=vtx-id-de-tu-proyecto \
     --non-interactive
   ```

---

### Opción B: Instalación Manual (Firebase Console)

1. Ingresá a la [Consola de Firebase](https://console.firebase.google.com/).
2. Seleccioná el proyecto de la tienda (ej: `vtx-slug-de-tienda`).
3. En el menú lateral izquierdo, navegá a **Build** > **Extensions**.
4. Buscá la extensión **Trigger Email** (desarrollada por Firebase) y hacé clic en **Install**.
5. Completá las configuraciones requeridas en el asistente:
   * **Cloud Functions location**: Elegí la misma región del proyecto (generalmente `us-central1`).
   * **Email documents collection**: Escribí `mail` (debe coincidir exactamente con el nombre de la colección en la tienda).
   * **SMTP connection URI**: Ingresá la URI de conexión de tu proveedor de correo (ejemplo para SendGrid: `smtps://apikey:TU_API_KEY@smtp.sendgrid.net:465`).
   * **Default FROM address**: La dirección de email autorizada para realizar envíos (ej: `contacto@tudominio.com`).
   * **Default FROM name**: El nombre descriptivo visible para los usuarios (ej: `Ventas — Mi Tienda`).

---

## 🧪 Validación y Pruebas

Una vez instalada la extensión en el proyecto Firebase de la tienda, podés realizar una validación técnica inmediata:

1. Iniciá sesión en el **Panel de Administración** de la tienda (`/admin`).
2. Navegá a la sección **Configuración de Emails** (`/admin/emails`).
3. Hacé clic en **Enviar Email de Prueba**.
4. Completá el destinatario y presioná **Enviar**.
5. Verificá dos puntos clave:
   * **Base de datos (Firestore)**: Debería haberse creado un nuevo documento en la colección `mail` con el campo `delivery` en estado `SUCCESS` u `PROCESSING`.
   * **Bandeja de Entrada**: Comprobá si recibiste el correo de prueba (y revisá la carpeta de Spam si es necesario).

---

## ⚠️ Errores Comunes y Solución de Problemas

* **Los correos no se envían y el estado en Firestore es `ERROR`**:
  * Revisá los logs de la Cloud Function creada por la extensión (`ext-trigger-mail-processQueue`) en la consola de Firebase > Functions > Logs.
  * Comprobá que las credenciales SMTP sean correctas y que el puerto utilizado esté permitido por tu proveedor SMTP (comúnmente `465` para smtps o `587` para starttls).
* **El remitente (FROM) aparece como no autorizado**:
  * Muchos proveedores SMTP (como SendGrid, Mailgun o Amazon SES) requieren que verifiques y configures previamente tu dominio (registros SPF/DKIM) o que registres el email emisor específico antes de permitir envíos desde él.
