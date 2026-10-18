// Pizza Planet - unlocks the achievements that can be worked out from the results (admin only).
// Everything is worked out from the leagues that have ended and have their final standings saved (Save Stats).
// It only ever ADDS achievements, so anything the admin unlocked by hand stays. The ones that can't be worked out
// from the saved data (Ron Hextall, Backup Goalie, President Trophy Curse, Miracle on Ice) are still unlocked by hand.
//
// It also keeps a "N TIME CHAMP" suffix up to date when the team has won more leagues since choosing it.

import { db } from "./firebase.js";
import { collection, getDocs, getDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { leaguePhase } from "./phases.js";
import { buildRow, makeStatsLookup, predictionMarks } from "./standings.js";

// the achievements that are never unlocked automatically (the Edit Team page marks them "Manual")
export const MANUAL_ACHIEVEMENTS = ["ronHextall", "backupGoalie", "presidentsCurse", "miracleOnIce"];

// how many leagues played unlocks what
const PLAYED = [[1, "dank"], [3, "memeLord"], [5, "venaCava"], [10, "cowFarmer"], [20, "rlyeh"], [30, "smoothER"], [40, "grandMufti"], [50, "ctulhu"]];

// how many league wins unlocks what
const WON = [[1, "winner"], [2, "notAFluke"], [3, "hatTrick"], [5, "spezzaApprentice"], [10, "insiderTrader"]];

const GOALS_NEEDED = 894;

// two years (or more) in a row where check(year) is true
function inARow(years, count, check)
{
    const set = new Set(years);

    return years.some(function(start) {
        for (let step = 0; step < count; step++)
        {
            if (!set.has(start + step) || !check(start + step))
            {
                return false;
            }
        }

        return true;
    });
}

// leagues = [{ year, league, standings, stats, entries }]
//   standings = the saved rows ([{ uid, place, ... }]), stats = the saved player list, entries = { uid: entry data }
// returns Map uid -> { wins, ids: Set of achievement ids }
export function workOutAchievements(leagues)
{
    const teams = new Map();

    function team(uid)
    {
        if (!teams.has(uid))
        {
            teams.set(uid, { uid: uid, records: [], goals: 0, perfect: new Set() });
        }

        return teams.get(uid);
    }

    leagues.forEach(function(item) {
        const size = item.standings.length;
        const lastPlace = item.standings.reduce(function(worst, row) { return Math.max(worst, Number(row.place) || 0); }, 0);
        const results = item.league.results && Array.isArray(item.league.results.winners) ? item.league.results.winners : [];
        const resultsDone = results.length === 15 && results.every(function(winner) { return winner !== ""; });
        const lookup = makeStatsLookup(item.stats);

        item.standings.forEach(function(row) {
            const record = team(String(row.uid));
            const place = Number(row.place) || 0;

            record.records.push({
                year: item.year, place: place, won: place === 1, second: place === 2,
                last: size >= 2 && place === lastPlace, top: place <= size * 0.5
            });

            const entry = item.entries[row.uid];

            if (!entry || !entry.bracket || !Array.isArray(entry.bracket.winners))
            {
                return;
            }

            // goals scored by the players this team picked
            try
            {
                buildRow(item.league, entry, lookup, [], String(row.uid)).picks.forEach(function(pick) {
                    record.goals += Number(pick.stats && pick.stats.goals) || 0;
                });
            }
            catch (err)
            {
                // this league adds no goals
            }

            if (!resultsDone)
            {
                return;
            }

            const picked = entry.bracket.winners;

            if (picked.length === 15)
            {
                if (results.slice(0, 8).every(function(winner, i) { return picked[i] === winner; }))
                {
                    record.perfect.add("oracle");
                }

                if (results.every(function(winner, i) { return picked[i] === winner; }))
                {
                    record.perfect.add("horoscope");
                }

                if (results[14] === "TOR" && picked[14] === "TOR")
                {
                    record.perfect.add("bismillah");
                }

                const marks = Object.values(predictionMarks(item.league, picked).marks);

                if (marks.length === 16 && marks.every(function(mark) { return mark.kind !== "miss"; }))
                {
                    record.perfect.add("allSeeing");
                }
            }
        });
    });

    const output = new Map();

    teams.forEach(function(record, uid) {
        const ids = new Set(record.perfect);
        const records = record.records;
        const wins = records.filter(function(r) { return r.won; }).length;
        const years = Array.from(new Set(records.map(function(r) { return r.year; }))).sort(function(a, b) { return a - b; });
        const inYear = function(year) { return records.filter(function(r) { return r.year === year; }); };

        PLAYED.forEach(function(rule) { if (records.length >= rule[0]) { ids.add(rule[1]); } });
        WON.forEach(function(rule) { if (wins >= rule[0]) { ids.add(rule[1]); } });

        if (record.goals >= GOALS_NEEDED)
        {
            ids.add("greatOne");
        }

        if (inARow(years, 2, function(year) { return inYear(year).some(function(r) { return r.won; }); }))
        {
            ids.add("dynasty");
        }

        if (inARow(years, 2, function(year) { return inYear(year).some(function(r) { return r.second; }); }))
        {
            ids.add("mcDavidsLegacy");
        }

        // last place one year, a win the next
        if (records.some(function(r) { return r.last && inYear(r.year + 1).some(function(next) { return next.won; }); }))
        {
            ids.add("ultimateRegain");
        }

        // top half of the standings five years running, with no win in any of them
        if (inARow(years, 5, function(year) {
            const found = inYear(year);
            return found.every(function(r) { return r.top && !r.won; });
        }))
        {
            ids.add("ourYear");
        }

        output.set(uid, { wins: wins, ids: ids });
    });

    return output;
}

// Reads every ended league that has saved standings, works out the achievements and writes the new ones to the public teams.
// returns { teams: how many teams got something new, added: how many achievements were added }
export async function refreshAchievements()
{
    const leagueDocs = await getDocs(collection(db, "leagues"));
    const ended = leagueDocs.docs.filter(function(leagueDoc) { return leaguePhase(leagueDoc.data()) === "ended"; });

    const loaded = await Promise.all(ended.map(async function(leagueDoc) {
        const standings = await getDoc(doc(db, "leagues", leagueDoc.id, "final", "standings"));

        if (!standings.exists() || !Array.isArray(standings.data().standings) || standings.data().standings.length === 0)
        {
            return null;
        }

        const stats = await getDoc(doc(db, "leagues", leagueDoc.id, "final", "stats"));
        const entryDocs = await getDocs(collection(db, "leagues", leagueDoc.id, "entries"));
        const entries = {};
        entryDocs.forEach(function(entryDoc) { entries[entryDoc.id] = entryDoc.data(); });

        return {
            year: Number(leagueDoc.data().year) || 0, league: leagueDoc.data(), standings: standings.data().standings,
            stats: stats.exists() && Array.isArray(stats.data().players) ? stats.data().players : [], entries: entries
        };
    }));

    const worked = workOutAchievements(loaded.filter(Boolean));
    const teamDocs = await getDocs(collection(db, "teams"));

    let teams = 0;
    let added = 0;

    for (const teamDoc of teamDocs.docs)
    {
        const result = worked.get(teamDoc.id);

        if (!result)
        {
            continue;
        }

        const data = teamDoc.data();
        const have = Array.isArray(data.achievements) ? data.achievements : [];
        const fresh = Array.from(result.ids).filter(function(id) { return !have.includes(id); });
        const changes = {};

        if (fresh.length > 0)
        {
            changes.achievements = have.concat(fresh);
        }

        // "3 TIME CHAMP" chosen, then another league won: keep the number right
        const match = /^multi:([0-9]{1,2})$/.exec(String(data.suffix || ""));

        if (match && result.wins >= 2 && result.wins <= 99 && Number(match[1]) !== result.wins)
        {
            changes.suffix = "multi:" + result.wins;
        }

        if (Object.keys(changes).length > 0)
        {
            await updateDoc(doc(db, "teams", teamDoc.id), changes);
            teams++;
            added += fresh.length;
        }
    }

    return { teams: teams, added: added };
}