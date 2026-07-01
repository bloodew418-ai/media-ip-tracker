# Media IP Tracker v2

`/docs` はGitHub Pagesで公開する検索ファースト版のWebアプリです。

## v2の方針

- 作品名を入力して、漫画・アニメ・ドラマ・映画・小説を横断検索します。
- AniList / Google Books / Wikidata はAPIキーなしで検索します。
- TMDbは任意です。映画・ドラマ検索を強化したい場合だけ、Web画面の「設定/API」でRead Access Tokenを保存します。
- TMDbトークン、保存済み作品、インポートデータはブラウザのlocalStorageに保存します。
- スクレイピング、ログイン、課金、クラウド同期、AIレコメンドは実装していません。
- NetflixやAmazonなどは「探す」ための検索リンクであり、配信中・販売中とは断定しません。

## 画面

1. 検索トップ
2. 検索結果ページ
3. 作品詳細 / 保存済みページ
4. 設定 / APIキー管理
5. データ管理

v1の `/docs` は `../docs-v1` に退避しています。
