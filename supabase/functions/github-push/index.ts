import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface FileToCommit {
  path: string;
  content: string;
}

interface PushRequest {
  githubToken: string;
  owner: string;
  repo: string;
  branch?: string;
  commitMessage: string;
  files: FileToCommit[];
  createRepo?: boolean;
  repoDescription?: string;
  isPrivate?: boolean;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,120}$/;
const SAFE_PATH_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;
const MAX_FILES_PER_PUSH = 100;
const MAX_FILE_SIZE_BYTES = 500_000;

function isSafeRepoPath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\') || path.includes('\0')) {
    return false;
  }
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 && parts.every((part) => SAFE_PATH_SEGMENT_RE.test(part));
}

function validatePushRequest(body: PushRequest): string | null {
  if (!OWNER_RE.test(body.owner)) return 'Invalid repository owner.';
  if (!REPO_RE.test(body.repo)) return 'Invalid repository name.';
  if (body.branch && !BRANCH_RE.test(body.branch)) return 'Invalid branch name.';
  if (!body.files?.length) return 'At least one file is required.';
  if (body.files.length > MAX_FILES_PER_PUSH) return `Too many files. Max is ${MAX_FILES_PER_PUSH}.`;

  for (const file of body.files) {
    if (!isSafeRepoPath(file.path)) return `Invalid file path: ${file.path}`;
    if (new TextEncoder().encode(file.content ?? '').length > MAX_FILE_SIZE_BYTES) {
      return `File too large: ${file.path}`;
    }
  }

  return null;
}

async function githubFetch(url: string, token: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GitHub API error [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

async function createRepository(token: string, name: string, description: string, isPrivate: boolean) {
  return githubFetch('https://api.github.com/user/repos', token, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    }),
  });
}

async function listUserRepos(token: string) {
  return githubFetch('https://api.github.com/user/repos?sort=updated&per_page=30', token);
}

async function getUser(token: string) {
  return githubFetch('https://api.github.com/user', token);
}

async function pushFiles(token: string, owner: string, repo: string, branch: string, message: string, files: FileToCommit[]) {
  // Get the reference to the branch
  let ref;
  try {
    ref = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, token);
  } catch {
    throw new Error(`Branch '${branch}' not found in ${owner}/${repo}`);
  }

  const latestCommitSha = ref.object.sha;

  // Get the tree of the latest commit
  const latestCommit = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, token);
  const baseTreeSha = latestCommit.tree.sha;

  // Create blobs for each file
  const treeItems = [];
  for (const file of files) {
    const blob = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, token, {
      method: 'POST',
      body: JSON.stringify({
        content: file.content,
        encoding: 'utf-8',
      }),
    });
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  // Create new tree
  const newTree = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  });

  // Create commit
  const newCommit = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: newTree.sha,
      parents: [latestCommitSha],
    }),
  });

  // Update reference
  await githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: newCommit.sha,
    }),
  });

  return { commitSha: newCommit.sha, commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}` };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (req.method === 'GET') {
      const authHeader = req.headers.get('x-github-token');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'GitHub token required' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'user') {
        const user = await getUser(authHeader);
        return new Response(JSON.stringify(user), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'repos') {
        const repos = await listUserRepos(authHeader);
        return new Response(JSON.stringify(repos), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (req.method === 'POST') {
      const body: PushRequest = await req.json();

      if (!body.githubToken) {
        return new Response(JSON.stringify({ error: 'GitHub token required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'create-repo') {
        const repo = await createRepository(
          body.githubToken,
          body.repo,
          body.repoDescription || 'Generated by Figma to Code',
          body.isPrivate ?? true,
        );
        return new Response(JSON.stringify(repo), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'push') {
        if (!body.owner || !body.repo || !body.files?.length) {
          return new Response(JSON.stringify({ error: 'owner, repo, and files are required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const validationError = validatePushRequest(body);
        if (validationError) {
          return new Response(JSON.stringify({ error: validationError }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await pushFiles(
          body.githubToken,
          body.owner,
          body.repo,
          body.branch || 'main',
          body.commitMessage || 'feat: add generated component',
          body.files,
        );

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('GitHub push error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
