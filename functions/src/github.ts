import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getGitHubPat, ALLOWED_ORIGINS } from './helpers';

interface DeploymentHistoryPayload {
  projectId: string;
}

interface GitHubJob {
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
}

interface GitHubWorkflowRun {
  id: number;
  run_number: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  display_title: string;
}

export const getStoreDeploymentHistory = onCall<DeploymentHistoryPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    // Auth check
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can view deployment history.');
    }

    const { projectId } = request.data;
    if (!projectId) {
      throw new HttpsError('invalid-argument', 'Missing projectId.');
    }

    try {
      const pat = await getGitHubPat();
      
      // Fetch latest 20 runs from the actions API
      const runsRes = await fetch(
        'https://api.github.com/repos/Vertex-Tech-Devs/ecommerce-vertex/actions/runs?per_page=20',
        {
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!runsRes.ok) {
        throw new Error(`GitHub runs API failed: ${runsRes.status} ${await runsRes.text()}`);
      }

      const runsData = (await runsRes.json()) as { workflow_runs: GitHubWorkflowRun[] };
      const runs = runsData.workflow_runs ?? [];

      // Fetch jobs for each run concurrently to find the ones matching the projectId
      const runsWithJobs = await Promise.all(
        runs.map(async (run) => {
          try {
            const jobsRes = await fetch(
              `https://api.github.com/repos/Vertex-Tech-Devs/ecommerce-vertex/actions/runs/${run.id}/jobs`,
              {
                headers: {
                  Authorization: `Bearer ${pat}`,
                  Accept: 'application/vnd.github+json',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
              }
            );

            if (!jobsRes.ok) return { run, matches: false };

            const jobsData = (await jobsRes.json()) as { jobs: GitHubJob[] };
            const jobs = jobsData.jobs ?? [];

            // Match if any job name contains the projectId
            const matches = jobs.some((job) => 
              job.name.includes(projectId) || 
              run.display_title.includes(projectId)
            );

            return { run, matches };
          } catch (err) {
            console.error(`Error fetching jobs for run ${run.id}:`, err);
            return { run, matches: false };
          }
        })
      );

      // Filter and map to simple clean format
      const filteredHistory = runsWithJobs
        .filter((item) => item.matches)
        .map((item) => ({
          id: item.run.id,
          runNumber: item.run.run_number,
          status: item.run.status,
          conclusion: item.run.conclusion,
          htmlUrl: item.run.html_url,
          createdAt: item.run.created_at,
          updatedAt: item.run.updated_at,
          displayTitle: item.run.display_title,
        }));

      return { history: filteredHistory };
    } catch (err) {
      console.warn('[getStoreDeploymentHistory] Gracefully caught error (likely missing or invalid github-pat secret):', err);
      return { history: [] };
    }
  }
);
