(() => {
  'use strict';

  const repoPattern = /^[a-z\d][a-z\d-]{0,38}\/[a-z\d_.-]{1,100}$/i;
  const shaPattern = /^[a-f\d]{40}$/i;
  const maxPreviewBytes = 128 * 1024;

  function repoName(value) {
    const repo = value.trim().replace(/^https:\/\/github\.com\//i, '').replace(/\/$/, '').replace(/\.git$/i, '');
    if (!repoPattern.test(repo) || /\/(?:\.|\.\.)$/.test(repo)) {
      throw new Error('Escribe el repositorio como usuario/repositorio.');
    }
    return repo;
  }

  function githubUrl(repo, type, sha, path = '') {
    if (!repoPattern.test(repo) || !shaPattern.test(sha)) return null;
    const suffix = path ? '/' + path.split('/').map(encodeURIComponent).join('/') : '';
    return `https://github.com/${repo}/${type}/${sha}${suffix}`;
  }

  async function read(repo, kind, ref, signal) {
    const routes = {
      repo: '',
      commit: '/commits/' + encodeURIComponent(ref),
      tree: '/git/trees/' + encodeURIComponent(ref) + '?recursive=1',
      blob: '/git/blobs/' + encodeURIComponent(ref)
    };
    const endpoint = 'https://api.github.com/repos/' + repo + routes[kind];
    let response = await fetch(endpoint, {headers:{Accept:'application/vnd.github+json'}, signal});
    if (!response.ok && (response.status === 404 || response.status === 403)) {
      const params = new URLSearchParams({repo, kind, ref});
      const relay = await fetch('/api/github?' + params, {signal});
      if (relay.headers.get('X-Nodes-GitHub') === '1') response = relay;
    }

    if (response.status === 404) throw new Error('No se encontró el repositorio o la rama. Si es privado, debe tener acceso de lectura configurado en Sites.');
    if (response.status === 401) throw new Error('La autorización de GitHub no es válida.');
    if (response.status === 403 || response.status === 429) throw new Error('GitHub limitó la consulta o falta permiso de lectura. Inténtalo de nuevo más tarde.');
    if (response.status === 409) throw new Error('El repositorio todavía no tiene commits.');
    if (!response.ok) throw new Error('GitHub no pudo responder. Inténtalo de nuevo.');
    return response.json();
  }

  async function load(repository, branch, signal) {
    const repo = repoName(repository);
    const info = await read(repo, 'repo', '', signal);
    const name = repoName(info.full_name || repo);
    const ref = branch.trim() || info.default_branch;
    const commit = await read(name, 'commit', ref, signal);
    const treeSha = commit.commit?.tree?.sha;
    if (!shaPattern.test(treeSha) || !shaPattern.test(commit.sha)) throw new Error('GitHub no devolvió un commit válido.');
    const tree = await read(name, 'tree', treeSha, signal);
    if (tree.truncated) throw new Error('El repositorio es demasiado grande para mostrar el árbol completo de archivos.');
    if (!Array.isArray(tree.tree)) throw new Error('GitHub no devolvió el árbol de archivos.');
    const files = tree.tree.filter(entry => entry.type === 'blob' || entry.type === 'commit').map(entry => ({
      path: entry.path, sha: entry.sha, size: entry.size, submodule: entry.type === 'commit'
    }));
    return {
      repo: name, branch: ref, sha: commit.sha,
      title: commit.commit.message.split(/\r?\n/, 1)[0] || commit.sha.slice(0, 7),
      files
    };
  }

  async function preview(file, signal) {
    if (file.submodule) throw new Error('Este archivo apunta a un submódulo. Puedes abrirlo en GitHub.');
    if (!Number.isSafeInteger(file.size) || file.size > maxPreviewBytes) {
      throw new Error('Este archivo supera el límite de vista previa de 128 KB. Puedes abrirlo en GitHub.');
    }
    const blob = await read(repoName(file.repo), 'blob', file.sha, signal);
    if (blob.encoding !== 'base64' || typeof blob.content !== 'string') throw new Error('La vista previa no está disponible para este archivo.');
    const raw = atob(blob.content);
    if (raw.length > maxPreviewBytes || raw.includes('\0')) throw new Error('Puedes abrir este archivo en GitHub.');
    try {
      return new TextDecoder('utf-8', {fatal:true}).decode(Uint8Array.from(raw, char => char.charCodeAt(0)));
    } catch {
      throw new Error('Este archivo no es texto UTF-8. Puedes abrirlo en GitHub.');
    }
  }

  window.nodoGithub = { load, preview, githubUrl };
})();
