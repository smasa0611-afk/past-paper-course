from __future__ import annotations

import itertools
import json
import re
import unicodedata
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

from pypdf import PdfReader


ROOT_DIR = Path(__file__).resolve().parents[2]
COMMON_2023_DIR = ROOT_DIR / "common" / "2023"
PDF_BASE = "https://www.dnc.ac.jp"
PROBLEM_PAGE = f"{PDF_BASE}/kyotsu/kakomondai/r5/r5_honshiken_mondai.html"
ANSWER_PAGE = f"{PDF_BASE}/kyotsu/kakomondai/r5/r5_honsiken_seikai.html"


@dataclass(frozen=True)
class SubjectConfig:
    slug: str
    title: str
    time_minutes: int
    problem_label: str
    answer_label: str
    family: str


SUBJECTS: list[SubjectConfig] = [
    SubjectConfig("japanese", "共通テスト 国語 2023", 80, "国語", "国語", "choice"),
        SubjectConfig("world_history_b", "共通テスト 世界史B 2023", 60, "世界史Ｂ", "世界史Ｂ", "choice"),
        SubjectConfig("japanese_history_b", "共通テスト 日本史B 2023", 60, "日本史Ｂ", "日本史Ｂ", "choice"),
        SubjectConfig("geography_b", "共通テスト 地理B 2023", 60, "地理Ｂ", "地理Ｂ", "choice"),
    SubjectConfig("modern_society", "共通テスト 現代社会 2023", 60, "現代社会", "現代社会", "choice"),
    SubjectConfig("ethics", "共通テスト 倫理 2023", 60, "倫理", "倫理", "choice"),
    SubjectConfig("politics_economy", "共通テスト 政治・経済 2023", 60, "政治・経済", "政治・経済", "choice"),
    SubjectConfig(
        "ethics_politics_economy",
        "共通テスト 倫理，政治・経済 2023",
        60,
        "倫理，政治・経済",
        "倫理，政治・経済",
        "choice",
    ),
    SubjectConfig("english", "共通テスト 英語リーディング 2023", 80, "リーディング", "リーディング", "choice"),
    SubjectConfig("english_listening", "共通テスト 英語リスニング 2023", 60, "リスニング", "リスニング", "choice"),
        SubjectConfig("math_ia", "共通テスト 数学I・数学A 2023", 60, "数学Ⅰ・数学Ａ", "数学Ⅰ・数学Ａ", "numeric"),
        SubjectConfig("math_iib", "共通テスト 数学II・数学B 2023", 60, "数学Ⅱ・数学Ｂ", "数学Ⅱ・数学Ｂ", "numeric"),
    SubjectConfig("physics_basics", "共通テスト 物理基礎 2023", 60, "物理基礎", "物理基礎", "choice"),
    SubjectConfig("chemistry_basics", "共通テスト 化学基礎 2023", 60, "化学基礎", "化学基礎", "choice"),
    SubjectConfig("biology_basics", "共通テスト 生物基礎 2023", 60, "生物基礎", "生物基礎", "choice"),
    SubjectConfig("earth_science_basics", "共通テスト 地学基礎 2023", 60, "地学基礎", "地学基礎", "choice"),
    SubjectConfig("physics", "共通テスト 物理 2023", 60, "物理", "物理", "choice"),
    SubjectConfig("chemistry", "共通テスト 化学 2023", 60, "化学", "化学", "choice"),
    SubjectConfig("biology", "共通テスト 生物 2023", 60, "生物", "生物", "choice"),
    SubjectConfig("earth_science", "共通テスト 地学 2023", 60, "地学", "地学", "choice"),
        SubjectConfig("information_related_basics", "共通テスト 情報関係基礎 2023", 60, "情報関係基礎", "情報関係基礎", "numeric"),
]

NUMERIC_ENTRY_VALUES = ["-"] + [str(value) for value in range(10)] + list("abcde")
NUMERIC_ENTRY_LABELS = ["-", *[str(value) for value in range(10)], *list("ABCDE")]
CHOICE_ENTRY_VALUES = [str(value) for value in range(1, 10)]
ROW_PATTERN = re.compile(
    r"([0-9A-Za-zⅠⅡⅢアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン]+(?:[,-][0-9A-Za-zⅠⅡⅢアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン]+)*)\s+"
    r"([0-9A-Za-z-]+(?:[,-][0-9A-Za-z-]+)*)\s+"
    r"(\(\d+\)|\d+\*?|\d+)"
)


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._current_href: str | None = None
        self._current_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            self._current_href = dict(attrs).get("href")
            self._current_text = []

    def handle_data(self, data: str) -> None:
        if self._current_href is not None:
            self._current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._current_href is not None:
            text = normalize_label("".join(self._current_text))
            if text:
                self.links.append((text, self._current_href))
            self._current_href = None
            self._current_text = []


def normalize_label(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"\s*\([^)]*\)\s*$", "", value)
    return value.strip()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def fetch_links(page_url: str) -> dict[str, str]:
    with urllib.request.urlopen(page_url) as response:
        html = response.read().decode("utf-8", errors="replace")
    parser = LinkParser()
    parser.feed(html)
    links: dict[str, str] = {}
    for label, href in parser.links:
        links.setdefault(label, urljoin(page_url, href))
    return links


def download_binary(url: str, destination: Path) -> None:
    ensure_dir(destination.parent)
    with urllib.request.urlopen(url) as response:
        destination.write_bytes(response.read())


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

        question_ids = [question_ids_by_label[label] for label in labels]
        answer_values = [answer.lower() for answer in answers]
        if len(labels) > 1:
            accepted = sorted(set(itertools.permutations(answer_values)))
            accepted_variants = [list(variant) for variant in accepted]
        else:
            accepted_variants = [answer_values]

        scoring_rules.append(
            {
                "id": f"rule_{len(scoring_rules) + 1}",
                "questionIds": question_ids,
                "acceptedVariants": accepted_variants,
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
            f"# 採点基準 {config.title}",
            "## 採点の考え方",
            "- 公表された正解PDFをもとに、各設問の正答を機械判定します。",
            "- 複数欄をまとめて採点する設問は、正解グループとして登録しています。",
            "- 問題PDFはアプリ内で表示する前提で保存しています。",
            "",
            "## 運用メモ",
            "- problem.pdf を置き換えれば同じ画面で利用できます。",
            "- marksheet.json を更新すれば、選択肢や採点ロジックも調整できます。",
        ]
    )


def write_json(path: Path, payload: dict) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    problem_links = fetch_links(PROBLEM_PAGE)
    answer_links = fetch_links(ANSWER_PAGE)
    created: list[str] = []
    skipped_marksheets: list[str] = []

    for config in SUBJECTS:
        problem_label = normalize_label(config.problem_label)
        answer_label = normalize_label(config.answer_label)
        if problem_label not in problem_links:
            raise RuntimeError(f"problem link not found: {config.problem_label}")
        if answer_label not in answer_links:
            raise RuntimeError(f"answer link not found: {config.answer_label}")

        subject_dir = COMMON_2023_DIR / config.slug
        ensure_dir(subject_dir)
        problem_pdf_path = subject_dir / "problem.pdf"
        answer_pdf_path = subject_dir / "answer.pdf"
        download_binary(problem_links[problem_label], problem_pdf_path)
        download_binary(answer_links[answer_label], answer_pdf_path)

        metadata = {
            "exam_type": "common",
            "year": 2023,
            "subject": config.slug,
            "course": "",
            "title": config.title,
            "time_minutes": config.time_minutes,
        }
        write_json(subject_dir / "metadata.json", metadata)
        try:
            write_json(subject_dir / "marksheet.json", build_marksheet(config, answer_pdf_path))
        except RuntimeError:
            skipped_marksheets.append(config.slug)
        (subject_dir / "rubric.md").write_text(build_rubric(config) + "\n", encoding="utf-8")
        created.append(config.slug)

    print(json.dumps({"created": created, "skipped_marksheets": skipped_marksheets}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
