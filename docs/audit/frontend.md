# フロントエンド監査

## 計測コマンド
```powershell
Get-Command cloc -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
Get-Command tokei -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
node .tmp/audit-repo.mjs
$Excluded = @('node_modules','vendor','dist','build','.next','.git','coverage','__generated__')
Get-ChildItem -Recurse -File | Where-Object { $p=$_.FullName; -not ($Excluded | Where-Object { $p -match "\\$_(\\|$)" }) } | Measure-Object
rg --files -g '!node_modules/**' -g '!vendor/**' -g '!dist/**' -g '!build/**' -g '!.next/**' -g '!.git/**' -g '!coverage/**' -g '!__generated__/**' | Measure-Object
```

注: cloc/tokei は未検出のため、Node.jsスキャンとPowerShell/rg系コマンドで代替計測しました。除外対象は node_modules, vendor, dist, build, .next, .git, coverage, __generated__ です。

## 1. 技術スタック
| 項目 |内容 |
| --- |--- |
| framework |next@16.2.3 |
| 言語比率 |TSX: 7298行, CSS: 380行 |
| styling |tailwindcss@^4, @tailwindcss/postcss@^4, CSS Modules未検出 |
| 状態管理 |React useState/useEffect中心。Redux/Zustand/Jotai等は未検出 |
| フォーム |React標準フォーム/FormData。react-hook-form等は未検出 |
| テスト基盤 |未検出 |

## 2. 規模（実測）
| 項目 |値 |
| --- |--- |
| 総ファイル数 |22 |
| 本体行数 |7678 |
| テスト行数 |0 |
| テストファイル数 |0 |

### 言語別内訳
| 言語 |ファイル数 |行数 |
| --- |--- |--- |
| TSX |21 |7298 |
| CSS |1 |380 |

## 3. 画面・ルート一覧
| パス |ファイル |概要 |
| --- |--- |--- |
| / |exam-system/src/app/page.tsx |画面概要は未計測（静的抽出不可） |
| /exam/[...id] |exam-system/src/app/exam/[...id]/page.tsx |画面概要は未計測（静的抽出不可） |
| /grading |exam-system/src/app/grading/page.tsx |教師ログインが必要です |
| /grading/[...id] |exam-system/src/app/grading/[...id]/page.tsx |採点スタッフ入力 - {submission.studentId} |
| /login |exam-system/src/app/login/page.tsx |IDと安全なニックネームでログイン |
| /practice |exam-system/src/app/practice/page.tsx |過去問対策メニュー |
| /practice/common |exam-system/src/app/practice/common/page.tsx |生徒ログインが必要です |
| /practice/secondary |exam-system/src/app/practice/secondary/page.tsx |生徒ログインが必要です |
| /ranking |exam-system/src/app/ranking/page.tsx |ログインが必要です |
| /results |exam-system/src/app/results/page.tsx |生徒ログインが必要です |
| /review/[...id] |exam-system/src/app/review/[...id]/page.tsx |結果の確認 |
| /videos |exam-system/src/app/videos/page.tsx |ログインが必要です |
| /videos/[id] |exam-system/src/app/videos/[id]/page.tsx |ログインが必要です |

## 4. コンポーネント
| 項目 |値 |
| --- |--- |
| components配下のファイル数 |7 |
| 共通コンポーネント |7 |
| 画面固有コンポーネント |0 |
| カスタムフック数 use*.ts(x) |0 |

| ファイル |
| --- |
| exam-system/src/components/AuthNav.tsx |
| exam-system/src/components/BackgroundThemePicker.tsx |
| exam-system/src/components/BackgroundThemeProvider.tsx |
| exam-system/src/components/BgmProvider.tsx |
| exam-system/src/components/HeaderHomeLink.tsx |
| exam-system/src/components/PdfViewer.tsx |
| exam-system/src/components/SearchableSelect.tsx |

## 5. API連携
| 項目 |値 |
| --- |--- |
| fetch/axios/SWR/React Query 呼び出し箇所数 |68 |
| 認証方式 |session Cookie。src/lib/session.ts の署名付きトークンを api/auth/login で設定 |

| メソッド |パス |呼び出しファイル |
| --- |--- |--- |
| GET |/api/auth/me |exam-system/src/app/exam/[...id]/page.tsx |
| GET |/api/files/[param]/metadata.json |exam-system/src/app/exam/[...id]/page.tsx |
| GET |/api/files/[param]/marksheet.json |exam-system/src/app/exam/[...id]/page.tsx |
| GET |/api/student-goals |exam-system/src/app/exam/[...id]/page.tsx |
| POST |/api/submit |exam-system/src/app/exam/[...id]/page.tsx |
| POST |/api/grade |exam-system/src/app/exam/[...id]/page.tsx |
| GET |/api/auth/me |exam-system/src/app/grading/page.tsx |
| GET |/api/students |exam-system/src/app/grading/page.tsx |
| GET |/api/exams |exam-system/src/app/grading/page.tsx |
| GET |/api/assignments |exam-system/src/app/grading/page.tsx |
| GET |/api/submissions |exam-system/src/app/grading/page.tsx |
| GET |/api/student-goals |exam-system/src/app/grading/page.tsx |
| GET |/api/admissions |exam-system/src/app/grading/page.tsx |
| GET |/api/admissions |exam-system/src/app/grading/page.tsx |
| GET |/api/admissions |exam-system/src/app/grading/page.tsx |
| GET |/api/admissions |exam-system/src/app/grading/page.tsx |
| POST |/api/import-student-goals |exam-system/src/app/grading/page.tsx |
| POST |/api/import-secondary-scores |exam-system/src/app/grading/page.tsx |
| GET |/api/student-goals |exam-system/src/app/grading/page.tsx |
| DELETE |/api/student-goals |exam-system/src/app/grading/page.tsx |
| POST |/api/assignments |exam-system/src/app/grading/page.tsx |
| POST |/api/assignments |exam-system/src/app/grading/page.tsx |
| PUT |/api/assignments |exam-system/src/app/grading/page.tsx |
| DELETE |/api/assignments |exam-system/src/app/grading/page.tsx |
| GET |/api/files/submissions/[param]/[param]/submission.json |exam-system/src/app/grading/[...id]/page.tsx |
| GET |/api/files/[param]/rubric.md |exam-system/src/app/grading/[...id]/page.tsx |
| GET |/api/files/submissions/[param]/[param]/grade.json |exam-system/src/app/grading/[...id]/page.tsx |
| POST |/api/grade |exam-system/src/app/grading/[...id]/page.tsx |
| GET |/api/auth/student-status |exam-system/src/app/login/page.tsx |
| POST |/api/auth/login |exam-system/src/app/login/page.tsx |
| POST |/api/auth/student-setup |exam-system/src/app/login/page.tsx |
| GET |/api/auth/me |exam-system/src/app/practice/common/page.tsx |
| GET |/api/exams |exam-system/src/app/practice/common/page.tsx |
| GET |/api/auth/me |exam-system/src/app/practice/secondary/page.tsx |
| GET |/api/exams |exam-system/src/app/practice/secondary/page.tsx |
| GET |/api/secondary-access |exam-system/src/app/practice/secondary/page.tsx |
| GET |/api/auth/me |exam-system/src/app/ranking/page.tsx |
| GET |/api/students |exam-system/src/app/ranking/page.tsx |
| GET |/api/exams |exam-system/src/app/ranking/page.tsx |
| GET |/api/submissions |exam-system/src/app/ranking/page.tsx |
| GET |/api/auth/me |exam-system/src/app/results/page.tsx |
| GET |/api/exams |exam-system/src/app/results/page.tsx |
| GET |/api/assignments |exam-system/src/app/results/page.tsx |
| GET |/api/submissions |exam-system/src/app/results/page.tsx |
| GET |/api/secondary-access |exam-system/src/app/results/page.tsx |
| GET |/api/student-goals |exam-system/src/app/results/page.tsx |
| GET |/api/admissions |exam-system/src/app/results/page.tsx |
| GET |/api/admissions |exam-system/src/app/results/page.tsx |
| GET |/api/admissions |exam-system/src/app/results/page.tsx |
| GET |/api/admissions |exam-system/src/app/results/page.tsx |
| GET |/api/student-goals |exam-system/src/app/results/page.tsx |
| DELETE |/api/student-goals |exam-system/src/app/results/page.tsx |
| GET |/api/files/[param]/marksheet.json |exam-system/src/app/results/page.tsx |
| GET |/api/submissions |exam-system/src/app/review/[...id]/page.tsx |
| GET |/api/files/submissions/[param]/[param]/submission.json |exam-system/src/app/review/[...id]/page.tsx |
| GET |/api/files/submissions/[param]/[param]/grade.json |exam-system/src/app/review/[...id]/page.tsx |
| GET |/api/files/[param]/marksheet.json |exam-system/src/app/review/[...id]/page.tsx |
| GET |/api/auth/me |exam-system/src/app/videos/page.tsx |
| GET |/api/video-lessons |exam-system/src/app/videos/page.tsx |
| GET |/api/video-progress |exam-system/src/app/videos/page.tsx |
| GET |/api/video-progress |exam-system/src/app/videos/page.tsx |
| POST |/api/video-progress |exam-system/src/app/videos/page.tsx |
| GET |/api/auth/me |exam-system/src/app/videos/[id]/page.tsx |
| GET |/api/video-lessons |exam-system/src/app/videos/[id]/page.tsx |
| POST |/api/video-progress |exam-system/src/app/videos/[id]/page.tsx |
| GET |/api/auth/me |exam-system/src/components/AuthNav.tsx |
| POST |/api/auth/logout |exam-system/src/components/AuthNav.tsx |
| GET |/api/auth/me |exam-system/src/components/HeaderHomeLink.tsx |

## 6. 機能的複雑度
| 項目 |値 |
| --- |--- |
| フォーム実装数 |5 |
| テーブル/一覧数 |5 |
| WebSocket/SSE有無 |あり: .tmp/audit-repo.mjs |
| i18n有無 |あり/要確認: .tmp/audit-repo.mjs |

## 7. テスト・品質
| 項目 |値 |
| --- |--- |
| テストファイル数 |0 |
| linter/formatter設定 |exam-system/eslint.config.mjs<br>exam-system/postcss.config.mjs<br>exam-system/tsconfig.json |

## 8. ビルド・配信
| 項目 |値 |
| --- |--- |
| ビルドコマンド |node scripts/sync-public-exam-assets.mjs && next build && node scripts/prune-pdf-nft.mjs |
| 開発コマンド |next dev |
| デプロイ先の手がかり |exam-system/vercel.json<br>vercel.json |

## 9. 機能マップ
| 画面パス |画面名 |主要コンポーネント |呼び出しAPI（メソッド+パス） |関連BEハンドラ |
| --- |--- |--- |--- |--- |
| / |画面概要は未計測（静的抽出不可） |- |- |- |
| /exam/[...id] |画面概要は未計測（静的抽出不可） |useBgm (src/components/BgmProvider) |GET /api/auth/me<br>GET /api/files/[param]/metadata.json<br>GET /api/files/[param]/marksheet.json<br>GET /api/student-goals<br>POST /api/submit<br>POST /api/grade |exam-system/src/app/api/auth/me/route.ts<br>未突合<br>exam-system/src/app/api/student-goals/route.ts<br>exam-system/src/app/api/submit/route.ts<br>exam-system/src/app/api/grade/route.ts |
| /grading |教師ログインが必要です |SearchableSelect (src/components/SearchableSelect) |GET /api/auth/me<br>GET /api/students<br>GET /api/exams<br>GET /api/assignments<br>GET /api/submissions<br>GET /api/student-goals<br>GET /api/admissions<br>POST /api/import-student-goals<br>POST /api/import-secondary-scores<br>DELETE /api/student-goals<br>POST /api/assignments<br>PUT /api/assignments<br>DELETE /api/assignments |exam-system/src/app/api/auth/me/route.ts<br>exam-system/src/app/api/students/route.ts<br>exam-system/src/app/api/exams/route.ts<br>exam-system/src/app/api/assignments/route.ts<br>exam-system/src/app/api/submissions/route.ts<br>exam-system/src/app/api/student-goals/route.ts<br>exam-system/src/app/api/admissions/route.ts<br>exam-system/src/app/api/import-student-goals/route.ts<br>exam-system/src/app/api/import-secondary-scores/route.ts |
| /grading/[...id] |採点スタッフ入力 - {submission.studentId} |- |GET /api/files/submissions/[param]/[param]/submission.json<br>GET /api/files/[param]/rubric.md<br>GET /api/files/submissions/[param]/[param]/grade.json<br>POST /api/grade |未突合<br>exam-system/src/app/api/grade/route.ts |
| /login |IDと安全なニックネームでログイン |- |GET /api/auth/student-status<br>POST /api/auth/login<br>POST /api/auth/student-setup |exam-system/src/app/api/auth/student-status/route.ts<br>exam-system/src/app/api/auth/login/route.ts<br>exam-system/src/app/api/auth/student-setup/route.ts |
| /practice |過去問対策メニュー |- |- |- |
| /practice/common |生徒ログインが必要です |- |GET /api/auth/me<br>GET /api/exams |exam-system/src/app/api/auth/me/route.ts<br>exam-system/src/app/api/exams/route.ts |
| /practice/secondary |生徒ログインが必要です |- |GET /api/auth/me<br>GET /api/exams<br>GET /api/secondary-access |exam-system/src/app/api/auth/me/route.ts<br>exam-system/src/app/api/exams/route.ts<br>exam-system/src/app/api/secondary-access/route.ts |
| /ranking |ログインが必要です |useBgm (src/components/BgmProvider) |GET /api/auth/me<br>GET /api/students<br>GET /api/exams<br>GET /api/submissions |exam-system/src/app/api/auth/me/route.ts<br>exam-system/src/app/api/students/route.ts<br>exam-system/src/app/api/exams/route.ts<br>exam-system/src/app/api/submissions/route.ts |
| /results |生徒ログインが必要です |SearchableSelect (src/components/SearchableSelect) |GET /api/auth/me<br>GET /api/exams<br>GET /api/assignments<br>GET /api/submissions<br>GET /api/secondary-access<br>GET /api/student-goals<br>GET /api/admissions<br>DELETE /api/student-goals<br>GET /api/files/[param]/marksheet.json |exam-system/src/app/api/auth/me/route.ts<br>exam-system/src/app/api/exams/route.ts<br>exam-system/src/app/api/assignments/route.ts<br>exam-system/src/app/api/submissions/route.ts<br>exam-system/src/app/api/secondary-access/route.ts<br>exam-system/src/app/api/student-goals/route.ts<br>exam-system/src/app/api/admissions/route.ts<br>未突合 |
| /review/[...id] |結果の確認 |- |GET /api/submissions<br>GET /api/files/submissions/[param]/[param]/submission.json<br>GET /api/files/submissions/[param]/[param]/grade.json<br>GET /api/files/[param]/marksheet.json |exam-system/src/app/api/submissions/route.ts<br>未突合 |
| /videos |ログインが必要です |- |GET /api/auth/me<br>GET /api/video-lessons<br>GET /api/video-progress<br>POST /api/video-progress |exam-system/src/app/api/auth/me/route.ts<br>exam-system/src/app/api/video-lessons/route.ts<br>exam-system/src/app/api/video-progress/route.ts |
| /videos/[id] |ログインが必要です |- |GET /api/auth/me<br>GET /api/video-lessons<br>POST /api/video-progress |exam-system/src/app/api/auth/me/route.ts<br>exam-system/src/app/api/video-lessons/route.ts<br>exam-system/src/app/api/video-progress/route.ts |

### 画面に紐付かないAPI呼び出し
- POST /api/auth/logout
