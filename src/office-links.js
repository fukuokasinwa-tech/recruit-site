/*
 * 事業所ごとのホームページを自動で探す（サイト公開時に実行）
 *
 * 法人ホームページ（config.homepage）を巡回し、各ページのタイトル・見出し・本文・URLから
 * 「どの事業所のページか」を点数で判定して、事業所ごとのリンク先を決めます。
 *  - offices.json の "homepage" に URL を書いた事業所は、その URL を優先（手動で上書き）
 *  - "homepage": false の事業所はリンクを出さない
 *  - 見つからない事業所や、ホームページに接続できない時は法人トップページにリンク
 *  - 事業所名が仮（「（事業所名）」など）の事業所は判定しない
 */
'use strict';

const MAX_PAGES = 150;
const MAX_DEPTH = 3;
const TIMEOUT_MS = 10000;
const SKIP_EXT = /\.(jpe?g|png|gif|webp|svg|ico|pdf|zip|docx?|xlsx?|pptx?|mp4|mp3|css|js|xml|json|txt)(\?|$)/i;
const SKIP_PATH = /\/(wp-admin|wp-json|wp-login|feed|comments|xmlrpc|tag|author|page\/\d+)(\/|$)|\?(p|s|replytocom)=/i;

const SERVICE_KEYS = [
  [/A型/i, ['就労継続支援a型', 'a型']],
  [/B型/i, ['就労継続支援b型', 'b型']],
  [/放課後/, ['放課後等デイサービス', '放課後デイ', '放デイ']],
  [/児童発達/, ['児童発達支援']],
  [/相談/, ['相談支援']],
  [/生活介護/, ['生活介護']],
  [/グループホーム|共同生活/, ['グループホーム', '共同生活援助']]
];

function norm(s) {
  return String(s || '').normalize('NFKC').toLowerCase().replace(/[\s　・･\-－―‐]/g, '');
}
function decode(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function textOf(html) {
  return decode(html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

// 事業所名から「その事業所だけの名前」を取り出す（例：「就労継続支援A型 Link」→「link」）
function distinctiveName(office) {
  const raw = String(office.name || '');
  if (/事業所名|（.*入力.*）/.test(raw)) return '';
  const n = norm(raw
    .replace(/就労継続支援\s*[AＡBＢ]\s*型/g, '')
    .replace(/放課後等デイサービス|児童発達支援|相談支援センター|相談支援事業所|相談支援|生活介護|グループホーム|事業所|センター/g, '')
    .replace(/[（(][^）)]*[）)]/g, ''));
  return n.length >= 2 ? n : '';
}
function serviceKeys(office) {
  const hit = SERVICE_KEYS.find(([re]) => re.test(office.service || ''));
  return hit ? hit[1] : [];
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recruit-site-builder)', 'Accept-Language': 'ja' } });
    const type = res.headers.get('content-type') || '';
    if (!res.ok) return null;
    return { url: res.url || url, type, body: await res.text() };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sameSite(u, base) {
  return u.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '');
}
function clean(href, from, base) {
  try {
    const u = new URL(decode(href), from);
    if (!/^https?:$/.test(u.protocol) || !sameSite(u, base)) return null;
    u.hash = '';
    const s = u.toString();
    if (SKIP_EXT.test(u.pathname) || SKIP_PATH.test(u.pathname + u.search)) return null;
    return s;
  } catch (e) { return null; }
}

async function crawl(home, log) {
  const base = new URL(home);
  const pages = [];
  const seen = new Set();
  const queue = [[base.toString(), 0]];

  // サイトマップがあれば候補に追加（WordPress など）
  for (const sm of ['/sitemap.xml', '/wp-sitemap.xml', '/sitemap_index.xml']) {
    const r = await fetchText(new URL(sm, base).toString());
    if (!r || !/<(urlset|sitemapindex)/.test(r.body)) continue;
    const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => decode(m[1]));
    for (const loc of locs) {
      if (/sitemap.*\.xml/i.test(loc)) {
        const sub = await fetchText(loc);
        if (sub) for (const m of sub.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) { const c = clean(m[1], loc, base); if (c) queue.push([c, 1]); }
      } else { const c = clean(loc, base, base); if (c) queue.push([c, 1]); }
    }
    break;
  }

  while (queue.length && pages.length < MAX_PAGES) {
    const [url, depth] = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await fetchText(url);
    if (!r || !/html/i.test(r.type)) continue;
    const html = r.body;
    const title = textOf((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const og = decode((html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i) || [])[1] || '');
    const heads = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => textOf(m[1])).join(' ');
    const main = (html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i) || [html])[0];
    pages.push({ rawTitle: (og || title).trim(), url: r.url || url, path: decodeURIComponent(new URL(r.url || url).pathname), title: norm(title + ' ' + og), heads: norm(heads), body: norm(textOf(main)) });
    if (depth < MAX_DEPTH) {
      for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#][^"']*)["']/gi)) {
        const c = clean(m[1], r.url || url, base);
        if (c && !seen.has(c)) queue.push([c, depth + 1]);
      }
    }
  }
  log(`  法人ホームページ ${pages.length}ページを確認しました`);
  // 確認用：浅い階層のページ一覧（事業所名の確認に使う）
  pages.filter(p => p.path.split('/').filter(Boolean).length <= 1 && !/\/(news|blog|category|\d{4})\b/i.test(p.path))
    .forEach(p => log(`    ・${p.rawTitle.slice(0, 60)}  ${p.url}`));
  return pages;
}

function scorePage(page, office, others) {
  const name = distinctiveName(office);
  if (!name) return 0;
  const svc = serviceKeys(office);
  const path = norm(page.path);
  const isTop = /^\/?(index\.html?)?$/.test(page.path);
  let s = 0, nameHit = false;
  if (page.title.includes(name)) { s += 10; nameHit = true; }
  if (page.heads.includes(name)) { s += 6; nameHit = true; }
  if (path.includes(name)) { s += 8; nameHit = true; }
  if (page.body.includes(name)) { s += 3; nameHit = true; }
  if (!nameHit) return 0;
  if (svc.some(k => page.title.includes(k) || page.heads.includes(k))) s += 4;
  else if (svc.some(k => page.body.includes(k))) s += 1;
  const addr = norm(office.address || '').match(/\d{3,}/);
  if (addr && page.body.includes(addr[0])) s += 3;
  if (office.city && page.body.includes(norm(office.city))) s += 1;
  // 他の事業所名も見出しに並ぶページ（一覧ページ・トップ）は下げる
  const crowd = others.filter(n => n && n !== name && (page.title.includes(n) || page.heads.includes(n))).length;
  s -= crowd * 3;
  if (isTop) s -= 8;
  return s;
}

async function resolve(config, offices, log = console.log) {
  const home = config.homepage;
  const result = {};
  if (!home) return result;
  log('事業所ホームページの自動判定：');
  let pages = [];
  try { pages = await crawl(home, log); } catch (e) { pages = []; }
  if (!pages.length) log('  ※ 法人ホームページに接続できなかったため、すべて法人トップページにリンクします');
  const names = offices.map(distinctiveName);
  for (const o of offices) {
    if (o.homepage === false) { result[o.id] = null; continue; }
    if (typeof o.homepage === 'string' && o.homepage.trim()) {
      result[o.id] = { url: o.homepage.trim(), how: '手動設定' };
      log(`  ${o.name} → ${o.homepage.trim()}（手動設定）`);
      continue;
    }
    let best = null;
    if (distinctiveName(o)) {
      for (const p of pages) {
        const sc = scorePage(p, o, names);
        if (sc > 0 && (!best || sc > best.score || (sc === best.score && p.path.length < best.path.length))) best = { url: p.url, path: p.path, score: sc };
      }
    }
    if (best && best.score >= 8) {
      result[o.id] = { url: best.url, how: '自動判定', score: best.score };
      log(`  ${o.name} → ${best.url}（自動判定・${best.score}点）`);
    } else {
      result[o.id] = { url: home, how: '法人トップ' };
      log(`  ${o.name} → ${home}（${distinctiveName(o) ? '専用ページが見つからないため' : '事業所名が未設定のため'}法人トップ）`);
    }
  }
  return result;
}

module.exports = { resolve, distinctiveName, scorePage };
