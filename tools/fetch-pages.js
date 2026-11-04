// 法人ホームページの本文テキストを取得してログに出す（文章作成の参考用・手動実行）
'use strict';
const urls = process.argv.slice(2);
function text(html) {
  return html.replace(/<(script|style|noscript|svg|header|footer|nav)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|tr|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
(async () => {
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recruit-site-builder)' } });
      const h = await r.text();
      const t = (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
      console.log(`\n===== ${u} (${r.status}) ${t.trim()} =====`);
      console.log(text(h).slice(0, 4000));
    } catch (e) { console.log(`\n===== ${u} 取得失敗: ${e.message}`); }
  }
})();
