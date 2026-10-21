"""
BioLoggr — Modal.com deployment

Serves the FastAPI backend, production Angular static assets, and BioCLIP (CPU).
Set Modal secret ``biologgr-turso`` with TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.
User uploads are stored on Modal Volume ``biologgr-images`` (mounted at UPLOADS_MOUNT).
"""

from pathlib import Path

import modal

APP_NAME = "biologgr"
ROOT = Path(__file__).resolve().parent

turso_secret = modal.Secret.from_name("biologgr-turso")
images_volume = modal.Volume.from_name("biologgr-images", create_if_missing=True)

UPLOADS_MOUNT = "/app/backend/uploads"

app = modal.App(APP_NAME)


def _preload_bioclip_weights() -> None:
    """Download BioCLIP weights into the image so cold starts skip HF fetch."""
    import open_clip

    open_clip.create_model_and_transforms("hf-hub:imageomics/bioclip")


image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install(
        "curl",
        "ca-certificates",
        "gnupg",
        "gcc",
        "libglib2.0-0",
        "libgomp1",
    )
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y --no-install-recommends nodejs",
        "rm -rf /var/lib/apt/lists/*",
    )
    .pip_install_from_requirements(
        str(ROOT / "backend" / "requirements.txt"),
        extra_index_url="https://download.pytorch.org/whl/cpu",
    )
    .env({"PYTHONPATH": "/app", "PYTHONUNBUFFERED": "1"})
    .workdir("/app")
    .add_local_dir(
        str(ROOT / "backend"),
        remote_path="/app/backend",
        ignore=["uploads/*", "__pycache__", "**/__pycache__"],
    )
    .add_local_dir(
        str(ROOT / "frontend"),
        remote_path="/build/frontend",
        ignore=["node_modules", "dist", ".angular", "test-results", "playwright-report"],
    )
    .run_commands(
        "cd /build/frontend && npm ci && npm run build",
        "mkdir -p /app/backend/static",
        "cp -r /build/frontend/dist/frontend/browser/. /app/backend/static/",
        r"find /app/backend/static -type f -name '*.js' "
        r"-exec sed -i 's|http://localhost:8000||g' {} +",
    )
    .run_function(_preload_bioclip_weights, timeout=60 * 30)
)


@app.function(
    image=image,
    secrets=[turso_secret],
    volumes={UPLOADS_MOUNT: images_volume},
    cpu=4.0,
    memory=8192,
    timeout=60 * 10,
    scaledown_window=60 * 10,
    min_containers=0,
)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def web():
    import os

    os.chdir("/app")
    os.makedirs(UPLOADS_MOUNT, exist_ok=True)

    from backend.upload_storage import register_upload_commit

    register_upload_commit(images_volume.commit)

    from backend.seed import run_seed

    run_seed()

    from backend.main import app as fastapi_app

    return fastapi_app
