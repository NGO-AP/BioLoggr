"""
reset_test_data.py — Verwijdert testwaarnemingen en badge-unlocks voor productie.

Wist alleen Observation- en BadgeUnlock-records. De Animal-tabel blijft ongewijzigd.

Gebruik (vanuit projectroot):
    python backend/reset_test_data.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlmodel import Session, delete

from database import engine
from models import BadgeUnlock, Observation


def main() -> None:
    with Session(engine) as session:
        obs_result = session.exec(delete(Observation))
        badge_result = session.exec(delete(BadgeUnlock))
        session.commit()
        obs_deleted = obs_result.rowcount if obs_result.rowcount is not None else "?"
        badges_deleted = badge_result.rowcount if badge_result.rowcount is not None else "?"

    print(
        "Succes: testdata gewist - "
        f"{obs_deleted} waarneming(en) en {badges_deleted} badge-unlock(s) verwijderd. "
        "De Animal-tabel is niet gewijzigd."
    )


if __name__ == "__main__":
    main()
