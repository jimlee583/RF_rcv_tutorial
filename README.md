# RF Receiver Lab

An interactive educational tool for exploring RF receiver architecture
(gain distribution, noise figure, IIP3/OIP3, SFDR, mixer conversion,
and two-tone intermodulation).

- **Backend:** Python 3.12, FastAPI, NumPy/SciPy, Pydantic
- **Frontend:** React + TypeScript + Vite + Plotly.js
- **Tests:** pytest (backend), `tsc --noEmit` + Vite build (frontend)

See [docs/overview](#features) below for the feature set, and the
"Engineering notes" section for the modeling assumptions and limitations.

## Quick start

Full setup instructions for macOS and Windows will be added at the end of
Phase 4. For now:

```bash
# Backend
cd backend
python3.12 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

## Features

- Editable receiver signal chain (antenna, filter, LNA, mixer, IF filter,
  IF amp, output) with cumulative gain / NF / IIP3 after each stage.
- Cascaded Friis noise figure, cascaded IIP3/OIP3, thermal noise floor,
  and third-order SFDR.
- Interactive RF and IF spectrum analyzer with two-tone IM3, LO
  harmonics, and illustrative mixer spurs.
- IP3/SFDR visualization with fundamental (1 dB/dB) and IM3 (3 dB/dB)
  curves, noise floor, and SFDR annotation.
- Learning panel with explanations of all key concepts.
- Save / load / export receiver configurations as JSON and CSV.

## Engineering notes

This tool uses standard small-signal cascade models. Important
limitations:

- IP3 is an extrapolated small-signal metric; it is not a saturation
  power. Results above roughly IP1dB are not physical.
- Cascaded P1dB is reported as an estimate (first-compressing stage),
  not a sum of individual P1dB values.
- Mixer spurs and LO harmonic suppression values are illustrative unless
  the user provides a measured spur table.
- Frequency responses are flat within each component's declared band.

See the "Learn" tab in the app for full discussion.
