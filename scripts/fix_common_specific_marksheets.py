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
TOSHIN_BASE = "https://www.toshin.com/kyotsutest/saiten/summary"
CACHE_DIR = ROOT_DIR / ".tmp" / "toshin-specific"

CHOICE_VALUES = [str(value) for value in range(1, 10)]
NUMERIC_VALUES = ["-"] + [str(value) for value in range(10)] + list("abcde")
NUMERIC_LABELS = ["-"] + [str(value) for value in range(10)] + list("ABCDE")


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


LABEL_PATTERN = re.compile(r"^\(([^)]+)\)$")
POINT_PATTERN = re.compile(r"^\d+$")


def read_toshin_math_iib(year: str) -> str:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / f"{year}_math_2B.html"
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8", errors="ignore")

    request = urllib.request.Request(
        f"{TOSHIN_BASE}/{year}_math_2B.html",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(request) as response:
        cache_path.write_bytes(response.read())
    return cache_path.read_text(encoding="utf-8", errors="ignore")


def extract_text_parts(source: str) -> list[str]:
    collector = TextCollector()
    collector.feed(source)
    return collector.parts


def parse_toshin_math_iib(year: str) -> list[ParsedRule]:
    parts = extract_text_parts(read_toshin_math_iib(year))
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

        pending.append(ParsedEntry(label=label, answer=parts[answer_index].lower()))
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


def write_math_iib(year: str) -> dict[str, int]:
    marksheet_path = ROOT_DIR / "common" / year / "math_iib" / "marksheet.json"
    marksheet = json.loads(marksheet_path.read_text(encoding="utf-8"))
    rules = parse_toshin_math_iib(year)

    questions = []
    scoring_rules = []
    ordinal = 1
    for rule_index, rule in enumerate(rules, start=1):
        question_ids = []
        for entry in rule.entries:
            question = {
                "id": f"q_{ordinal}",
                "number": ordinal,
                "displayLabel": entry.label,
                "correctAnswer": entry.answer,
                "prompt": f"第{rule_index}採点欄",
                "points": 1,
            }
            questions.append(question)
            question_ids.append(question["id"])
            ordinal += 1

        scoring_rules.append(
            {
                "id": f"rule_{rule_index}",
                "title": "・".join(entry.label for entry in rule.entries),
                "questionIds": question_ids,
                "acceptedVariants": variants_for(rule),
                "points": rule.points,
            }
        )

    marksheet["instructions"] = "問題PDFを見ながら、解答欄ごとにマークしてください。"
    marksheet["defaultChoices"] = [
        {"value": value, "label": NUMERIC_LABELS[index]}
        for index, value in enumerate(NUMERIC_VALUES)
    ]
    marksheet["choicesPerRow"] = 6
    marksheet["questions"] = questions
    marksheet["scoringRules"] = scoring_rules
    marksheet["sourceLabels"] = [question["displayLabel"] for question in questions]
    marksheet_path.write_text(
        json.dumps(marksheet, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {
        "questions": len(questions),
        "rules": len(scoring_rules),
        "points": sum(rule.points for rule in rules),
    }


def write_choice_subject(year: str, subject: str, rows: list[tuple[int, str, int]]) -> dict[str, int]:
    marksheet_path = ROOT_DIR / "common" / year / subject / "marksheet.json"
    marksheet = json.loads(marksheet_path.read_text(encoding="utf-8"))
    prompt = (
        marksheet.get("questions", [{}])[0].get("prompt")
        or "各設問の正しい選択肢を選んでください。"
    )

    questions = []
    scoring_rules = []
    for index, (label, answer, points) in enumerate(rows, start=1):
        question_id = f"q_{index}"
        questions.append(
            {
                "id": question_id,
                "number": index,
                "displayLabel": str(label),
                "correctAnswer": answer,
                "prompt": prompt,
                "points": 1,
            }
        )
        scoring_rules.append(
            {
                "id": f"rule_{index}",
                "title": f"解答番号 {label}",
                "questionIds": [question_id],
                "acceptedVariants": [[answer]],
                "points": points,
            }
        )

    marksheet["instructions"] = "問題PDFを見ながら、解答番号ごとにマークしてください。"
    marksheet["defaultChoices"] = [{"value": value, "label": value} for value in CHOICE_VALUES]
    marksheet["choicesPerRow"] = 4
    marksheet["questions"] = questions
    marksheet["scoringRules"] = scoring_rules
    marksheet["sourceLabels"] = [str(label) for label, _, _ in rows]
    marksheet_path.write_text(
        json.dumps(marksheet, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {
        "questions": len(questions),
        "rules": len(scoring_rules),
        "points": sum(points for _, _, points in rows),
    }


EARTH_SCIENCE_BASICS_2022 = [
    (1, "4", 3),
    (2, "3", 3),
    (3, "1", 4),
    (4, "3", 3),
    (5, "1", 3),
    (6, "1", 4),
    (7, "4", 3),
    (8, "2", 3),
    (9, "3", 4),
    (10, "2", 3),
    (11, "4", 4),
    (12, "1", 3),
    (13, "4", 3),
    (14, "1", 4),
    (15, "1", 3),
]

EARTH_SCIENCE_2022 = [
    (1, "3", 3),
    (2, "2", 4),
    (3, "4", 4),
    (4, "4", 3),
    (5, "2", 3),
    (6, "2", 3),
    (7, "5", 4),
    (8, "7", 4),
    (9, "1", 3),
    (10, "1", 3),
    (11, "2", 3),
    (12, "3", 3),
    (13, "3", 4),
    (14, "3", 3),
    (15, "3", 4),
    (16, "2", 3),
    (17, "6", 3),
    (18, "2", 3),
    (19, "3", 3),
    (20, "1", 4),
    (21, "4", 3),
    (22, "2", 4),
    (23, "4", 3),
    (24, "4", 3),
    (25, "2", 3),
    (26, "3", 4),
    (27, "2", 3),
    (28, "3", 4),
    (29, "4", 3),
    (30, "2", 3),
]


def main() -> None:
    results = {
        "2022/earth_science_basics": write_choice_subject(
            "2022", "earth_science_basics", EARTH_SCIENCE_BASICS_2022
        ),
        "2022/earth_science": write_choice_subject("2022", "earth_science", EARTH_SCIENCE_2022),
        "2023/math_iib": write_math_iib("2023"),
        "2024/math_iib": write_math_iib("2024"),
    }
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
