const fs = require('fs');

async function listSAs(projectId, token) {
  try {
    const res = await fetch(`https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`=== Service Accounts in ${projectId} (Status ${res.status}) ===`);
    const data = await res.json();
    if (data.accounts) {
      for (const sa of data.accounts) {
        console.log(` - ${sa.email} (${sa.displayName || 'No display name'})`);
      }
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error(`Error listing SAs for ${projectId}:`, e);
  }
}

async function run() {
  const adc = JSON.parse(fs.readFileSync('/Users/juanson/.config/gcloud/application_default_credentials.json', 'utf-8'));
  
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: adc.client_id,
      client_secret: adc.client_secret,
      refresh_token: adc.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  if (!token) {
    console.error('Failed to get access token:', tokenData);
    return;
  }

  await listSAs('vertex-platform-dev', token);
  await listSAs('vertex-platform-app', token);
  await listSAs('ecommerce-vertex-dev', token);
  await listSAs('ecommerce-vertex', token);
}

run();
