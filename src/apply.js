/* メール応募フォーム：入力チェック → 応募者のメールアプリで送信内容を作成 */
(function () {
  'use strict';
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  function pad(n) { return ('0' + n).slice(-2); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmt(v) { var p = v.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); return p[0] + '年' + (+p[1]) + '月' + (+p[2]) + '日（' + WD[d.getDay()] + '）'; }

  [].forEach.call(document.querySelectorAll('form.mailform'), function (f) {
    var closed = (f.dataset.closed || '').split(',').filter(Boolean).map(Number);
    var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    var max = new Date(); max.setDate(max.getDate() + 90);
    [1, 2, 3].forEach(function (n) { var d = f.elements['d' + n]; d.min = ymd(tomorrow); d.max = ymd(max); });
    var err = f.querySelector('.mf-error');
    f.addEventListener('input', function (e) { e.target.classList.remove('invalid'); });

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var el = f.elements, msgs = [], bad = [];
      function need(name, label) { if (!el[name].value.trim()) { msgs.push(label + 'を入力してください'); bad.push(el[name]); } }
      need('name', 'お名前');
      need('tel', '電話番号');
      if (el.tel.value.trim()) {
        var digits = el.tel.value.replace(/[^0-9]/g, '');
        if (!/^0\d{9,10}$/.test(digits)) { msgs.push('電話番号は市外局番から（10〜11桁）入力してください'); bad.push(el.tel); }
      }
      var seen = {};
      [1, 2, 3].forEach(function (n) {
        var d = el['d' + n], t = el['t' + n];
        if (!d.value) { msgs.push('第' + n + '希望の日付を選んでください'); bad.push(d); }
        if (!t.value) { msgs.push('第' + n + '希望の時間を選んでください'); bad.push(t); }
        if (d.value) {
          var p = d.value.split('-'), day = new Date(+p[0], +p[1] - 1, +p[2]);
          if (d.value < d.min) { msgs.push('第' + n + '希望は明日以降の日付を選んでください'); bad.push(d); }
          else if (closed.indexOf(day.getDay()) >= 0) { msgs.push('第' + n + '希望：' + WD[day.getDay()] + '曜日はお休みです。別の日を選んでください'); bad.push(d); }
        }
        if (d.value && t.value) {
          var k = d.value + ' ' + t.value;
          if (seen[k]) { msgs.push('第' + n + '希望が第' + seen[k] + '希望と同じ日時です。別の日時を選んでください'); bad.push(d, t); }
          seen[k] = n;
        }
      });
      [].forEach.call(f.querySelectorAll('.invalid'), function (x) { x.classList.remove('invalid'); });
      if (msgs.length) {
        bad.forEach(function (x) { x.classList.add('invalid'); });
        err.innerHTML = '入力内容を確認してください：<br>・' + msgs.map(function (m) { return m.replace(/</g, '&lt;'); }).join('<br>・');
        err.hidden = false; bad[0].focus();
        return;
      }
      err.hidden = true;
      var subject = '【応募・面接希望】' + el.job.value + '　' + el.name.value.trim() + '様';
      var body = [
        '採用ご担当者様', '',
        '求人サイトを見て応募します。面接をお願いします。', '',
        '■ 応募する事業所：' + el.place.value,
        '■ 職種：' + el.job.value + '（' + el.emp.value + '）',
        '■ お名前：' + el.name.value.trim(),
        '■ 電話番号：' + el.tel.value.trim(), '',
        '■ 面接の希望日時',
        '　第1希望：' + fmt(el.d1.value) + ' ' + el.t1.value + '〜',
        '　第2希望：' + fmt(el.d2.value) + ' ' + el.t2.value + '〜',
        '　第3希望：' + fmt(el.d3.value) + ' ' + el.t3.value + '〜', '',
        '■ ご質問・ご希望：' + (el.msg.value.trim() || 'なし'), '',
        'どうぞよろしくお願いいたします。'
      ].join('\n');
      var fb = f.querySelector('.mf-fallback');
      var mailText = '宛先：' + f.dataset.to + '\n件名：' + subject + '\n\n' + body;
      var mailto = 'mailto:' + f.dataset.to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      fb.querySelector('.mf-text').value = mailText;

      if (!f.dataset.endpoint) { fb.hidden = false; location.href = mailto; return; }

      // 自動送信（Google Apps Script）
      var btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = '送信中…';
      var data = {
        website: el.website.value, place: el.place.value, job: el.job.value, emp: el.emp.value,
        name: el.name.value.trim(), tel: el.tel.value.trim(), msg: el.msg.value.trim(),
        c1: fmt(el.d1.value) + ' ' + el.t1.value + '〜', c2: fmt(el.d2.value) + ' ' + el.t2.value + '〜', c3: fmt(el.d3.value) + ' ' + el.t3.value + '〜',
        subject: subject, page: location.href
      };
      fetch(f.dataset.endpoint, { method: 'POST', body: JSON.stringify(data) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || 'error');
          [].forEach.call(f.querySelectorAll('input:not([type=hidden]), select, textarea, button[type=submit], .cand, label, .mf-place, p.muted'), function (x) { x.hidden = true; x.style.display = 'none'; });
          f.querySelector('.mf-done').hidden = false;
          f.querySelector('.mf-done').scrollIntoView({ block: 'center', behavior: 'smooth' });
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = '応募する';
          err.innerHTML = '送信できませんでした。時間をおいてもう一度お試しいただくか、下の「うまく送信できない場合」から、メールまたはお電話でご応募ください。';
          err.hidden = false; fb.hidden = false; fb.open = true;
          if (!fb.querySelector('.mf-mailto')) { var a = document.createElement('a'); a.className = 'btn mf-mailto'; a.textContent = 'メールアプリで送る'; a.href = mailto; a.style.marginTop = '8px'; fb.appendChild(a); }
        });
    });

    var copy = f.querySelector('.mf-copy');
    if (copy) copy.addEventListener('click', function () {
      var ta = f.querySelector('.mf-text');
      (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(function () { alert('コピーしました'); }, function () { ta.select(); document.execCommand('copy'); alert('コピーしました'); });
    });
  });
})();
