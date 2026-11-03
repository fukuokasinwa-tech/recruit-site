# 採用サイト（求人票作成・公開システム）

就労継続支援A型・B型／相談支援／放課後等デイサービスの職員募集用に作った、**無料で運用できる求人サイト**です。

- 求人票は**ブラウザの入力画面（求人票作成ツール）**で作成。職種のひな形つき
- **GitHub Pages（無料）**でインターネットに公開。サーバー代・ドメイン代は不要
- **Googleしごと検索**（Google検索の求人枠）に載るための構造化データを自動で埋め込み
- 地域（八女市・久留米市・柳川市・筑後市・大牟田市）／事業／雇用形態で絞り込み
- スマホ対応、**A4一枚の求人票として印刷**可能（ハローワーク掲示・店頭掲示用）
- 掲載期限を過ぎた求人は毎朝自動で非公開

---

## 仕組み

```
求人票作成ツール（ブラウザ）
   │ 「GitHubに登録して公開する」
   ▼
GitHub（jobs/ フォルダに 求人1件 = 1ファイル で保存）
   │ 自動（GitHub Actions）
   ▼
求人サイト https://＜あなたのID＞.github.io/recruit-site/
   │
   ▼
Googleしごと検索・Google検索・SNSでのシェア
```

## フォルダ構成

| 場所 | 内容 |
|---|---|
| `data/config.json` | 法人名・電話番号・メール・GitHubのID など（最初に1回だけ編集） |
| `data/offices.json` | 事業所の一覧（名前・事業種別・住所） |
| `jobs/*.json` | 求人1件ごとのデータ（作成ツールで作る） |
| `admin/index.html` | 求人票作成ツール |
| `build.js` | サイトを生成するプログラム（触らなくてOK） |
| `.github/workflows/deploy.yml` | 自動公開の設定（触らなくてOK） |

---

## はじめての公開手順（初回のみ・約30分）

### 1. GitHubアカウントを作る（無料）
1. https://github.com/signup で登録（メールアドレスとパスワードだけ）
2. ユーザー名（例：`yame-fukushi`）を控えておく

### 2. リポジトリ（保管場所）を作る
1. 右上「＋」→「New repository」
2. Repository name：`recruit-site`
3. **Public** を選択（無料でサイト公開するために必要）→「Create repository」

### 3. ファイルをアップロード
**方法A：Claude Code を使う（おすすめ）**
Claude Code に「このフォルダを GitHub の ＜ユーザー名＞/recruit-site に push して」と頼めば完了します。

**方法B：ブラウザでアップロード**
1. リポジトリ画面の「uploading an existing file」をクリック
2. このフォルダの中身（`admin` `data` `jobs` `src` `build.js` `preview.js` `README.md` `.gitignore`）をドラッグ＆ドロップ →「Commit changes」
3. `.github` フォルダは隠しフォルダのため、別に作ります：
   「Add file」→「Create new file」→ ファイル名に `.github/workflows/deploy.yml` と入力 →
   このフォルダの `.github/workflows/deploy.yml` の中身を貼り付けて「Commit changes」

### 4. GitHub Pages を有効にする
1. リポジトリの「Settings」→ 左メニュー「Pages」
2. 「Source」を **GitHub Actions** に変更
3. 「Actions」タブを開き、「求人サイトを公開」が緑のチェックになれば公開完了
   → `https://＜ユーザー名＞.github.io/recruit-site/` で見られます

### 5. 法人情報を入力する（GitHub上で編集できます）
1. `data/config.json` を開き、右上の鉛筆マーク（Edit）
2. 書き換える項目：

| 項目 | 内容 |
|---|---|
| `orgName` | 法人名（例：社会福祉法人○○会） |
| `siteName` | サイト名（例：○○会 採用情報） |
| `catchcopy` | トップページの紹介文 |
| `siteUrl` | `https://＜ユーザー名＞.github.io/recruit-site` |
| `hqPostalCode` `hqAddress` | 本部の郵便番号・住所 |
| `phone` `phoneHours` | 採用担当の電話番号と受付時間 |
| `email` | 応募受付メールアドレス |
| `applyFormUrl` | Googleフォームの応募フォームURL（任意・下記参照） |
| `github.owner` | GitHubのユーザー名 |

3. `data/offices.json` も同じように、各事業所の名前・郵便番号・住所（番地まで）を入力
   - 事業所を増やすときは `{ ... }` のかたまりをコピーして追加。`id` は半角英小文字で重複しない名前に
   - `service` は「就労継続支援A型」「就労継続支援B型」「相談支援」「放課後等デイサービス」など
4. 「Commit changes」で保存 → 1〜2分で反映

> ⚠️ `jobs/sample-*.json` は見本です（非公開設定）。不要になったら削除してください。

---

## 毎回の求人票の作り方

1. `https://＜ユーザー名＞.github.io/recruit-site/admin/` を開く（ブックマーク推奨）
2. 事業所を選び、「ひな形から入力」で職種を押す → 例文が入るので、給与・時間・休日などを実情に合わせて修正
3. 右側のプレビューで確認
4. **「① GitHubに登録して公開する」** → GitHubの画面で緑の「Commit changes…」→「Commit changes」
5. 1〜2分後、求人サイトに掲載されます

| やりたいこと | 方法 |
|---|---|
| 求人を修正 | GitHubで `jobs/○○.json` を開き鉛筆マーク → 作成ツールで「JSONをコピー」した内容に全部貼り替え。または直接文字を修正 |
| 募集を終了 | `"published": true` を `false` に変える、または掲載期限を過去日に。ファイル削除でもOK |
| 紙の求人票 | 求人ページの「印刷する」ボタン → A4一枚で印刷／PDF保存 |
| 求人を手元に保存 | 作成ツールの「JSONを保存」 |

> 管理画面（/admin/）は誰でも開けますが、**GitHubにログインしている人しか求人を登録・変更できない**ので安全です。

---

## 応募者を増やすための無料の手段

1. **Google Search Console に登録**（最重要）
   https://search.google.com/search-console →「URLプレフィックス」に サイトURL を入力 → 所有権確認は「HTMLタグ」を選び、表示された `<meta ...>` をClaude Codeに渡して埋め込んでもらう →「サイトマップ」に `sitemap.xml` を送信。
   これで求人が **Google検索の「しごと検索」枠** に表示されやすくなります（「八女市 生活支援員 求人」など）。
2. **Googleビジネスプロフィール**（各事業所）のWebサイト欄や投稿に求人URLを載せる
3. **Indeed**：無料掲載枠があります（Indeed側で求人を登録し、応募先にこのサイトのURLを記載）
4. **ハローワーク**：求人申込み時に「求人サイトのURL」として記載。印刷した求人票も掲示に使えます
5. **LINE・Instagram・Facebook**：求人ページの「共有する」ボタンからURLを送る
6. **応募フォーム**：Googleフォーム（無料）で「氏名・電話・希望事業所・見学希望」を作り、URLを `applyFormUrl` に入れると応募ボタンが表示されます（回答はスプレッドシートに自動集計）

---

## パソコンで確認する（任意）

Node.js（https://nodejs.org/ ）が入っていれば：

```bash
node preview.js
```

→ http://localhost:8080/ （サイト）と http://localhost:8080/admin/ （作成ツール）。下書きも表示されます。

## 料金について

- GitHub・GitHub Pages・GitHub Actions：公開リポジトリは**無料**
- 独自ドメインなどの有料サービスは使いません（すべて無料の範囲で運用）
- 注意：公開リポジトリのため、**個人情報（応募者情報など）は絶対にここに保存しない**でください
