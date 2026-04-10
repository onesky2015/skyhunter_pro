"""
将 airports.csv 中有 IATA 代码的机场数据导入数据库（Supabase PostgreSQL 或本地 SQLite）。

用法：
  cd backend
  python import_airports.py
"""

import csv
import sys
from sqlmodel import Session, SQLModel, select
from db import engine
from models.database import Airport
from config import logger

CSV_PATH = "d:/SkyHunter/航空公司数据/airports.csv"


def import_airports():
    SQLModel.metadata.create_all(engine)

    airports = []
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            iata = row.get("iata_code", "").strip()
            if not iata:
                continue
            airports.append(Airport(
                iata_code=iata.upper(),
                icao_code=row.get("icao_code", "").strip() or None,
                name=row.get("name", "").strip(),
                municipality=row.get("municipality", "").strip() or None,
                iso_country=row.get("iso_country", "").strip(),
                iso_region=row.get("iso_region", "").strip() or None,
                airport_type=row.get("type", "").strip(),
                latitude=float(row["latitude_deg"]) if row.get("latitude_deg", "").strip() else None,
                longitude=float(row["longitude_deg"]) if row.get("longitude_deg", "").strip() else None,
                name_zh=row.get("name_zh", "").strip() or None,
                municipality_zh=row.get("municipality_zh", "").strip() or None,
            ))

    logger.info(f"从 CSV 解析出 {len(airports)} 条机场记录（含 IATA 代码）")

    with Session(engine) as session:
        existing = session.exec(select(Airport)).all()
        existing_iata = {a.iata_code for a in existing}
        logger.info(f"数据库中已有 {len(existing_iata)} 条机场记录")

        inserted = 0
        skipped = 0
        for ap in airports:
            if ap.iata_code in existing_iata:
                skipped += 1
                continue
            session.add(ap)
            existing_iata.add(ap.iata_code)
            inserted += 1

        session.commit()
        logger.info(f"导入完成：新增 {inserted} 条，跳过 {skipped} 条（已存在）")


if __name__ == "__main__":
    try:
        import_airports()
    except Exception as e:
        logger.error(f"导入失败: {e}")
        sys.exit(1)
