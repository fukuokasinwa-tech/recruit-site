/*
 * 求人票の表示ロジック（ビルド時 Node.js と 管理画面のプレビュー の両方で使用）
 */
(function (root) {
  'use strict';

  var EMPLOYMENT_TYPES = {
    '正社員': 'FULL_TIME',
    '契約社員': 'CONTRACTOR',
    'パート・アルバイト': 'PART_TIME',
    '業務委託': 'CONTRACTOR',
    '臨時・短期': 'TEMPORARY'
  };
  var SALARY_UNITS = { '時給': 'HOUR', '日給': 'DAY', '月給': 'MONTH', '年収': 'YEAR' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nl2br(s) { return esc(s).replace(/\r?\n/g, '<br>'); }
  function yen(n) { return Number(n).toLocaleString('ja-JP') + '円'; }

  function salaryText(job) {
    var s = job.salary || {};
    if (!s.min && !s.max) return '';
    var unit = s.unit || '';
    if (s.min && s.max && s.min !== s.max) return unit + ' ' + yen(s.min) + '〜' + yen(s.max);
    return unit + ' ' + yen(s.min || s.max) + (s.max ? '' : '〜');
  }

  function fullAddress(office) {
    return '福岡県' + (office.city || '') + (office.address || '');
  }

  function isExpired(job, today) {
    return job.validThrough && job.validThrough < today;
  }

  // Google しごと検索 用の構造化データ (JobPosting)
  function jobPostingJsonLd(job, office, config) {
    var s = job.salary || {};
    var data = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: job.title,
      description: jobDescriptionHtml(job, office),
      datePosted: job.datePosted,
      employmentType: EMPLOYMENT_TYPES[job.employmentType] || 'OTHER',
      hiringOrganization: {
        '@type': 'Organization',
        name: operatorName(office, config),
        sameAs: config.homepage || config.siteUrl
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          streetAddress: office.address,
          addressLocality: office.city,
          addressRegion: '福岡県',
          postalCode: office.postalCode,
          addressCountry: 'JP'
        }
      },
      identifier: { '@type': 'PropertyValue', name: operatorName(office, config), value: job.id },
      directApply: true
    };
    var ll = String(office.map || '').match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (ll) data.jobLocation.geo = { '@type': 'GeoCoordinates', latitude: Number(ll[1]), longitude: Number(ll[2]) };
    if (config.logo) data.hiringOrganization.logo = absUrl(config, config.logo);
    if (job.validThrough) data.validThrough = job.validThrough + 'T23:59:59+09:00';
    if (s.min || s.max) {
      var value = { '@type': 'QuantitativeValue', unitText: SALARY_UNITS[s.unit] || 'MONTH' };
      if (s.min && s.max && s.min !== s.max) { value.minValue = Number(s.min); value.maxValue = Number(s.max); }
      else value.value = Number(s.min || s.max);
      data.baseSalary = { '@type': 'MonetaryAmount', currency: 'JPY', value: value };
    }
    return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  }

  function absUrl(config, path) {
    if (/^https?:/.test(path)) return path;
    return config.siteUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  // 求人の詳細（構造化データの description にも使う）
  function jobDescriptionHtml(job, office) {
    var parts = [];
    function add(label, v) { if (v) parts.push('<p><strong>' + esc(label) + '</strong><br>' + nl2br(v) + '</p>'); }
    add('仕事内容', job.description);
    add('応募資格', job.requirements);
    add('歓迎条件', job.welcome);
    add('給与', [salaryText(job), job.salaryNote].filter(Boolean).join('\n'));
    add('勤務時間', job.hours);
    add('休日・休暇', job.holidays);
    add('勤務地', office.name + '（' + office.service + '）\n' + fullAddress(office));
    add('福利厚生', job.benefits);
    return parts.join('');
  }

  var ROWS = [
    ['職種', function (j) { return esc(j.title); }],
    ['事業所', function (j, o, c) { return esc(o.name) + '<br><span class="muted">' + esc(o.service) + '</span>' +
      '<br><span class="muted">運営：' + esc(operatorName(o, c)) + (c.displayName ? '（' + esc(/グループ$/.test(c.displayName) ? c.displayName : c.displayName + 'グループ') + '）' : '') + '</span>' + (officeHomepage(o) ? '<br><a class="no-print" href="' + esc(officeHomepage(o)) + '" target="_blank" rel="noopener">事業所のホームページを見る ↗</a>' : ''); }],
    ['雇用形態', function (j) { return esc(j.employmentType); }],
    ['仕事内容', function (j) { return nl2br(j.description); }],
    ['給与', function (j) { return '<strong>' + esc(salaryText(j)) + '</strong>' + (j.salaryNote ? '<br>' + nl2br(j.salaryNote) : ''); }],
    ['勤務時間', function (j) { return nl2br(j.hours); }],
    ['休日・休暇', function (j) { return nl2br(j.holidays); }],
    ['応募資格', function (j) { return nl2br(j.requirements); }],
    ['歓迎条件', function (j) { return nl2br(j.welcome); }],
    ['勤務地', function (j, o) { return '〒' + esc(o.postalCode) + ' ' + esc(fullAddress(o)) + (o.access ? '<br><span class="muted">' + nl2br(o.access) + '</span>' : ''); }],
    ['加入保険', function (j) { return nl2br(j.insurance); }],
    ['福利厚生・待遇', function (j) { return nl2br(j.benefits); }],
    ['試用期間', function (j) { return nl2br(j.trial); }],
    ['募集人数', function (j) { return j.headcount ? esc(j.headcount) + '名' : ''; }],
    ['掲載期限', function (j) { return j.validThrough ? esc(j.validThrough.replace(/-/g, '/')) + ' まで' : ''; }]
  ];

  // 写真（事業所の写真 ＋ 求人ごとの写真）
  function photosOf(job, office) {
    return [].concat(office.photos || [], job.photos || []).filter(function (p) { return p && p.src; });
  }
  function photoSrc(p, base) {
    return /^https?:/.test(p.src) ? p.src : (base == null ? '../' : base) + p.src.replace(/^\//, '');
  }
  function galleryHtml(job, office, base) {
    var ps = photosOf(job, office);
    if (!ps.length) return '';
    return '<div class="gallery no-print">' + ps.map(function (p, i) {
      var src = esc(photoSrc(p, base));
      return '<figure class="' + (i === 0 ? 'main' : '') + '"><a href="' + src + '" target="_blank" rel="noopener"><img src="' + src + '" alt="' + esc(p.caption || office.name) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '"></a>' +
        (p.caption ? '<figcaption>' + esc(p.caption) + '</figcaption>' : '') + '</figure>';
    }).join('') + '</div>';
  }

  // 雇用する会社（運営法人）：offices.json の operator、なければ config.orgName
  function operatorName(o, config) { return (o && o.operator) || config.orgName; }

  // 事業所のホームページ（offices.json の homepage が手動設定、なければ公開時の自動判定結果 _homepage）
  function officeHomepage(o) {
    if (o.homepage === false) return '';
    return (typeof o.homepage === 'string' && o.homepage.trim()) || o._homepage || '';
  }

  // 地図（Googleマップ・APIキー不要の無料埋め込み）
  // office.map に「住所」「緯度,経度」「建物名」のいずれかを入れると、その場所を表示。空なら住所で表示。
  function mapQuery(office) {
    var m = String(office.map || '').trim();
    return m || fullAddress(office);
  }
  function mapLinkUrl(office) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapQuery(office));
  }
  function mapHtml(office) {
    var q = mapQuery(office);
    if (!q || q === '福岡県') return '';
    var src = 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=17&hl=ja&output=embed';
    return '<section class="map no-print"><h2>勤務地の地図</h2>' +
      '<p class="muted">' + esc(office.name) + '　〒' + esc(office.postalCode) + ' ' + esc(fullAddress(office)) + '</p>' +
      '<div class="map-frame"><iframe src="' + esc(src) + '" title="' + esc(office.name) + 'の地図" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>' +
      '<p class="map-btns"><a class="btn" href="' + esc(mapLinkUrl(office)) + '" target="_blank" rel="noopener">Googleマップで開く（道案内）</a>' +
      (officeHomepage(office) ? '<a class="btn" href="' + esc(officeHomepage(office)) + '" target="_blank" rel="noopener">' + esc(office.name) + 'のホームページ</a>' : '') + '</p></section>';
  }

  // 求人票本体（表形式）
  function jobSheetHtml(job, office, config, base) {
    var rows = ROWS.map(function (r) {
      var v = r[1](job, office, config);
      if (!v || v === '<strong></strong>') return '';
      return '<tr><th>' + r[0] + '</th><td>' + v + '</td></tr>';
    }).join('');
    var tags = (job.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    return '' +
      '<article class="sheet">' +
      '<header class="sheet-head' + (office.logo ? ' has-logo' : '') + '">' +
      '<div class="sheet-top"><div class="badges"><span class="badge svc">' + esc(office.service) + '</span><span class="badge city">' + esc(office.city) + '</span><span class="badge emp">' + esc(job.employmentType) + '</span></div>' +
      (office.logo ? '<img class="office-logo" src="' + esc(photoSrc({ src: office.logo }, base)) + '" alt="' + esc(office.name) + ' ロゴ">' : '') + '</div>' +
      '<h1>' + esc(job.title) + '</h1>' +
      '<p class="salary">' + esc(salaryText(job)) + '</p>' +
      (tags ? '<div class="tags">' + tags + '</div>' : '') +
      '</header>' +
      galleryHtml(job, office, base) +
      (job.message ? '<p class="message">' + nl2br(job.message) + '</p>' : '') +
      '<table class="sheet-table">' + rows + '</table>' +
      mapHtml(office) +
      applyHtml(job, office, config) +
      '<p class="org">' + esc(config.displayName || config.orgName) + (config.hqAddress ? '　' + (config.hqPostalCode ? '〒' + esc(config.hqPostalCode) + ' ' : '') + esc(config.hqAddress) : '') + '</p>' +
      '</article>';
  }

  // 面接の時間の候補（data/config.json の interview で変更可）
  function interviewTimes(config) {
    var iv = config.interview || {};
    var toMin = function (t) { var m = String(t).split(':'); return Number(m[0]) * 60 + Number(m[1] || 0); };
    var start = toMin(iv.start || '9:00'), end = toMin(iv.end || '16:00'), step = Number(iv.step || 30), out = [];
    for (var t = start; t <= end; t += step) out.push(Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2));
    return out;
  }

  // メールでの応募・面接申し込みフォーム（送信は応募者のメールアプリから。サーバー不要・無料）
  function mailFormHtml(job, office, config) {
    if (!config.email) return '';
    var times = interviewTimes(config).map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
    var cands = [1, 2, 3].map(function (n) {
      return '<div class="cand"><span class="cand-label">第' + n + '希望<span class="req">必須</span></span>' +
        '<input type="date" name="d' + n + '" required aria-label="第' + n + '希望の日付">' +
        '<select name="t' + n + '" required aria-label="第' + n + '希望の時間"><option value="">時間を選択</option>' + times + '</select></div>';
    }).join('');
    var place = office.name + '（' + office.service + '）';
    var auto = !!config.formEndpoint;
    return '<form class="mailform no-print" novalidate data-to="' + esc(config.email) + '"' + (auto ? ' data-endpoint="' + esc(config.formEndpoint) + '"' : '') + ' data-closed="' + esc((config.interview && config.interview.closedDays || [0]).join(',')) + '">' +
      '<h3>' + (auto ? 'Webで応募・面接のお申し込み' : 'メールで応募・面接のお申し込み') + '</h3>' +
      (auto ? '<p class="muted">入力して「応募する」を押すと、採用担当に<b>自動で送信</b>されます。担当者から、お電話またはメールでご連絡します。</p>'
            : '<p class="muted">入力して「メールを作成する」を押すと、お使いのメールアプリに内容が入った状態で開きます。そのまま<b>送信</b>してください。</p>') +
      '<div class="mf-hp" aria-hidden="true"><label>ホームページ<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<label>応募する事業所・職種</label>' +
      '<div class="mf-place">' + esc(place) + '<br><span class="muted">' + esc(job.title) + '</span></div>' +
      '<input type="hidden" name="place" value="' + esc(place) + '">' +
      '<input type="hidden" name="job" value="' + esc(job.title) + '">' +
      '<input type="hidden" name="emp" value="' + esc(job.employmentType) + '">' +
      '<label for="mf-name-' + esc(job.id) + '">お名前<span class="req">必須</span></label>' +
      '<input type="text" id="mf-name-' + esc(job.id) + '" name="name" required autocomplete="name" placeholder="例：八女 太郎">' +
      '<label for="mf-tel-' + esc(job.id) + '">電話番号<span class="req">必須</span></label>' +
      '<input type="tel" id="mf-tel-' + esc(job.id) + '" name="tel" required autocomplete="tel" inputmode="tel" placeholder="例：090-1234-5678">' +
      '<label for="mf-mail-' + esc(job.id) + '">メールアドレス<span class="req">必須</span></label>' +
      '<input type="email" id="mf-mail-' + esc(job.id) + '" name="email" required autocomplete="email" inputmode="email" placeholder="例：yame.taro@example.com">' +
      '<p class="muted" style="margin:4px 0 0">' + (auto && config.formAutoReply ? '受付確認のメールをお送りします。採用担当からの返信もこのアドレスに届きます。' : '採用担当からの返信は、このアドレスに届きます。') + '</p>' +
      '<label>面接の希望日時（3つ選んでください）<span class="req">必須</span></label>' +
      '<p class="muted" style="margin:0 0 6px">' + (config.interview && config.interview.note ? esc(config.interview.note) : '日曜日はお休みです。') + '</p>' +
      cands +
      '<label for="mf-msg-' + esc(job.id) + '">ご質問・ご希望など（任意）</label>' +
      '<textarea id="mf-msg-' + esc(job.id) + '" name="msg" rows="3" placeholder="例：見学も希望します"></textarea>' +
      '<p class="mf-error" role="alert" hidden></p>' +
      '<button type="submit" class="btn primary">' + (auto ? '応募する' : 'メールを作成する') + '</button>' +
      '<div class="mf-done" role="status" hidden><b>応募を受け付けました。</b><br>' + (config.formAutoReply ? 'ありがとうございます。ご入力いただいたメールアドレスに<b>受付確認のメール</b>をお送りしました。担当者から、お電話またはメールでご連絡します。<br>※ 確認メールが届かない場合は、迷惑メールフォルダもご確認ください。数日たっても連絡がない場合は、お手数ですがお電話でお問い合わせください。' : 'ありがとうございます。担当者から、お電話またはメールでご連絡します。数日たっても連絡がない場合は、お手数ですがお電話でお問い合わせください。') + '</div>' +
      '<details class="mf-fallback" hidden><summary>' + (auto ? 'うまく送信できない場合' : 'メールアプリが開かない場合') + '</summary>' +
      '<p>下の内容をコピーして、<b>' + esc(config.email) + '</b> 宛てにメールで送ってください。</p>' +
      '<textarea readonly rows="10" class="mf-text"></textarea><button type="button" class="btn mf-copy">内容をコピー</button></details>' +
      '</form>';
  }

  function applyHtml(job, office, config) {
    var btns = [];
    if (config.applyFormUrl) btns.push('<a class="btn primary" href="' + esc(config.applyFormUrl) + '" target="_blank" rel="noopener">応募フォームから応募</a>');
    if (config.phone) btns.push('<a class="btn" href="tel:' + esc(String(config.phone).replace(/[^0-9+]/g, '')) + '">電話で応募・問い合わせ<br><small>' + esc(config.phone) + (config.phoneHours ? '（' + esc(config.phoneHours) + '）' : '') + '</small></a>');
    return '<section class="apply no-print"><h2>応募・見学のお申し込み</h2><p>' + (config.contactName ? '採用担当：' + esc(config.contactName) + '　' : '') + '「求人サイトを見た」とお伝えください。見学だけでも歓迎です。</p><div class="btns">' + btns.join('') + '</div>' +
      mailFormHtml(job, office, config) + '</section>' +
      '<section class="apply print-only"><h2>応募・お問い合わせ</h2><p>' + (config.contactName ? '採用担当：' + esc(config.contactName) + '　' : '') + 'TEL ' + esc(config.phone) + (config.phoneHours ? '（' + esc(config.phoneHours) + '）' : '') + (config.email ? '　/　' + esc(config.email) : '') + '</p></section>';
  }

  var api = {
    esc: esc, nl2br: nl2br, salaryText: salaryText, fullAddress: fullAddress, isExpired: isExpired, mapHtml: mapHtml, mapQuery: mapQuery, officeHomepage: officeHomepage, operatorName: operatorName,
    jobPostingJsonLd: jobPostingJsonLd, jobSheetHtml: jobSheetHtml, photosOf: photosOf, photoSrc: photoSrc, absUrl: absUrl,
    EMPLOYMENT_TYPES: EMPLOYMENT_TYPES, SALARY_UNITS: SALARY_UNITS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JobRender = api;
})(this);
