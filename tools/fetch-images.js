// 法人ホームページのページから写真を取得して保存する（求人用写真の候補・手動実行）
'use strict';
const fs = require('fs'), path = require('path');
const [out, ...urls] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  let n = 0; const seen = new Set();
  for (const page of urls) {
    const res = await fetch(page, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recruit-site-builder)' } });
    const html = await res.text();
    console.log(`${page}: ${res.status} ${html.length}文字`);
    const found0 = [...html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi), ...html.matchAll(/url\(\s*['"]?([^'")]+\.(?:jpe?g|png|webp))['"]?\s*\)/gi)].map(m => m[1]);
    const found = found0; console.log(`  画像候補 ${found.length}件`);
    for (const src of found) {
      let u; try { u = new URL(src.replace(/&amp;/g, '&'), page).toString(); } catch (e) { continue; }
      if (seen.has(u) || !/\.(jpe?g|png|webp)(\?|$)/i.test(u)) continue;
      seen.add(u);
      try {
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recruit-site-builder)' } }); if (!r.ok) { console.log(`  × ${r.status} ${u}`); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 15000) continue; // アイコン等の小さい画像は除外
        const name = `${String(++n).padStart(2, '0')}-${path.basename(new URL(u).pathname).replace(/[^\w.-]/g, '_')}`;
        fs.writeFileSync(path.join(out, name), buf);
        fs.appendFileSync(path.join(out, 'list.txt'), `${name}\t${page}\t${u}\n`);
      } catch (e) {}
    }
  }
  console.log(`${n}枚を保存しました`);
})();
