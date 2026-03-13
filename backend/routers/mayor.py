"""Mayor & SkyBlock election tracker."""
import httpx
from fastapi import APIRouter, HTTPException, Request
from ..limiter import limiter
from ..utils.cache import cached

router = APIRouter(prefix="/mayor", tags=["mayor"])

ELECTION_URL = "https://api.hypixel.net/v2/resources/skyblock/election"

# SkyBlock event calendar (approximate recurring dates)
EVENTS = [
    {"name": "Zoo Event",           "icon": "🦁", "desc": "Special animals spawn"},
    {"name": "Spooky Festival",     "icon": "🎃", "desc": "Farming + candy drop event, last week of Oct"},
    {"name": "New Year Celebration","icon": "🎆", "desc": "Fireworks in the Hub"},
    {"name": "Winter Island",       "icon": "❄️",  "desc": "Jerry's Workshop, gifts, minigames"},
    {"name": "Traveling Zoo",       "icon": "🐾", "desc": "Rare animals appear near farms"},
    {"name": "Election Cycle",      "icon": "🗳️", "desc": "Vote for next SkyBlock Mayor"},
    {"name": "Dark Auction",        "icon": "🔮", "desc": "Midnight rare item auction in Hub"},
    {"name": "Mining Fiesta",       "icon": "⛏️",  "desc": "Double mining XP + rare ores"},
]

MAYOR_TIPS = {
    "Derpy": "Skill XP x3 — best time to grind skills. AH prices spike.",
    "Diana": "Mythological Ritual is active — farm Griffin pets & inquisitors.",
    "Finnegan": "Farming contest rewards boosted — push farming skill.",
    "Technoblade": "Slayer XP +20% — grind slayers efficiently.",
    "Paul": "EZPZ +35% Combat XP — grind combat skill & dungeons.",
    "Cole": "Mining XP +20% — best time to mine.",
    "Aatrox": "Slayer quests give double XP — farm all slayers.",
    "Marina": "Fishing XP +20% — fish in the hub / sea creature hunting.",
    "Foxy": "Increased auction house traffic — list items with short durations.",
    "Jerry": "Random events — Jerry boxes spawn for extra loot.",
}


async def _fetch_election() -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(ELECTION_URL)
        if not r.is_success:
            raise ValueError(f"Hypixel election API returned {r.status_code}")
        return r.json()


@router.get("")
@limiter.limit("30/minute")
async def get_mayor(request: Request):
    """Return current SkyBlock mayor + election data."""
    try:
        data = await cached("mayor", 120, _fetch_election)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    mayor = data.get("mayor", {})
    election = data.get("current", {})

    current_name = mayor.get("name", "Unknown")
    perks = [
        {"name": p.get("name"), "description": p.get("description")}
        for p in mayor.get("perks", [])
    ]
    minister = mayor.get("minister", {})

    candidates = []
    for c in election.get("candidates", []):
        candidates.append({
            "name": c.get("name"),
            "votes": c.get("votes", 0),
            "perks": [
                {"name": p.get("name"), "description": p.get("description")}
                for p in c.get("perks", [])
            ],
        })
    # sort by votes desc
    candidates.sort(key=lambda x: x["votes"], reverse=True)

    total_votes = sum(c["votes"] for c in candidates) or 1
    for c in candidates:
        c["vote_pct"] = round(c["votes"] / total_votes * 100, 1)

    return {
        "mayor": {
            "name": current_name,
            "perks": perks,
            "minister": {
                "name": minister.get("name"),
                "perk": minister.get("perk", {}).get("name"),
            } if minister else None,
            "year": mayor.get("election", {}).get("year"),
            "tip": MAYOR_TIPS.get(current_name, "Check wiki for mayor-specific strategies."),
        },
        "election": {
            "year": election.get("year"),
            "candidates": candidates,
        },
        "events": EVENTS,
    }
