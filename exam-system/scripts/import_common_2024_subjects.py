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
COMMON_2024_DIR = ROOT_DIR / "common" / "2024"
PDF_BASE = "https://www.dnc.ac.jp"


@dataclass(frozen=True)
class SubjectConfig:
    slug: str
    title: str
    time_minutes: int
    problem_pdf_path: str
    answer_pdf_path: str
    family: str


SUBJECTS: list[SubjectConfig] = [
    SubjectConfig(
        slug="english",
        title="共通テスト 英語 2024",
        time_minutes=80,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/english_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004282.pdf&n=R6_%E8%8B%B1%E8%AA%9E%28%E3%83%AA%E3%83%BC%E3%83%87%E3%82%A3%E3%83%B3%E3%82%B0%29_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="english_listening",
        title="共通テスト 英語リスニング 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/listening_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004285.pdf&n=R6_%E8%8B%B1%E8%AA%9E%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="japanese",
        title="共通テスト 国語 2024",
        time_minutes=80,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/kokugo_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004279.pdf&n=R6_%E5%9B%BD%E8%AA%9E_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
        SubjectConfig(
        slug="math_ia",
        title="共通テスト 数学I・数学A 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/sugaku1_a_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004293.pdf&n=R6_%E6%95%B0%E5%AD%A6%E2%85%A0%E3%83%BB%E6%95%B0%E5%AD%A6A_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="numeric",
    ),
        SubjectConfig(
        slug="math_iib",
        title="共通テスト 数学II・数学B 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/sugaku2_b_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004295.pdf&n=R6_%E6%95%B0%E5%AD%A6%E2%85%A1%E3%83%BB%E6%95%B0%E5%AD%A6B_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="numeric",
    ),
        SubjectConfig(
        slug="world_history_b",
        title="共通テスト 世界史B 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/sekaishi_b_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004268.pdf&n=R6_%E4%B8%96%E7%95%8C%E5%8F%B2%EF%BC%A2_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
        SubjectConfig(
        slug="japanese_history_b",
        title="共通テスト 日本史B 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/nihonshi_b_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004272.pdf&n=R6_%E6%97%A5%E6%9C%AC%E5%8F%B2%EF%BC%A2_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
        SubjectConfig(
        slug="geography_b",
        title="共通テスト 地理B 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/chiri_b_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004270.pdf&n=R6_%E5%9C%B0%E7%90%86%EF%BC%A2_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="modern_society",
        title="共通テスト 現代社会 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/gendaishakai_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004275.pdf&n=R6_%E7%8F%BE%E4%BB%A3%E7%A4%BE%E4%BC%9A_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="ethics",
        title="共通テスト 倫理 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/rinri_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004278.pdf&n=R6_%E5%80%AB%E7%90%86_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="politics_economy",
        title="共通テスト 政治・経済 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/seijikeizai_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004276.pdf&n=R6_%E6%94%BF%E6%B2%BB%E3%83%BB%E7%B5%8C%E6%B8%88_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="ethics_politics_economy",
        title="共通テスト 倫理・政治・経済 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day1_jmq2ytbaxq/pdf/rinriseikei_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004277.pdf&n=R6_%E5%80%AB%E7%90%86%EF%BC%8C%E6%94%BF%E6%B2%BB%E3%83%BB%E7%B5%8C%E6%B8%88_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="physics_basics",
        title="共通テスト 物理基礎 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/butsurikiso_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004291.pdf&n=R6_%E7%89%A9%E7%90%86%E5%9F%BA%E7%A4%8E_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="chemistry_basics",
        title="共通テスト 化学基礎 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/kagakukiso_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004292.pdf&n=R6_%E5%8C%96%E5%AD%A6%E5%9F%BA%E7%A4%8E_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="biology_basics",
        title="共通テスト 生物基礎 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/seibutsukiso_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004290.pdf&n=R6_%E7%94%9F%E7%89%A9%E5%9F%BA%E7%A4%8E_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="earth_science_basics",
        title="共通テスト 地学基礎 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/chigakukiso_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004289.pdf&n=R6_%E5%9C%B0%E5%AD%A6%E5%9F%BA%E7%A4%8E_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="physics",
        title="共通テスト 物理 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/butsuri_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004302.pdf&n=R6_%E7%89%A9%E7%90%86_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="chemistry",
        title="共通テスト 化学 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/kagaku_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004301.pdf&n=R6_%E5%8C%96%E5%AD%A6_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="biology",
        title="共通テスト 生物 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/seibutsu_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004299.pdf&n=R6_%E7%94%9F%E7%89%A9_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
    SubjectConfig(
        slug="earth_science",
        title="共通テスト 地学 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/chigaku_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004300.pdf&n=R6_%E5%9C%B0%E5%AD%A6_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="choice",
    ),
        SubjectConfig(
        slug="information_related_basics",
        title="共通テスト 情報関係基礎 2024",
        time_minutes=60,
        problem_pdf_path="https://www.asahicom.jp/edu/kyotsu-exam/shiken2024/mondai_day2_r8wv8d72jz/pdf/johokankei_01.pdf",
        answer_pdf_path="/albums/abm.php?d=661&f=abm00004298.pdf&n=R6_%E6%83%85%E5%A0%B1%E9%96%A2%E4%BF%82%E5%9F%BA%E7%A4%8E_%E6%9C%AC%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
        family="numeric",
    ),
]

NUMERIC_ENTRY_VALUES = ["-"] + [str(value) for value in range(10)] + list("abcde")
NUMERIC_ENTRY_LABELS = ["-", *[str(value) for value in range(10)], *list("ABCDE")]
CHOICE_ENTRY_VALUES = [str(value) for value in range(1, 10)]

MANUAL_MARKSHEET_ROWS: dict[str, list[tuple[str, str, str, int, bool]]] = {
    "math_i": [
        ("第1問", "ア", "3", 1, False),
        ("第1問", "イ・ウ", "1・0", 1, False),
        ("第1問", "エ・オ", "1・0", 2, False),
        ("第1問", "カ", "0", 3, False),
        ("第1問", "キ", "5", 3, False),
        ("第1問", "ク", "2", 2, False),
        ("第1問", "ケ", "2", 3, False),
        ("第1問", "コサ・シ", "-2・3", 2, False),
        ("第1問", "ス・セ", "2・1", 2, False),
        ("第1問", "ソタ", "12", 1, False),
        ("第1問", "チ", "3", 3, False),
        ("第1問", "ツ", "1", 1, False),
        ("第1問", "テ・ト", "1・1", 2, False),
        ("第1問", "ナ", "3", 1, False),
        ("第1問", "ニヌ", "-6", 2, False),
        ("第1問", "ネノ", "14", 1, False),
        ("第2問", "ア・イ", "3・2", 2, False),
        ("第2問", "ウ・エ", "9・6", 1, False),
        ("第2問", "オ・カ・キ", "9・2・6", 2, False),
        ("第2問", "ク", "1", 1, False),
        ("第2問", "ケ・コ", "5・2", 1, False),
        ("第2問", "サ", "2", 1, False),
        ("第2問", "シ", "2", 1, False),
        ("第2問", "ス", "3", 3, False),
        ("第2問", "セ・ソ", "0・5", 2, False),
        ("第2問", "タ", "1", 2, False),
        ("第2問", "チ", "1", 4, False),
        ("第2問", "ツ", "2", 2, False),
        ("第2問", "テ", "3", 1, False),
        ("第2問", "ト・ナ", "4・2", 3, False),
        ("第2問", "ニ・ヌ", "0・4", 2, False),
        ("第2問", "ネ", "2", 2, False),
        ("第3問", "ア", "3", 2, False),
        ("第3問", "イ", "9", 2, False),
        ("第3問", "ウ・エ", "5・4", 3, False),
        ("第3問", "オ", "6", 2, False),
        ("第3問", "カ", "6", 3, False),
        ("第3問", "キ", "4", 2, False),
        ("第3問", "ク・ケ", "2・3", 2, False),
        ("第3問", "コ", "9", 2, False),
        ("第3問", "サ", "a", 2, False),
        ("第4問", "ア・イ", "4・0", 2, False),
        ("第4問", "ウ", "1", 2, False),
        ("第4問", "エ", "8", 2, False),
        ("第4問", "オ", "b", 2, False),
        ("第4問", "カ", "4", 3, False),
        ("第4問", "キ", "4", 3, False),
        ("第4問", "ク・ケ・コサ・シ", "1・2・15・2", 3, False),
        ("第4問", "ス・セ・ソ・タ", "3・2・7・2", 3, False),
    ],
    "math_ia": [
        ("第1問", "ア", "7", 2, False),
        ("第1問", "イ・ウ", "7・3", 2, False),
        ("第1問", "エオカ", "-56", 2, False),
        ("第1問", "キク", "14", 2, False),
        ("第1問", "ケ・コ・サ", "3・6・0", 2, False),
        ("第1問", "シ・ス・セ", "4・5・8", 2, False),
        ("第1問", "ソ・タ・チ", "2・4・8", 2, False),
        ("第1問", "ツ・テ", "5・7", 2, False),
        ("第1問", "ト・ナ・ニ・ヌ", "2・3・5・7", 2, False),
        ("第1問", "ネ", "2", 1, False),
        ("第1問", "ノ", "3", 1, False),
        ("第2問", "アイ", "21", 2, False),
        ("第2問", "ウ・エ", "1・4", 3, True),
        ("第2問", "オ・カ", "5・2", 2, False),
        ("第2問", "キ・ク・ケ", "5・3・3", 3, False),
        ("第2問", "コ", "4", 4, False),
        ("第2問", "サ・シ", "4・0", 4, False),
        ("第2問", "ス・セ・ソ", "7・4・2", 4, False),
        ("第2問", "タ", "3", 4, False),
        ("第2問", "チ・ツ・テ・ト", "7・5・0・1", 4, False),
        ("第3問", "ア", "0", 1, False),
        ("第3問", "イ", "0", 2, False),
        ("第3問", "ウ", "0", 1, False),
        ("第3問", "エ", "2", 2, False),
        ("第3問", "オ・カ", "0・2", 2, False),
        ("第3問", "キ", "5", 4, False),
        ("第3問", "ク", "0", 3, False),
        ("第3問", "ケ", "9", 3, False),
        ("第3問", "コ", "8", 3, False),
        ("第3問", "サシ", "12", 2, False),
        ("第3問", "ス", "8", 1, False),
        ("第3問", "セソ", "13", 2, False),
        ("第3問", "タ・チ・ツ", "3・3・2", 4, False),
        ("第4問", "ア", "6", 1, False),
        ("第4問", "イウ", "18", 1, False),
        ("第4問", "エ", "8", 2, False),
        ("第4問", "オ", "6", 2, False),
        ("第4問", "カ", "4", 2, False),
        ("第4問", "キ", "0", 2, False),
        ("第4問", "ク・ケコ", "3・51", 2, False),
        ("第4問", "サ", "1", 2, False),
        ("第4問", "シ", "1", 3, False),
        ("第4問", "ス", "7", 3, False),
    ],
}


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


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


def split_manual_labels(token: str) -> list[str]:
    labels: list[str] = []
    normalized = unicodedata.normalize("NFKC", token)
    for chunk in normalized.split("・"):
        chunk = chunk.strip()
        if not chunk:
            continue
        labels.extend(list(chunk))
    return labels


def split_manual_answers(token: str) -> list[str]:
    answers: list[str] = []
    normalized = unicodedata.normalize("NFKC", token).replace("－", "-").lower()
    for chunk in normalized.split("・"):
        chunk = chunk.strip()
        if not chunk:
            continue
        answers.extend(list(chunk))
    return answers


def build_manual_marksheet(config: SubjectConfig) -> dict:
    rows = MANUAL_MARKSHEET_ROWS[config.slug]
    default_choices = [
        {"value": value, "label": label}
        for value, label in zip(NUMERIC_ENTRY_VALUES, NUMERIC_ENTRY_LABELS, strict=True)
    ]

    questions: list[dict] = []
    scoring_rules: list[dict] = []
    source_labels: list[str] = []

    for section, raw_labels, raw_answers, points, unordered in rows:
        labels = split_manual_labels(raw_labels)
        answers = split_manual_answers(raw_answers)
        if len(labels) != len(answers):
            raise RuntimeError(f"manual marksheet mismatch for {config.slug}: {raw_labels} -> {raw_answers}")

        question_ids: list[str] = []
        accepted_variant = [answer.lower() for answer in answers]

        for label, answer in zip(labels, answers, strict=True):
            question_id = f"q_{len(questions) + 1}"
            display_label = f"{section} {label}"
            source_labels.append(display_label)
            question_ids.append(question_id)
            questions.append(
                {
                    "id": question_id,
                    "number": len(questions) + 1,
                    "displayLabel": display_label,
                    "correctAnswer": answer.lower(),
                    "prompt": "解答欄に対応する数字・記号を選んで入力してください。",
                    "points": 1,
                }
            )

        accepted_variants = [accepted_variant]
        if unordered and len(accepted_variant) > 1:
            accepted_variants = [list(variant) for variant in sorted(set(itertools.permutations(accepted_variant)))]

        scoring_rules.append(
            {
                "id": f"rule_{len(scoring_rules) + 1}",
                "questionIds": question_ids,
                "acceptedVariants": accepted_variants,
                "points": points,
            }
        )

    instructions = "問題PDFを見ながら、解答欄ごとにマークしてください。"
    if config.slug == "math_ia":
        instructions = (
            "問題PDFを見ながら、解答欄ごとにマークしてください。"
            " 第1問・第2問は必答、第3問〜第5問は選択制なので、解いた設問だけ入力してください。"
        )

    return {
        "title": config.title,
        "instructions": instructions,
        "defaultChoices": default_choices,
        "choicesPerRow": 6,
        "questions": questions,
        "scoringRules": scoring_rules,
        "sourceLabels": source_labels,
    }


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
    if config.slug in MANUAL_MARKSHEET_ROWS:
        return build_manual_marksheet(config)

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
        choices_perRow = 4
        prompt = "各設問の正しい選択肢を選んで入力してください。"
        return {
            "title": config.title,
            "instructions": "問題PDFを見ながら、解答欄ごとにマークしてください。",
            "defaultChoices": default_choices,
            "choicesPerRow": choices_perRow,
            "questions": [
                {
                    **question,
                    "prompt": prompt,
                    "points": 1,
                }
                for question in questions
            ],
            "scoringRules": scoring_rules,
            "sourceLabels": labels_in_order,
        }

    return {
        "title": config.title,
        "instructions": "問題PDFを見ながら、解答欄ごとにマークしてください。",
        "defaultChoices": default_choices,
        "choicesPerRow": choices_per_row,
        "questions": [
            {
                **question,
                "prompt": prompt,
                "points": 1,
            }
            for question in questions
        ],
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
    created: list[str] = []
    skipped_marksheets: list[str] = []

    for config in SUBJECTS:
        subject_dir = COMMON_2024_DIR / config.slug
        ensure_dir(subject_dir)

        problem_pdf_path = subject_dir / "problem.pdf"
        answer_pdf_path = subject_dir / "answer.pdf"
        problem_url = config.problem_pdf_path if config.problem_pdf_path.startswith("http") else f"{PDF_BASE}{config.problem_pdf_path}"
        download_binary(problem_url, problem_pdf_path)
        download_binary(f"{PDF_BASE}{config.answer_pdf_path}", answer_pdf_path)

        metadata = {
            "exam_type": "common",
            "year": 2024,
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
