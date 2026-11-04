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

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // いたずら（自動投稿プログラム）対策：見えない欄に入力があれば受け付けたふりをして破棄
    if (d.website) return json_({ ok: true });

    const need = ['place', 'job', 'name', 'tel', 'c1', 'c2', 'c3'];
    for (const k of need) {
      if (!d[k] || !String(d[k]).trim()) return json_({ ok: false, error: '未入力: ' + k });
    }
    const v = {};
    ['place', 'job', 'emp', 'name', 'tel', 'c1', 'c2', 'c3', 'page'].forEach(function (k) { v[k] = clip_(d[k], 200); });
    v.msg = clip_(d.msg, 1000);
    if (!/^0\d{9,10}$/.test(v.tel.replace(/[^0-9]/g, ''))) return json_({ ok: false, error: '電話番号の形式' });

    // 受付数の上限
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get('count') || 0);
    if (n >= MAX_PER_HOUR) return json_({ ok: false, error: '混み合っています' });
    cache.put('count', String(n + 1), 3600);

    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

    // 1. スプレッドシートに記録
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(SHEET_NAME);
      sh.appendRow(['受付日時', '事業所', '職種', '雇用形態', 'お名前', '電話番号', '第1希望', '第2希望', '第3希望', 'ご質問・ご希望', '対応状況']);
      sh.setFrozenRows(1);
    }
    sh.appendRow([now, v.place, v.job, v.emp, v.name, "'" + v.tel, v.c1, v.c2, v.c3, v.msg, '未対応']);

    // 2. 採用担当へメール
    const subject = '【応募・面接希望】' + v.job + '　' + v.name + '様';
    const body = [
      '求人サイトから応募がありました。（' + now + ' 受付）', '',
      '■ 応募する事業所：' + v.place,
      '■ 職種：' + v.job + (v.emp ? '（' + v.emp + '）' : ''),
      '■ お名前：' + v.name,
      '■ 電話番号：' + v.tel, '',
      '■ 面接の希望日時',
      '　第1希望：' + v.c1,
      '　第2希望：' + v.c2,
      '　第3希望：' + v.c3, '',
      '■ ご質問・ご希望：' + (v.msg || 'なし'), '',
      '応募一覧（スプレッドシート）：' + ss.getUrl(),
      '応募ページ：' + v.page, '',
      '※ このメールは求人サイトの応募フォームから自動で送信されています。応募者へは電話でご連絡ください。'
    ].join('\n');
    MailApp.sendEmail({ to: TO, subject: subject, body: body, name: '福心会 採用サイト' });

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
  MailApp.sendEmail(TO, '【テスト】求人サイト応募フォーム', 'これはテスト送信です。このメールが届けば、応募の自動送信の準備ができています。');
}

function clip_(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
