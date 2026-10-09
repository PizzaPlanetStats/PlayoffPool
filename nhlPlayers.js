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

        lists[key] = fetch(NHL_PROXY + "/players" + (year ? "?season=" + encodeURIComponent(year) : ""))
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