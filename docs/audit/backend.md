# バックエンド監査

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
| 言語 |TypeScript/JavaScript |
| FW |Next.js 16.2.3 |
| ORM |未検出 |
| DB |Neon/Postgres候補 ^1.1.0 |
| キャッシュ |未検出 |
| キュー |未検出 |
| 主要ライブラリ |@vercel/blob@^2.3.3, @neondatabase/serverless@^1.1.0, xlsx@^0.18.5 |

## 2. 規模（実測）
| 項目 |値 |
| --- |--- |
| 総ファイル数 |52 |
| 本体行数 |7312 |
| テスト行数 |0 |
| テストファイル数 |0 |
| マイグレーション行数 |0 |
| マイグレーションファイル数 |0 |

### 言語別内訳
| 言語 |ファイル数 |行数 |
| --- |--- |--- |
| TypeScript |39 |4579 |
| Python |6 |2142 |
| JavaScript |7 |591 |

## 3. エンドポイント一覧
| メソッド |パス |ハンドラ |認証要否 |
| --- |--- |--- |--- |
| GET |/api/admissions |exam-system/src/app/api/admissions/route.ts |不要/未確認 |
| GET |/api/assignments |exam-system/src/app/api/assignments/route.ts |要 |
| POST |/api/assignments |exam-system/src/app/api/assignments/route.ts |要 |
| PUT |/api/assignments |exam-system/src/app/api/assignments/route.ts |要 |
| DELETE |/api/assignments |exam-system/src/app/api/assignments/route.ts |要 |
| POST |/api/auth/login |exam-system/src/app/api/auth/login/route.ts |不要/未確認 |
| POST |/api/auth/logout |exam-system/src/app/api/auth/logout/route.ts |不要/未確認 |
| GET |/api/auth/me |exam-system/src/app/api/auth/me/route.ts |要 |
| POST |/api/auth/student-setup |exam-system/src/app/api/auth/student-setup/route.ts |不要/未確認 |
| GET |/api/auth/student-status |exam-system/src/app/api/auth/student-status/route.ts |不要/未確認 |
| GET |/api/exams |exam-system/src/app/api/exams/route.ts |不要/未確認 |
| GET |/api/files/[...path] |exam-system/src/app/api/files/[...path]/route.ts |要 |
| POST |/api/grade |exam-system/src/app/api/grade/route.ts |要 |
| POST |/api/import-secondary-scores |exam-system/src/app/api/import-secondary-scores/route.ts |要 |
| POST |/api/import-student-goals |exam-system/src/app/api/import-student-goals/route.ts |要 |
| GET |/api/pdf |exam-system/src/app/api/pdf/route.ts |不要/未確認 |
| GET |/api/secondary-access |exam-system/src/app/api/secondary-access/route.ts |要 |
| GET |/api/student-goals |exam-system/src/app/api/student-goals/route.ts |要 |
| POST |/api/student-goals |exam-system/src/app/api/student-goals/route.ts |要 |
| DELETE |/api/student-goals |exam-system/src/app/api/student-goals/route.ts |要 |
| PUT |/api/student-goals |exam-system/src/app/api/student-goals/route.ts |要 |
| GET |/api/students |exam-system/src/app/api/students/route.ts |要 |
| POST |/api/students |exam-system/src/app/api/students/route.ts |要 |
| GET |/api/submissions |exam-system/src/app/api/submissions/route.ts |要 |
| POST |/api/submit |exam-system/src/app/api/submit/route.ts |要 |
| GET |/api/video-cdn/[...path] |exam-system/src/app/api/video-cdn/[...path]/route.ts |不要/未確認 |
| GET |/api/video-lessons |exam-system/src/app/api/video-lessons/route.ts |要 |
| GET |/api/video-progress |exam-system/src/app/api/video-progress/route.ts |要 |
| POST |/api/video-progress |exam-system/src/app/api/video-progress/route.ts |要 |

### メソッド別集計
| メソッド |件数 |
| --- |--- |
| GET |14 |
| POST |11 |
| PUT |2 |
| PATCH |0 |
| DELETE |2 |

## 4. データモデル
| 項目 |値 |
| --- |--- |
| モデル/エンティティ候補ファイル数 |27 |
| CREATE TABLE検出数 |1 |
| CREATE TABLE検出名 |students |
| マイグレーションファイル数 |0 |
| マイグレーション最古〜最新 |未計測: マイグレーションファイル未検出 |

| 主要テーブル/データ |リレーション概要 |
| --- |--- |
| students |生徒マスタ。JSON/DBで id, nickname, password, campus, grade を保持 |
| teachers |講師ログイン用データ。JSONで id, name, password を保持 |
| assignments |生徒IDと試験ID、締切日の紐付け |
| student_goals |生徒IDと志望校/判定基準の紐付け |
| secondary_enrollments |生徒IDと大学別対策申込 targetKey の紐付け |
| submissions |提出答案/採点結果。ファイルストレージ配下に保存 |
| video-lessons |映像講座カタログ。講座/講師/動画IDを保持 |
| video-progress |視聴履歴。APIとlocalStorageで扱う |

## 5. ビジネスロジック層
| 項目 |値 |
| --- |--- |
| service/usecase/domain ディレクトリ数 |0 |
| service/usecase/domain ファイル数 |0 |
| service/usecase/domain 行数 |0 |
| バッチ/cron/worker/queue consumer 候補数 |15 |

| 候補ファイル |
| --- |
| exam-system/scripts/append-demo-students-from-goal-list.mjs |
| exam-system/scripts/create-demo-goal-list.mjs |
| exam-system/scripts/import-video-lessons.mjs |
| exam-system/scripts/import_common_2022_subjects.py |
| exam-system/scripts/import_common_2022_toshin_scoring.py |
| exam-system/scripts/import_common_2023_subjects.py |
| exam-system/scripts/import_common_2024_subjects.py |
| exam-system/scripts/import_common_2025_subjects.py |
| exam-system/scripts/import_common_2026_subjects.py |
| exam-system/scripts/prepare-goal-import-smoke-test.mjs |
| exam-system/scripts/prune-pdf-nft.mjs |
| exam-system/scripts/seed-student-goals-from-goal-list.mjs |
| exam-system/scripts/sync-public-exam-assets.mjs |
| exam-system/scripts/__pycache__/import_common_2024_subjects.cpython-311.pyc |
| exam-system/scripts/__pycache__/import_common_2025_subjects.cpython-312.pyc |

## 6. 外部連携
| 外部APIクライアント候補ファイル |
| --- |
| exam-system/src/app/api/files/[...path]/route.ts |
| exam-system/src/app/api/video-cdn/[...path]/route.ts |
| exam-system/src/lib/student-store.ts |
| exam-system/src/lib/submission-storage.ts |
| exam-system/src/lib/video-proxy.ts |

### Webhook受信エンドポイント
未検出

## 7. インフラ・運用
| 項目 |値 |
| --- |--- |
| Dockerfile / compose |未検出 |
| Terraform |未検出 |
| k8s manifests |未検出 |
| CI/CD workflows |未検出 |
| .env.example 変数数 |1 |
| .env.example キー名 |OPENAI_API_KEY |

## 8. テスト・品質
| 項目 |値 |
| --- |--- |
| テストファイル数 |0 |
| unit/integration/e2e 種別 |未計測: テストファイル未検出 |
| 静的解析設定 |exam-system/eslint.config.mjs<br>exam-system/postcss.config.mjs<br>exam-system/tsconfig.json |

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

### 認証/共通レイアウトなど画面に紐付かないAPI
- POST /api/auth/logout
