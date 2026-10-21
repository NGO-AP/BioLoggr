"""Optional hook to persist upload directory changes (e.g. Modal Volume commit)."""

from collections.abc import Awaitable, Callable

_commit_fn: Callable[[], Awaitable[None]] | None = None


def register_upload_commit(callback: Callable[[], Awaitable[None]]) -> None:
    global _commit_fn
    _commit_fn = callback


async def commit_uploads_if_configured() -> None:
    if _commit_fn is not None:
        await _commit_fn()
