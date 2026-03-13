from sqlmodel import Session, create_engine
from config import DATABASE_URL, _is_sqlite, logger

if _is_sqlite:
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )
else:
    if not DATABASE_URL.startswith("postgresql://"):
        raise RuntimeError("DATABASE_URL 格式无效")
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        connect_args={},
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True,
    )

def get_session():
    with Session(engine) as session:
        yield session
