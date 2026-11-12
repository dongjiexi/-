"""Bounded, shared question-part parsing without confusing citations with headings."""
from __future__ import annotations

import re
import unicodedata

MAX_TEXT = 18000
MAX_PARTS = 12
ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8}
NUMBER, LETTER = r"[0-9０-９]{1,2}", r"viii|vii|vi|iv|v|iii|ii|i|[Ⅰ-Ⅷⅰ-ⅷ]"
TOKEN = f"(?:{NUMBER}|{LETTER})"
SCORE = r"[（(][ \t　]*(?:(?:本(?:小)?题)?满分[ \t　]*)?[0-9０-９]{1,3}(?:[.．][0-9０-９]{1,2})?[ \t　]*分[ \t　]*[）)]"
LEAD = "已知|若|当|设|在|由|从|利用|记|取|过(?!后|去|了)|令|如图|如表|求|证明|求证|写出|确定|计算|讨论|判断|说明|试|找出|给出|建立|作|研究|分析|选择|是否|椭圆|双曲线|抛物线|圆|直线|点|函数|数列|矩形|三角形|向量"
HEAD_START = rf"(?:{LEAD}|\$|\\[\[(]|[（(][ \t　]*{TOKEN}[ \t　]*[）)])"
EXAM_NUMBER = re.compile(rf"^\s*(?:第[ \t　]*{NUMBER}[ \t　]*题[：:、．.]?|{NUMBER}[.．、](?![0-9０-９]))(?=[ \t　]*(?:[\r\n]|{SCORE}|{HEAD_START}))", re.I)
LEADING_SCORE = re.compile(rf"^(\s*){SCORE}(?=\s*(?:{HEAD_START}|$))", re.I)
TRAILING_SCORE = re.compile(rf"([。；;！!？?]|\r?\n)[ \t　]*{SCORE}(?=\s*$)")
EXAM_BANNER = re.compile(r"(?:(?:20[0-9０-９]{2}[ \t　]*年[ \t　]*)?普通高等学校招生全国统一考试(?:[ \t　]*[（(](?:新课标|新高考)?(?:全国)?[ⅠⅡⅢI一二三]+卷[）)])?(?:[ \t　]*数学(?:试题|试卷)?)?|数学(?:试题|试卷)|绝密[★☆]启用前)")
PAGE_NUMBER = re.compile(r"(?:数学(?:试题|试卷)[ \t　]*第[ \t　]*[0-9０-９]{1,3}[ \t　]*页|(?:数学(?:试题|试卷)[ \t　]*)?第[ \t　]*[0-9０-９]{1,3}[ \t　]*页[ \t　]*(?:[（(/／][ \t　]*)?共[ \t　]*[0-9０-９]{1,3}[ \t　]*页[）)]?)")
MATH_BLOCK = re.compile(r"(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<![\\$])\$(?:\\[\s\S]|[^$\\])*?\$(?!\$)")
SQUARE_TERM = r"[xy](?:\^2|²)(?:[ \t]*[/／][ \t]*(?:[ab](?:\^2|²)|[0-9]+(?:\.[0-9]+)?))?"
LINE_BREAK = r"[ \t]*(?:\r\n|\n|\r)[ \t]*"


def _across_line(op: str) -> str:
    return rf"([ \t]*{op}{LINE_BREAK}|{LINE_BREAK}{op}(?:{LINE_BREAK}|[ \t]*))"


TERM_JOIN = re.compile(rf"({SQUARE_TERM}){_across_line('[+＋−-]')}(?={SQUARE_TERM})")
EQUATION_JOIN = re.compile(rf"({SQUARE_TERM}){_across_line('[=＝]')}(?=[+-]?[0-9]+(?:\.[0-9]+)?(?![0-9A-Za-z_.]))")
DIVISION_JOIN = re.compile(rf"([xy](?:\^2|²)){_across_line('[/／]')}(?=(?:[ab](?:\^2|²)|[0-9]+(?:\.[0-9]+)?)(?![0-9A-Za-z_.]))")



class QuestionPartsError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _checked_text(text: str) -> str:
    if not isinstance(text, str):
        raise QuestionPartsError("QUESTION_PARTS_TEXT", "题目必须是文字。")
    if len(text) > MAX_TEXT:
        raise QuestionPartsError("QUESTION_PARTS_LENGTH", f"题目超过 {MAX_TEXT} 字符，请缩短或分题输入。")
    return text


def _strip_wrap(value: str) -> str:
    return re.sub(r"(?:\$|\\\(|\\\)|\\\[|\\\])+", "", value)


def _heading(text: str, start: int, end: int) -> bool:
    before, after = _strip_wrap(text[max(0, start-160):start]), _strip_wrap(text[end:end+180])
    left, right = before.rstrip(), after.lstrip()
    if re.match(r"[+\-*/^=<>≤≥),%0-9０-９]", right):
        return False
    if re.match(r"[（(]\s*"+TOKEN+r"\s*[）)]", right, re.I) or re.search(r"[（(]\s*"+TOKEN+r"\s*[）)]\s*$", left, re.I):
        return False
    if re.match(r"(?:的?(?:条件|结论|结果|基础|假设|范围|小问)|问(?:[。；;,，）)]|$)|中(?:的|所得|所求|给出|提到|求)|所得|所求|给出|提到|可知|可得|成立|所示|与|和|、|及|或|至|到)", right):
        return False
    line_start = max(text.rfind("\n", 0, start), text.rfind("\r", 0, start))+1
    if re.fullmatch(r"(?:\s|\$|\\[()\[\]])*", text[line_start:start]):
        return True
    if re.search(r"[A-Za-z0-9０-９_√π*/^+=-]\s*$", left):
        return False
    if re.search(r"(?:在|由|根据|依据|利用|结合|参见|见|第|前述|上述|小问|问题|题|求出|求|证明|式|编号|条件)\s*$", left):
        return False
    if re.search(r"[。；;:：!?！？]\s*$", left):
        return True
    return bool(re.match(rf"(?:{LEAD})", LEADING_SCORE.sub(r"\1", right).lstrip()))


def _scan(text: str, roman: bool = False) -> list[dict]:
    pattern = rf"[（(]\s*({LETTER if roman else NUMBER})\s*[）)]"
    result = []
    for match in re.finditer(pattern, text, re.I if roman else 0):
        if not _heading(text, match.start(), match.end()):
            continue
        token = unicodedata.normalize("NFKC", match.group(1)).lower()
        number = token if roman else int(token)
        if not roman and number < 1:
            continue
        result.append({"index": match.start(), "end": match.end(), "number": number, "raw": match.group(0)})
    return result


def headings(text: str) -> list[dict]:
    return _scan(_checked_text(text))


def _remove_page_furniture(text: str) -> str:
    lines = re.split(r"(\r\n|\r|\n)", text.replace("\f", "\n"))
    kept = []
    for index in range(0, len(lines), 2):
        label = lines[index].strip()
        if not EXAM_BANNER.fullmatch(label) and not PAGE_NUMBER.fullmatch(label):
            kept.extend((lines[index], lines[index+1] if index+1 < len(lines) else ""))
    return "".join(kept)


def _fold_formula_lines(text: str) -> str:
    def join_plain(segment: str) -> str:
        for rule in (DIVISION_JOIN, TERM_JOIN, EQUATION_JOIN):
            segment = rule.sub(lambda m: m[1]+re.sub(r"\s", "", m[2]), segment)
        return segment

    pieces, start = [], 0
    for match in MATH_BLOCK.finditer(text):
        pieces.extend((join_plain(text[start:match.start()]), re.sub(LINE_BREAK, " ", match[0])))
        start = match.end()
    pieces.append(join_plain(text[start:]))
    return "".join(pieces)


def exam_content(value: str) -> str:
    """Return mathematical content while headings() keeps original source offsets."""
    original = _fold_formula_lines(_remove_page_furniture(_checked_text(value)))
    without_number = EXAM_NUMBER.sub("", original)
    text = (LEADING_SCORE.sub(r"\1", original) if without_number == original
            else LEADING_SCORE.sub(r"\1", without_number).lstrip())
    numeric = _scan(text)
    markers = []
    for i, part in enumerate(numeric):
        markers.append(part)
        start = part["end"]
        end = numeric[i+1]["index"] if i+1 < len(numeric) else len(text)
        markers.extend({**child, "index": child["index"]+start, "end": child["end"]+start}
                       for child in _scan(text[start:end], True))
    if not markers:
        return TRAILING_SCORE.sub(r"\1", text)
    content = [TRAILING_SCORE.sub(r"\1", text[:markers[0]["index"]])]
    for i, part in enumerate(markers):
        content.append(re.sub(r"[０-９Ⅰ-Ⅷⅰ-ⅷ]",
                              lambda match: unicodedata.normalize("NFKC", match[0]).lower(), part["raw"]))
        end = markers[i+1]["index"] if i+1 < len(markers) else len(text)
        segment = LEADING_SCORE.sub(r"\1", text[part["end"]:end])
        content.append(TRAILING_SCORE.sub(r"\1", segment))
    return "".join(content)


def split_problem_parts(text: str) -> list[dict]:
    text = exam_content(text)
    matches = _scan(text)
    if not matches:
        body = text.strip()
        return [{"index": 0, "label": "完整题目", "question": body, "body": body}]
    parents = set()
    for heading in matches:
        if heading["number"] in parents:
            raise QuestionPartsError("QUESTION_PARTS_DUPLICATE", f"题目包含重复小问编号（{heading['number']}），请修正编号后重试。")
        parents.add(heading["number"])
    preamble, parts = text[:matches[0]["index"]].strip(), []
    for i, heading in enumerate(matches):
        end = matches[i+1]["index"] if i+1 < len(matches) else len(text)
        segment, number = text[heading["end"]:end], heading["number"]
        nested = _scan(segment, True)
        if not nested:
            body = segment.strip()
            parts.append({"index": number, "label": f"第（{number}）问", "question": (preamble+"\n"+body).strip(), "body": body})
            continue
        setup, seen = segment[:nested[0]["index"]].strip(), set()
        for j, sub in enumerate(nested):
            if sub["number"] in seen:
                raise QuestionPartsError("QUESTION_PARTS_DUPLICATE", f"题目包含重复小问编号（{number}）（{sub['number']}），请修正编号后重试。")
            seen.add(sub["number"])
            sub_end = nested[j+1]["index"] if j+1 < len(nested) else len(segment)
            sub_body = segment[sub["end"]:sub_end].strip()
            body = (setup+"\n"+sub_body).strip() if setup else sub_body
            parts.append({"index": number*100+ROMAN[sub["number"]], "label": f"第（{number}）（{sub['number']}）问", "question": (preamble+"\n"+body).strip(), "body": body, "parent_index": number, "sub_index": sub["number"]})
    if len(parts) > MAX_PARTS:
        raise QuestionPartsError("QUESTION_PARTS_MAX", f"题目共有 {len(parts)} 个小问，超过最多 {MAX_PARTS} 个的限制，请分题输入。")
    return parts
