from pathlib import Path

from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session
import os

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

LOCAL_SQLITE_URL = "sqlite:///biologgr.db"


def _database_url() -> str:
    url = (os.getenv("DATABASE_URL") or LOCAL_SQLITE_URL).strip()
    if not url.startswith("sqlite"):
        raise RuntimeError(f"Alleen SQLite wordt ondersteund; ongeldige DATABASE_URL: {url!r}")
    return url


def _uses_local_sqlite_file() -> bool:
    return ":memory:" not in _database_url()


engine = create_engine(_database_url(), connect_args={"check_same_thread": False})


def init_db():
    if _uses_local_sqlite_file():
        # If the DB schema changed (e.g. adding category column), remove old db file for fresh migration
        db_path = "./biologgr.db"
        if os.path.exists(db_path):
            try:
                # Check if category column exists, if not recreate
                import sqlite3
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("PRAGMA table_info(animal);")
                columns = [col[1] for col in cursor.fetchall()]
                conn.close()
                if columns and "category" not in columns:
                    os.remove(db_path)
                    return
                conn.close()
                # Migrate observation columns if missing
                conn2 = sqlite3.connect(db_path)
                cur2 = conn2.cursor()
                cur2.execute("PRAGMA table_info(observation);")
                obs_cols = [col[1] for col in cur2.fetchall()]
                if obs_cols and "is_wild" not in obs_cols:
                    cur2.execute("ALTER TABLE observation ADD COLUMN is_wild BOOLEAN NOT NULL DEFAULT 1")
                    conn2.commit()
                if obs_cols and "thumbnail_path" not in obs_cols:
                    cur2.execute("ALTER TABLE observation ADD COLUMN thumbnail_path TEXT")
                    conn2.commit()
                for col_name, col_def in (
                    ("iso", "INTEGER"),
                    ("aperture", "REAL"),
                    ("focal_length", "REAL"),
                    ("shutter_speed", "TEXT"),
                    ("camera_model", "TEXT"),
                ):
                    if obs_cols and col_name not in obs_cols:
                        cur2.execute(f"ALTER TABLE observation ADD COLUMN {col_name} {col_def}")
                        conn2.commit()
                conn2.close()
            except Exception:
                pass

    SQLModel.metadata.create_all(engine)

    if not _uses_local_sqlite_file():
        return

    # Ensure BadgeUnlock table exists (new table, safe to always run)
    try:
        import sqlite3
        db_path2 = "./biologgr.db"
        if os.path.exists(db_path2):
            conn3 = sqlite3.connect(db_path2)
            conn3.execute(
                "CREATE TABLE IF NOT EXISTS badgeunlock "
                "(id INTEGER PRIMARY KEY, badge_id TEXT NOT NULL UNIQUE, unlocked_at DATETIME)"
            )
            conn3.commit()
            conn3.close()
    except Exception:
        pass


def get_session():
    with Session(engine) as session:
        yield session
