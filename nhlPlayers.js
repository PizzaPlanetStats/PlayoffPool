// Pizza Planet - NHL player lookup.
// Used by the admin to build player groups (so every group player really exists in the NHL data)
// and when a team types in a custom player (to warn them if the name isn't in the NHL data).
//
// The browser can't ask the NHL directly, so everything goes through our Cloudflare Worker (see nhlConfig.js).
// Each player keeps the NHL's player id, which is what the stats update uses to find them.

import { NHL_PROXY, proxyReady } from "./nhlConfig.js";

const lists = {};         // the list for each year, once it has been asked for
let listDate = "";        // when the list was made

// "Alex Ovechkin" and "alex  OVECHKIN" and "Alex Óvechkin" all become "alex ovechkin"
export function normalizeName(name)
{
    return String(name)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

// every NHL player on the rosters of one season. "year" is the year the playoffs end in (2018 = the 2017-18 season).
// Leave it out for today's rosters. Throws if the NHL can't be reached.
export function loadPlayers(year)
{
    const key = year ? String(year) : "current";

    if (!lists[key])
    {
        if (!proxyReady())
        {
            return Promise.reject(new Error("The NHL proxy address isn't set yet (see nhlConfig.js)."));
        }

        lists[key] = fetch(NHL_PROXY + "/players?v=3" + (year ? "&season=" + encodeURIComponent(year) : ""))
            .then(async function(response) {
                if (!response.ok)
                {
                    throw new Error("The NHL player list isn't available (" + response.status + ").");
                }

                const body = await response.json();
                const rows = Array.isArray(body.players) ? body.players : [];

                listDate = String(body.generatedAt || "");

                return rows.map(function(row) {
                    return {
                        id: String(row.id),
                        name: String(row.name),
                        team: String(row.team || ""),
                        position: String(row.position || ""),
                        norm: normalizeName(row.name)
                    };
                });
            })
            .catch(function(err) {
                delete lists[key];   // so the next try asks again
                throw err;
            });
    }

    return lists[key];
}

// when the list was last updated, as a readable date ("" if unknown)
export function playerListDate()
{
    const date = new Date(listDate);

    return isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

// players whose name contains every word that was typed, best matches first
export function searchPlayers(players, query, limit)
{
    const words = normalizeName(query).split(" ").filter(Boolean);

    if (words.length === 0)
    {
        return [];
    }

    return players
        .filter(function(player) {
            return words.every(function(word) {
                return player.norm.includes(word);
            });
        })
        .sort(function(a, b) {
            const aStarts = a.norm.startsWith(words[0]) ? 0 : 1;
            const bStarts = b.norm.startsWith(words[0]) ? 0 : 1;
            return (aStarts - bStarts) || a.norm.localeCompare(b.norm);
        })
        .slice(0, limit || 10);
}

// the player with exactly this name, or undefined
export function findPlayerByName(players, name)
{
    const norm = normalizeName(name);

    return players.find(function(player) {
        return player.norm === norm;
    });
}

// every player with exactly this name (two players can share one)
export function findPlayersByName(players, name)
{
    const norm = normalizeName(name);
    const seen = new Set();

    return players.filter(function(player) {
        if (player.norm !== norm || seen.has(player.id))
        {
            return false;
        }

        seen.add(player.id);
        return true;
    });
}

// A player's playoff totals for one year (the year the playoffs end in, e.g. 2026 for the 2025-26 season).
// Returns the NHL's playoff season row for that year, or null if the player has none (didn't play).
export async function loadPlayoffTotals(playerId, year)
{
    if (!proxyReady())
    {
        throw new Error("The NHL proxy address isn't set yet (see nhlConfig.js).");
    }

    const response = await fetch(NHL_PROXY + "/web/v1/player/" + encodeURIComponent(playerId) + "/landing");

    if (!response.ok)
    {
        throw new Error("Could not load stats (" + response.status + ").");
    }

    const body = await response.json();
    const season = Number(year - 1) * 10000 + Number(year);

    const rows = (body.seasonTotals || []).filter(function(row) {
        return row.leagueAbbrev === "NHL" && row.gameTypeId === 3 && row.season === season;
    });

    return rows.length > 0 ? rows[0] : null;
}

// A player's regular season points for one year (0 if they have none)
export async function loadRegularSeasonPoints(playerId, year)
{
    const response = await fetch(NHL_PROXY + "/web/v1/player/" + encodeURIComponent(playerId) + "/landing");

    if (!response.ok)
    {
        throw new Error("Could not load stats (" + response.status + ").");
    }

    const body = await response.json();
    const season = Number(year - 1) * 10000 + Number(year);

    return (body.seasonTotals || [])
        .filter(function(row) { return row.leagueAbbrev === "NHL" && row.gameTypeId === 2 && row.season === season; })
        .reduce(function(sum, row) { return sum + (row.points || 0); }, 0);
}

// every NHL player a name can be checked against: the rosters of the league's season first, then today's rosters
// (so someone who has since moved, or a new player, is still found). Never throws. An empty list means the NHL list could not be loaded.
export async function loadKnownPlayers(year)
{
    const results = await Promise.allSettled([loadPlayers(year), loadPlayers()]);
    const all = [];

    results.forEach(function(result) {
        if (result.status === "fulfilled")
        {
            result.value.forEach(function(player) {
                all.push(player);
            });
        }
        else
        {
            console.warn("NHL player list problem:", result.reason);
        }
    });

    return all;
}

// every skater's and goalie's playoff stats for one season, from the Worker (which asks the NHL and keeps the answer 5 minutes
// while that season is on). "year" is the year the playoffs end in. Resolves to { players: [{ id, name, team, position, stats }], generatedAt }.
// Throws if the Worker can't be reached.
const statLists = {};

export function loadPlayoffStats(year)
{
    const key = String(year);

    if (!statLists[key])
    {
        if (!proxyReady())
        {
            return Promise.reject(new Error("The NHL proxy address isn't set yet (see nhlConfig.js)."));
        }

        statLists[key] = fetch(NHL_PROXY + "/playoff-stats?season=" + encodeURIComponent(year))
            .then(async function(response) {
                if (!response.ok)
                {
                    throw new Error("The playoff stats aren't available (" + response.status + ").");
                }

                const body = await response.json();

                return {
                    players: Array.isArray(body.players) ? body.players : [],
                    generatedAt: body.generatedAt ? new Date(body.generatedAt) : null
                };
            })
            .catch(function(err) {
                delete statLists[key];   // so the next try asks again
                throw err;
            });
    }

    return statLists[key];
}