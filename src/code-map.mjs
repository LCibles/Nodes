import {parse as parseScript} from 'acorn';
import {parse as parseDocument} from 'parse5';
import {adapter} from 'parse5-htmlparser2-tree-adapter';
import {parse as parseStylesheet, generate} from 'css-tree';
import {selectAll} from 'css-select';

function elementLabel(node) {
  const attrs = node.attribs;
  const identity = attrs.id ? '#' + attrs.id :
    (attrs.class ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(name => '.' + name).join('');
  const detail = node.name === 'meta' ? attrs.name ?? attrs.property ?? (attrs.charset && 'charset') :
    node.name === 'link' ? attrs.rel : '';
  return node.name + (identity || (detail ? ' · ' + detail : ''));
}

export function parseHtml(source) {
  const document = parseDocument(source, {treeAdapter:adapter, sourceCodeLocationInfo:true});
  const html = document.children.find(node => node.name === 'html');
  const parts = [];
  const keys = new Map();
  let sequence = 0;

  function collect(node, parent) {
    if (!adapter.isElementNode(node)) return;
    const location = adapter.getNodeSourceCodeLocation(node);
    const isRoot = node.name === 'head' || node.name === 'body';
    let container = parent;
    if (location || isRoot) {
      const key = String(sequence++);
      keys.set(node, key);
      parts.push({
        key, parent, title:elementLabel(node), kind:'html',
        start:location?.startLine ?? null, end:location?.endLine ?? null
      });
      container = key;
    }
    const children = node.name === 'template' ? adapter.getTemplateContent(node).children : node.children;
    for (const child of children) collect(child, container);
  }

  for (const node of html.children) {
    if (node.name === 'head' || node.name === 'body') collect(node, null);
  }
  const stylesheets = selectAll('link[rel~="stylesheet"][href]', document.children).map(node => node.attribs.href);
  return {parts, keys, document, stylesheets};
}

const nonElementRules = new Set(['font-face','keyframes','-webkit-keyframes','page','property','counter-style']);

function readSelectors(node, inherited = []) {
  if (node.type === 'Rule' && node.prelude?.type === 'SelectorList') {
    const selectors = node.prelude.children.toArray().map(selector => {
      if (!inherited.length) return generate(selector);
      const anchor = ':is(' + inherited.join(',') + ')';
      let nesting = false;
      const withoutNesting = generate(selector, {
        decorator(handlers) {
          return {
            ...handlers,
            node(current) {
              if (current.type !== 'NestingSelector') return handlers.node(current);
              nesting = true;
              handlers.node({type:'Raw', value:anchor});
            }
          };
        }
      });
      return nesting ? withoutNesting : anchor + ' ' + withoutNesting;
    });
    const children = node.block?.children.toArray() ?? [];
    const own = children.some(child => child.type === 'Declaration') ? selectors : [];
    return own.concat(children.flatMap(child => readSelectors(child, selectors)));
  }
  if (node.type !== 'Atrule' || nonElementRules.has(node.name.toLowerCase())) return [];
  const children = node.block?.children.toArray() ?? [];
  const own = children.some(child => child.type === 'Declaration') ? inherited : [];
  return own.concat(children.flatMap(child => readSelectors(child, inherited)));
}

function titleFor(node) {
  if (node.type === 'Atrule') return '@' + node.name + (node.prelude ? ' ' + generate(node.prelude) : '');
  return node.prelude ? generate(node.prelude) : 'Reglas CSS';
}

export function parseCss(source) {
  const comments = [];
  const ast = parseStylesheet(source, {
    positions:true,
    onComment(text, loc) {
      if (!loc) return;
      const before = source.slice(source.lastIndexOf('\n', loc.start.offset - 1) + 1, loc.start.offset);
      if (!before.trim() && text.trim()) comments.push({text:text.trim().replace(/\s+/g, ' '), loc});
    }
  });
  const parts = [];
  let preceding = 0;
  for (const statement of ast.children) {
    if (statement.type !== 'Rule' && statement.type !== 'Atrule') continue;
    let heading;
    while (preceding < comments.length && comments[preceding].loc.end.offset <= statement.loc.start.offset) {
      heading = comments[preceding++];
    }
    // Comments inside the previous rule describe declarations, not the next section.
    const previousEnd = parts.at(-1)?.lastOffset ?? 0;
    if (heading && heading.loc.start.offset < previousEnd) heading = null;
    let group = parts.at(-1);
    if (heading || !group?.heading) {
      group = {
        key:String(parts.length), parent:null, kind:'css', title:heading?.text ?? titleFor(statement),
        start:heading?.loc.start.line ?? statement.loc.start.line, selectors:[], heading:Boolean(heading)
      };
      parts.push(group);
    }
    group.lastOffset = statement.loc.end.offset;
    group.end = statement.loc.end.line;
    group.selectors.push(...readSelectors(statement));
  }
  return parts.map(({lastOffset, heading, ...part}) => ({...part, selectors:[...new Set(part.selectors)]}));
}

export function parseJavaScript(source) {
  let comments, tokens;
  for (const sourceType of ['module', 'script']) {
    comments = [];
    tokens = [];
    try {
      parseScript(source, {ecmaVersion:'latest', sourceType, locations:true, onComment:comments, onToken:tokens});
      break;
    } catch (error) {
      if (sourceType === 'script') throw new Error('No se pudo leer la sintaxis de este archivo JavaScript.');
    }
  }

  const headings = [];
  for (const comment of comments) {
    const {start, end} = comment.loc;
    const before = source.slice(comment.start - start.column, comment.start);
    if (before.trim() || source.startsWith('#!', comment.start)) continue;
    const title = comment.value.replace(/^\s*\* ?/gm, '').trim();
    if (!title) continue;
    const previous = headings.at(-1);
    if (previous?.lineComment && comment.type === 'Line' && start.line === previous.lastLine + 1) {
      previous.title += '\n' + title;
      previous.lastLine = end.line;
      previous.endOffset = comment.end;
    } else {
      headings.push({
        title, start:start.line, lastLine:end.line,
        offset:comment.start, endOffset:comment.end, lineComment:comment.type === 'Line'
      });
    }
  }

  const parts = [];
  let tokenIndex = 0;
  for (const [index, heading] of headings.entries()) {
    const next = headings[index + 1]?.offset ?? source.length;
    let lastCode;
    while (tokenIndex < tokens.length && tokens[tokenIndex].start < next) {
      const token = tokens[tokenIndex++];
      if (token.start >= heading.endOffset) lastCode = token;
    }
    if (!lastCode) continue;
    parts.push({
      key:String(parts.length), parent:null, kind:'js', title:heading.title,
      start:heading.start, end:lastCode.loc.end.line
    });
  }
  return parts;
}

function stylesheetPath(htmlPath, href) {
  const base = 'https://nodes.invalid/';
  try {
    const from = new URL(htmlPath.split('/').map(encodeURIComponent).join('/'), base);
    const url = new URL(href, from);
    if (url.origin !== from.origin) return null;
    return url.pathname.slice(1).split('/').map(decodeURIComponent).join('/');
  } catch {
    return null;
  }
}

export function cssMatches(groups, cssPath, html, htmlPath) {
  if (!html.stylesheets.some(href => stylesheetPath(htmlPath, href) === cssPath)) return [];
  const matches = [];
  for (const group of groups) {
    const targets = new Map();
    for (const selector of group.selectors) {
      try {
        const ast = parseStylesheet(selector, {context:'selector'});
        ast.children = ast.children.filter(node => node.type !== 'PseudoElementSelector');
        if (ast.children.isEmpty) continue;
        for (const element of selectAll(generate(ast), html.document.children)) {
          const key = html.keys.get(element);
          if (key === undefined) continue;
          if (!targets.has(key)) targets.set(key, []);
          targets.get(key).push(selector);
        }
      } catch {
        // Browser-only or unsupported selectors are not inferred.
      }
    }
    for (const [htmlKey, selectors] of targets) matches.push({cssKey:group.key, htmlKey, selectors});
  }
  return matches;
}

window.nodoCodeMap = {parseHtml, parseCss, parseJavaScript, cssMatches};
