import sys
from pathlib import Path

# Garante que `main` e `cifraclub_search` sejam importáveis a partir de qualquer CWD
# (ex.: `py -m pytest scraper` na raiz do repo).
sys.path.insert(0, str(Path(__file__).resolve().parent))
