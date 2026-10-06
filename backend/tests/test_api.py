import os
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlmodel.pool import StaticPool

from backend.main import app, get_session
from backend.models import Animal, Observation, Badge

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
            name="Test Badge",
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
    assert response.json() == {"status": "ok", "service": "BioLoggr API"}

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
    assert len(data) >= 1
    assert data[0]["name"] == "Test Badge"

def test_create_observation(client: TestClient, tmp_path):
    # Create a dummy image file
    dummy_img = tmp_path / "test_fox.jpg"
    dummy_img.write_bytes(b"\xff\xd8\xff\xe0\x00\x10JFIF") # Minimal JPEG header bytes

    with open(dummy_img, "rb") as f:
        response = client.post(
            "/api/observations?latitude=51.2194&longitude=4.4025&notes=Test+observation",
            files={"file": ("test_fox.jpg", f, "image/jpeg")}
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["latitude"] == 51.2194
    assert data["longitude"] == 4.4025
    assert data["confidence"] > 0.0
    assert "image_path" in data
