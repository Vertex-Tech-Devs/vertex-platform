export const DEFAULT_ADMIN_SUBJECT = '¡Nuevo Pedido Recibido! - #{orderId}';
export const DEFAULT_ADMIN_TEMPLATE = `
  <p>¡Hola Administrador!</p>
  <p>Se ha recibido un nuevo pedido en la tienda con el ID: <strong>{orderId}</strong>.</p>
  <hr>
  <h4>Detalles del Cliente:</h4>
  <ul>
    <li><strong>Nombre:</strong> {clientName}</li>
    <li><strong>Email:</strong> {clientEmail}</li>
    <li><strong>Teléfono:</strong> {clientPhone}</li>
  </ul>
  <hr>
  <h4>Productos del Pedido:</h4>
  {itemsList}
  <hr>
  <h3><strong>Monto Total:</strong> ${'{totalAmount}'}</h3>
  <p>Puedes ver los detalles completos y gestionar el pedido en el panel de administración.</p>
`;

export const DEFAULT_CUSTOMER_SUBJECT = 'Confirmación de tu pedido #{orderId}';
export const DEFAULT_CUSTOMER_TEMPLATE = `
  <p>¡Hola, {clientName}!</p>
  <p>Hemos recibido tu pedido y ya lo estamos preparando. ¡Muchas gracias por tu compra!</p>
  <p>A continuación, te dejamos un resumen de tu orden <strong>#{orderId}</strong>.</p>
  <hr>
  <h4>Resumen de tu Compra:</h4>
  {itemsList}
  <hr>
  <h3><strong>Total Pagado:</strong> ${'{totalAmount}'}</h3>
  <p>Recibirás otra notificación cuando tu pedido sea enviado.</p>
  <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
`;
