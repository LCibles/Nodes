const shaPattern = /^[a-f\d]{40}$/i;
const repositoryPattern = /^[a-z\d][a-z\d-]{0,38}\/[a-z\d_.-]{1,100}$/i;

const relayHeaders = {'Cache-Control':'private, no-store', 'X-Nodes-GitHub':'1'};
const response = (status, body) => Response.json(body, {status, headers:relayHeaders});

async function githubRelay(request, env, url) {
  if (request.method !== 'GET') return response(405, {});
  const visitor = request.headers.get('oai-authenticated-user-email')?.toLowerCase();
  if (!env.GITHUB_READ_TOKEN || !env.GITHUB_VIEWER_EMAIL || visitor !== env.GITHUB_VIEWER_EMAIL.toLowerCase()) {
    return response(404, {});
  }
  const repo = url.searchParams.get('repo') ?? '';
  const kind = url.searchParams.get('kind');
  const ref = url.searchParams.get('ref') ?? '';
  if (!repositoryPattern.test(repo) || /\/(?:\.|\.\.)$/.test(repo)) return response(400, {});
  const segment = encodeURIComponent(ref);
  let path;
  switch (kind) {
    case 'repo': path = ''; break;
    case 'commit':
      if (!ref || ref.length > 240 || /^(?:\.|\.\.)$/.test(ref) || /[\x00-\x1f]/.test(ref)) return response(400, {});
      path = '/commits/' + segment;
      break;
    case 'tree':
      if (!shaPattern.test(ref)) return response(400, {});
      path = '/git/trees/' + segment + '?recursive=1';
      break;
    case 'blob':
      if (!shaPattern.test(ref)) return response(400, {});
      path = '/git/blobs/' + segment;
      break;
    default: return response(400, {});
  }
  try {
    const result = await fetch('https://api.github.com/repos/' + repo + path, {
      headers:{Authorization:'Bearer ' + env.GITHUB_READ_TOKEN, Accept:'application/vnd.github+json', 'User-Agent':'Nodes-board'},
      redirect:'error',
      signal:AbortSignal.timeout(12000)
    });
    if (!result.ok) return response(result.status, {});
    const data = await result.json();
    switch (kind) {
      case 'repo': return response(200, {full_name:data.full_name, default_branch:data.default_branch});
      case 'commit': return response(200, {sha:data.sha, commit:{message:data.commit.message, tree:{sha:data.commit.tree.sha}}});
      case 'tree': return response(200, {truncated:data.truncated, tree:data.tree.map(({path, mode, type, size, sha}) => ({path, mode, type, size, sha}))});
      case 'blob':
        if (data.size > 128 * 1024) return response(413, {});
        return response(200, {encoding:data.encoding, content:data.content});
    }
  } catch {
    return response(502, {});
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/github') return githubRelay(request, env, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, {status:405});
    const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('No encontrado', {status:404});
    return new Response(request.method === 'HEAD' ? null : asset.body, {
      headers:{'Content-Type':asset.type, 'Cache-Control':'private, no-cache', 'X-Content-Type-Options':'nosniff'}
    });
  }
};
