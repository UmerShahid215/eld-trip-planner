"""Make the backend directory importable so `import hos_engine` works in tests."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
