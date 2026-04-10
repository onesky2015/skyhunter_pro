# filename: backend/services/predictive_search_dataset.py
"""将每次热力图搜索整理为独立行写入 predictive_search_records，供后续建模使用。"""
from __future__ import annotations

import json
from typing import Any, List, Optional

from sqlmodel import Session

from config import APP_VERSION, PREDICTIVE_SEARCH_LOG_ENABLED, logger
from db import engine
from models.database import PredictiveSearchRecord
from schemas.api_models import SearchRequest, SearchResponse


def _without_booking_link(fd: Optional[dict]) -> Optional[dict]:
    if not fd or not isinstance(fd, dict):
        return None
    return {k: v for k, v in fd.items() if k != "booking_link"}


def _sanitize_daily(rows: List[dict]) -> List[dict]:
    out: List[dict] = []
    for r in rows:
        item: dict[str, Any] = {
            "date": r.get("date"),
            "price": r.get("price"),
            "flight": _without_booking_link(r.get("flight_data") if isinstance(r.get("flight_data"), dict) else None),
        }
        out.append(item)
    return out


def _build_outcome_payload(
    response: SearchResponse,
    outbound_daily: List[dict],
    return_daily: Optional[List[dict]],
) -> dict:
    best_raw = response.best_flight.model_dump() if response.best_flight else None
    return {
        "schema_version": 1,
        "aggregates": {
            "lowest_price": response.lowest_price,
            "lowest_price_date": response.lowest_price_date,
            "average_price": response.average_price,
            "highest_price": response.highest_price,
            "return_lowest_price": response.return_lowest_price,
            "return_lowest_price_date": response.return_lowest_price_date,
        },
        "heatmap_outbound": [c.model_dump() for c in response.heatmap_data],
        "heatmap_return": [c.model_dump() for c in response.return_heatmap_data],
        "best_flight": _without_booking_link(best_raw),
        "daily_outbound": _sanitize_daily(outbound_daily),
        "daily_return": _sanitize_daily(return_daily) if return_daily else [],
        "data_source": response.data_source,
        "searched_at": response.searched_at,
    }


def append_predictive_search_record_safe(
    *,
    user_id: int,
    search_id: str,
    request: SearchRequest,
    response: SearchResponse,
    credits_charged: int,
    outbound_daily: List[dict],
    return_daily: Optional[List[dict]],
) -> None:
    """写入失败仅打日志，不影响搜索主流程。"""
    if not PREDICTIVE_SEARCH_LOG_ENABLED:
        return
    try:
        outcome = _build_outcome_payload(response, outbound_daily, return_daily or [])
        rec = PredictiveSearchRecord(
            user_id=user_id,
            search_id=search_id,
            credits_charged=credits_charged,
            app_version=APP_VERSION,
            request_json=json.dumps(
                request.model_dump(),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            outcome_json=json.dumps(outcome, ensure_ascii=False, separators=(",", ":")),
        )
        with Session(engine) as session:
            session.add(rec)
            session.commit()
        logger.info(f"📊 predictive_search_records 已记录 search_id={search_id} user_id={user_id}")
    except Exception as e:
        logger.warning(f"predictive_search_records 写入失败（已忽略）search_id={search_id}: {e}")
