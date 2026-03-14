"""
SkyHelper Discord Bot
Slash commands that surface live Hypixel SkyBlock data from the SkyHelper API.

Run:
    python -m backend.run_bot

Required env vars:
    DISCORD_BOT_TOKEN        — bot token from Discord Developer Portal
    DISCORD_BOT_API_BASE     — base URL of the SkyHelper backend (default: http://localhost:8000)
    DISCORD_BOT_GUILD_ID     — (optional) guild ID for instant slash-cmd registration during dev
"""

import asyncio
import logging
import os

import httpx
import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

API_BASE  = os.environ.get("DISCORD_BOT_API_BASE", "http://localhost:8000").rstrip("/")
TOKEN     = os.environ.get("DISCORD_BOT_TOKEN", "")
_GUILD_ID = os.environ.get("DISCORD_BOT_GUILD_ID")
GUILD     = discord.Object(id=int(_GUILD_ID)) if _GUILD_ID else None

# ── Embed colours ─────────────────────────────────────────────────────────────
GOLD   = 0xF5C518
GREEN  = 0x22C55E
BLUE   = 0x3B82F6
RED    = 0xEF4444
PURPLE = 0xA855F7
ORANGE = 0xF97316


# ── Helpers ───────────────────────────────────────────────────────────────────

async def api(path: str, **params) -> dict:
    """Call the SkyHelper HTTP API and return parsed JSON."""
    url = f"{API_BASE}{path}"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params or None)
        r.raise_for_status()
        return r.json()


def coins(n: float | int) -> str:
    """Format a coin amount like the frontend formatCoins helper."""
    if n is None:
        return "0"
    n = float(n)
    if n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.2f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return f"{round(n):,}"


def item_label(item_id: str, max_len: int = 30) -> str:
    """Turn 'ENCHANTED_SUGAR_CANE' → 'Enchanted Sugar Cane'."""
    label = item_id.replace("_", " ").title()
    return label if len(label) <= max_len else label[: max_len - 1] + "…"


def err_embed(msg: str) -> discord.Embed:
    return discord.Embed(description=f"❌  {msg}", color=RED)


def truncate(s: str, n: int = 80) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


# ── Bot setup ─────────────────────────────────────────────────────────────────

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    log.info("Logged in as %s (id=%s)", bot.user, bot.user.id)
    try:
        if GUILD:
            bot.tree.copy_global_to(guild=GUILD)
            synced = await bot.tree.sync(guild=GUILD)
            log.info("Synced %d commands to guild %s", len(synced), _GUILD_ID)
        else:
            synced = await bot.tree.sync()
            log.info("Synced %d commands globally", len(synced))
    except Exception as exc:
        log.error("Failed to sync commands: %s", exc)


# ── Slash commands ────────────────────────────────────────────────────────────

@bot.tree.command(name="ping", description="Check bot and API health")
async def cmd_ping(interaction: discord.Interaction):
    await interaction.response.defer()
    try:
        health = await api("/healthz")
        up_s = int(health.get("uptime_seconds", 0))
        up_str = f"{up_s // 3600}h {(up_s % 3600) // 60}m"
        embed = discord.Embed(title="🏓  Pong!", color=BLUE)
        embed.add_field(name="Latency",  value=f"{round(bot.latency * 1000)} ms", inline=True)
        embed.add_field(name="API",      value=health.get("status", "ok").upper(), inline=True)
        embed.add_field(name="Uptime",   value=up_str, inline=True)
        embed.add_field(
            name="AH Index",
            value="✅ Ready" if health.get("ah_index_ready") else "⏳ Building…",
            inline=True,
        )
        embed.set_footer(text="SkyHelper")
    except Exception as exc:
        embed = err_embed(f"API unreachable — {exc}")
    await interaction.followup.send(embed=embed)


@bot.tree.command(name="mayor", description="Current SkyBlock mayor, perks, and election standings")
async def cmd_mayor(interaction: discord.Interaction):
    await interaction.response.defer()
    try:
        data = await api("/mayor")
        mayor = data["mayor"]

        embed = discord.Embed(
            title=f"🗳️  Mayor: {mayor['name']}",
            color=GOLD,
        )

        # Perks
        perk_lines = "\n".join(
            f"**{p['name']}** — {truncate(p['description'], 80)}"
            for p in mayor.get("perks", [])
        )
        if perk_lines:
            embed.add_field(name="Perks", value=perk_lines, inline=False)

        # Tip
        if mayor.get("tip"):
            embed.add_field(name="💡 Strategy Tip", value=mayor["tip"], inline=False)

        # Minister
        minister = mayor.get("minister")
        if minister and minister.get("name"):
            embed.add_field(
                name="Minister",
                value=f"{minister['name']} — {minister.get('perk', '—')}",
                inline=False,
            )

        # Election candidates (top 3)
        candidates = data.get("election", {}).get("candidates", [])[:3]
        if candidates:
            cand_lines = "\n".join(
                f"**{c['name']}** — {c['vote_pct']:.1f}%"
                for c in candidates
            )
            embed.add_field(name="📊 Election Standings", value=cand_lines, inline=False)

        year = mayor.get("year")
        if year:
            embed.set_footer(text=f"SkyBlock Year {year}")
    except Exception as exc:
        embed = err_embed(str(exc))
    await interaction.followup.send(embed=embed)


@bot.tree.command(name="flip", description="Top bazaar flip opportunities ranked by profit")
@app_commands.describe(limit="Number of flips to show (1–20, default 10)")
async def cmd_flip(interaction: discord.Interaction, limit: int = 10):
    await interaction.response.defer()
    limit = max(1, min(limit, 20))
    try:
        data = await api("/bazaar/flips", min_volume=1000, min_margin=2, limit=limit)
        flips = data.get("flips", [])[:limit]

        embed = discord.Embed(
            title=f"📈  Top {limit} Bazaar Flips",
            color=GOLD,
            description=f"{data.get('count', '?')} flips available right now",
        )
        for flip in flips:
            embed.add_field(
                name=item_label(flip["item_id"]),
                value=(
                    f"Buy  `{coins(flip['sell_price'])}`\n"
                    f"Sell `{coins(flip['buy_price'])}`\n"
                    f"Margin `{flip['margin_pct']:.1f}%`\n"
                    f"Profit `{coins(flip['profit_per_item'])}`/item"
                ),
                inline=True,
            )
        embed.set_footer(text="Prices update every 90 s · SkyHelper")
    except Exception as exc:
        embed = err_embed(str(exc))
    await interaction.followup.send(embed=embed)


@bot.tree.command(name="bazaar", description="Look up live Bazaar prices for any item")
@app_commands.describe(item="Item name or ID (e.g. 'sugar cane', 'ENCHANTED_DIAMOND')")
async def cmd_bazaar(interaction: discord.Interaction, item: str):
    await interaction.response.defer()
    try:
        # Fetch a broad list so we can do name matching
        data = await api("/bazaar/flips", min_volume=0, min_margin=0, limit=500)
        flips = data.get("flips", [])

        query_id   = item.strip().upper().replace(" ", "_")
        query_name = item.strip().lower()

        # Priority 1: exact item_id match
        match = next((f for f in flips if f["item_id"].upper() == query_id), None)
        # Priority 2: item_id starts-with
        if not match:
            match = next((f for f in flips if f["item_id"].upper().startswith(query_id)), None)
        # Priority 3: item_id contains query (after replacing spaces)
        if not match:
            match = next(
                (f for f in flips if query_name.replace(" ", "_") in f["item_id"].lower()),
                None,
            )
        # Priority 4: human-readable name contains query
        if not match:
            match = next(
                (f for f in flips if query_name in f["item_id"].replace("_", " ").lower()),
                None,
            )

        if not match:
            await interaction.followup.send(
                embed=err_embed(f"No Bazaar item found matching **{item}**. Try the full item ID."),
            )
            return

        vol = match.get("weekly_volume", 0)
        embed = discord.Embed(
            title=f"💰  {item_label(match['item_id'], 40)}",
            color=GREEN,
        )
        embed.add_field(name="Instant Buy",  value=f"`{coins(match['sell_price'])}`",          inline=True)
        embed.add_field(name="Instant Sell", value=f"`{coins(match['buy_price'])}`",           inline=True)
        embed.add_field(name="Margin",       value=f"`{match['margin_pct']:.1f}%`",             inline=True)
        embed.add_field(name="Profit/item",  value=f"`{coins(match['profit_per_item'])}`",     inline=True)
        embed.add_field(name="Profit/1M",    value=f"`{coins(match.get('profit_per_million_invested', 0))}`", inline=True)
        embed.add_field(name="Weekly Vol",   value=f"`{vol:,.0f}`",                            inline=True)
        embed.set_footer(text=f"ID: {match['item_id']} · SkyHelper")
    except Exception as exc:
        embed = err_embed(str(exc))
    await interaction.followup.send(embed=embed)


@bot.tree.command(name="sniper", description="Live AH sniper — items listed well below market value")
@app_commands.describe(
    min_profit="Minimum profit in coins (default 500 000)",
    threshold="Max % of market value to show (default 20)",
)
async def cmd_sniper(
    interaction: discord.Interaction,
    min_profit: int = 500_000,
    threshold: int = 20,
):
    await interaction.response.defer()
    try:
        data = await api(
            "/auctions/sniper",
            threshold=threshold,
            min_profit=min_profit,
            limit=8,
        )
        deals = data.get("deals") or data.get("results") or data.get("items") or []
        if not deals:
            await interaction.followup.send(
                embed=discord.Embed(
                    description="🎯  No sniper deals found right now — try lowering `min_profit`.",
                    color=ORANGE,
                )
            )
            return

        embed = discord.Embed(
            title="🎯  AH Sniper — Best Deals",
            color=PURPLE,
            description=f"Items listed **≤{threshold}%** of market value · min profit `{coins(min_profit)}`",
        )
        for deal in deals[:8]:
            name = truncate(
                deal.get("item_name") or item_label(deal.get("item_id", "Unknown")), 28
            )
            bid      = deal.get("price") or deal.get("bid") or 0
            ref      = deal.get("estimated_value") or deal.get("ref_price") or 0
            discount = deal.get("discount_pct") or deal.get("savings_pct") or 0
            profit   = deal.get("profit") or (ref - bid)
            embed.add_field(
                name=name,
                value=(
                    f"Bid  `{coins(bid)}`\n"
                    f"Est  `{coins(ref)}`\n"
                    f"Save `{discount:.0f}%`\n"
                    f"Profit `{coins(profit)}`"
                ),
                inline=True,
            )
        embed.set_footer(text="AH index refreshes every 60 s · SkyHelper")
    except Exception as exc:
        embed = err_embed(str(exc))
    await interaction.followup.send(embed=embed)


@bot.tree.command(name="player", description="SkyBlock player profile and net worth")
@app_commands.describe(ign="Minecraft username (IGN)")
async def cmd_player(interaction: discord.Interaction, ign: str):
    await interaction.response.defer()
    try:
        player = await api(f"/player/{ign}")
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            await interaction.followup.send(embed=err_embed(f"Player **{ign}** not found."))
        else:
            await interaction.followup.send(embed=err_embed(str(exc)))
        return
    except Exception as exc:
        await interaction.followup.send(embed=err_embed(str(exc)))
        return

    embed = discord.Embed(
        title=f"👤  {ign}",
        color=BLUE,
    )
    embed.set_thumbnail(url=f"https://mc-heads.net/avatar/{ign}/64")

    # Rank / network level
    rank = (
        player.get("rank")
        or player.get("newPackageRank")
        or player.get("packageRank")
        or "None"
    )
    embed.add_field(name="Rank", value=f"`{rank}`", inline=True)

    # Profiles
    profiles = player.get("profiles", [])
    if profiles:
        embed.add_field(name="Profiles", value=str(len(profiles)), inline=True)

    # Fairy souls
    fairy = player.get("fairy_souls") or player.get("fairy_souls_collected")
    if fairy is not None:
        embed.add_field(name="Fairy Souls", value=str(fairy), inline=True)

    # Skill average
    skill_avg = player.get("skill_avg") or player.get("average_skill_level")
    if skill_avg is not None:
        embed.add_field(name="Skill Avg", value=f"{float(skill_avg):.1f}", inline=True)

    # Net worth (try fetching it)
    if profiles:
        try:
            profile_id = profiles[0].get("profile_id") or profiles[0].get("cute_name")
            nw_data = await api(f"/player/{ign}/networth", profile_id=profile_id)
            nw = nw_data.get("networth") or nw_data.get("total") or nw_data.get("net_worth")
            if nw:
                embed.add_field(name="Net Worth", value=f"`{coins(nw)}`", inline=True)
        except Exception:
            pass  # net worth is optional

    # Skills block
    skills = player.get("skills") or {}
    if skills:
        skill_lines = []
        for sk, lvl in list(skills.items())[:6]:
            skill_lines.append(f"`{sk.title():<12}` Lv {lvl}")
        embed.add_field(name="Skills", value="\n".join(skill_lines), inline=False)

    embed.set_footer(text="SkyHelper · Data from Hypixel API")
    await interaction.followup.send(embed=embed)


@bot.tree.command(name="price", description="Quick price lookup — buy/sell price for any BZ item")
@app_commands.describe(item="Item ID or name (e.g. 'ENCHANTED_GOLD' or 'enchanted gold')")
async def cmd_price(interaction: discord.Interaction, item: str):
    await interaction.response.defer()
    try:
        item_id = item.strip().upper().replace(" ", "_")
        data = await api(f"/prices/item/{item_id}")
        embed = discord.Embed(
            title=f"💎  {item_label(item_id, 40)}",
            color=GREEN,
        )
        buy  = data.get("buy")  or data.get("buy_price")  or data.get("instant_buy")
        sell = data.get("sell") or data.get("sell_price") or data.get("instant_sell")
        if buy  is not None: embed.add_field(name="Instant Buy",  value=f"`{coins(buy)}`",  inline=True)
        if sell is not None: embed.add_field(name="Instant Sell", value=f"`{coins(sell)}`", inline=True)
        for key, label in [
            ("volume", "Volume"), ("weekly_volume", "Weekly Vol"),
            ("margin_pct", "Margin"), ("last_updated", "Updated"),
        ]:
            val = data.get(key)
            if val is not None:
                text = f"`{val:.1f}%`" if key == "margin_pct" else f"`{val}`"
                embed.add_field(name=label, value=text, inline=True)
        embed.set_footer(text=f"ID: {item_id} · SkyHelper")
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            embed = err_embed(f"Item **{item}** not found — try `/bazaar {item}` to search by name.")
        else:
            embed = err_embed(str(exc))
    except Exception as exc:
        embed = err_embed(str(exc))
    await interaction.followup.send(embed=embed)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    if not TOKEN:
        raise RuntimeError(
            "DISCORD_BOT_TOKEN is not set. "
            "Add it to your .env file or environment variables."
        )
    log.info("Starting SkyHelper bot — API: %s", API_BASE)
    asyncio.run(bot.start(TOKEN))


if __name__ == "__main__":
    main()
