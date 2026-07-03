import http from 'node:http';

function mockMercadoPagoWebhook(tenantId: string, orderId: string, status: string = 'approved') {
  const postData = JSON.stringify({
    action: 'payment.created',
    api_version: 'v1',
    data: {
      id: `mp-payment-${Math.floor(Math.random() * 1000000)}`
    },
    date_created: new Date().toISOString(),
    id: Math.floor(Math.random() * 10000000),
    live_mode: false,
    type: 'payment',
    userId: '123456',
    // Custom context to allow backend emulator to tie webhook to tenant and order
    metadata: {
      tenant_id: tenantId,
      order_id: orderId,
      status: status
    }
  });

  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/demo-vertex/us-central1/mercadoPagoWebhookHandler',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log(`[MP Mock] Sending webhook for tenant: "${tenantId}", order: "${orderId}", status: "${status}"...`);

  const req = http.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => { responseBody += chunk; });
    res.on('end', () => {
      console.log(`[MP Mock] Response Status: ${res.statusCode}`);
      console.log(`[MP Mock] Response Body: ${responseBody}`);
    });
  });

  req.on('error', (e) => {
    const safeMsg = e.message.replace(/[\r\n]/g, '');
    console.error(`[MP Mock] Error sending webhook: ${safeMsg}`);
  });

  req.write(postData);
  req.end();
}

const sanitize = (val: string) => val.replace(/[\r\n]/g, '');

// Check command line arguments
const args = process.argv.slice(2);
const tenant = sanitize(args[0] || 'tienda-dos');
const order = sanitize(args[1] || 'order-dev-123');
const paymentStatus = sanitize(args[2] || 'approved');

mockMercadoPagoWebhook(tenant, order, paymentStatus);
