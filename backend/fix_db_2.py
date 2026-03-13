import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlmodel import Session, text
from db import engine

def main():
    try:
        with Session(engine) as session:
            try:
                session.exec(text("ALTER TABLE monitor_tasks ADD COLUMN click_count INTEGER DEFAULT 0;"))
                print("Added click_count")
            except Exception as e:
                print(f"Skipped click_count: {e}")
                session.rollback()
            try:
                session.exec(text("ALTER TABLE monitor_tasks ADD COLUMN last_clicked_at VARCHAR NULL;"))
                print("Added last_clicked_at")
            except Exception as e:
                print(f"Skipped last_clicked_at: {e}")
                session.rollback()
            session.commit()
    except Exception as e:
        print(f"Error executing SQL: {e}")

if __name__ == "__main__":
    main()
