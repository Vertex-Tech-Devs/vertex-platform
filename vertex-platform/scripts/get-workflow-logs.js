const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');

async function run() {
  const secretsClient = new SecretManagerServiceClient();
  const [version] = await secretsClient.accessSecretVersion({
    name: 'projects/vertex-platform-dev/secrets/github-pat/versions/latest',
  });
  const pat = version.payload.data.toString().trim();

  const res = await fetch('https://api.github.com/repos/Vertex-Tech-Devs/ecommerce-vertex/actions/runs?per_page=5', {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const data = await res.json();
  console.log('=== Recent Workflow Runs in ecommerce-vertex ===');
  if (data.workflow_runs) {
    for (const run of data.workflow_runs) {
      console.log(`ID: ${run.id} | Name: ${run.name} | Status: ${run.status} | Conclusion: ${run.conclusion} | Event: ${run.event} | Branch: ${run.head_branch}`);
      
      // Fetch jobs for this run
      const jobsRes = await fetch(run.jobs_url, {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      const jobsData = await jobsRes.json();
      if (jobsData.jobs) {
        for (const job of jobsData.jobs) {
          console.log(`  Job: ${job.name} (${job.status} / ${job.conclusion})`);
          if (job.steps) {
            for (const step of job.steps) {
              if (step.conclusion === 'failure' || step.name.includes('Log Service Account') || step.name.includes('Deploy')) {
                console.log(`    Step: ${step.name} -> ${step.conclusion}`);
              }
            }
          }
        }
      }
    }
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
