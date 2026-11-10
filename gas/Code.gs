/**
 * 福心会 採用情報 — 応募フォーム自動受付（Google Apps Script・無料）
 *
 * 求人サイトの「応募する」ボタンから届いた内容を
 *   1. 採用担当のメールアドレスへ自動でメール送信
 *   2. このスプレッドシートの「応募一覧」シートに1行ずつ記録
 * します。
 *
 * 設置方法は README の「応募の自動送信（Google Apps Script）」を見てください。
 */

// ▼ 応募メールの受け取り先（変更する時はここを書き換えて「デプロイ」→「デプロイを管理」→ 新バージョン）
const TO = 'fsg.itoh@fukusokyo.jp';
const SHEET_NAME = '応募一覧';
const MAX_PER_HOUR = 30; // いたずら対策：1時間あたりの受付上限
const REPLY_NAME = '福心会 採用担当';           // 応募者へ送る確認メールの差出人名
const CONTACT = 'TEL 090-9574-2762（平日・土曜 9:00〜17:00）'; // 確認メールに書く問い合わせ先

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // いたずら（自動投稿プログラム）対策：見えない欄に入力があれば受け付けたふりをして破棄
    if (d.website) return json_({ ok: true });

    const need = ['place', 'job', 'name', 'tel', 'email', 'c1', 'c2', 'c3'];
    for (const k of need) {
      if (!d[k] || !String(d[k]).trim()) return json_({ ok: false, error: '未入力: ' + k });
    }
    const v = {};
    ['place', 'job', 'emp', 'name', 'tel', 'email', 'c1', 'c2', 'c3', 'page'].forEach(function (k) { v[k] = clip_(d[k], 200); });
    v.msg = clip_(d.msg, 1000);
    v.bring = clip_(d.bring, 100); // 面接当日の持ち物（サイトの設定から届く）
    if (!/^0\d{9,10}$/.test(v.tel.replace(/[^0-9]/g, ''))) return json_({ ok: false, error: '電話番号の形式' });
    v.email = v.email.replace(/＠/g, '@').replace(/\s/g, '');
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(v.email)) return json_({ ok: false, error: 'メールアドレスの形式' });

    // 受付数の上限
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get('count') || 0);
    if (n >= MAX_PER_HOUR) return json_({ ok: false, error: '混み合っています' });
    cache.put('count', String(n + 1), 3600);
    // 同じメールアドレスからの連続送信を防ぐ（10分）
    const key = 'mail:' + v.email.toLowerCase();
    if (cache.get(key)) return json_({ ok: true });
    cache.put(key, '1', 600);

    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

    // 1. スプレッドシートに記録
    const ss = spreadsheet_();
    const sh = sheet_(ss);
    sh.appendRow([now, v.place, v.job, v.emp, v.name, "'" + v.tel, v.c1, v.c2, v.c3, v.msg, '未対応', v.email]);

    // 2. 採用担当へメール
    const subject = '【応募・面接希望】' + v.job + '　' + v.name + '様';
    const body = [
      '求人サイトから応募がありました。（' + now + ' 受付）', '',
      '■ 応募する事業所：' + v.place,
      '■ 職種：' + v.job + (v.emp ? '（' + v.emp + '）' : ''),
      '■ お名前：' + v.name,
      '■ 電話番号：' + v.tel,
      '■ メールアドレス：' + v.email, '',
      '■ 面接の希望日時',
      '　第1希望：' + v.c1,
      '　第2希望：' + v.c2,
      '　第3希望：' + v.c3, '',
      '■ ご質問・ご希望：' + (v.msg || 'なし'), '',
      '応募一覧（スプレッドシート）：' + ss.getUrl(),
      '応募ページ：' + v.page, '',
      '――――――――――',
      '★ このメールに「返信」すると、応募者（' + v.email + '）へそのまま届きます。',
      '　 応募者には「応募を受け付けました」という確認メールを自動で送っています。'
    ].join('\n');
    MailApp.sendEmail({ to: TO, subject: subject, body: body, name: '福心会 採用サイト', replyTo: v.email });

    // 3. 応募者へ受付確認メール（返信先は採用担当）
    const thanks = [
      v.name + ' 様', '',
      'このたびは、福心会の求人にご応募いただき、ありがとうございます。',
      '以下の内容で応募を受け付けました。', '',
      '■ 応募する事業所：' + v.place,
      '■ 職種：' + v.job,
      '■ 面接の希望日時',
      '　第1希望：' + v.c1,
      '　第2希望：' + v.c2,
      '　第3希望：' + v.c3, '',
      (v.bring ? '■ 面接当日の持ち物：' + v.bring + '\n' : '') +
      '内容を確認のうえ、採用担当より、お電話またはメールで面接の日時をご連絡いたします。',
      '数日たっても連絡がない場合は、お手数ですが下記までお問い合わせください。', '',
      '福心会グループ 採用担当（伊藤）',
      CONTACT, '',
      '※ このメールは応募フォームから自動で送信しています。',
      '　 このメールに返信すると、採用担当に届きます。',
      '※ お心当たりのない場合は、このメールを破棄してください。'
    ].join('\n');
    MailApp.sendEmail({ to: v.email, subject: '【福心会】ご応募ありがとうございます（' + v.job + '）', body: thanks, name: REPLY_NAME, replyTo: TO });

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ブラウザでURLを開いた時の確認用
function doGet() {
  return json_({ ok: true, message: '応募フォームの受付は動いています' });
}

// 設置後の動作確認用：エディタ上部の関数選択で「testMail」を選んで「実行」
function testMail() {
  const ss = spreadsheet_();
  sheet_(ss);
  MailApp.sendEmail(TO, '【テスト】求人サイト応募フォーム',
    'これはテスト送信です。このメールが届けば、応募の自動送信の準備ができています。\n\n応募一覧（スプレッドシート）：' + ss.getUrl());
}

// 応募を記録するスプレッドシート
// スプレッドシートの「拡張機能」→「Apps Script」から作った場合はそのスプレッドシート、
// そうでない場合は「採用 応募一覧」というスプレッドシートを自動で作ってそこに記録する
function spreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create('採用 応募一覧');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function sheet_(ss) {
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['受付日時', '事業所', '職種', '雇用形態', 'お名前', '電話番号', '第1希望', '第2希望', '第3希望', 'ご質問・ご希望', '対応状況', 'メールアドレス']);
    sh.setFrozenRows(1);
  } else if (sh.getRange(1, 12).getValue() !== 'メールアドレス') {
    sh.getRange(1, 12).setValue('メールアドレス');
  }
  return sh;
}

function clip_(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
