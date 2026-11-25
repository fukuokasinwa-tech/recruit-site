# 法人ホームページ「求人情報」ページに付けるリンク

貼り付け先：https://fukushinkai-yame.jp/recruit （求人情報ページ）の、いちばん上の文章のすぐ下がおすすめです。

## リンク先（求人サイト）
https://fukuokasinwa-tech.github.io/recruit-site/

## バナー画像
- 画像URL：https://fukuokasinwa-tech.github.io/recruit-site/images/banner/recruit-banner.jpg
- サイズ：横1200 × 縦400（スマホでは自動で縮みます）
- 代わりの文字（alt）：福心会グループ 採用情報 求人一覧はこちら

## 文章（そのまま使えます）
**現在募集中の求人・応募はこちら**
八女・久留米・柳川・筑後・大牟田の事業所の求人を、写真・地図つきで掲載しています。
未経験・資格なしOKの求人もあります。Webから応募・見学のお申し込みができます。
▶ 求人一覧を見る：https://fukuokasinwa-tech.github.io/recruit-site/

## ボタンのコード（ホームページの編集画面に「HTML」や「カスタムHTML」で貼る場合）
```html
<a href="https://fukuokasinwa-tech.github.io/recruit-site/" target="_blank" rel="noopener" style="display:block;max-width:600px;margin:16px auto">
  <img src="https://fukuokasinwa-tech.github.io/recruit-site/images/banner/recruit-banner.jpg" alt="福心会グループ 採用情報 求人一覧はこちら" style="width:100%;height:auto;border-radius:12px">
</a>
<p style="text-align:center;margin:8px 0 24px">
  <a href="https://fukuokasinwa-tech.github.io/recruit-site/" target="_blank" rel="noopener" style="display:inline-block;background:#2f7d5b;color:#fff;font-weight:bold;padding:12px 28px;border-radius:999px;text-decoration:none">現在募集中の求人・応募はこちら ▶</a>
</p>
```

## HTMLが使えない編集画面の場合
1. 「画像」を追加 → バナー画像をアップロード（または画像URLを指定）
2. 画像に「リンク」を設定 → リンク先に求人サイトのURLを入れる
3. 「新しいタブで開く」があればオン
