from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
COMMON_2022_DIR = ROOT_DIR / "common" / "2022"
PDF_BASE = "https://edu.chunichi.co.jp/site_home/center/pdf"


@dataclass(frozen=True)
class SubjectConfig:
    slug: str
    title: str
    time_minutes: int
    problem_pdf: str
    answer_pdf: str
    family: str
    question_count: int


SUBJECTS: list[SubjectConfig] = [
    SubjectConfig("japanese", "共通テスト 国語 2022", 80, "2022kokugo_q.pdf", "2022kokugo_a.pdf", "choice", 36),
        SubjectConfig("world_history_b", "共通テスト 世界史B 2022", 60, "2022sekaishi-B_q.pdf", "2022sekaishi-B_a.pdf", "choice", 34),
        SubjectConfig("japanese_history_b", "共通テスト 日本史B 2022", 60, "2022nihonshi-B_q.pdf", "2022nihonshi-B_a.pdf", "choice", 32),
        SubjectConfig("geography_b", "共通テスト 地理B 2022", 60, "2022chiri-B_q.pdf", "2022chiri-B_a.pdf", "choice", 32),
    SubjectConfig("modern_society", "共通テスト 現代社会 2022", 60, "2022gensha_q.pdf", "2022gensha_a.pdf", "choice", 33),
    SubjectConfig("ethics", "共通テスト 倫理 2022", 60, "2022rinri_q.pdf", "2022rinri_a.pdf", "choice", 33),
    SubjectConfig("politics_economy", "共通テスト 政治・経済 2022", 60, "2022seikei_q.pdf", "2022seikei_a.pdf", "choice", 33),
    SubjectConfig(
        "ethics_politics_economy",
        "共通テスト 倫理，政治・経済 2022",
        60,
        "2022rinri-seikei_q.pdf",
        "2022rinri-seikei_a.pdf",
        "choice",
        33,
    ),
    SubjectConfig("english", "共通テスト 英語リーディング 2022", 80, "2022English_q.pdf", "2022English_a.pdf", "choice", 48),
    SubjectConfig("english_listening", "共通テスト 英語リスニング 2022", 60, "2022English-L_q.pdf", "2022English-L_a.pdf", "choice", 37),
        SubjectConfig("math_ia", "共通テスト 数学I・数学A 2022", 70, "2022sugaku-1A_q.pdf", "2022sugaku-1A_a.pdf", "numeric", 76),
        SubjectConfig("math_iib", "共通テスト 数学II・数学B 2022", 60, "2022sugaku-2B_q.pdf", "2022sugaku-2B_a.pdf", "numeric", 60),
        SubjectConfig("information_related_basics", "共通テスト 情報関係基礎 2022", 60, "2022johokankei_q.pdf", "2022johokankei_a.pdf", "numeric", 40),
    SubjectConfig("physics_basics", "共通テスト 物理基礎 2022", 60, "2022butsurikiso_q.pdf", "2022butsurikiso_a.pdf", "choice", 18),
    SubjectConfig("chemistry_basics", "共通テスト 化学基礎 2022", 60, "2022kagakukiso_q.pdf", "2022kagakukiso_a.pdf", "choice", 18),
    SubjectConfig("biology_basics", "共通テスト 生物基礎 2022", 60, "2022seibutsukiso_q.pdf", "2022seibutsukiso_a.pdf", "choice", 18),
    SubjectConfig("earth_science_basics", "共通テスト 地学基礎 2022", 60, "2022chigakukiso_q.pdf", "2022chigakukiso_a.pdf", "choice", 18),
    SubjectConfig("physics", "共通テスト 物理 2022", 60, "2022butsuri_q.pdf", "2022butsuri_a.pdf", "choice", 27),
    SubjectConfig("chemistry", "共通テスト 化学 2022", 60, "2022kagaku_q.pdf", "2022kagaku_a.pdf", "choice", 28),
    SubjectConfig("biology", "共通テスト 生物 2022", 60, "2022seibutsu_q.pdf", "2022seibutsu_a.pdf", "choice", 31),
    SubjectConfig("earth_science", "共通テスト 地学 2022", 60, "2022chigaku_q.pdf", "2022chigaku_a.pdf", "choice", 27),
]

CHOICE_VALUES = [str(value) for value in range(1, 10)]
NUMERIC_VALUES = ["-"] + [str(value) for value in range(10)] + list("abcde")
NUMERIC_LABELS = ["-", *[str(value) for value in range(10)], *list("ABCDE")]


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def download_pdf(filename: str, destination: Path) -> None:
    ensure_dir(destination.parent)
    url = f"{PDF_BASE}/{filename}"
    with urllib.request.urlopen(url) as response:
        destination.write_bytes(response.read())


def build_marksheet(config: SubjectConfig) -> dict:
    if config.family == "numeric":
        default_choices = [
            {"value": value, "label": label}
            for value, label in zip(NUMERIC_VALUES, NUMERIC_LABELS, strict=True)
        ]
        choices_per_row = 6
        instructions = "問題PDFを見ながら、解答欄ごとに数字・記号をマークしてください。"
        prompt = "解答欄に対応する数字・記号を選んでください。"
    else:
        default_choices = [{"value": value, "label": value} for value in CHOICE_VALUES]
        choices_per_row = 4
        instructions = "問題PDFを見ながら、解答番号ごとにマークしてください。"
        prompt = "各設問の正しい選択肢を選んでください。"

    return {
        "title": config.title,
        "instructions": instructions,
        "defaultChoices": default_choices,
        "choicesPerRow": choices_per_row,
        "questions": [
            {
                "id": f"q_{index}",
                "number": index,
                "displayLabel": str(index),
                "prompt": prompt,
                "points": 1,
            }
            for index in range(1, config.question_count + 1)
        ],
    }


def build_rubric(config: SubjectConfig) -> str:
    return "\n".join(
        [
            f"# 採点基準 {config.title}",
            "## 運用メモ",
            "- 2022年の中日進学ナビPDFは画像PDFのため、現時点では解答PDFを参照しながら採点してください。",
            "- marksheet.json はマーク入力UI用です。正答データを追加すれば自動採点できます。",
        ]
    )


def write_json(path: Path, payload: dict) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    created: list[str] = []
    for config in SUBJECTS:
        subject_dir = COMMON_2022_DIR / config.slug
        ensure_dir(subject_dir)
        download_pdf(config.problem_pdf, subject_dir / "problem.pdf")
        download_pdf(config.answer_pdf, subject_dir / "answer.pdf")
        write_json(
            subject_dir / "metadata.json",
            {
                "exam_type": "common",
                "year": 2022,
                "subject": config.slug,
                "course": "",
                "title": config.title,
                "time_minutes": config.time_minutes,
            },
        )
        write_json(subject_dir / "marksheet.json", build_marksheet(config))
        (subject_dir / "rubric.md").write_text(build_rubric(config) + "\n", encoding="utf-8")
        created.append(config.slug)

    print(f"created {len(created)} common 2022 subjects")
    print(", ".join(created))


if __name__ == "__main__":
    main()
