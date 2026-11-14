"""test_badges.py — Unit tests for the badge evaluation engine."""
import io
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from main import app, get_session
from models import Animal, BadgeUnlock, Observation
from services.badge_service import (
    BADGE_REGISTRY,
    evaluate_unlocked_badge_ids,
    get_badges_with_progress,
    get_stats,
    _is_bat,
    _is_water_bird,
    _is_raptor,
    _is_butterfly,
    _is_dragonfly,
    _is_bee,
    _is_snake,
    _is_frog_toad,
)


# ─── Fixtures ────────────────────────────────────────────────────────────────

def _make_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def _make_jpeg() -> bytes:
    img = Image.new("RGB", (50, 50), color=(100, 150, 50))
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


@pytest.fixture(name="session")
def session_fixture():
    engine = _make_engine()
    with Session(engine) as session:
        yield session


@pytest.fixture(name="session_with_animals")
def session_with_animals_fixture():
    engine = _make_engine()
    with Session(engine) as session:
        animals = [
            Animal(scientific_name="Vulpes vulpes", dutch_name="Rode Vos",
                   category="Zoogdieren", rarity="Vrij algemeen", description="Vos"),
            Animal(scientific_name="Buteo buteo", dutch_name="Buizerd",
                   category="Vogels", rarity="Vrij algemeen", description="Roofvogel"),
            Animal(scientific_name="Anas platyrhynchos", dutch_name="Wilde Eend",
                   category="Vogels", rarity="Vrij algemeen", description="Eend"),
            Animal(scientific_name="Erithacus rubecula", dutch_name="Roodborst",
                   category="Vogels", rarity="Vrij algemeen", description="Zangvogel"),
            Animal(scientific_name="Pieris brassicae", dutch_name="Groot Koolwitje",
                   category="Insecten", rarity="Vrij algemeen", description="Vlinder"),
            Animal(scientific_name="Bombus terrestris", dutch_name="Aardhommel",
                   category="Insecten", rarity="Vrij algemeen", description="Hommel"),
            Animal(scientific_name="Rana temporaria", dutch_name="Bruine Kikker",
                   category="Reptielen & Amfibieën", rarity="Vrij algemeen", description="Kikker"),
            Animal(scientific_name="Natrix natrix", dutch_name="Ringslang",
                   category="Reptielen & Amfibieën", rarity="Zeldzaam", description="Slang"),
            Animal(scientific_name="Pipistrellus pipistrellus", dutch_name="Gewone Dwergvleermuis",
                   category="Zoogdieren", rarity="Zeldzaam", description="Vleermuis"),
            Animal(scientific_name="Capreolus capreolus", dutch_name="Ree",
                   category="Zoogdieren", rarity="Vrij algemeen", description="Ree"),
        ]
        for a in animals:
            session.add(a)
        session.commit()
        for a in animals:
            session.refresh(a)
        yield session


@pytest.fixture(name="client")
def client_fixture(session_with_animals: Session):
    def override():
        return session_with_animals
    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


# ─── Taxonomy helper tests ────────────────────────────────────────────────────

def test_is_raptor():
    a = Animal(scientific_name="Buteo buteo", dutch_name="Buizerd",
               category="Vogels", rarity="Vrij algemeen", description="")
    assert _is_raptor(a)


def test_is_water_bird():
    a = Animal(scientific_name="Anas platyrhynchos", dutch_name="Wilde Eend",
               category="Vogels", rarity="Vrij algemeen", description="")
    assert _is_water_bird(a)


def test_is_not_water_bird_mammal():
    a = Animal(scientific_name="Lutra lutra", dutch_name="Otter",
               category="Zoogdieren", rarity="Zeldzaam", description="")
    assert not _is_water_bird(a)


def test_is_butterfly():
    a = Animal(scientific_name="Pieris brassicae", dutch_name="Groot Koolwitje",
               category="Insecten", rarity="Vrij algemeen", description="")
    assert _is_butterfly(a)


def test_is_dragonfly():
    a = Animal(scientific_name="Anax imperator", dutch_name="Grote Keizerlibel",
               category="Insecten", rarity="Vrij algemeen", description="")
    assert _is_dragonfly(a)


def test_is_bee():
    a = Animal(scientific_name="Bombus terrestris", dutch_name="Aardhommel",
               category="Insecten", rarity="Vrij algemeen", description="")
    assert _is_bee(a)


def test_is_bat():
    a = Animal(scientific_name="Pipistrellus pipistrellus", dutch_name="Gewone Dwergvleermuis",
               category="Zoogdieren", rarity="Zeldzaam", description="")
    assert _is_bat(a)


def test_is_snake():
    a = Animal(scientific_name="Natrix natrix", dutch_name="Ringslang",
               category="Reptielen & Amfibieën", rarity="Zeldzaam", description="")
    assert _is_snake(a)


def test_is_frog():
    a = Animal(scientific_name="Rana temporaria", dutch_name="Bruine Kikker",
               category="Reptielen & Amfibieën", rarity="Vrij algemeen", description="")
    assert _is_frog_toad(a)


# ─── evaluate_unlocked_badge_ids tests ───────────────────────────────────────

def test_no_badges_when_empty(session: Session):
    """With no observations, no badges should be unlocked."""
    # Add minimal animals so totals are non-zero
    session.add(Animal(scientific_name="Vulpes vulpes", dutch_name="Vos",
                       category="Zoogdieren", rarity="Vrij algemeen", description=""))
    session.commit()
    unlocked = evaluate_unlocked_badge_ids(session)
    assert "first_discovery" not in unlocked
    assert len(unlocked) == 0


def test_first_discovery_unlocks(session_with_animals: Session):
    """Adding 1 observation should unlock first_discovery."""
    s = session_with_animals
    animals = s.exec(__import__("sqlmodel", fromlist=["select"]).select(Animal)).all()
    obs = Observation(animal_id=animals[0].id, image_path="/uploads/t.webp",
                      confidence=0.9, is_wild=True)
    s.add(obs)
    s.commit()
    unlocked = evaluate_unlocked_badge_ids(s)
    assert "first_discovery" in unlocked


def test_wild_tracker_badge(session_with_animals: Session):
    """5 wild observations should unlock tracker_wild_1."""
    s = session_with_animals
    animals = s.exec(__import__("sqlmodel", fromlist=["select"]).select(Animal)).all()
    for i in range(5):
        s.add(Observation(animal_id=animals[i % len(animals)].id,
                          image_path=f"/uploads/t{i}.webp",
                          confidence=0.8, is_wild=True))
    s.commit()
    unlocked = evaluate_unlocked_badge_ids(s)
    assert "tracker_wild_1" in unlocked
    assert "tracker_wild_2" not in unlocked


def test_all_rounder_badge(session_with_animals: Session):
    """1 obs in each category should unlock all_rounder_1."""
    s = session_with_animals
    animals_list = s.exec(__import__("sqlmodel", fromlist=["select"]).select(Animal)).all()
    # Find one from each category
    by_cat = {}
    for a in animals_list:
        if a.category not in by_cat:
            by_cat[a.category] = a
    for a in by_cat.values():
        s.add(Observation(animal_id=a.id, image_path="/uploads/x.webp",
                          confidence=0.7, is_wild=True))
    s.commit()
    unlocked = evaluate_unlocked_badge_ids(s)
    if len(by_cat) == 4:
        assert "all_rounder_1" in unlocked


def test_familiar_face_badge(session_with_animals: Session):
    """2 observations of the same animal unlocks familiar_face_1."""
    s = session_with_animals
    animals_list = s.exec(__import__("sqlmodel", fromlist=["select"]).select(Animal)).all()
    aid = animals_list[0].id
    for _ in range(2):
        s.add(Observation(animal_id=aid, image_path="/uploads/f.webp",
                          confidence=0.9, is_wild=True))
    s.commit()
    unlocked = evaluate_unlocked_badge_ids(s)
    assert "familiar_face_1" in unlocked


def test_ai_sharp_badge(session_with_animals: Session):
    """Observation with confidence >= 0.90 unlocks ai_sharp."""
    s = session_with_animals
    animals_list = s.exec(__import__("sqlmodel", fromlist=["select"]).select(Animal)).all()
    s.add(Observation(animal_id=animals_list[0].id, image_path="/uploads/ai.webp",
                      confidence=0.95, is_wild=True))
    s.commit()
    unlocked = evaluate_unlocked_badge_ids(s)
    assert "ai_sharp" in unlocked


# ─── GET /api/badges endpoint tests ──────────────────────────────────────────

def test_badges_endpoint_returns_67(client: TestClient):
    response = client.get("/api/badges")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 67


def test_badges_have_required_fields(client: TestClient):
    response = client.get("/api/badges")
    data = response.json()
    required = {"id", "title", "description", "category", "icon",
                "is_challenge", "unlocked", "current", "target", "percentage", "unlocked_at"}
    for badge in data:
        assert required.issubset(badge.keys()), f"Missing fields in {badge['id']}"


def test_badges_all_locked_initially(client: TestClient):
    """Without any observations, all badges should be locked."""
    response = client.get("/api/badges")
    data = response.json()
    assert all(not b["unlocked"] for b in data)


# ─── GET /api/stats endpoint tests ───────────────────────────────────────────

def test_stats_endpoint(client: TestClient):
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_observed" in data
    assert "total_codex" in data
    assert "badges_unlocked" in data
    assert "badges_total" in data
    assert data["badges_total"] == 67
    assert "by_category" in data
    assert "challenges_total" in data
    assert data["challenges_total"] == 9


# ─── POST /api/observations → newly_unlocked_badges tests ────────────────────

def test_observation_returns_newly_unlocked_badges(client: TestClient, auth_headers, tmp_path):
    """First observation should return first_discovery in newly_unlocked_badges."""
    jpeg = _make_jpeg()
    img_file = tmp_path / "test.jpg"
    img_file.write_bytes(jpeg)

    with open(img_file, "rb") as f:
        response = client.post(
            "/api/observations?latitude=51.2&longitude=4.4",
            files={"file": ("test.jpg", f, "image/jpeg")},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert "newly_unlocked_badges" in data
    assert isinstance(data["newly_unlocked_badges"], list)
    ids = [b["id"] for b in data["newly_unlocked_badges"]]
    assert "first_discovery" in ids


def test_second_observation_does_not_re_unlock_first_discovery(client: TestClient, auth_headers, tmp_path):
    """first_discovery should not appear in newly_unlocked_badges on the second call."""
    jpeg = _make_jpeg()

    def post_obs():
        img = tmp_path / f"img_{id(object())}.jpg"
        img.write_bytes(jpeg)
        with open(img, "rb") as f:
            return client.post(
                "/api/observations",
                files={"file": ("img.jpg", f, "image/jpeg")},
                headers=auth_headers,
            )

    post_obs()  # First observation — unlocks first_discovery
    r2 = post_obs()  # Second observation — should NOT re-unlock
    assert r2.status_code == 200
    ids = [b["id"] for b in r2.json()["newly_unlocked_badges"]]
    assert "first_discovery" not in ids


def test_badge_progress_updates_after_observation(client: TestClient, auth_headers, tmp_path):
    """Progress counters should increase after posting an observation."""
    before = client.get("/api/badges").json()
    first_b = next(b for b in before if b["id"] == "first_discovery")
    assert first_b["current"] == 0

    jpeg = _make_jpeg()
    img = tmp_path / "p.jpg"
    img.write_bytes(jpeg)
    with open(img, "rb") as f:
        client.post("/api/observations", files={"file": ("p.jpg", f, "image/jpeg")}, headers=auth_headers)

    after = client.get("/api/badges").json()
    first_a = next(b for b in after if b["id"] == "first_discovery")
    assert first_a["unlocked"] is True
    assert first_a["current"] >= 1
    assert first_a["percentage"] == 100
