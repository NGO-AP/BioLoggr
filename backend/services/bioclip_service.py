"""
bioclip_service.py — BioCLIP zero-shot soortidentificatie voor BioLoggr

Laad het model 'hf-hub:imageomics/bioclip' via open_clip.
Cacht tekst-embeddings voor alle DB-soorten op schijf zodat
identficatie per request snel is (~50 ms op CPU).

Gebruik:
    from backend.services.bioclip_service import bioclip
    bioclip.load_in_background(animals)   # tijdens startup
    result = bioclip.predict(image_bytes)  # per request
"""

import hashlib
import io
import json
import logging
import threading
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

CACHE_DIR  = Path("backend/data")
CACHE_PT   = CACHE_DIR / "embeddings_cache.pt"
CACHE_META = CACHE_DIR / "embeddings_meta.json"

MODEL_NAME = "hf-hub:imageomics/bioclip"


class BioCLIPService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.is_ready    = False
        self.is_loading  = False
        self.load_error: Optional[str] = None

        # Interne state — alleen toegankelijk na is_ready
        self._model       = None
        self._preprocess  = None
        self._tokenizer   = None
        self._text_feats  = None   # Tensor (n_species, embed_dim)
        self._species: list[dict] = []   # [{animal_id, dutch_name, scientific_name}]

        # Lazy imports
        self._torch = None
        self._F     = None
        self._Image = None

    # ── Publieke API ──────────────────────────────────────────────────────────

    def load_in_background(self, animals: list) -> None:
        """Start model + embeddings laden in een daemon-thread."""
        t = threading.Thread(target=self._load, args=(list(animals),), daemon=True)
        t.start()

    def predict(self, image_bytes: bytes, top_k: int = 3) -> list[dict]:
        """
        Identificeer soort uit afbeelding-bytes.
        Retourneert [{ animal_id, dutch_name, scientific_name, confidence }]
        gesorteerd op aflopende betrouwbaarheid.
        """
        if not self.is_ready:
            return []

        torch = self._torch
        F     = self._F
        Image = self._Image

        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img_tensor = self._preprocess(image).unsqueeze(0)

            with torch.no_grad():
                img_feat = self._model.encode_image(img_tensor)
                img_feat = F.normalize(img_feat, dim=-1)

            # Cosinus-gelijkenis over alle soorten
            sims = (img_feat @ self._text_feats.T).squeeze(0)

            k = min(top_k, len(self._species))
            top_sims, top_idx = torch.topk(sims, k)

            # Normaliseer top-k zodat de weergave-percentages optellen tot 100 %
            top_probs = torch.softmax(top_sims * 40, dim=0)

            return [
                {
                    **self._species[int(idx)],
                    "confidence": float(prob),
                }
                for prob, idx in zip(top_probs, top_idx)
            ]
        except Exception as exc:
            logger.warning(f"BioCLIP predict fout: {exc}")
            return []

    # ── Privé: laden & embeddings ─────────────────────────────────────────────

    def _load(self, animals: list) -> None:
        with self._lock:
            if self.is_ready or self.is_loading:
                return
            self.is_loading = True

        try:
            import open_clip
            import torch
            import torch.nn.functional as F
            from PIL import Image

            self._torch = torch
            self._F     = F
            self._Image = Image

            logger.info("BioCLIP: model laden (bij eerste gebruik ~enkele minuten)…")
            model, _, preprocess = open_clip.create_model_and_transforms(MODEL_NAME)
            tokenizer = open_clip.get_tokenizer(MODEL_NAME)
            model.eval()

            self._model      = model
            self._preprocess = preprocess
            self._tokenizer  = tokenizer

            self._build_or_load_embeddings(animals)

            with self._lock:
                self.is_ready   = True
                self.is_loading = False

            logger.info(f"BioCLIP: klaar — {len(self._species)} soorten gecached.")

        except ImportError as exc:
            msg = f"open_clip of torch niet geïnstalleerd: {exc}"
            logger.warning(f"BioCLIP niet beschikbaar: {msg}")
            with self._lock:
                self.load_error = msg
                self.is_loading = False

        except Exception as exc:
            logger.error(f"BioCLIP laden mislukt: {exc}", exc_info=True)
            with self._lock:
                self.load_error = str(exc)
                self.is_loading = False

    def _species_hash(self, animals: list) -> str:
        names = sorted(a.scientific_name for a in animals)
        return hashlib.md5(json.dumps(names).encode()).hexdigest()[:16]

    def _build_or_load_embeddings(self, animals: list) -> None:
        import torch
        import torch.nn.functional as F

        current_hash = self._species_hash(animals)

        # Probeer schijfcache te laden
        if CACHE_PT.exists() and CACHE_META.exists():
            try:
                meta = json.loads(CACHE_META.read_text())
                if meta.get("hash") == current_hash:
                    cached = torch.load(CACHE_PT, weights_only=False)
                    self._text_feats = cached["text_feats"]
                    self._species    = cached["species"]
                    logger.info("BioCLIP: embeddings geladen uit schijfcache.")
                    return
            except Exception as exc:
                logger.warning(f"Cache lezen mislukt, opnieuw bouwen: {exc}")

        # Bouw embeddings (batch per 64 om OOM te vermijden)
        logger.info(f"BioCLIP: tekst-embeddings bouwen voor {len(animals)} soorten…")
        prompts = [f"a photo of {a.scientific_name}" for a in animals]
        species_meta = [
            {"animal_id": a.id, "dutch_name": a.dutch_name, "scientific_name": a.scientific_name}
            for a in animals
        ]

        batch_size = 64
        all_feats: list = []

        with torch.no_grad():
            for i in range(0, len(prompts), batch_size):
                batch_prompts = prompts[i : i + batch_size]
                tokens = self._tokenizer(batch_prompts)
                feats  = self._model.encode_text(tokens)
                feats  = F.normalize(feats, dim=-1)
                all_feats.append(feats)

        text_feats = torch.cat(all_feats, dim=0)

        # Opslaan op schijf
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        torch.save({"text_feats": text_feats, "species": species_meta}, CACHE_PT)
        CACHE_META.write_text(json.dumps({"hash": current_hash, "n": len(animals)}))

        self._text_feats = text_feats
        self._species    = species_meta
        logger.info("BioCLIP: embeddings opgeslagen in cache.")


# Globale singleton — geïmporteerd door main.py
bioclip = BioCLIPService()
