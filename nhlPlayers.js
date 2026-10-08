// Pizza Planet - NHL player lookup.
// Used by the admin to build player groups (so every group player really exists in the NHL data)
// and when a team types in a custom player (to warn them if the name isn't in the NHL data).
//
// It downloads every team's roster from the NHL web API (the one nhl.com itself uses):
//   https://api-web.nhle.com/v1/roster/{TEAM}/current       for a league that is playing now or next
//   https://api-web.nhle.com/v1/roster/{TEAM}/{SEASON}      for an older league, like 20252026
// once, then searches the list in the browser. Each player keeps the NHL's player id, which is what
// the stats update will use later to find them, and the team they are on.
//
// (The NHL's other API, api.nhle.com/stats/rest, does not allow requests from web pages, so it can't be used here.)

import { NHL_TEAMS } from "./nhlTeams.js";

const API = "https://api-web.nhle.com/v1";
const cache = {};   // league year -> the list of players (as a promise)

// a league for 2026 is the 2025-26 season, whose id is 20252026
export function seasonIdForYear(year)
{
    const y = Number(year);
    return (y - 1) * 10000 + y;
}

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

// Utah took over from Arizona in 2024-25, so older leagues look at Arizona instead
function teamCodesForYear(year)
{
    const codes = NHL_TEAMS.map(function(team) {
        return team.code;
    });

    if (Number(year) <= 2024)
    {
        return codes.filter(function(code) { return code !== "UTA"; }).concat("ARI");
    }

    return codes;
}

// is this league for the season that is on now (or the next one)? Then ask for the current rosters.
function wantsCurrentRoster(year)
{
    const now = new Date();
    const thisYear = now.getFullYear();

    // January to July the season ends this year, from August on it ends next year
    return Number(year) > thisYear || (Number(year) === thisYear && now.getMonth() <= 6);
}

function nameOf(part)
{
    return part && typeof part === "object" ? String(part.default || "") : String(part || "");
}

function playersFromRoster(roster, team)
{
    const found = [];

    ["forwards", "defensemen", "goalies"].forEach(function(group) {
        (Array.isArray(roster[group]) ? roster[group] : []).forEach(function(row) {
            const name = (nameOf(row.firstName) + " " + nameOf(row.lastName)).trim();

            if (!name || row.id === undefined || row.id === null)
            {
                return;
            }

            found.push({
                id: String(row.id),
                name: name,
                team: team,
                position: String(row.positionCode || (group === "goalies" ? "G" : group === "defensemen" ? "D" : "")),
                norm: normalizeName(name)
            });
        });
    });

    return found;
}

// one team's players, or null if that team couldn't be loaded (a team that didn't exist that season, for example)
async function loadTeam(team, year)
{
    const when = wantsCurrentRoster(year) ? "current" : String(seasonIdForYear(year));

    try
    {
        const response = await fetch(API + "/roster/" + team + "/" + when);

        if (!response.ok)
        {
            return null;
        }

        return playersFromRoster(await response.json(), team);
    }
    catch (err)
    {
        return null;
    }
}

// every player on every team's roster. Throws if the NHL API can't be reached at all.
export function loadPlayers(year)
{
    if (!cache[year])
    {
        cache[year] = Promise.all(teamCodesForYear(year).map(function(team) {
            return loadTeam(team, year);
        })).then(function(results) {
            const loaded = results.filter(function(players) {
                return players !== null;
            });

            if (loaded.length === 0)
            {
                throw new Error("The NHL API could not be reached.");
            }

            const byId = new Map();

            loaded.forEach(function(players) {
                players.forEach(function(player) {
                    byId.set(player.id, player);
                });
            });

            return Array.from(byId.values());
        }).catch(function(err) {
            delete cache[year];   // so the next try asks again
            throw err;
        });
    }

    return cache[year];
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