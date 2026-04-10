from __future__ import annotations

import json
from typing import Dict, List


def normalize_airport_query(query: str) -> str:
    """压缩空白，避免输入法或粘贴带来的异常空格影响检索。"""
    return " ".join(query.strip().split())


def parse_airport_alias_config(raw_value: str | None) -> Dict[str, List[str]]:
    """解析后台配置中的机场别名 JSON。格式：{ "北京": ["PEK", "PKX"] }。"""
    if not raw_value:
        return {}

    try:
        parsed = json.loads(raw_value)
    except (TypeError, ValueError):
        return {}

    if not isinstance(parsed, dict):
        return {}

    alias_map: Dict[str, List[str]] = {}
    for alias, iata_codes in parsed.items():
        if not isinstance(alias, str):
            continue
        normalized_alias = normalize_airport_query(alias)
        if not normalized_alias:
            continue

        codes: List[str] = []
        if isinstance(iata_codes, list):
            for code in iata_codes:
                if not isinstance(code, str):
                    continue
                normalized_code = code.strip().upper()
                if normalized_code and normalized_code not in codes:
                    codes.append(normalized_code)

        if codes:
            alias_map[normalized_alias] = codes

    return alias_map


def resolve_airport_alias_iata(query: str, alias_map: Dict[str, List[str]]) -> List[str]:
    """将后台维护的城市/机场别名解析成 IATA 列表。"""
    normalized = normalize_airport_query(query)
    compact_query = normalized.replace(" ", "").lower()
    if not compact_query:
        return []

    matches: List[str] = []
    seen = set()

    for alias, iata_codes in alias_map.items():
        compact_alias = alias.replace(" ", "").lower()
        if compact_query == compact_alias or compact_query in compact_alias or compact_alias in compact_query:
            for code in iata_codes:
                upper_code = code.upper()
                if upper_code not in seen:
                    seen.add(upper_code)
                    matches.append(upper_code)

    return matches
