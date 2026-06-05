# 大学二次試験PDF取得状況メモ

確認日: 2026-05-16

対象: 2026年度から10年分のうち、まずWeb上で確認できる範囲。公式PDFは実装対象、予備校・新聞・個人サイトの解答解説は著作権処理が必要なため、当面は参照元メモに留める。

## 結論

- 東京大学: 公式サイトで直近3年度分の第2次学力試験問題を公開。2026年度は英語など一部が著作権理由で非公開。今回、2026年度の公式公開分のうち国語・数学・地歴・理科を取り込み済み。
- 東京大学: CyberCollegeにも2025年度、2024年度、2023年度の前期全学部の問題PDFが掲載されている。ただしパスワード付きPDFのため、実装対象から除外し、ファイルも削除済み。
- 京都大学: 公式サイトで令和7年度(2025年度)の一般選抜試験問題と出題意図等を公開。掲載期限は2027年3月まで。今回、2025年度の数学(文系/理系)と英語(公開部分)を取り込み済み。
- 名古屋大学: 公式サイトで令和8年度、令和7年度、令和6年度の一般選抜試験問題および正解・解答例等を公開。今回、2026年度の英語・数学・物理・化学・生物を取り込み済み。
- 浜松医科大学: 公式サイトではPDF配布ではなく、入試課窓口で過去5年分の閲覧請求が可能。Web上に公式問題PDFは見つからないため、現時点では実装保留。
- 10年分の完全なWeb取得は、公式サイトだけでは不足。東進の過去問DBは2008-2025年の主要国公立二次の問題・解答を掲載しているが、ログイン/利用条件があり、システムへの再配布は別判断が必要。
- 京大・名大・浜松医科大は、教材研究室からPDFを受領したら差し替えられるように、2026-2017年度の年度別・科目別入口を仮PDFつきで作成済み。

## 公式ソース

### 東京大学

- 公式: https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/e01_04.html
- 2026年度問題: https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/r8_exam.html
- CyberCollege: https://www.cybercollege.jp/tokyo/index.php
- 公式ページ上の範囲: 直近3年度分。2026年度ページでは、英語、英語スクリプト、独仏中、および一部著作物を非公開としている。
- CyberCollege分: 2025-2023年度のPDFは確認済みだが、パスワード付きのためシステムでは使用しない。
- 実装済み:
  - `todai/2026/japanese/humanities`
  - `todai/2026/japanese/science`
  - `todai/2026/math/humanities`
  - `todai/2026/math/science`
  - `todai/2026/social/humanities`
  - `todai/2026/science/science`
  - `todai/2026-2017/*` の入口を仮PDFで作成。2026年度の公式公開分は実PDF、その他の未取得分は教材研究室差し替え待ち。

### 京都大学

- 公式: https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq
- 2025年度問題・出題意図等: https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq/r7-eq
- 利用条件: https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq/copyright-policy
- 公式ページ上の範囲: 2025年度。著作物許諾が得られない部分は掲載されない。掲載期限は2027年3月まで。
- 赤本オンライン: https://akahon.net/kkm/kyt/index.html
  - 2015-2025年度の解答用紙はPDF公開。問題・解答・傾向分析本文は赤本掲載扱い。
- 実装済み:
  - `kyodai/2025/math/humanities`
  - `kyodai/2025/math/science`
  - `kyodai/2025/english/science` (公式公開部分)
  - 2026-2017年度の英語・数学・国語・地歴・理科の入口を仮PDFで作成。

### 名古屋大学

- 公式: https://www.nagoya-u.ac.jp/admissions/exam/data/answer/index.html
- 2026年度問題・正解/解答例等: https://www.nagoya-u.ac.jp/admissions/exam/data/answer/sub/post_642.html
- 公式ページ上の範囲: 2026年度、2025年度、2024年度。著作権者の利用許諾を得ていない部分は掲載されない。
- 実装済み:
  - `nagoya/2026/math/science`
  - `nagoya/2026/math/humanities`
  - `nagoya/2026/english/science`
  - `nagoya/2026/physics/science`
  - `nagoya/2026/chemistry/science`
  - `nagoya/2026/biology/science`
  - 2026-2017年度の英語・数学・国語・地歴・理科の入口を仮PDFで作成。

### 浜松医科大学

- 公式: https://www.hama-med.ac.jp/admission/past.html
- 公式ページ上の範囲: Web PDF公開ではなく、入試課窓口で過去5年分の試験問題閲覧を請求可能。
- 実装状況: 公式PDFがWeb取得できないため、2026-2017年度の英語・数学・物理・化学・生物・小論文の入口を仮PDFで作成。教材研究室または窓口請求でPDF化できたら `hamamatsu_medical/YYYY/.../problem.pdf` を差し替える。

## 予備校・その他

- 東進 過去問DB: https://www.toshin-kakomon.com/sp/index.php
  - 2008-2025年の共通テスト、東京大学・京都大学など主要国公立二次、難関私大の問題・解答を掲載と明記。
  - 無料会員登録/ログイン前提。直接再配布は避け、取得確認と教材作成の参照元扱い。
- 2025年解答速報まとめ: https://resemom.jp/article/2025/02/21/80917.html
  - 東進、代ゼミ、河合塾、駿台、Z会、読売、産経の掲載予定大学がまとまっている。
  - 東大・京大・名大は複数予備校で2025年度解答速報対象。浜松医科大学は主要速報一覧には見当たらない。
- 駿台 京大入試データ: https://www2.sundai.ac.jp/univ/kyoto-u/nyushi-data-kyoto/
  - 入試データ/分析系。解答解説の常設PDF取得元としては未確定。
- 浜松医科大学 赤本: https://akahon.net/books/detail/2680400?link=Books%2FlistDetail%2F3%2F1
  - 市販本として問題編・解答編あり。Web実装には使わず、教材研究室側の差し替え候補。
- 浜松医科大学の過去問紹介ページ: https://shotosha.com/medical-school/kako/hama-med-kako
  - Web上の過去問リンク案内あり。ただし公式配布ではないため、直接取り込みは保留。

## 実装メモ

- 公式PDF取り込みスクリプト: `exam-system/scripts/import-secondary-official-sources.mjs`
- PDF公開同期: `exam-system/scripts/sync-public-exam-assets.mjs`
- 未取得分の入口作成: `exam-system/scripts/scaffold-secondary-placeholders.mjs`
- 二次試験のように `marksheet.json` がない試験では、試験画面の右側マーク欄を非表示にし、PDF基準幅とズーム上限を上げた。
- 予備校/手書き解説は、佐鳴教材研究室の解説PDFに差し替える前提。現時点では公式の「出題意図・解答例」がある名大/京大のみ `answer.pdf` に配置した。
