/**
 * Lightweight rich-text parser for Quick Notes.
 *
 * Quick Notes are typed fast, in a plain textarea, with no formatting bar in
 * the way — so the parser has to infer structure rather than demand syntax.
 * In practice the notes look like:
 *
 *     Strings Methods
 *
 *     strim().split("\\s+");
 *     Explanation:
 *     - We write \\ because Java needs \\ to produce the single
 *     - \s -> in regex, means whitespace.
 *
 * i.e. a title line, bare code with no fences, short labels, bullets, and the
 * occasional pasted URL. Markdown syntax (```fences```, `inline`, **bold**,
 * [text](url)) is honoured when present, but nothing requires it.
 *
 * Shell commands are deliberately left as plain text — see `looksLikeShell`.
 *
 * Everything here is pure and framework-free so it can be reasoned about
 * without a DOM.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'strike'; children: InlineNode[] }
  | { type: 'link'; href: string; label: string; bare: boolean };

export type NoteNode =
  | { type: 'heading'; children: InlineNode[] }
  | { type: 'label'; children: InlineNode[] }
  | { type: 'paragraph'; lines: InlineNode[][] }
  | { type: 'list'; items: { marker: string; children: InlineNode[] }[] }
  | { type: 'code'; lang: string | null; code: string; explicit: boolean };

// ─── Inline ───────────────────────────────────────────────────────────────

// Alternation order is load-bearing: JS picks the *first* alternative that
// matches at the earliest index, so `**bold**` must be tried before `*italic*`
// and a markdown link before the bare-URL catch-all.
const INLINE_RE = new RegExp(
  [
    '(?<code>`[^`\\n]+`)',
    '(?<mdlink>\\[[^\\]\\n]*\\]\\((?:https?:\\/\\/|mailto:)[^\\s)]+\\))',
    '(?<url>(?:https?:\\/\\/|www\\.)[^\\s<>"\'`]+)',
    '(?<bold>\\*\\*[^*\\n]+\\*\\*)',
    '(?<strike>~~[^~\\n]+~~)',
    '(?<italic>\\*[^*\\n]+\\*)',
  ].join('|'),
  'g',
);

// A URL that ends a sentence should not swallow the punctuation. Closing
// brackets only count as trailing if they were never opened inside the URL.
function trimUrlTail(url: string): { href: string; tail: string } {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if ('.,;:!?"\''.includes(ch)) {
      end--;
      continue;
    }
    if (ch === ')' || ch === ']') {
      const open = ch === ')' ? '(' : '[';
      const body = url.slice(0, end);
      const opens = body.split(open).length - 1;
      const closes = body.split(ch).length - 1;
      if (closes > opens) {
        end--;
        continue;
      }
    }
    break;
  }
  return { href: url.slice(0, end), tail: url.slice(end) };
}

export function normaliseHref(raw: string): string {
  if (/^(https?:\/\/|mailto:)/i.test(raw)) return raw;
  return `https://${raw}`;
}

/**
 * Collapses a URL into something readable: `github.com/ramin-010/revise`
 * rather than 120 characters of query string.
 */
export function prettyUrl(raw: string): string {
  try {
    const u = new URL(normaliseHref(raw));
    const host = u.hostname.replace(/^www\./, '');
    const path = (u.pathname + u.search).replace(/\/+$/, '');
    if (!path) return host;
    const short = path.length > 24 ? `${path.slice(0, 14)}…${path.slice(-8)}` : path;
    return host + short;
  } catch {
    return raw;
  }
}

export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  let last = 0;

  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    const g = m.groups!;

    if (g.code) {
      out.push({ type: 'code', value: g.code.slice(1, -1) });
    } else if (g.mdlink) {
      const close = g.mdlink.indexOf('](');
      const label = g.mdlink.slice(1, close);
      const href = g.mdlink.slice(close + 2, -1);
      out.push({ type: 'link', href, label: label || prettyUrl(href), bare: false });
    } else if (g.url) {
      const { href, tail } = trimUrlTail(g.url);
      out.push({ type: 'link', href: normaliseHref(href), label: href, bare: true });
      if (tail) out.push({ type: 'text', value: tail });
    } else if (g.bold) {
      out.push({ type: 'bold', children: parseInline(g.bold.slice(2, -2)) });
    } else if (g.strike) {
      out.push({ type: 'strike', children: parseInline(g.strike.slice(2, -2)) });
    } else if (g.italic) {
      out.push({ type: 'italic', children: parseInline(g.italic.slice(1, -1)) });
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

// ─── Block heuristics ─────────────────────────────────────────────────────

const BULLET_RE = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/;
const FENCE_RE = /^\s*```([\w+#.\-]*)\s*$/;

const KEYWORD_RE =
  /^\s*(?:function|class|const|let|var|def|public|private|protected|static|final|import|export|from|return|if|else|for|while|switch|case|struct|interface|enum|type|async|await|package|namespace|using|new|throw|try|catch|SELECT|INSERT|UPDATE|DELETE|#include|#define)\b/;

const SYMBOLS_RE = /[()[\]{}=<>._\\/|&+^%$#@~]/;

/**
 * True when a bare line is far more likely to be code than prose.
 *
 * Deliberately conservative: a false positive turns a sentence into a
 * monospaced code card, which is much worse than leaving a snippet as plain
 * text. Every rule below requires punctuation that prose rarely carries.
 */
export function looksLikeCode(raw: string): boolean {
  const line = raw.trim();
  if (line.length < 3 || line.length > 400) return false;
  if (BULLET_RE.test(raw)) return false; // bullets are prose
  if (/^(https?:\/\/|www\.)/i.test(line)) return false;
  if (/^[#>|]/.test(line)) return false; // quotes / tables / comments

  const words = line.split(/\s+/);
  const hasSymbols = SYMBOLS_RE.test(line);

  const strong =
    // Terminated statement — but only with code punctuation somewhere in it,
    // so "Do this; then that;" stays prose.
    (/[;{}]$/.test(line) && hasSymbols) ||
    // A call on its own: foo(), a.b.c(x), Arrays.sort(...)
    /^[\w.$\][<>]+\s*\([^)]*\)\s*[;{]?$/.test(line) ||
    // A call glued to more code: foo(x).bar, foo(x) => , foo(x) {
    /\w\s*\([^()]*\)\s*(?:\.\w|\{|;|=>|->)/.test(line) ||
    // Assignment ending in a semicolon
    /^[\w.$[\]]+\s*[-+*/|&]?=\s*\S.*;$/.test(line) ||
    // Language keyword plus code punctuation
    (KEYWORD_RE.test(line) && /[({=;:[]/.test(line)) ||
    // Operator soup
    (/(?:=>|->|::|!==|===|<=|>=|\+\+|--|&&|\|\||!=)/.test(line) && /[()[\]{};]/.test(line)) ||
    // Indented continuation of a block
    (/^\s{2,}/.test(raw) && /[;{}()]$/.test(line));

  if (!strong) return false;
  // A long sentence that merely happens to end in a brace is still a sentence.
  if (words.length > 14 && !/[;{}]$/.test(line)) return false;
  return true;
}

// Terminal commands are common in these notes, and they read perfectly well as
// plain text — a code card around `git fetch origin` is decoration, not
// information. This test exists purely to keep shell OUT of the code path,
// including lines like `export PATH=...` that the generic heuristic above
// would otherwise mistake for JavaScript.
const SHELL_CMD_RE = new RegExp(
  '^\\s*(?:[$>]\\s+)?(?:sudo\\s+(?:-\\w+\\s+)*)?(?:' +
    [
      'cd', 'ls', 'll', 'pwd', 'cat', 'less', 'more', 'head', 'tail', 'touch',
      'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'ln', 'chmod', 'chown', 'chgrp',
      'du', 'df', 'stat', 'file', 'tree', 'find', 'grep', 'egrep', 'rg', 'sed',
      'awk', 'xargs', 'tee', 'sort', 'uniq', 'wc', 'diff', 'patch', 'tar',
      'zip', 'unzip', 'gzip', 'gunzip', 'curl', 'wget', 'ssh', 'scp', 'rsync',
      'ping', 'dig', 'nslookup', 'netstat', 'lsof', 'ps', 'top', 'htop', 'kill',
      'killall', 'nohup', 'screen', 'tmux', 'git', 'gh', 'npm', 'npx', 'pnpm',
      'yarn', 'bun', 'node', 'deno', 'tsc', 'vite', 'prisma', 'python',
      'python3', 'pip', 'pip3', 'pipx', 'poetry', 'conda', 'java', 'javac',
      'mvn', 'gradle', 'go', 'cargo', 'rustc', 'rustup', 'dotnet', 'php',
      'composer', 'ruby', 'gem', 'bundle', 'rails', 'docker', 'docker-compose',
      'podman', 'kubectl', 'helm', 'terraform', 'ansible', 'vagrant',
      'systemctl', 'service', 'journalctl', 'supervisorctl', 'pm2', 'nginx',
      'apache2ctl', 'httpd', 'certbot', 'psql', 'pg_dump', 'mysql', 'mysqldump',
      'mongo', 'mongosh', 'redis-cli', 'sqlite3', 'apt', 'apt-get', 'yum',
      'dnf', 'pacman', 'apk', 'brew', 'snap', 'choco', 'winget', 'scoop',
      'export', 'source', 'unset', 'alias', 'env', 'echo', 'printf', 'clear',
      'exit', 'sh', 'bash', 'zsh', 'fish', 'powershell', 'pwsh', 'make',
      'cmake', 'ninja', 'gcc', 'clang', 'vim', 'nvim', 'nano',
    ].join('|') +
    ')\\b',
);

const SHELL_PATH_RE = /^\s*(?:\.\/|\.\.\/|~\/|\/(?:usr|var|etc|opt|home|root|tmp|bin|sbin|srv)\/)\S/;

// Half the command names above are also ordinary English words — "find a way",
// "make it work", "top of the list". These are not.
const UNAMBIGUOUS_CMD_RE =
  /^\s*(?:[$>]\s+)?(?:sudo|git|gh|npm|npx|pnpm|yarn|bun|deno|tsc|vite|prisma|pip3?|pipx|poetry|conda|javac|mvn|gradle|cargo|rustc|rustup|dotnet|composer|rails|docker|docker-compose|podman|kubectl|helm|terraform|ansible|vagrant|systemctl|journalctl|supervisorctl|pm2|nginx|apache2ctl|httpd|certbot|psql|pg_dump|mysql|mysqldump|mongo|mongosh|redis-cli|sqlite3|apt|apt-get|yum|dnf|pacman|apk|brew|snap|choco|winget|scoop|chmod|chown|chgrp|mkdir|rmdir|rsync|scp|ssh|curl|wget|nslookup|netstat|lsof|killall|htop|tmux|unzip|gunzip|gzip|xargs|cmake|ninja|gcc|clang|nvim|pwd|cd|ls|ll)\b/;

// Connectives that show up in sentences and essentially never in a command
// line. If the arguments read like English, this is prose about a command.
const PROSE_WORD_RE =
  /\b(?:the|a|an|to|and|then|for|of|in|on|at|with|your|my|our|their|its|if|is|are|was|were|be|been|that|this|these|those|it|you|we|they|so|but|or|from|into|onto|after|before|when|while|will|can|could|should|would|do|does|did|have|has|had|about|because|there|here|what|which|how|why|all|any|some|more|most|just|only|also|very|again|way|thing|need|want)\b/i;

export function looksLikeShell(raw: string): boolean {
  const line = raw.trim();
  if (line.length < 2 || line.length > 400) return false;
  if (BULLET_RE.test(raw)) return false;
  if (/^(https?:\/\/|www\.)/i.test(line)) return false;
  if (SHELL_PATH_RE.test(line)) return true;

  const cmd = line.match(SHELL_CMD_RE);
  if (!cmd) return false;

  const words = line.split(/\s+/);
  if (words.length > 12) return false;

  // Flags, paths, redirects, env assignments, file extensions: unmistakable.
  if (/(?:\s-{1,2}\w|[/\\|>&;=$~*]|\.\w{1,4}\b|:{1,2}\w)/.test(line)) return true;

  const rest = line.slice(cmd[0].length).trim();
  if (PROSE_WORD_RE.test(rest)) return false;
  if (/[.!?]$/.test(line) && words.length > 3) return false;

  // No argument signal at all — only trust it if the command name itself
  // could not be a stray English word.
  return UNAMBIGUOUS_CMD_RE.test(line);
}

function isLabel(raw: string): boolean {
  const line = raw.trim();
  if (!line.endsWith(':')) return false;
  if (line.length > 48) return false;
  const words = line.split(/\s+/);
  return words.length <= 6 && !looksLikeCode(line) && !looksLikeShell(line);
}

// ─── Block parser ─────────────────────────────────────────────────────────

export function parseNote(source: string): NoteNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const nodes: NoteNode[] = [];

  const isCodeAt = (idx: number) =>
    idx >= 0 &&
    idx < lines.length &&
    lines[idx].trim() !== '' &&
    looksLikeCode(lines[idx]) &&
    !looksLikeShell(lines[idx]);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Explicit fenced block (an unterminated fence, mid-typing, runs to the end)
    const fence = line.match(FENCE_RE);
    if (fence) {
      const lang = fence[1] || null;
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) body.push(lines[i++]);
      if (i < lines.length) i++; // consume closing fence
      nodes.push({ type: 'code', lang, code: body.join('\n'), explicit: true });
      continue;
    }

    // Bullet run
    if (BULLET_RE.test(line)) {
      const items: { marker: string; children: InlineNode[] }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(BULLET_RE);
        if (m) {
          items.push({ marker: m[2], children: parseInline(m[3]) });
          i++;
        } else if (
          lines[i].trim() !== '' &&
          items.length > 0 &&
          !isLabel(lines[i]) &&
          !isCodeAt(i) &&
          !FENCE_RE.test(lines[i])
        ) {
          // Wrapped continuation of the previous bullet.
          items[items.length - 1].children.push(
            { type: 'text', value: ' ' },
            ...parseInline(lines[i].trim()),
          );
          i++;
        } else break;
      }
      nodes.push({ type: 'list', items });
      continue;
    }

    // Bare code run
    if (isCodeAt(i)) {
      const body: string[] = [];
      while (isCodeAt(i)) body.push(lines[i++]);
      nodes.push({ type: 'code', lang: null, code: body.join('\n'), explicit: false });
      continue;
    }

    // Short "Explanation:" style label
    if (isLabel(line)) {
      nodes.push({ type: 'label', children: parseInline(line.trim()) });
      i++;
      continue;
    }

    // Paragraph: consecutive prose lines, newlines preserved
    const para: InlineNode[][] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !BULLET_RE.test(lines[i]) &&
      !isCodeAt(i) &&
      !isLabel(lines[i]) &&
      !FENCE_RE.test(lines[i])
    ) {
      para.push(parseInline(lines[i]));
      i++;
    }
    if (para.length) nodes.push({ type: 'paragraph', lines: para });
  }

  return promoteTitle(nodes);
}

// Words that mark a line as the continuation of the one above it, which is how
// a wrapped sentence is told apart from a title followed by its body.
const CONTINUATION_RE =
  /^(?:and|or|but|so|then|to|that|which|with|for|of|in|on|at|as|because|if|when|while|from|by|it|its|is|are|was|were)\b/i;

/**
 * The first line of a note is almost always its title — "Strings Methods",
 * "Test erp-api", "sort an 2d array" — so it is promoted to a heading even
 * when the lines beneath it belong to the same paragraph block.
 */
function promoteTitle(nodes: NoteNode[]): NoteNode[] {
  const first = nodes[0];
  if (!first || first.type !== 'paragraph') return nodes;
  if (nodes.length === 1 && first.lines.length === 1) return nodes; // nothing to title

  const titleLine = first.lines[0];
  const text = inlineText(titleLine).trim();
  if (text.length === 0 || text.length > 60) return nodes;
  if (text.split(/\s+/).length > 8) return nodes;
  if (/[.,!?;:]$/.test(text)) return nodes;

  const rest = first.lines.slice(1);
  if (rest.length > 0 && CONTINUATION_RE.test(inlineText(rest[0]).trim())) return nodes;

  const head: NoteNode = { type: 'heading', children: titleLine };
  return rest.length > 0
    ? [head, { type: 'paragraph', lines: rest }, ...nodes.slice(1)]
    : [head, ...nodes.slice(1)];
}

export function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return n.value;
        case 'code':
          return n.value;
        case 'link':
          return n.label;
        default:
          return inlineText(n.children);
      }
    })
    .join('');
}
