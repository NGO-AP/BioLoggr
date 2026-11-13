import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlmodel.pool import StaticPool

from backend import auth
from backend.main import app, get_session
from backend.models import Animal, Badge

TEST_PASSWORD = "test-password"
TEST_SECRET = "test-secret-key-for-pytest"


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


@pytest.fixture(autouse=True)
def auth_env(monkeypatch):
    auth._failed_attempts.clear()
    monkeypatch.setenv("ADMIN_PASSWORD", TEST_PASSWORD)
    monkeypatch.setenv("AUTH_SECRET_KEY", TEST_SECRET)


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(client: TestClient):
    response = client.post("/api/auth/login", json={"password": TEST_PASSWORD})
    return {"Authorization": f"Bearer {response.json()['token']}"}
