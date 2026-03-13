import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlmodel import Session, text
from db import engine

def main():
    try:
        with Session(engine) as session:
            # Check if column exists first (optional, but good practice. For simplicity, we just try to add and catch if it exists)
            session.exec(text("ALTER TABLE monitor_tasks ADD COLUMN IF NOT EXISTS excluded_airlines VARCHAR;"))
            session.commit()
            print("Successfully added 'excluded_airlines' column to monitor_tasks table.")
    except Exception as e:
        print(f"Error executing SQL: {e}")

if __name__ == "__main__":
    main()
