"""Tests voor is_native / is_wild filtering in BioCLIP en identify-endpoint."""

import io

import pytest
import torch
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import Session, select

from main import app, get_session
from models import Animal
from services.bioclip_service import BioCLIPService


def _jpeg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color=(10, 20, 30)).save(buf, "JPEG")
    return buf.getvalue()


@pytest.fixture(name="filter_client")
def filter_client_fixture(session: Session):
    fox = session.exec(
        select(Animal).where(Animal.scientific_name == "Vulpes vulpes")
    ).first()
    fox.is_native = True
    session.add(fox)
    lion = Animal(
        scientific_name="Panthera leo",
        dutch_name="Leeuw",
        category="Zoogdieren",
        rarity="Algemeen",
        description="Exoot",
        is_native=False,
    )
    session.add(lion)
    session.commit()
    session.refresh(lion)

    class FakeBioCLIP:
        is_ready = True
        load_error = None

        def predict(self, image_bytes: bytes, top_k: int = 3, native_only: bool = False):
            native = {
                "animal_id": fox.id,
                "dutch_name": "Rode Vos",
                "scientific_name": "Vulpes vulpes",
                "confidence": 0.9,
            }
            exotic = {
                "animal_id": lion.id,
                "dutch_name": "Leeuw",
                "scientific_name": "Panthera leo",
                "confidence": 0.85,
            }
            if native_only:
                return [native]
            return [exotic, native]

    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    import backend.main as main_mod

    main_mod.bioclip = FakeBioCLIP()
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.mark.skip(reason="is_wild filtering op /api/identify is nog niet geïmplementeerd")
def test_identify_wild_returns_only_native(filter_client: TestClient):
    res = filter_client.post(
        "/api/identify?is_wild=true",
        files={"file": ("x.jpg", _jpeg_bytes(), "image/jpeg")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert len(data["suggestions"]) == 1
    assert data["suggestions"][0]["scientific_name"] == "Vulpes vulpes"


@pytest.mark.skip(reason="is_wild filtering op /api/identify is nog niet geïmplementeerd")
def test_identify_zoo_includes_exotic(filter_client: TestClient):
    res = filter_client.post(
        "/api/identify?is_wild=false",
        files={"file": ("x.jpg", _jpeg_bytes(), "image/jpeg")},
    )
    assert res.status_code == 200
    suggestions = res.json()["suggestions"]
    assert any(s["scientific_name"] == "Panthera leo" for s in suggestions)


@pytest.mark.skip(reason="BioCLIP native_only filtering is nog niet geïmplementeerd")
def test_bioclip_top_k_native_only_masks_exotic():
    svc = BioCLIPService()
    svc.is_ready = True
    svc._torch = torch
    svc._species = [
        {"animal_id": 1, "dutch_name": "Leeuw", "scientific_name": "Panthera leo", "is_native": False},
        {"animal_id": 2, "dutch_name": "Vos", "scientific_name": "Vulpes vulpes", "is_native": True},
    ]
    sims = torch.tensor([0.9, 0.5])
    wild = svc._top_k_from_sims(sims, top_k=2, native_only=True)
    assert len(wild) == 1
    assert wild[0]["scientific_name"] == "Vulpes vulpes"

    all_results = svc._top_k_from_sims(sims, top_k=2, native_only=False)
    assert len(all_results) == 2
    assert all_results[0]["scientific_name"] == "Panthera leo"
