import requests
from config import logger


def get_geo_from_ip(ip: str) -> dict:
    """
    通过免费 API 获取 IP 地理信息。
    返回 {"country": "US", "region": "California", "city": "San Francisco"}
    失败时返回空值字典。
    """
    if not ip or ip in ("unknown", "127.0.0.1", "localhost", "::1"):
        return {"country": None, "region": None, "city": None}

    try:
        resp = requests.get(
            f"http://ip-api.com/json/{ip}?fields=status,countryCode,regionName,city",
            timeout=3,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success":
                return {
                    "country": data.get("countryCode"),
                    "region": data.get("regionName"),
                    "city": data.get("city"),
                }
    except Exception as e:
        logger.warning(f"IP geolocation failed for {ip}: {e}")

    return {"country": None, "region": None, "city": None}
