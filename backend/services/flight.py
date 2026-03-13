import random
from datetime import date, timedelta, datetime
from typing import Optional, List
import time as _time_module
import json
import hashlib
from sqlmodel import Session, select
from db import engine
from config import USE_MOCK_DATA, CACHE_HOURS, SERPAPI_API_KEY, logger
from models.database import FlightCache, ApiCostRecord, utc_iso_now
from schemas.api_models import HeatmapCell, FlightDetail
# ============================================================================
# 航空公司数据（Mock 模式使用）
# ============================================================================

MOCK_AIRLINES = [
    {"name": "United Airlines", "code": "UA", "alliance": "Star Alliance"},
    {"name": "Air China", "code": "CA", "alliance": "Star Alliance"},
    {"name": "China Eastern", "code": "MU", "alliance": "SkyTeam"},
    {"name": "Delta Air Lines", "code": "DL", "alliance": "SkyTeam"},
    {"name": "American Airlines", "code": "AA", "alliance": "Oneworld"},
    {"name": "Cathay Pacific", "code": "CX", "alliance": "Oneworld"},
    {"name": "Singapore Airlines", "code": "SQ", "alliance": "Star Alliance"},
    {"name": "ANA", "code": "NH", "alliance": "Star Alliance"},
    {"name": "Japan Airlines", "code": "JL", "alliance": "Oneworld"},
    {"name": "Korean Air", "code": "KE", "alliance": "SkyTeam"},
    {"name": "Lufthansa", "code": "LH", "alliance": "Star Alliance"},
    {"name": "Turkish Airlines", "code": "TK", "alliance": "Star Alliance"},
    {"name": "Emirates", "code": "EK", "alliance": "None"},
    {"name": "Qatar Airways", "code": "QR", "alliance": "Oneworld"},
    {"name": "EVA Air", "code": "BR", "alliance": "Star Alliance"},
]

ALLIANCE_MEMBERS = {}
for _a in MOCK_AIRLINES:
    alliance = _a.get("alliance", "None")
    if alliance != "None":
        ALLIANCE_MEMBERS.setdefault(alliance, set()).add(_a["code"])
        ALLIANCE_MEMBERS.setdefault(alliance.lower(), set()).add(_a["code"])

CABIN_CLASS_MAP = {"economy": 1, "premium_economy": 2, "business": 3, "first": 4}
CABIN_PRICE_MULTIPLIER = {"economy": 1.0, "premium_economy": 1.6, "business": 3.2, "first": 5.5}

LONG_HAUL_PAIRS = {
    ("JFK", "PVG"), ("PVG", "JFK"), ("LAX", "NRT"), ("NRT", "LAX"),
    ("SFO", "HKG"), ("HKG", "SFO"), ("JFK", "LHR"), ("LHR", "JFK"),
    ("LAX", "SIN"), ("SIN", "LAX"), ("ORD", "PEK"), ("PEK", "ORD"),
    ("SFO", "PVG"), ("PVG", "SFO"),
}

MOCK_BAGGAGE_OPTIONS = [
    "1x checked bag included",
    "Carry-on only",
    "1x carry-on + 1x checked bag",
    "2x checked bags included",
    "No checked bag",
    "1x personal item only",
]


# ============================================================================
# 核心业务逻辑：搜索引擎（与 v3.1.0 完全相同）
# ============================================================================


def _parse_time_to_minutes(time_str: Optional[str]) -> Optional[int]:
    """将 HH:MM 格式的时间字符串转为自午夜起的分钟数。"""
    if not time_str:
        return None
    try:
        parts = time_str.strip().split(" ")
        time_part = parts[-1] if len(parts) > 1 else parts[0]
        h, m = time_part.split(":")[:2]
        return int(h) * 60 + int(m)
    except (ValueError, IndexError):
        return None


def _is_within_time_window(
    time_value: Optional[str], time_min: Optional[str], time_max: Optional[str],
) -> bool:
    """检查时间是否在指定时间窗口内。"""
    if time_min is None and time_max is None:
        return True
    val_minutes = _parse_time_to_minutes(time_value)
    if val_minutes is None:
        return True
    min_minutes = _parse_time_to_minutes(time_min)
    max_minutes = _parse_time_to_minutes(time_max)
    if min_minutes is not None and val_minutes < min_minutes:
        return False
    if max_minutes is not None and val_minutes > max_minutes:
        return False
    return True


def _matches_airline_filter(
    airline_name: Optional[str], airline_code: Optional[str], airline_include: Optional[str],
) -> bool:
    """检查航班是否匹配航司过滤条件。"""
    if not airline_include:
        return True
    filter_val = airline_include.strip().upper()
    if not filter_val:
        return True
    if airline_code and airline_code.upper() == filter_val:
        return True
    alliance_key = airline_include.strip().lower()
    if alliance_key in ALLIANCE_MEMBERS:
        if airline_code and airline_code.upper() in ALLIANCE_MEMBERS[alliance_key]:
            return True
        for mock_a in MOCK_AIRLINES:
            if mock_a.get("alliance", "").lower() == alliance_key:
                if airline_name and mock_a["name"].lower() in airline_name.lower():
                    return True
    if airline_name and filter_val.lower() in airline_name.lower():
        return True
    return False


def _is_excluded_airline(
    airline_name: Optional[str], airline_code: Optional[str], excluded_airlines: Optional[str],
) -> bool:
    """检查航班是否在排除航司列表中（任一匹配则排除）。"""
    if not excluded_airlines:
        return False
    codes = [c.strip().upper() for c in excluded_airlines.split(",") if c.strip()]
    if not codes:
        return False
    if airline_code and airline_code.upper() in codes:
        return True
    if airline_name:
        name_upper = airline_name.upper()
        for code in codes:
            if len(code) >= 2 and code in name_upper:
                return True
    return False


def _generate_mock_baggage() -> str:
    return random.choice(MOCK_BAGGAGE_OPTIONS)


def _generate_mock_heatmap(
    origin: str, destination: str, start_date: date, days: int, cabin_class: str,
) -> List[dict]:
    multiplier = CABIN_PRICE_MULTIPLIER.get(cabin_class, 1.0)
    base_low, base_high = (800, 1800) if (origin, destination) in LONG_HAUL_PAIRS else (600, 1500)
    results = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        date_str = current_date.isoformat()
        if random.random() < 0.08:
            results.append({"date": date_str, "price": None})
            continue
        base_price = random.uniform(base_low, base_high)
        if current_date.weekday() >= 5:
            base_price *= random.uniform(1.15, 1.30)
        days_from_now = (current_date - date.today()).days
        if days_from_now < 7:
            base_price *= random.uniform(1.20, 1.40)
        elif days_from_now < 14:
            base_price *= random.uniform(1.05, 1.15)
        results.append({"date": date_str, "price": round(base_price * multiplier, 2)})
    return results


def _classify_heatmap_levels(raw_data: List[dict]) -> List[HeatmapCell]:
    valid_prices = [d["price"] for d in raw_data if d["price"] is not None]
    if not valid_prices:
        return [HeatmapCell(date=d["date"], price=None, level="unavailable") for d in raw_data]
    avg_price = sum(valid_prices) / len(valid_prices)
    low_t, high_t = avg_price * 0.85, avg_price * 1.15
    cells = []
    for d in raw_data:
        p = d["price"]
        if p is None:
            level = "unavailable"
        elif p <= low_t:
            level = "low"
        elif p <= high_t:
            level = "medium"
        else:
            level = "high"
        cells.append(HeatmapCell(date=d["date"], price=p, level=level))
    return cells


def _generate_mock_flight_detail(
    origin: str, destination: str, departure_date: str, price: float,
    max_stops: Optional[int] = None,
    departure_time_min: Optional[str] = None, departure_time_max: Optional[str] = None,
    arrival_time_min: Optional[str] = None, arrival_time_max: Optional[str] = None,
    airline_include: Optional[str] = None,
) -> FlightDetail:
    if airline_include and airline_include.strip():
        filter_val = airline_include.strip().upper()
        matched = [a for a in MOCK_AIRLINES if a["code"] == filter_val]
        if not matched:
            alliance_key = airline_include.strip().lower()
            if alliance_key in ALLIANCE_MEMBERS:
                member_codes = ALLIANCE_MEMBERS[alliance_key]
                matched = [a for a in MOCK_AIRLINES if a["code"] in member_codes]
        if not matched:
            matched = [a for a in MOCK_AIRLINES if filter_val.lower() in a["name"].lower()]
        airline = random.choice(matched) if matched else random.choice(MOCK_AIRLINES)
    else:
        airline = random.choice(MOCK_AIRLINES)

    flight_num = f"{airline['code']}{random.randint(100, 9999)}"
    min_hour, max_hour = 6, 22
    if departure_time_min:
        parsed = _parse_time_to_minutes(departure_time_min)
        if parsed is not None:
            min_hour = max(min_hour, parsed // 60)
    if departure_time_max:
        parsed = _parse_time_to_minutes(departure_time_max)
        if parsed is not None:
            max_hour = min(max_hour, parsed // 60)
    if min_hour > max_hour:
        min_hour, max_hour = 6, 22

    dep_hour = random.randint(min_hour, max_hour)
    dep_min = random.choice([0, 15, 30, 45])
    duration = random.randint(180, 960)
    arr_total_min = dep_hour * 60 + dep_min + duration
    arr_hour = (arr_total_min // 60) % 24
    arr_min = arr_total_min % 60

    if arrival_time_min or arrival_time_max:
        arr_min_limit = _parse_time_to_minutes(arrival_time_min)
        arr_max_limit = _parse_time_to_minutes(arrival_time_max)
        arr_current = arr_hour * 60 + arr_min
        if arr_min_limit is not None and arr_current < arr_min_limit:
            duration += (arr_min_limit - arr_current)
        if arr_max_limit is not None and arr_current > arr_max_limit:
            duration = max(120, duration - (arr_current - arr_max_limit))
        arr_total_min = dep_hour * 60 + dep_min + duration
        arr_hour = (arr_total_min // 60) % 24
        arr_min = arr_total_min % 60

    if max_stops is not None:
        if max_stops == 0:
            stops = 0
        elif max_stops == 1:
            stops = random.choices([0, 1], weights=[40, 60])[0]
        else:
            stops = random.choices([0, 1, 2], weights=[30, 45, 25])[0]
    else:
        stops = random.choices([0, 1, 2], weights=[40, 45, 15])[0]

    booking_link = f"https://www.google.com/flights?flt={origin}.{destination}.{departure_date}&sc=e&px=1"
    baggage = _generate_mock_baggage()
    return FlightDetail(
        airline=airline["name"], flight_number=flight_num,
        departure_time=f"{dep_hour:02d}:{dep_min:02d}",
        arrival_time=f"{arr_hour:02d}:{arr_min:02d}",
        duration_minutes=duration, stops=stops, booking_link=booking_link,
        baggage_info=baggage,
    )


def _build_flight_cache_signature(
    origin: str,
    destination: str,
    departure_date: date,
    cabin_class: str = "economy",
    adults: int = 1,
    children: int = 0,
    max_stops: Optional[int] = None,
    departure_time_min: Optional[str] = None,
    departure_time_max: Optional[str] = None,
    sort_strategy: str = "best",
    arrival_time_min: Optional[str] = None,
    arrival_time_max: Optional[str] = None,
    airline_include: Optional[str] = None,
    excluded_airlines: Optional[str] = None,
    return_date: Optional[date] = None,
) -> str:
    """
    生成稳定的查询签名，避免不同筛选条件错误命中同一条缓存。
    """
    signature_payload = {
        "origin": origin.upper(),
        "destination": destination.upper(),
        "date": departure_date.isoformat(),
        "cabin_class": cabin_class,
        "adults": adults,
        "children": children,
        "max_stops": max_stops,
        "departure_time_min": departure_time_min,
        "departure_time_max": departure_time_max,
        "sort_strategy": sort_strategy,
        "arrival_time_min": arrival_time_min,
        "arrival_time_max": arrival_time_max,
        "airline_include": airline_include,
        "excluded_airlines": excluded_airlines,
        "return_date": return_date.isoformat() if return_date else None,
    }
    raw = json.dumps(signature_payload, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _search_serpapi_single_day(
    origin: str, destination: str, departure_date: date,
    cabin_class: str = "economy", adults: int = 1, children: int = 0,
    max_stops: Optional[int] = None,
    departure_time_min: Optional[str] = None, departure_time_max: Optional[str] = None,
    sort_strategy: str = "best",
    arrival_time_min: Optional[str] = None, arrival_time_max: Optional[str] = None,
    airline_include: Optional[str] = None, excluded_airlines: Optional[str] = None,
    return_date: Optional[date] = None,
    bypass_cache: bool = False,
) -> Optional[dict]:
    """调用 SerpApi Google Flights 查询单日价格（带数据库缓存）"""

    # ── Step A: 读取缓存 ──
    date_str = departure_date.isoformat()
    query_signature = _build_flight_cache_signature(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        cabin_class=cabin_class,
        adults=adults,
        children=children,
        max_stops=max_stops,
        departure_time_min=departure_time_min,
        departure_time_max=departure_time_max,
        sort_strategy=sort_strategy,
        arrival_time_min=arrival_time_min,
        arrival_time_max=arrival_time_max,
        airline_include=airline_include,
        excluded_airlines=excluded_airlines,
        return_date=return_date,
    )
    if bypass_cache:
        logger.info(f"📦 Cache SKIP: {origin}->{destination} {date_str} (forced live lookup)")
    else:
        try:
            with Session(engine) as session:
                cached = session.exec(
                    select(FlightCache).where(
                        FlightCache.origin == origin.upper(),
                        FlightCache.destination == destination.upper(),
                        FlightCache.date == date_str,
                    )
                ).first()
                if cached:
                    cache_age_hours = (datetime.utcnow() - datetime.fromisoformat(cached.updated_at)).total_seconds() / 3600
                    if cache_age_hours < CACHE_HOURS:
                        if cached.data:
                            cached_payload = json.loads(cached.data)
                            if isinstance(cached_payload, dict) and cached_payload.get("query_signature") == query_signature:
                                logger.info(f"📦 Cache HIT: {origin}->{destination} {date_str} (age: {cache_age_hours:.1f}h)")
                                cached_result = cached_payload.get("result")
                                if isinstance(cached_result, dict):
                                    return cached_result
                            else:
                                logger.info(f"📦 Cache BYPASS: {origin}->{destination} {date_str} (signature mismatch)")
                        elif cached.price is not None:
                            logger.info(f"📦 Cache BYPASS: {origin}->{destination} {date_str} (legacy price-only entry)")
                    else:
                        logger.info(f"📦 Cache STALE: {origin}->{destination} {date_str} (age: {cache_age_hours:.1f}h > {CACHE_HOURS}h)")
        except Exception as e:
            logger.warning(f"📦 Cache read error: {e}")

    # ── Step B: 调用 SerpApi ──
    try:
        from serpapi import GoogleSearch
    except ImportError:
        logger.error("serpapi 库未安装")
        return None
    if not SERPAPI_API_KEY:
        logger.error("SERPAPI_API_KEY 未配置")
        return None

    params = {
        "engine": "google_flights", "api_key": SERPAPI_API_KEY,
        "departure_id": origin.upper(), "arrival_id": destination.upper(),
        "outbound_date": departure_date.strftime("%Y-%m-%d"),
        "currency": "USD", "hl": "en", "adults": adults,
        "travel_class": CABIN_CLASS_MAP.get(cabin_class, 1),
    }
    if return_date:
        params["type"] = "1"
        params["return_date"] = return_date.strftime("%Y-%m-%d")
    else:
        params["type"] = "2"
    if max_stops is not None:
        params["max_stops"] = max_stops
    if children > 0:
        params["children"] = children

    logger.info(f"🔍 SerpApi: {origin}->{destination} {departure_date}")
    try:
        search = GoogleSearch(params)
        results = search.get_dict()
        if "error" in results:
            return None
        best_flights = results.get("best_flights", []) or []
        other_flights = results.get("other_flights", []) or []
        all_flights = best_flights + other_flights
        if not all_flights:
            return None

        filtered_flights = []
        for flight in all_flights:
            segments = flight.get("flights", [])
            if not segments:
                filtered_flights.append(flight)
                continue
            first_seg, last_seg = segments[0], segments[-1]
            dep_airport = first_seg.get("departure_airport", {})
            dep_time = dep_airport.get("time") if isinstance(dep_airport, dict) else None
            if not _is_within_time_window(dep_time, departure_time_min, departure_time_max):
                continue
            arr_airport = last_seg.get("arrival_airport", {})
            arr_time = arr_airport.get("time") if isinstance(arr_airport, dict) else None
            if not _is_within_time_window(arr_time, arrival_time_min, arrival_time_max):
                continue
            seg_airline = first_seg.get("airline")
            seg_airline_code = first_seg.get("airline_code") or first_seg.get("flight_number", "")[:2]
            if not _matches_airline_filter(seg_airline, seg_airline_code, airline_include):
                continue
            if _is_excluded_airline(seg_airline, seg_airline_code, excluded_airlines):
                continue
            filtered_flights.append(flight)

        if not filtered_flights:
            return None
        if sort_strategy == "cheapest":
            chosen = min(filtered_flights, key=lambda f: f.get("price", float("inf")))
        else:
            best_in_filtered = [f for f in filtered_flights if f in best_flights]
            chosen = min(best_in_filtered or filtered_flights, key=lambda f: f.get("price", float("inf")))

        price = chosen.get("price")
        if price is None:
            return None
        segments = chosen.get("flights", [])
        airline_name = flight_number = dep_time = arr_time = None
        duration = chosen.get("total_duration")
        stops = len(chosen.get("layovers", []))
        if segments:
            first_seg = segments[0]
            airline_name = first_seg.get("airline")
            flight_number = first_seg.get("flight_number")
            dep_airport = first_seg.get("departure_airport", {})
            dep_time = dep_airport.get("time") if isinstance(dep_airport, dict) else None
            last_seg = segments[-1]
            arr_airport = last_seg.get("arrival_airport", {})
            arr_time = arr_airport.get("time") if isinstance(arr_airport, dict) else None
        booking_link = results.get("search_metadata", {}).get("google_flights_url", "")
        if not booking_link:
            dep_str = departure_date.strftime("%Y-%m-%d")
            sc = {"economy": "e", "premium_economy": "p", "business": "b", "first": "f"}.get(cabin_class, "e")
            booking_link = f"https://www.google.com/flights?flt={origin}.{destination}.{dep_str}&sc={sc}&px={adults}"
        baggage = None
        extensions = chosen.get("extensions", [])
        if extensions:
            for ext in extensions:
                if isinstance(ext, str) and ("bag" in ext.lower() or "luggage" in ext.lower()):
                    baggage = ext
                    break
        result_data = {
            "price": float(price), "booking_link": booking_link,
            "airline": airline_name, "flight_number": flight_number,
            "departure_time": dep_time, "arrival_time": arr_time,
            "duration_minutes": duration, "stops": stops, "baggage_info": baggage,
        }

        # ── Step B-Write: 写入/更新缓存 ──
        try:
            with Session(engine) as cache_session:
                existing_cache = cache_session.exec(
                    select(FlightCache).where(
                        FlightCache.origin == origin.upper(),
                        FlightCache.destination == destination.upper(),
                        FlightCache.date == date_str,
                    )
                ).first()
                if existing_cache:
                    existing_cache.price = result_data["price"]
                    existing_cache.data = json.dumps(
                        {"query_signature": query_signature, "result": result_data},
                        ensure_ascii=False,
                        separators=(",", ":"),
                    )
                    existing_cache.updated_at = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
                    cache_session.add(existing_cache)
                else:
                    new_cache = FlightCache(
                        origin=origin.upper(),
                        destination=destination.upper(),
                        date=date_str,
                        price=result_data["price"],
                        data=json.dumps(
                            {"query_signature": query_signature, "result": result_data},
                            ensure_ascii=False,
                            separators=(",", ":"),
                        ),
                        updated_at=datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    )
                    cache_session.add(new_cache)
                cache_session.commit()
                logger.info(f"📦 Cache WRITE: {origin}->{destination} {date_str} @ ${result_data['price']}")
        except Exception as cache_err:
            logger.warning(f"📦 Cache write error: {cache_err}")

        # 记录 SerpApi 调用成本（每次实际 API 调用约 $0.005）
        try:
            with Session(engine) as cost_session:
                cost_record = ApiCostRecord(
                    api_provider="serpapi",
                    cost_usd=0.005,
                    request_type="search",
                    reference_id=f"{origin}-{destination}-{date_str}",
                    origin=origin.upper(),
                    destination=destination.upper(),
                    created_at=utc_iso_now(),
                )
                cost_session.add(cost_record)
                cost_session.commit()
        except Exception as cost_err:
            logger.warning(f"ApiCostRecord write error: {cost_err}")

        return result_data
    except Exception as e:
        logger.error(f"SerpApi 异常: {e}")
        return None


def _search_range(
    origin: str, destination: str, start_date: date, days: int,
    cabin_class: str = "economy", adults: int = 1, children: int = 0,
    max_stops: Optional[int] = None,
    departure_time_min: Optional[str] = None, departure_time_max: Optional[str] = None,
    sort_strategy: str = "best",
    arrival_time_min: Optional[str] = None, arrival_time_max: Optional[str] = None,
    airline_include: Optional[str] = None, excluded_airlines: Optional[str] = None,
    return_date: Optional[date] = None,
) -> List[dict]:
    """对日期范围搜索（Mock 或 SerpApi）"""
    if USE_MOCK_DATA:
        raw = _generate_mock_heatmap(origin, destination, start_date, days, cabin_class)
        results = []
        for d in raw:
            fd = None
            if d["price"] is not None:
                fd = _generate_mock_flight_detail(
                    origin, destination, d["date"], d["price"],
                    max_stops=max_stops, departure_time_min=departure_time_min,
                    departure_time_max=departure_time_max, arrival_time_min=arrival_time_min,
                    arrival_time_max=arrival_time_max, airline_include=airline_include,
                )
                fd = fd.model_dump()
            results.append({"date": d["date"], "price": d["price"], "flight_data": fd})
        return results
    else:
        results = []
        for i in range(days):
            current_date = start_date + timedelta(days=i)
            date_str = current_date.isoformat()
            flight_data = _search_serpapi_single_day(
                origin, destination, current_date, cabin_class, adults, children,
                max_stops, departure_time_min, departure_time_max, sort_strategy,
                arrival_time_min, arrival_time_max, airline_include, excluded_airlines, return_date,
            )
            if flight_data:
                results.append({"date": date_str, "price": flight_data["price"], "flight_data": flight_data})
            else:
                results.append({"date": date_str, "price": None, "flight_data": None})
            if i < days - 1:
                _time_module.sleep(1.5)
        return results


