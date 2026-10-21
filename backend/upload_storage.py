"""Optional hook to persist upload directory changes (e.g. Modal Volume commit)."""

from collections.abc import Callable

_commit_fn: Callable[[], None] | None = None


def register_upload_commit(callback: Callable[[], None]) -> None:
    global _commit_fn
    _commit_fn = callback


def commit_uploads_if_configured() -> None:
    if _commit_fn is not None:
        _commit_fn()
