# PoC の本実装

https://github.com/paperxlab/yjs/pull/1 に示している PoC を、より良い形でプロジェクトに取り込むための計画

[./poc.diff](./poc.diff) にその PoC の差分がある。
この差分には、doc -> block への rename, store -> structStore への rename が含まれていて困惑しやすいので、注意深く読むこと。

## 背景

この PoC は以下のような問題に対処することを目的としている。
- 巨大なドキュメントを実体化・編集するには、すべての update を読み込む必要がある
  - 小さな Doc に分割して、それをリンクするという方法にすることで、全体を読み込まなくても、一部を読み込んで実体化・編集できるようになる
- 削除処理は、update 自体に削除フラグを立てて、それは取り消せない。削除を undo すると、全く同じ update が再度適用されることになる。
  - 全体を削除、undo, redo を繰り返すとあっという間に update が膨れ上がる
  - その影響で、共同編集で削除 / undo すると、他のクライアントの変更は完全に失われる
  - 削除を Doc の unref 操作として扱い、削除の undo は再度 ref 操作を行うことになり、update の肥大化を防げる
- このパターンは id を Map/Array に入れることで模倣できるが、CRDT の特性上、重複して存在したり、循環参照が発生したりする
  - 中央サーバーで管理する前提にすることで、複数クライアントを跨いでも一意性を保証できる仕組みを導入

## 変更点の概要

- 新しい概念: NanoStore / NanoBlock / StoreTransaction を導入し、従来の Doc 単位の編集から、複数ブロック（= 複数 Doc 相当）を束ねるストアに拡張。
- 新しいコンテンツ種別: ContentBlockRef / ContentBlockUnref を追加し、ブロック（Doc）間の参照／参照解除を CRDT の一部として扱えるように。循環参照検知・競合時のクローン生成も含む。
- スケーラブルな中央サーバーの実装（別リポジトリ）

## どうすべきか悩んでいる点

NanoBlock を Doc に統合したら、NanoBlock が持っていた type はどうするのか
そもそもなぜ NanoBlock に type が必要だったのか

基本的に使い回す時は type をそのまま使い回すので、block.type にアクセスする必要がない気がする

- update の受け取り時
  - blockId と type の両方を持っているので、blockId から引っ張ってきて、type で初期化する（未初期化の場合）
- Map/Array を traverse する時
  - 親が子の　type を知っているので、それで初期化すればいい
- 保存時に blockId から type を引っ張ってくる必要がある
  - block を取得して、その初期化された type が何かを調べる
  - そもそも backend で type を保存する必要があるのか？
  - backend で block 単位で serialize するために必要だと考えていたが、結局ドメイン知識付きで変換することになるので、type は不要じゃないか

backend で blockType を保持しないとしたら
-> traverse 時に呼び出し元が知識として type を持っているだけで良くなり
-> ContentBlockRef にも type を持たせる必要がなくなる

observeRoot の設計が困っている
今は type が eventHandler を持つようになっているが、実際の集計は Root Doc 単位で行われる
理想的には doc.emit("rootObserver", rootTransaction) のようにされるべきか
-> これは実装した

ContentBlockRef から type を削除したのは間違いだった
map.set("child", array) のようにした時に、どうやってもそこのインスタンスを復元する方法がない。完全にミスっ。 ここはやり直しだな。
ただし、backend に blockType を保持する必要はないはず。まあどうせ page とかも持たせる方針だったし、同時にやり直すか。

## PoC からの変更点まとめ

- NanoBlock は Doc に統合された
- NanoStore はなくなり、Doc(root) になった。Root ごとに独立している
- Transaction も Doc(root) 単位になったので、XYClient も Doc(root) 単位に作ることになる
- ContentBlockRef / ContentBlockUnref は ContentDocRef / ContentDocUnref に
- ContentDocRef は blockType を持たない。
  - データベースに保存する値も削除して良くなった
  - 代わりに、`doc.getMap()` などの方法で親が子の type を知っている必要がある



---

## 新機能テストの実装計画

- 狙い: ContentDocRef/ContentDocUnref と autoRef/createRef による Doc 参照機構が壊れていないか、競合・循環・同期のケースを網羅する。既存の subdoc/通常の Type とは独立したカバレッジを tests/doc-ref.tests.js を軸に追加する。
- 優先度順: 基本生成 → フラグ組み合わせ → 競合/循環 → 同期/エンコード → ライフサイクル(unref)。

### 追加するテストケース
- 基本生成と参照解決
  - autoRef=true の Doc に Map/Array で新規 Type を埋め込むと ContentDocRef が作られ、rootDoc.refDocs に登録され、取得値は子 Doc 上に integrate された Type になることを確認（doc/getRefDoc/child.doc などを検証）。
  - autoRef=false の場合は通常の ContentType で埋め込まれ、refDocs が増えないことを確認。
- createRef フラグの組み合わせ
  - autoRef=false でも Type.createRef=true を明示すれば参照化されること、逆に autoRef=true でも createRef=false を明示すれば深い埋め込みになることをそれぞれ検証。
- 競合時のクローン生成
  - 同じ Type インスタンスを Map の複数キー/Array の複数位置に挿入した場合、resolveRefConflict により別 GUID の Doc が生成され、それぞれの内容がクローンされることを確認（元 Type と値の独立性もチェック）。
- 循環参照の排除
  - 子 Doc から親への参照や自己参照を挿入しようとした場合に validateCircularRef により項目が即座に削除され、データ構造が汚れないことを Map/Array 両方で確認。
- 削除と unref の取り扱い
  - 参照を削除した際に `_referrer` がクリアされ、子 Doc の `_unrefs` に ContentDocUnref が積まれることを検証。encode/apply 経由でも Unref が伝搬することを確認。
- 同期とシリアライズ
  - 参照を含む Doc の更新を encodeStateAsUpdate/applyUpdate したときに、受信側でも同じ GUID/階層で refDocs が再構築され、既存更新系テスト（state vector/diff）と両立することを確認。
- 更新イベントの伝播
  - 参照先 Doc を編集した際の updateV2/afterTransaction イベント発火が意図した Doc 単位で起きること、rootDoc 側の rootTransaction イベントが必要なら将来のための pending テストとしてスキップマーク付きで用意する。

### 実装段取り
- tests/doc-ref.tests.js を中心にケースを追加し、必要であれば `tests/testHelper.js` に refDocs を検査する小さなユーティリティを置く。
- 既存の contentRefs マッピング検証は残しつつ、encode/apply を使うケースで `tests/encoding.tests.js` に最小の往復テストを追加（ContentDocRef/Unref がバイナリラウンドトリップすること）。
- 新規テスト追加後は `npm test` で一括確認、doc-ref だけを反復するために `node dist/tests.cjs doc-ref` のようなターゲット指定もメモしておく。

### 実行結果メモ
- `npm run dist` の上で `node ./dist/tests.cjs --filter docRefExtended` を実行。現状の成否:
  - OK: `testDocRefAutoRefRegistersRefs`, `testDocRefCreateRefFlagOverridesAutoRef`.
  - NG: `testDocRefCircularReferencesArePruned`（root を set した時点で「root doc には ContentDocRef 作れない」例外、テストは throw を期待する形に変更済み）。
  - NG: `testDocRefCircularReferencesOnNestedDocsArePruned`（非 root 同士の循環で Unexpected content type in insert operation）。
  - NG: `testDocRefConflictsClonePerPlacement`（同じエラー: Unexpected content type in insert operation 経由で落ちる）。
  - NG: `testDocRefDeletionAddsUnrefAndSerializes`（同上）。
  - NG: `testDocRefSyncRoundtripRestoresRefs`（replicated が Array にならずアサート落ち）。
- 全テスト実行 (`node ./tests/index.js`) では y-map 系など既存ユニットも初期段階から構造不一致で失敗している状態。
