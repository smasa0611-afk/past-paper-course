from __future__ import annotations

import itertools
import json
import os
import re
import unicodedata
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader


ROOT_DIR = Path(__file__).resolve().parents[2]
COMMON_2026_DIR = ROOT_DIR / "common" / "2026"
TMP_DIR = ROOT_DIR / ".tmp" / "common_2026_import"

ASAHI_DAY_URLS = [
    "https://www.asahi.com/edu/kyotsu-exam/shiken2026/day1.html",
    "https://www.asahi.com/edu/kyotsu-exam/shiken2026/day2.html",
]

ANSWER_PDF_BASE = "https://www.dnc.ac.jp"


@dataclass(frozen=True)
class SubjectConfig:
    slug: str
    title: str
    time_minutes: int
    source_key: str
    answer_pdf_path: str
    family: str


SUBJECTS: list[SubjectConfig] = [
    SubjectConfig(
        slug="geography",
        title="共通テスト 地理総合・地理探究 2026",
        time_minutes=60,
        source_key="chiri",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006031.pdf&n=R8_%E3%80%90%E5%9C%B0%E7%90%86%E7%B7%8F%E5%90%88%EF%BC%8C%E5%9C%B0%E7%90%86%E6%8E%A2%E7%A9%B6%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="japanese_history",
        title="共通テスト 歴史総合・日本史探究 2026",
        time_minutes=60,
        source_key="nihonshi",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006032.pdf&n=R8_%E3%80%90%E6%AD%B4%E5%8F%B2%E7%B7%8F%E5%90%88%EF%BC%8C%E6%97%A5%E6%9C%AC%E5%8F%B2%E6%8E%A2%E7%A9%B6%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="world_history",
        title="共通テスト 歴史総合・世界史探究 2026",
        time_minutes=60,
        source_key="sekaishi",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006033.pdf&n=R8_%E3%80%90%E6%AD%B4%E5%8F%B2%E7%B7%8F%E5%90%88%EF%BC%8C%E4%B8%96%E7%95%8C%E5%8F%B2%E6%8E%A2%E7%A9%B6%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="public_ethics",
        title="共通テスト 公共・倫理 2026",
        time_minutes=60,
        source_key="kokyorinri",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006030.pdf&n=R8_%E3%80%90%E5%85%AC%E5%85%B1%EF%BC%8C%E5%80%AB%E7%90%86%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="public_politics_economy",
        title="共通テスト 公共・政治経済 2026",
        time_minutes=60,
        source_key="kokyoseikei",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006034.pdf&n=R8_%E3%80%90%E5%85%AC%E5%85%B1%EF%BC%8C%E6%94%BF%E6%B2%BB%E7%B5%8C%E6%B8%88%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="integrated_history_public",
        title="共通テスト 地理総合・歴史総合・公共 2026",
        time_minutes=60,
        source_key="chirirekishikokyo",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006029.pdf&n=R8_%E3%80%90%E5%9C%B0%E7%B7%8F%EF%BC%8F%E6%AD%B4%E7%B7%8F%EF%BC%8F%E5%85%AC%E5%85%B1%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="japanese",
        title="共通テスト 国語 2026",
        time_minutes=90,
        source_key="kokugo",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006035.pdf&n=R8_%E3%80%90%E5%9B%BD%E8%AA%9E%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="english_listening",
        title="共通テスト 英語リスニング 2026",
        time_minutes=60,
        source_key="listening",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006037.pdf&n=R8_%E3%80%90%E8%8B%B1%E8%AA%9E%EF%BC%88%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0%EF%BC%89%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="science_basics",
        title="共通テスト 理科基礎 2026",
        time_minutes=60,
        source_key="rikakiso",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006051.pdf&n=R8_%E3%80%90%E5%9F%BA%E7%A4%8E%E7%A7%91%E7%9B%AE%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="physics",
        title="共通テスト 物理 2026",
        time_minutes=60,
        source_key="butsuri",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006049.pdf&n=R8_%E3%80%90%E7%89%A9%E7%90%86%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="chemistry",
        title="共通テスト 化学 2026",
        time_minutes=60,
        source_key="kagaku",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006050.pdf&n=R8_%E3%80%90%E5%8C%96%E5%AD%A6%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="biology",
        title="共通テスト 生物 2026",
        time_minutes=60,
        source_key="seibutsu",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006047.pdf&n=R8_%E3%80%90%E7%94%9F%E7%89%A9%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="earth_science",
        title="共通テスト 地学 2026",
        time_minutes=60,
        source_key="chigaku",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006048.pdf&n=R8_%E3%80%90%E5%9C%B0%E5%AD%A6%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="information_i",
        title="共通テスト 情報I 2026",
        time_minutes=60,
        source_key="joho1",
        answer_pdf_path="/albums/abm.php?d=797&f=abm00006055.pdf&n=R8_%E3%80%90%E6%83%85%E5%A0%B1%E2%85%A0%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
        family="numeric",
    ),
]

NUMERIC_ENTRY_VALUES = ["-"] + [str(value) for value in range(10)] + list("abcde")
NUMERIC_ENTRY_LABELS = ["-", *[str(value) for value in range(10)], *list("ABCDE")]
CHOICE_ENTRY_VALUES = [str(value) for value in range(1, 10)]


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def fetch_text(url: str) -> str:
    with urllib.request.urlopen(url) as response:
        raw = response.read()
    return raw.decode("utf-8", "ignore")


def download_binary(url: str, destination: Path) -> None:
    ensure_dir(destination.parent)
    with urllib.request.urlopen(url) as response:
        destination.write_bytes(response.read())


def extract_subject_pages(page_html: str) -> dict[str, str]:
    subject_pages = re.findall(
        r"https://www\.asahi\.com/edu/kyotsu-exam/shiken2026/(?:mondai|kaito)_day[12]/[^\"']+/([^/]+)\.html",
        page_html,
    )
    links = re.findall(
        r"https://www\.asahi\.com/edu/kyotsu-exam/shiken2026/(?:mondai|kaito)_day[12]/[^\"']+/[^/]+\.html",
        page_html,
    )
    result: dict[str, str] = {}
    for key, link in zip(subject_pages, links):
        result[key] = link
    return result


def extract_pdf_link(subject_html: str) -> str | None:
    match = re.search(r"https://www\.asahicom\.jp/edu/kyotsu-exam/shiken2026/[^\"']+/pdf/[^\"']+\.pdf", subject_html)
    return match.group(0) if match else None


def normalize_pdf_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    normalized = normalized.replace("，", ",").replace("－", "-").replace("＊", "*")
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
    r"([0-9A-Za-zアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン]+(?:[,-][0-9A-Za-zアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン]+)*)\s+"
    r"([0-9A-Za-z]+(?:[,-][0-9A-Za-z]+)*)\s+"
    r"(\(各?\d+\)|\d+\*?|\d+)"
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
        if raw_points.startswith("(各"):
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
        "instructions": "問題冊子を見ながら、解答番号ごとにマークしてください。",
        "defaultChoices": default_choices,
        "choicesPerRow": choices_per_row,
        "questions": questions,
        "scoringRules": scoring_rules,
        "sourceLabels": labels_in_order,
    }


def build_rubric(config: SubjectConfig) -> str:
    return "\n".join(
        [
            f"# 採点基準（{config.title}）",
            "## 判定の考え方",
            "- 公式の正解データに一致した解答を正答とします。",
            "- 複数欄をまとめて採点する設問は、同じ設問グループとして扱います。",
            "- この科目はマーク入力の確認を目的とした簡易スキーマです。",
            "",
            "## 利用メモ",
            "- 問題PDFと答えPDFを見比べながら入力できるようにしています。",
            "- 表記ゆれが出やすい数値・記号は解答欄の表記を優先してください。",
        ]
    )


def write_json(path: Path, payload: dict) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_dir(TMP_DIR)
    subject_pages: dict[str, str] = {}
    for url in ASAHI_DAY_URLS:
        page_html = fetch_text(url)
        subject_pages.update(extract_subject_pages(page_html))

    created: list[str] = []
    for config in SUBJECTS:
        subject_page_url = subject_pages.get(config.source_key)
        if not subject_page_url:
            raise RuntimeError(f"subject page not found for {config.slug}")
        problem_page_html = fetch_text(subject_page_url)
        problem_pdf_url = extract_pdf_link(problem_page_html)
        if not problem_pdf_url:
            raise RuntimeError(f"problem pdf not found for {config.slug}")

        answer_pdf_url = f"{ANSWER_PDF_BASE}{config.answer_pdf_path}"
        subject_dir = COMMON_2026_DIR / config.slug
        ensure_dir(subject_dir)

        problem_pdf_path = subject_dir / "problem.pdf"
        answer_pdf_path = subject_dir / "answer.pdf"
        download_binary(problem_pdf_url, problem_pdf_path)
        download_binary(answer_pdf_url, answer_pdf_path)

        metadata = {
            "exam_type": "common",
            "year": 2026,
            "subject": config.slug,
            "course": "",
            "title": config.title,
            "time_minutes": config.time_minutes,
        }
        write_json(subject_dir / "metadata.json", metadata)
        write_json(subject_dir / "marksheet.json", build_marksheet(config, answer_pdf_path))
        (subject_dir / "rubric.md").write_text(build_rubric(config) + "\n", encoding="utf-8")
        created.append(config.slug)

    print(json.dumps({"created": created}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
