from __future__ import annotations

import html
import itertools
import json
import re
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
COMMON_2022_DIR = ROOT_DIR / "common" / "2022"
CACHE_DIR = ROOT_DIR / ".tmp" / "toshin2022"
TOSHIN_BASE = "https://www.toshin.com/kyotsutest/saiten/summary"


@dataclass
class ParsedEntry:
    label: str
    answer: str


@dataclass
class ParsedRule:
    entries: list[ParsedEntry]
    points: int
    unordered: bool = False


class TextCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        text = re.sub(r"\s+", " ", data.replace("\xa0", " ")).strip()
        if text:
            self.parts.append(html.unescape(text))


SOURCE_FILES: dict[str, str] = {
    "reading": f"{TOSHIN_BASE}/2022_reading.html",
    "listening": f"{TOSHIN_BASE}/2022_listening.html",
    "modern_japanese": f"{TOSHIN_BASE}/2022_modern_japanese.html",
    "old_japanese": f"{TOSHIN_BASE}/2022_old_japanese.html",
    "old_chinese": f"{TOSHIN_BASE}/2022_old_chinese.html",
    "world_history_b": f"{TOSHIN_BASE}/2022_world_history_B.html",
    "japanese_history_b": f"{TOSHIN_BASE}/2022_japanese_history_B.html",
    "geography_b": f"{TOSHIN_BASE}/2022_geography_B.html",
    "modern_society": f"{TOSHIN_BASE}/2022_modern_society.html",
    "ethics": f"{TOSHIN_BASE}/2022_ethics.html",
    "political_economy": f"{TOSHIN_BASE}/2022_political_economy.html",
    "ethics_political_economy": f"{TOSHIN_BASE}/2022_ethics_political_economy.html",
    "basic_physics": f"{TOSHIN_BASE}/2022_basic_physics.html",
    "basic_chemistry": f"{TOSHIN_BASE}/2022_basic_chemistry.html",
    "basic_biology": f"{TOSHIN_BASE}/2022_basic_biology.html",
    "advanced_physics": f"{TOSHIN_BASE}/2022_advanced_physics.html",
    "advanced_chemistry": f"{TOSHIN_BASE}/2022_advanced_chemistry.html",
    "advanced_biology": f"{TOSHIN_BASE}/2022_advanced_biology.html",
    "math_1a": f"{TOSHIN_BASE}/2022_math_1A.html",
    "math_2b": f"{TOSHIN_BASE}/2022_math_2B.html",
}

SUBJECT_SOURCES: dict[str, tuple[str, ...]] = {
    "japanese": ("modern_japanese", "old_japanese", "old_chinese"),
    "world_history_b": ("world_history_b",),
    "japanese_history_b": ("japanese_history_b",),
    "geography_b": ("geography_b",),
    "modern_society": ("modern_society",),
    "ethics": ("ethics",),
    "politics_economy": ("political_economy",),
    "ethics_politics_economy": ("ethics_political_economy",),
    "english": ("reading",),
    "english_listening": ("listening",),
    "math_ia": ("math_1a",),
    "math_iib": ("math_2b",),
    "physics_basics": ("basic_physics",),
    "chemistry_basics": ("basic_chemistry",),
    "biology_basics": ("basic_biology",),
    "physics": ("advanced_physics",),
    "chemistry": ("advanced_chemistry",),
    "biology": ("advanced_biology",),
}

ORDERED_SUBJECTS = {"math_ia", "math_iib"}
LABEL_PATTERN = re.compile(r"^\(([^)]+)\)$")
POINT_PATTERN = re.compile(r"^\d+$")


def read_source(key: str) -> str:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / f"{key}.html"
    if not cache_path.exists():
        request = urllib.request.Request(SOURCE_FILES[key], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request) as response:
            cache_path.write_bytes(response.read())
    return cache_path.read_text(encoding="utf-8", errors="ignore")


def extract_text_parts(source: str) -> list[str]:
    collector = TextCollector()
    collector.feed(source)
    return collector.parts


def parse_source(key: str) -> list[ParsedRule]:
    parts = extract_text_parts(read_source(key))
    index = 0
    pending: list[ParsedEntry] = []
    rules: list[ParsedRule] = []

    while index < len(parts):
        label_match = LABEL_PATTERN.match(parts[index])
        if not label_match:
            index += 1
            continue

        label = label_match.group(1)
        answer_index = None
        for cursor in range(index + 1, min(index + 8, len(parts))):
            if parts[cursor] == "正解":
                answer_index = cursor + 1
                break
        if answer_index is None or answer_index >= len(parts):
            index += 1
            continue

        pending.append(ParsedEntry(label=label, answer=parts[answer_index]))
        index = answer_index + 1

        meta: list[str] = []
        while index < len(parts) and not LABEL_PATTERN.match(parts[index]):
            meta.append(parts[index])
            index += 1

        point_values = [int(value) for value in meta if POINT_PATTERN.match(value)]
        if not point_values:
            continue

        unordered = any("順不同" in value for value in meta)
        complete = any("完答" in value for value in meta)

        if unordered and not complete and len(point_values) >= len(pending):
            points = sum(point_values[: len(pending)])
        else:
            points = point_values[0]

        rules.append(ParsedRule(entries=pending, points=points, unordered=unordered))
        pending = []

    return rules


def variants_for(rule: ParsedRule) -> list[list[str]]:
    answers = [entry.answer for entry in rule.entries]
    if not rule.unordered or len(answers) < 2:
        return [answers]
    return [list(variant) for variant in sorted(set(itertools.permutations(answers)))]


def question_id_for(entry: ParsedEntry, ordinal: int, ordered_subject: bool) -> str:
    if ordered_subject:
        return f"q_{ordinal}"
    if entry.label.isdigit():
        return f"q_{int(entry.label)}"
    return f"q_{ordinal}"


def ensure_question(marksheet: dict, question_id: str, number: int) -> dict:
    question_by_id = {question["id"]: question for question in marksheet["questions"]}
    if question_id in question_by_id:
        return question_by_id[question_id]

    prompt = "各設問の正しい選択肢を選んでください。"
    if marksheet["questions"]:
        prompt = marksheet["questions"][-1].get("prompt", prompt)
    question = {
        "id": question_id,
        "number": number,
        "displayLabel": str(number),
        "prompt": prompt,
        "points": 1,
    }
    marksheet["questions"].append(question)
    return question


def apply_subject_scoring(subject: str) -> tuple[int, int]:
    marksheet_path = COMMON_2022_DIR / subject / "marksheet.json"
    marksheet = json.loads(marksheet_path.read_text(encoding="utf-8"))
    sources = SUBJECT_SOURCES[subject]
    ordered_subject = subject in ORDERED_SUBJECTS

    parsed_rules: list[ParsedRule] = []
    for source in sources:
        parsed_rules.extend(parse_source(source))

    scoring_rules = []
    ordinal = 1
    used_numbers: list[int] = []
    for rule_index, rule in enumerate(parsed_rules, start=1):
        question_ids = []
        for entry in rule.entries:
            question_id = question_id_for(entry, ordinal, ordered_subject)
            question_number = ordinal if ordered_subject or not entry.label.isdigit() else int(entry.label)
            question = ensure_question(marksheet, question_id, question_number)
            question["correctAnswer"] = entry.answer
            question_ids.append(question_id)
            used_numbers.append(question_number)
            ordinal += 1

        scoring_rules.append(
            {
                "id": f"rule_{rule_index}",
                "questionIds": question_ids,
                "acceptedVariants": variants_for(rule),
                "points": rule.points,
            }
        )

    marksheet["scoringRules"] = scoring_rules
    if used_numbers:
        max_used_number = max(used_numbers)
        marksheet["questions"] = [
            question
            for question in marksheet["questions"]
            if int(str(question["id"]).removeprefix("q_")) <= max_used_number
        ]
    marksheet_path.write_text(
        json.dumps(marksheet, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return len(parsed_rules), sum(rule.points for rule in parsed_rules)


def main() -> None:
    for subject in SUBJECT_SOURCES:
        if not (COMMON_2022_DIR / subject).exists():
            continue
        rule_count, total_points = apply_subject_scoring(subject)
        print(f"{subject}: {rule_count} rules, {total_points} points")


if __name__ == "__main__":
    main()
