import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

const projectId = 'vtx-sd-3bf1de61';

async function inspect() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  const token = tokenRes.token;

  console.log(`=== Inspecting GCP/Firebase status for ${projectId} ===`);

  // 1. GCP Project
  try {
    const res = await fetch(`https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`GCP Project GET Status: ${res.status}`);
    const data = await res.json();
    console.log('GCP Project Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('GCP Project Error:', e);
  }

  // 2. IAM Policy
  try {
    const res = await fetch(
      `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}:getIamPolicy`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    console.log(`IAM Policy Status: ${res.status}`);
    const data = await res.json();
    console.log('IAM Policy Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('IAM Policy Error:', e);
  }

  // 3. Firebase Project Status
  try {
    const res = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`Firebase Project GET Status: ${res.status}`);
    const data = await res.json();
    console.log('Firebase Project Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Firebase Project Error:', e);
  }

  // 4. Firebase Hosting Sites
  try {
    const res = await fetch(
      `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    console.log(`Firebase Hosting Sites GET Status: ${res.status}`);
    const data = await res.json();
    console.log('Firebase Hosting Sites Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Firebase Hosting Sites Error:', e);
  }
}

inspect();
