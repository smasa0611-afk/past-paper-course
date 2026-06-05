from __future__ import annotations

import itertools
import json
import re
import unicodedata
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


ROOT_DIR = Path(__file__).resolve().parents[2]
COMMON_2025_DIR = ROOT_DIR / "common" / "2025"
TMP_DIR = ROOT_DIR / ".tmp" / "common_2025_import"
PDF_BASE = "https://www.dnc.ac.jp"


@dataclass(frozen=True)
class SubjectConfig:
    slug: str
    title: str
    time_minutes: int
    problem_pdf_paths: tuple[str, ...]
    answer_pdf_path: str
    family: str
    problem_labels: tuple[str, ...] | None = None


SUBJECTS: list[SubjectConfig] = [
    SubjectConfig(
        slug="english",
        title="共通テスト 英語 2025",
        time_minutes=80,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day1_r79dz8aw/pdf/english_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005150.pdf&n=R7_%E3%80%90%E8%8B%B1%E8%AA%9E%EF%BC%88%E3%83%AA%E3%83%BC%E3%83%87%E3%82%A3%E3%83%B3%E3%82%B0%EF%BC%89%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="english_listening",
        title="共通テスト 英語リスニング 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day1_r79dz8aw/pdf/listening_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005155.pdf&n=R7__%E3%80%90%E8%8B%B1%E8%AA%9E%EF%BC%88%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0%EF%BC%89%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="japanese",
        title="共通テスト 国語 2025",
        time_minutes=90,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day1_r79dz8aw/pdf/kokugo_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005149.pdf&n=R7_%E3%80%90%E5%9B%BD%E8%AA%9E%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="math_ia",
        title="共通テスト 数学Ⅰ・数学A 2025",
        time_minutes=70,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day2_5tzuepw7sd/pdf/sugaku1_a.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005167.pdf&n=R7_%E3%80%90%E6%95%B0%E5%AD%A6%E2%85%A0%EF%BC%8C%E6%95%B0%E5%AD%A6A%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="numeric",
    ),
    SubjectConfig(
        slug="math_iibc",
        title="共通テスト 数学Ⅱ・数学B・数学C 2025",
        time_minutes=70,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day2_5tzuepw7sd/pdf/sugaku2_b_c.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005177.pdf&n=R7_%E3%80%90%E6%95%B0%E5%AD%A6%E2%85%A1%EF%BC%8C%E6%95%B0%E5%AD%A6B%EF%BC%8C%E6%95%B0%E5%AD%A6C%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="numeric",
    ),
    SubjectConfig(
        slug="geography",
        title="共通テスト 地理総合・地理探究 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day1_r79dz8aw/pdf/chiri_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005132.pdf&n=R7_%E3%80%90%E5%9C%B0%E7%90%86%E7%B7%8F%E5%90%88%EF%BC%8C%E5%9C%B0%E7%90%86%E6%8E%A2%E7%A9%B6%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="japanese_history",
        title="共通テスト 歴史総合・日本史探究 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day1_r79dz8aw/pdf/nihonshi_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005136.pdf&n=R7_%E3%80%90%E6%AD%B4%E5%8F%B2%E7%B7%8F%E5%90%88%EF%BC%8C%E6%97%A5%E6%9C%AC%E5%8F%B2%E6%8E%A2%E7%A9%B6%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="world_history",
        title="共通テスト 歴史総合・世界史探究 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day1_r79dz8aw/pdf/sekaishi_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005134.pdf&n=R7_%E3%80%90%E6%AD%B4%E5%8F%B2%E7%B7%8F%E5%90%88%EF%BC%8C%E4%B8%96%E7%95%8C%E5%8F%B2%E6%8E%A2%E7%A9%B6%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="public_ethics",
        title="共通テスト 公共・倫理 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day1_r79dz8aw/pdf/kokyorinri_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005131.pdf&n=R7_%E3%80%90%E5%85%AC%E5%85%B1%EF%BC%8C%E5%80%AB%E7%90%86%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="public_politics_economy",
        title="共通テスト 公共・政治経済 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day1_r79dz8aw/pdf/kokyoseikei_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005130.pdf&n=R7__%E3%80%90%E5%85%AC%E5%85%B1%EF%BC%8C%E6%94%BF%E6%B2%BB%E3%83%BB%E7%B5%8C%E6%B8%88%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="integrated_history_public",
        title="共通テスト 地理総合・歴史総合・公共 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day1_r79dz8aw/pdf/chirirekishikokyo_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005133.pdf&n=R7_%E3%80%90%E5%9C%B0%E7%90%86%E7%B7%8F%E5%90%88%EF%BC%8F%E6%AD%B4%E5%8F%B2%E7%B7%8F%E5%90%88%EF%BC%8F%E5%85%AC%E5%85%B1%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="science_basics",
        title="共通テスト 理科基礎 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day2_5tzuepw7sd/pdf/rikakiso_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005164.pdf&n=R7_%E3%80%90%E7%89%A9%E7%90%86%E5%9F%BA%E7%A4%8E%EF%BC%8F%E5%8C%96%E5%AD%A6%E5%9F%BA%E7%A4%8E%EF%BC%8F%E7%94%9F%E7%89%A9%E5%9F%BA%E7%A4%8E%EF%BC%8F%E5%9C%B0%E5%AD%A6%E5%9F%BA%E7%A4%8E%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="physics",
        title="共通テスト 物理 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day2_5tzuepw7sd/pdf/butsuri_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005162.pdf&n=R7_%E3%80%90%E7%89%A9%E7%90%86%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="chemistry",
        title="共通テスト 化学 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day2_5tzuepw7sd/pdf/kagaku_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005160.pdf&n=R7_%E3%80%90%E5%8C%96%E5%AD%A6%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="biology",
        title="共通テスト 生物 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day2_5tzuepw7sd/pdf/seibutsu_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005159.pdf&n=R7_%E3%80%90%E7%94%9F%E7%89%A9%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="earth_science",
        title="共通テスト 地学 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day2_5tzuepw7sd/pdf/chigaku_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005161.pdf&n=R7_%E3%80%90%E5%9C%B0%E5%AD%A6%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="information_i",
        title="共通テスト 情報I 2025",
        time_minutes=60,
        problem_pdf_paths=("https://www.asahicom.jp/edu/kyotsu-exam/shiken2025/mondai_day2_5tzuepw7sd/pdf/joho1_01.pdf",),
        answer_pdf_path="/albums/abm.php?d=740&f=abm00005172.pdf&n=R7_%E3%80%90%E6%83%85%E5%A0%B1%E2%85%A0%E3%80%91%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="numeric",
    ),
]

NUMERIC_ENTRY_VALUES = ["-"] + [str(value) for value in range(10)] + list("abcde")
NUMERIC_ENTRY_LABELS = ["-", *[str(value) for value in range(10)], *list("ABCDE")]
CHOICE_ENTRY_VALUES = [str(value) for value in range(1, 10)]


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def download_binary(url: str, destination: Path) -> None:
    ensure_dir(destination.parent)
    with urllib.request.urlopen(url) as response:
        destination.write_bytes(response.read())


def download_problem_pdf(config: SubjectConfig, destination: Path) -> list[dict[str, str]]:
    ensure_dir(destination.parent)
    if len(config.problem_pdf_paths) == 1:
        source = config.problem_pdf_paths[0]
        url = source if source.startswith("http") else f"{PDF_BASE}{source}"
        download_binary(url, destination)
        return []

    problem_files: list[dict[str, str]] = []
    labels = config.problem_labels or tuple(f"問題 {index}" for index in range(1, len(config.problem_pdf_paths) + 1))
    for index, (pdf_path, label) in enumerate(zip(config.problem_pdf_paths, labels, strict=True), start=1):
        filename = "problem.pdf" if index == 1 else f"problem_{index}.pdf"
        file_path = destination.parent / filename
        url = pdf_path if pdf_path.startswith("http") else f"{PDF_BASE}{pdf_path}"
        download_binary(url, file_path)
        problem_files.append({"label": label, "path": filename})

    return problem_files


def normalize_pdf_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    normalized = normalized.replace("\u3000", " ")
    normalized = normalized.replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    return normalized


def split_labels(token: str) -> list[str]:
    labels: list[str] = []
    for chunk in token.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        numeric_range = re.fullmatch(r"(\d+)-(\d+)", chunk)
        if numeric_range:
            start = int(numeric_range.group(1))
            end = int(numeric_range.group(2))
            if end >= start and end - start <= 8:
                labels.extend(str(value) for value in range(start, end + 1))
                continue
        if "-" in chunk and all(part.isdigit() for part in chunk.split("-")):
            labels.extend(part for part in chunk.split("-") if part)
            continue
        labels.append(chunk)
    return labels


def split_answers(token: str) -> list[str]:
    values: list[str] = []
    for chunk in token.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            values.extend(part for part in chunk.split("-") if part)
        else:
            values.append(chunk)
    return values


ROW_PATTERN = re.compile(
    r"([0-9A-Za-z①-⑳アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン]+(?:[,-][0-9A-Za-z①-⑳アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン]+)*)\s+"
    r"([0-9A-Za-z-]+(?:[,-][0-9A-Za-z-]+)*)\s+"
    r"(\(\d+\)|\d+\*?|\d+)"
)


def parse_answer_pdf(pdf_path: Path) -> tuple[list[dict], list[dict], list[str]]:
    reader = PdfReader(str(pdf_path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    normalized = normalize_pdf_text(text)
    matches = ROW_PATTERN.findall(normalized)
    if not matches:
        raise RuntimeError(f"answer rows not found: {pdf_path}")

    questions: list[dict] = []
    scoring_rules: list[dict] = []
    labels_in_order: list[str] = []
    question_ids_by_label: dict[str, str] = {}

    for raw_labels, raw_answers, raw_points in matches:
        labels = split_labels(raw_labels)
        answers = split_answers(raw_answers)
        if not labels or not answers or len(labels) != len(answers):
            continue

        for label, answer in zip(labels, answers):
            if label in question_ids_by_label:
                continue
            question_id = f"q_{len(question_ids_by_label) + 1}"
            question_ids_by_label[label] = question_id
            labels_in_order.append(label)
            questions.append(
                {
                    "id": question_id,
                    "number": len(question_ids_by_label),
                    "displayLabel": label,
                    "correctAnswer": answer.lower(),
                }
            )

        numeric_points = re.sub(r"[^0-9]", "", raw_points)
        points = int(numeric_points) if numeric_points else len(labels)
        if raw_points.startswith("("):
            points *= len(labels)

        if len(labels) > 1:
            accepted = sorted(set(itertools.permutations([answer.lower() for answer in answers])))
            scoring_rules.append(
                {
                    "id": f"rule_{len(scoring_rules) + 1}",
                    "questionIds": [question_ids_by_label[label] for label in labels],
                    "acceptedVariants": [list(variant) for variant in accepted],
                    "points": points,
                }
            )
        else:
            scoring_rules.append(
                {
                    "id": f"rule_{len(scoring_rules) + 1}",
                    "questionIds": [question_ids_by_label[labels[0]]],
                    "acceptedVariants": [[answers[0].lower()]],
                    "points": points,
                }
            )

    return questions, scoring_rules, labels_in_order


def build_marksheet(config: SubjectConfig, answer_pdf: Path) -> dict:
    questions, scoring_rules, labels_in_order = parse_answer_pdf(answer_pdf)
    if not questions:
        raise RuntimeError(f"no questions parsed for {config.slug}")

    if config.family == "numeric":
        default_choices = [
            {"value": value, "label": label}
            for value, label in zip(NUMERIC_ENTRY_VALUES, NUMERIC_ENTRY_LABELS, strict=True)
        ]
        choices_per_row = 6
        prompt = "解答欄に対応する数字・記号を選んで入力してください。"
    else:
        default_choices = [{"value": value, "label": value} for value in CHOICE_ENTRY_VALUES]
        choices_per_row = 4
        prompt = "各設問の正しい選択肢を選んで入力してください。"

    for question in questions:
        question["prompt"] = prompt
        question["points"] = 1

    return {
        "title": config.title,
        "instructions": "問題PDFを見ながら、解答欄ごとにマークしてください。",
        "defaultChoices": default_choices,
        "choicesPerRow": choices_per_row,
        "questions": questions,
        "scoringRules": scoring_rules,
        "sourceLabels": labels_in_order,
    }


def build_rubric(config: SubjectConfig) -> str:
    return "\n".join(
        [
            f"# 採点基準: {config.title}",
            "## 採点の考え方",
            "- 公表された正解PDFをもとに、各設問の正答を機械判定します。",
            "- 複数欄をまとめて採点する設問は、正解グループとして登録しています。",
            "- 問題PDFはアプリ内のファイルを表示する前提で保存しています。",
            "",
            "## 運用メモ",
            "- あとで塾側の問題PDFへ差し替える場合も、problem.pdf を置き換えれば同じ画面で利用できます。",
            "- marksheet.json を更新すれば、選択肢や採点ロジックも調整できます。",
        ]
    )


def write_json(path: Path, payload: dict) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_dir(TMP_DIR)
    created: list[str] = []

    for config in SUBJECTS:
        subject_dir = COMMON_2025_DIR / config.slug
        ensure_dir(subject_dir)

        problem_pdf_path = subject_dir / "problem.pdf"
        answer_pdf_path = subject_dir / "answer.pdf"
        problem_files = download_problem_pdf(config, problem_pdf_path)
        download_binary(f"{PDF_BASE}{config.answer_pdf_path}", answer_pdf_path)

        metadata = {
            "exam_type": "common",
            "year": 2025,
            "subject": config.slug,
            "course": "",
            "title": config.title,
            "time_minutes": config.time_minutes,
        }
        if problem_files:
            metadata["problem_files"] = problem_files
        write_json(subject_dir / "metadata.json", metadata)
        write_json(subject_dir / "marksheet.json", build_marksheet(config, answer_pdf_path))
        (subject_dir / "rubric.md").write_text(build_rubric(config) + "\n", encoding="utf-8")
        created.append(config.slug)

    print(json.dumps({"created": created}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
