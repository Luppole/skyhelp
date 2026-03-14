"""
Entry point for the SkyHelper Discord bot.

Usage:
    # From the repo root:
    python -m backend.run_bot

    # Or directly:
    python backend/run_bot.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.discord_bot.bot import main

if __name__ == "__main__":
    main()
