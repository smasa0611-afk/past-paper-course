from __future__ import annotations

import html
import itertools
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

from pypdf import PdfReader


ROOT_DIR = Path(__file__).resolve().parents[2]
COMMON_DIR = ROOT_DIR / "common"
RETAKE_DIR = ROOT_DIR / "common_retake"
TMP_DIR = ROOT_DIR / ".tmp" / "common_retake_import"
DNC_BASE = "https://www.dnc.ac.jp"


@dataclass(frozen=True)
class SourcePage:
    problem: str | None
    answer: str | None


SOURCE_PAGES: dict[int, SourcePage] = {
    2026: SourcePage(
        problem=None,
        answer="https://www.dnc.ac.jp/kyotsu/shiken_jouhou/r8/r8_tuisaisiken_seikai.html",
    ),
    2025: SourcePage(
        problem="https://www.dnc.ac.jp/kyotsu/kakomondai/r7/r7_tuisaishiken_mondai.html",
        answer="https://www.dnc.ac.jp/kyotsu/kakomondai/r7/r7_tuisaisiken_seikai.html",
    ),
    2024: SourcePage(
        problem="https://www.dnc.ac.jp/kyotsu/kakomondai/r6/r6_tuisaishiken_mondai.html",
        answer="https://www.dnc.ac.jp/kyotsu/kakomondai/r6/r6_tuisaisiken_seikai.html",
    ),
    2023: SourcePage(
        problem="https://www.dnc.ac.jp/kyotsu/kakomondai/r5/r5_tuisaishiken_mondai.html",
        answer="https://www.dnc.ac.jp/kyotsu/kakomondai/r5/r5_tuisaisiken_seikai.html",
    ),
}

SUBJECT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "english": ("リーディング", "英語（リーディング）"),
    "english_listening": ("リスニング", "英語（リスニング）"),
    "japanese": ("国語",),
    "math_ia": ("数学Ⅰ，数学Ａ", "数学Ⅰ・数学Ａ", "数学Ⅰ，数学A", "数学Ⅰ・数学A"),
    "math_iibc": ("数学Ⅱ，数学Ｂ，数学Ｃ", "数学Ⅱ・数学Ｂ・数学Ｃ"),
    "math_iib": ("数学Ⅱ・数学Ｂ", "数学Ⅱ，数学Ｂ"),
    "geography": ("地理総合，地理探究",),
    "japanese_history": ("歴史総合，日本史探究",),
    "world_history": ("歴史総合，世界史探究",),
    "public_ethics": ("公共，倫理",),
    "public_politics_economy": ("公共，政治・経済",),
    "integrated_history_public": ("地理総合／歴史総合／公共", "地理総合，歴史総合，公共"),
    "information_i": ("情報Ⅰ",),
    "science_basics": ("物理基礎／化学基礎／生物基礎／地学基礎", "理科基礎"),
    "physics": ("物理",),
    "chemistry": ("化学",),
    "biology": ("生物",),
    "earth_science": ("地学",),
    "physics_basics": ("物理基礎",),
    "chemistry_basics": ("化学基礎",),
    "biology_basics": ("生物基礎",),
    "earth_science_basics": ("地学基礎",),
    "geography_b": ("地理Ｂ", "地理B"),
    "japanese_history_b": ("日本史Ｂ", "日本史B"),
    "world_history_b": ("世界史Ｂ", "世界史B"),
    "modern_society": ("現代社会",),
    "ethics": ("倫理",),
    "politics_economy": ("政治・経済",),
    "ethics_politics_economy": ("倫理，政治・経済", "倫理、政治・経済"),
}

NUMERIC_SUBJECTS = {"math_ia", "math_iib", "math_iibc", "information_i"}
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
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        attr = dict(attrs)
        self._href = attr.get("href")
        self._text = []

    def handle_data(self, data: str) -> None:
        if self._href:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href:
            text = normalize_text("".join(self._text))
            self.links.append((self._href, text))
            self._href = None
            self._text = []


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def normalize_text(value: str) -> str:
    value = html.unescape(value)
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("\u3000", " ")
    value = re.sub(r"\s+", "", value)
    return value


def absolute_url(href: str) -> str:
    return urllib.parse.urljoin(DNC_BASE, html.unescape(href))


def fetch_text(url: str, destination: Path) -> str:
    ensure_dir(destination.parent)
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read()
    destination.write_bytes(data)
    return data.decode("utf-8", errors="replace")


def download_binary(url: str, destination: Path) -> None:
    ensure_dir(destination.parent)
    with urllib.request.urlopen(url, timeout=120) as response:
        data = response.read()
    temp_destination = destination.with_name(f".{destination.name}.download")
    temp_destination.write_bytes(data)
    temp_destination.replace(destination)


def parse_links(url: str, cache_name: str) -> list[tuple[str, str]]:
    html_text = fetch_text(url, TMP_DIR / cache_name)
    parser = LinkParser()
    parser.feed(html_text)
    return [(absolute_url(href), text) for href, text in parser.links if href.lower().endswith((".pdf", ".mp3")) or "abm.php" in href]


def link_score(subject: str, link_text: str, url: str, *, kind: str) -> int:
    if not url.lower().endswith(".pdf") and "abm.php" not in url:
        return -100
    text = normalize_text(f"{link_text} {urllib.parse.unquote(url)}")
    if any(skip in text for skip in ("表紙", "hyoshi", "スクリプト", "問題訂正", "出典")):
        return -100

    score = -10
    for keyword in SUBJECT_KEYWORDS.get(subject, (subject,)):
        if normalize_text(keyword) in text:
            score += 50

    if subject == "physics" and "物理基礎" in text:
        score -= 60
    if subject == "chemistry" and "化学基礎" in text:
        score -= 60
    if subject == "biology" and "生物基礎" in text:
        score -= 60
    if subject == "earth_science" and "地学基礎" in text:
        score -= 60
    if subject == "ethics" and ("政治" in text or "公共" in text):
        score -= 35
    if subject == "politics_economy" and "倫理" in text:
        score -= 35
    if subject == "english" and "リスニング" in text:
        score -= 80
    if subject == "english_listening" and "リーディング" in text:
        score -= 80

    if kind == "problem" and "on_" in text:
        score += 5
    if kind == "answer" and ("正解" in text or "発表用" in text):
        score += 5
    return score


def select_link(links: list[tuple[str, str]], subject: str, *, kind: str) -> str | None:
    ranked = sorted(
        ((link_score(subject, text, url, kind=kind), url, text) for url, text in links),
        reverse=True,
    )
    best = ranked[0] if ranked else None
    if not best or best[0] < 20:
        return None
    return best[1]


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    ensure_dir(path.parent)
    temp_path = path.with_name(f".{path.name}.write")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def split_labels(token: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", token).replace("－", "-")
    labels: list[str] = []
    for chunk in normalized.split(","):
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
    normalized = unicodedata.normalize("NFKC", token).replace("－", "-")
    values: list[str] = []
    for chunk in normalized.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            values.extend(part for part in chunk.split("-") if part)
        else:
            values.append(chunk)
    return values


def normalize_pdf_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    normalized = normalized.replace("\u3000", " ")
    normalized = normalized.replace("\r", "\n")
    normalized = normalized.replace("－", "-")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    return normalized


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
    for raw_labels, raw_answers, raw_points in matches:
        labels = split_labels(raw_labels)
        answers = split_answers(raw_answers)
        if not labels or not answers or len(labels) != len(answers):
            continue

        question_ids: list[str] = []
        for label, answer in zip(labels, answers):
            question_id = f"q_{len(questions) + 1}"
            question_ids.append(question_id)
            labels_in_order.append(label)
            questions.append(
                {
                    "id": question_id,
                    "number": len(questions) + 1,
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
                    "questionIds": question_ids,
                    "acceptedVariants": [list(variant) for variant in accepted],
                    "points": points,
                }
            )
        else:
            scoring_rules.append(
                {
                    "id": f"rule_{len(scoring_rules) + 1}",
                    "questionIds": question_ids,
                    "acceptedVariants": [[answers[0].lower()]],
                    "points": points,
                }
            )

    return questions, scoring_rules, labels_in_order


def build_marksheet(metadata: dict, answer_pdf: Path) -> dict:
    questions, scoring_rules, labels_in_order = parse_answer_pdf(answer_pdf)
    if not questions:
        raise RuntimeError(f"no questions parsed: {answer_pdf}")

    subject = metadata["subject"]
    if subject in NUMERIC_SUBJECTS:
        default_choices = [
            {"value": value, "label": label}
            for value, label in zip(NUMERIC_ENTRY_VALUES, NUMERIC_ENTRY_LABELS, strict=True)
        ]
        choices_per_row = 6
        prompt = "解答番号に対応する数字・記号を選んでください。"
    else:
        default_choices = [{"value": value, "label": value} for value in CHOICE_ENTRY_VALUES]
        choices_per_row = 4
        prompt = "各設問の正しい選択肢を選んでください。"

    for question in questions:
        question["prompt"] = prompt
        question["points"] = 1

    return {
        "title": metadata["title"],
        "instructions": "問題PDFを見ながら、解答番号ごとにマークしてください。",
        "defaultChoices": default_choices,
        "choicesPerRow": choices_per_row,
        "questions": questions,
        "scoringRules": scoring_rules,
        "sourceLabels": labels_in_order,
    }


def update_metadata(subject_dir: Path, problem_url: str | None, answer_url: str | None, marksheet_status: str) -> None:
    metadata_path = subject_dir / "metadata.json"
    metadata = read_json(metadata_path)
    metadata["exam_type"] = "common_retake"
    metadata["problem_files"] = [{"label": "問題PDF", "path": "problem.pdf"}]
    metadata["answer_files"] = [{"label": "解答解説PDF", "path": "answer.pdf"}]
    metadata["source"] = {
        "kind": "official" if answer_url and problem_url else "partial",
        "problem_url": problem_url,
        "answer_url": answer_url,
        "marksheet_status": marksheet_status,
    }
    write_json(metadata_path, metadata)


def main() -> None:
    ensure_dir(TMP_DIR)
    report: list[dict] = []

    for year, pages in SOURCE_PAGES.items():
        problem_links = parse_links(pages.problem, f"{year}_problem.html") if pages.problem else []
        answer_links = parse_links(pages.answer, f"{year}_answer.html") if pages.answer else []
        year_dir = RETAKE_DIR / str(year)
        if not year_dir.exists():
            continue

        for subject_dir in sorted(path for path in year_dir.iterdir() if path.is_dir()):
            subject = subject_dir.name
            metadata_path = subject_dir / "metadata.json"
            if not metadata_path.exists():
                continue

            problem_url = select_link(problem_links, subject, kind="problem")
            answer_url = select_link(answer_links, subject, kind="answer")
            marksheet_status = "not_generated"

            if problem_url:
                download_binary(problem_url, subject_dir / "problem.pdf")
            if answer_url:
                download_binary(answer_url, subject_dir / "answer.pdf")
                metadata = read_json(metadata_path)
                try:
                    marksheet = build_marksheet(metadata, subject_dir / "answer.pdf")
                    main_marksheet = COMMON_DIR / str(year) / subject / "marksheet.json"
                    if main_marksheet.exists():
                        main_count = len(read_json(main_marksheet).get("questions", []))
                        if len(marksheet["questions"]) < max(1, int(main_count * 0.55)):
                            raise RuntimeError(
                                f"parsed too few questions ({len(marksheet['questions'])}/{main_count})"
                            )
                    write_json(subject_dir / "marksheet.json", marksheet)
                    marksheet_status = "generated"
                except Exception as error:
                    marksheet_status = f"needs_review: {error}"

            update_metadata(subject_dir, problem_url, answer_url, marksheet_status)
            report.append(
                {
                    "id": f"common_retake/{year}/{subject}",
                    "problem": bool(problem_url),
                    "answer": bool(answer_url),
                    "marksheet": marksheet_status,
                }
            )

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
