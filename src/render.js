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
        name: config.orgName,
        sameAs: config.siteUrl
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
      identifier: { '@type': 'PropertyValue', name: config.orgName, value: job.id },
      directApply: true
    };
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
    ['事業所', function (j, o) { return esc(o.name) + '<br><span class="muted">' + esc(o.service) + '</span>'; }],
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

  // 求人票本体（表形式）
  function jobSheetHtml(job, office, config) {
    var rows = ROWS.map(function (r) {
      var v = r[1](job, office);
      if (!v || v === '<strong></strong>') return '';
      return '<tr><th>' + r[0] + '</th><td>' + v + '</td></tr>';
    }).join('');
    var tags = (job.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    return '' +
      '<article class="sheet">' +
      '<header class="sheet-head">' +
      '<div class="badges"><span class="badge svc">' + esc(office.service) + '</span><span class="badge city">' + esc(office.city) + '</span><span class="badge emp">' + esc(job.employmentType) + '</span></div>' +
      '<h1>' + esc(job.title) + '</h1>' +
      '<p class="salary">' + esc(salaryText(job)) + '</p>' +
      (tags ? '<div class="tags">' + tags + '</div>' : '') +
      '</header>' +
      (job.message ? '<p class="message">' + nl2br(job.message) + '</p>' : '') +
      '<table class="sheet-table">' + rows + '</table>' +
      applyHtml(job, office, config) +
      '<p class="org">' + esc(config.orgName) + '　〒' + esc(config.hqPostalCode) + ' ' + esc(config.hqAddress) + '</p>' +
      '</article>';
  }

  function applyHtml(job, office, config) {
    var subject = '【応募】' + job.title + '（' + office.name + '）';
    var body = 'お名前：\nふりがな：\n電話番号：\nご希望の連絡時間帯：\n見学希望：あり／なし\nご質問など：\n';
    var btns = [];
    if (config.applyFormUrl) btns.push('<a class="btn primary" href="' + esc(config.applyFormUrl) + '" target="_blank" rel="noopener">応募フォームから応募</a>');
    if (config.phone) btns.push('<a class="btn" href="tel:' + esc(String(config.phone).replace(/[^0-9+]/g, '')) + '">電話で応募・問い合わせ<br><small>' + esc(config.phone) + (config.phoneHours ? '（' + esc(config.phoneHours) + '）' : '') + '</small></a>');
    if (config.email) btns.push('<a class="btn" href="mailto:' + esc(config.email) + '?subject=' + encodeURIComponent(subject) + '&amp;body=' + encodeURIComponent(body) + '">メールで応募</a>');
    return '<section class="apply no-print"><h2>応募・見学のお申し込み</h2><p>「求人サイトを見た」とお伝えください。見学だけでも歓迎です。</p><div class="btns">' + btns.join('') + '</div></section>' +
      '<section class="apply print-only"><h2>応募・お問い合わせ</h2><p>TEL ' + esc(config.phone) + (config.phoneHours ? '（' + esc(config.phoneHours) + '）' : '') + (config.email ? '　/　' + esc(config.email) : '') + '</p></section>';
  }

  var api = {
    esc: esc, nl2br: nl2br, salaryText: salaryText, fullAddress: fullAddress, isExpired: isExpired,
    jobPostingJsonLd: jobPostingJsonLd, jobSheetHtml: jobSheetHtml, absUrl: absUrl,
    EMPLOYMENT_TYPES: EMPLOYMENT_TYPES, SALARY_UNITS: SALARY_UNITS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JobRender = api;
})(this);
