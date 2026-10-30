"""FastAPI entrypoint for the RF Receiver Lab backend."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.routers import cascade, config, spectrum

app = FastAPI(
    title="RF Receiver Lab",
    version=__version__,
    description=(
        "Interactive RF receiver cascade / spectrum / IP3 analysis service. "
        "All math uses standard small-signal cascade models (Friis NF, "
        "cascaded IIP3, two-tone IM3)."
    ),
)

# Permissive CORS for local dev.  Vite proxies /api -> :8000 so in normal
# use the browser only ever talks to its own origin, but allowing all origins
# makes 'uvicorn + static html' debugging easier.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cascade.router)
app.include_router(config.router)
app.include_router(spectrum.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}
