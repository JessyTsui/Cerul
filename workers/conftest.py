import sys
from pathlib import Path

# Add the repository root so cross-package imports like `backend.app.embedding`
# resolve correctly when running workers tests.
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
