from sqlmodel import SQLModel, create_engine, Session
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./biologgr.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

def init_db():
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
            # Migrate: add is_wild if missing
            cursor.execute("PRAGMA table_info(observation);")
            obs_cols = [col[1] for col in cursor.fetchall()]
            if obs_cols and "is_wild" not in obs_cols:
                cursor.execute("ALTER TABLE observation ADD COLUMN is_wild BOOLEAN NOT NULL DEFAULT 1")
                conn.commit()
            conn.close()
        except Exception:
            pass

    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
