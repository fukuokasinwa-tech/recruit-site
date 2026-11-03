#!/usr/bin/env node
/*
 * 求人サイト生成スクリプト（追加インストール不要。Node.js だけで動きます）
 *   node build.js           … 公開用（published: true かつ 掲載期限内の求人だけ）
 *   node build.js --drafts  … 確認用（下書きも含めて生成）
 * 出力先: dist/
 */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./src/render.js');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const withDrafts = process.argv.includes('--drafts');

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
if (process.env.SITE_URL) config.siteUrl = process.env.SITE_URL;
config.siteUrl = config.siteUrl.replace(/\/$/, '');
const offices = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/offices.json'), 'utf8'));
const officeById = Object.fromEntries(offices.map(o => [o.id, o]));

// 日本時間の今日
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// ---- 求人データ読み込み & チェック ----
const errors = [];
const jobs = [];
for (const file of fs.readdirSync(path.join(ROOT, 'jobs')).filter(f => f.endsWith('.json')).sort()) {
  let job;
  try {
    job = JSON.parse(fs.readFileSync(path.join(ROOT, 'jobs', file), 'utf8'));
  } catch (e) {
    errors.push(`${file}: JSONの書き方に誤りがあります（${e.message}）`);
    continue;
  }
  const need = ['id', 'title', 'office', 'employmentType', 'description', 'datePosted'];
  const missing = need.filter(k => !job[k]);
  if (missing.length) { errors.push(`${file}: 必須項目が空です → ${missing.join(', ')}`); continue; }
  if (!/^[a-z0-9-]+$/.test(job.id)) { errors.push(`${file}: id は半角英小文字・数字・ハイフンのみ使えます`); continue; }
  if (!officeById[job.office]) { errors.push(`${file}: 事業所ID「${job.office}」が data/offices.json にありません`); continue; }
  if (!R.EMPLOYMENT_TYPES[job.employmentType]) errors.push(`${file}: 雇用形態「${job.employmentType}」は ${Object.keys(R.EMPLOYMENT_TYPES).join('/')} のいずれかにしてください`);
  if (!job.published && !withDrafts) { console.log(`  下書き（非公開）: ${file}`); continue; }
  if (R.isExpired(job, today)) { console.log(`  掲載期限切れ（非公開）: ${file}`); continue; }
  jobs.push(job);
}
if (errors.length) {
  console.error('\n求人データにエラーがあります:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
if (new Set(jobs.map(j => j.id)).size !== jobs.length) {
  console.error('同じ id の求人が複数あります。'); process.exit(1);
}
jobs.sort((a, b) => (b.datePosted || '').localeCompare(a.datePosted || ''));

// ---- 出力 ----
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'jobs'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'admin'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

const esc = R.esc;
const v = Date.now().toString(36);

function layout({ title, description, canonical, body, head = '', depth = 0 }) {
  const up = depth ? '../'.repeat(depth) : './';
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${config.logo ? `<meta property="og:image" content="${esc(R.absUrl(config, config.logo))}">` : ''}
<link rel="stylesheet" href="${up}assets/style.css?v=${v}">
${head}
</head>
<body>
<header class="site-head"><div class="wrap">
  <a class="brand" href="${up}">${config.logo ? `<img src="${up}${esc(config.logo)}" alt="">` : ''}${esc(config.siteName)}</a>
  <div class="tel">採用担当${config.contactName ? '（' + esc(config.contactName) + '）' : ''} ${esc(config.phone)}<br>${esc(config.phoneHours || '')}</div>
</div></header>
${body}
<footer class="site-foot"><div class="wrap">
  ${esc(config.orgName)}${config.hqAddress ? '　' + (config.hqPostalCode ? '〒' + esc(config.hqPostalCode) + ' ' : '') + esc(config.hqAddress) : ''}　TEL ${esc(config.phone)}
</div></footer>
</body>
</html>`;
}

// 求人詳細ページ
for (const job of jobs) {
  const office = officeById[job.office];
  const url = `${config.siteUrl}/jobs/${job.id}.html`;
  const desc = `${office.city}・${office.service}「${office.name}」の${job.title}（${job.employmentType}）求人。${R.salaryText(job)}。${(job.description || '').replace(/\s+/g, ' ').slice(0, 60)}`;
  const html = layout({
    depth: 1,
    title: `${job.title}｜${office.city}｜${config.siteName}`,
    description: desc,
    canonical: url,
    head: `<script type="application/ld+json">\n${R.jobPostingJsonLd(job, office, config)}\n</script>`,
    body: `<main class="wrap">
<nav class="crumb"><a href="../">求人一覧</a> ＞ ${esc(job.title)}</nav>
${job.published ? '' : '<p class="empty no-print">※ これは下書きのプレビューです（公開されません）</p>'}
${R.jobSheetHtml(job, office, config)}
<div class="tools no-print"><button onclick="window.print()">印刷する（A4求人票）</button>
<button onclick="navigator.share ? navigator.share({title: document.title, url: location.href}) : navigator.clipboard.writeText(location.href).then(()=>alert('URLをコピーしました'))">共有する</button></div>
</main>`
  });
  fs.writeFileSync(path.join(OUT, 'jobs', `${job.id}.html`), html);
}

// 一覧ページ
const uniq = arr => [...new Set(arr)];
const cityOrder = ['八女市', '久留米市', '柳川市', '筑後市', '大牟田市'];
const cities = uniq(jobs.map(j => officeById[j.office].city)).sort((a, b) => (cityOrder.indexOf(a) + 99) % 99 - (cityOrder.indexOf(b) + 99) % 99);
const services = uniq(jobs.map(j => officeById[j.office].service));
const emps = uniq(jobs.map(j => j.employmentType));
const opt = (label, list) => `<option value="">${label}：すべて</option>` + list.map(x => `<option>${esc(x)}</option>`).join('');

const cards = jobs.map(job => {
  const o = officeById[job.office];
  return `<a class="card" href="jobs/${job.id}.html" data-city="${esc(o.city)}" data-service="${esc(o.service)}" data-emp="${esc(job.employmentType)}">
  <div class="badges"><span class="badge svc">${esc(o.service)}</span><span class="badge city">${esc(o.city)}</span><span class="badge emp">${esc(job.employmentType)}</span></div>
  <h2>${esc(job.title)}</h2>
  <div class="salary">${esc(R.salaryText(job))}</div>
  <div class="meta">${esc(o.name)}</div>
  ${(job.tags || []).length ? `<div class="tags">${job.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
</a>`;
}).join('\n');

const indexHtml = layout({
  title: `${config.siteName}｜八女市・久留米市・柳川市・筑後市・大牟田市の福祉の求人`,
  description: config.catchcopy,
  canonical: config.siteUrl + '/',
  head: `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: config.orgName, url: config.siteUrl, telephone: config.phone, address: { '@type': 'PostalAddress', addressRegion: '福岡県', streetAddress: config.hqAddress || undefined, postalCode: config.hqPostalCode || undefined, addressCountry: 'JP' } })}</script>`,
  body: `<section class="hero"><div class="wrap">
  <h1>一緒に働く仲間を募集しています</h1>
  <p>${esc(config.catchcopy)}</p>
</div></section>
<main class="wrap">
  <div class="filters">
    <select id="f-city" aria-label="地域">${opt('地域', cities)}</select>
    <select id="f-service" aria-label="事業">${opt('事業', services)}</select>
    <select id="f-emp" aria-label="雇用形態">${opt('雇用形態', emps)}</select>
  </div>
  <p class="count" id="count">${jobs.length}件の求人</p>
  <div class="cards" id="cards">${cards || ''}</div>
  <p class="empty" id="empty" ${jobs.length ? 'hidden' : ''}>現在募集中の求人はありません。お問い合わせはお電話でどうぞ。</p>
</main>
<script>
(function () {
  var sel = ['city', 'service', 'emp'].map(function (k) { return [k, document.getElementById('f-' + k)]; });
  var cards = [].slice.call(document.querySelectorAll('.card'));
  var q = new URLSearchParams(location.search);
  sel.forEach(function (s) { if (q.get(s[0])) s[1].value = q.get(s[0]); s[1].addEventListener('change', apply); });
  function apply() {
    var n = 0, p = new URLSearchParams();
    sel.forEach(function (s) { if (s[1].value) p.set(s[0], s[1].value); });
    cards.forEach(function (c) {
      var ok = sel.every(function (s) { return !s[1].value || c.dataset[s[0]] === s[1].value; });
      c.hidden = !ok; if (ok) n++;
    });
    document.getElementById('count').textContent = n + '件の求人';
    document.getElementById('empty').hidden = n > 0;
    history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
  }
  apply();
})();
</script>`
});
fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml);

// 静的ファイル
fs.copyFileSync(path.join(ROOT, 'src/style.css'), path.join(OUT, 'assets/style.css'));
fs.copyFileSync(path.join(ROOT, 'src/render.js'), path.join(OUT, 'assets/render.js'));
fs.copyFileSync(path.join(ROOT, 'admin/index.html'), path.join(OUT, 'admin/index.html'));
fs.copyFileSync(path.join(ROOT, 'data/offices.json'), path.join(OUT, 'data/offices.json'));
fs.writeFileSync(path.join(OUT, 'data/config.json'), JSON.stringify(config, null, 2));
if (config.logo && fs.existsSync(path.join(ROOT, config.logo))) {
  fs.mkdirSync(path.dirname(path.join(OUT, config.logo)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, config.logo), path.join(OUT, config.logo));
}
if (fs.existsSync(path.join(ROOT, 'images'))) fs.cpSync(path.join(ROOT, 'images'), path.join(OUT, 'images'), { recursive: true });
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// 検索エンジン向け
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${config.siteUrl}/</loc><lastmod>${today}</lastmod></url>
${jobs.map(j => `  <url><loc>${config.siteUrl}/jobs/${j.id}.html</loc><lastmod>${j.updated || j.datePosted}</lastmod></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nDisallow: /admin/\nSitemap: ${config.siteUrl}/sitemap.xml\n`);

console.log(`\n完了: ${jobs.length}件の求人ページを dist/ に生成しました${withDrafts ? '（下書き含む）' : ''}`);
