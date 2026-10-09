import io
import os
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import SQLModel, create_engine, Session
from sqlmodel.pool import StaticPool

from backend.main import app, get_session
from backend.models import Animal, Observation, Badge


def _make_jpeg_bytes(width: int = 100, height: int = 100) -> bytes:
    """Genereer een geldig JPEG-plaatje in geheugen (voor tests)."""
    img = Image.new("RGB", (width, height), color=(120, 180, 60))
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Seed initial test data
        session.add(Animal(
            scientific_name="Vulpes vulpes",
            dutch_name="Rode Vos",
            rarity="Common",
            description="Test fox description",
            extra_info={"habitat": "Forest"}
        ))
        session.add(Badge(
            name="Eerste Waarneming",
            description="Test badge description",
            icon="🏆"
        ))
        session.commit()
        yield session

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_health_check(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "BioLoggr API"
    assert data["bioclip"] in ("ready", "loading", "unavailable")

def test_get_codex(client: TestClient):
    response = client.get("/api/codex")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["scientific_name"] == "Vulpes vulpes"
    assert "extra_info" in data[0]
    assert data[0]["extra_info"]["habitat"] == "Forest"

def test_get_badges(client: TestClient):
    response = client.get("/api/badges")
    assert response.status_code == 200
    data = response.json()
    # Nieuwe dynamische badge-engine retourneert alle 52 badges
    assert len(data) == 52
    # Verifieer de vereiste velden van het nieuwe formaat
    assert "id" in data[0]
    assert "title" in data[0]
    assert "unlocked" in data[0]
    assert "current" in data[0]
    assert "target" in data[0]
    assert "percentage" in data[0]
    assert "is_challenge" in data[0]

def test_create_observation(client: TestClient, tmp_path):
    jpeg_bytes = _make_jpeg_bytes()
    dummy_img = tmp_path / "test_fox.jpg"
    dummy_img.write_bytes(jpeg_bytes)

    with open(dummy_img, "rb") as f:
        response = client.post(
            "/api/observations?latitude=51.2194&longitude=4.4025&notes=Test+observation",
            files={"file": ("test_fox.jpg", f, "image/jpeg")}
        )

    assert response.status_code == 200
    data = response.json()
    assert "observation" in data
    assert "animal" in data
    assert data["observation"]["latitude"] == 51.2194
    assert data["observation"]["longitude"] == 4.4025
    assert data["observation"]["confidence"] > 0.0
    assert data["animal"]["scientific_name"] == "Vulpes vulpes"
    # Controleer dat afbeeldingspaden zijn opgeslagen
    assert data["observation"]["image_path"].endswith(".webp")
    assert data["observation"]["thumbnail_path"] is not None
    assert data["observation"]["thumbnail_path"].endswith("_thumb.webp")


def test_get_animal_detail_with_all_observations(client: TestClient, session: Session, tmp_path):
    # Maak een observatie aan en controleer dat het detail-endpoint all_observations teruggeeft
    animal = session.exec(
        __import__("sqlmodel", fromlist=["select"]).select(Animal).where(Animal.scientific_name == "Vulpes vulpes")
    ).first()
    obs = Observation(
        animal_id=animal.id,
        image_path="/uploads/test.webp",
        thumbnail_path="/uploads/test_thumb.webp",
        confidence=0.9,
        is_wild=True,
    )
    session.add(obs)
    session.commit()

    response = client.get(f"/api/codex/{animal.id}")
    assert response.status_code == 200
    data = response.json()
    assert "all_observations" in data
    assert len(data["all_observations"]) >= 1
    assert data["all_observations"][0]["thumbnail_path"] == "/uploads/test_thumb.webp"


def test_delete_observation(client: TestClient, session: Session):
    animal = session.exec(
        __import__("sqlmodel", fromlist=["select"]).select(Animal).where(Animal.scientific_name == "Vulpes vulpes")
    ).first()
    obs = Observation(
        animal_id=animal.id,
        image_path="/uploads/del_test.webp",
        thumbnail_path="/uploads/del_test_thumb.webp",
        confidence=0.85,
        is_wild=True,
    )
    session.add(obs)
    session.commit()
    session.refresh(obs)
    obs_id = obs.id

    response = client.delete(f"/api/observations/{obs_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["deleted_id"] == obs_id

    # Verifieer dat de waarneming uit de DB is verdwenen
    from sqlmodel import select as sel
    deleted = session.get(Observation, obs_id)
    assert deleted is None


def test_delete_observation_not_found(client: TestClient):
    response = client.delete("/api/observations/99999")
    assert response.status_code == 404
