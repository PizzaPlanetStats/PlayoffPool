// Pizza Planet - draws the playoff bracket from a list of 16 team codes.
//
// The list is in BRACKET ORDER (index 0 is "Opponent 1"):
//   positions 1 and 2 play each other in round 1, so do 3 and 4, 5 and 6, and so on
//   the winners of matches 1 and 2 play each other in round 2, matches 3 and 4 also, and so on
//   positions 1-8 are the top half of the bracket, 9-16 the bottom half, and the halves meet in the final
// An empty string means that spot has not been set yet.

import { NHL_TEAMS } from "./nhlTeams.js";

const TEAM_COUNT = 16;
const ROUND_NAMES = ["Round 1", "Round 2", "Round 3", "Round 4"];

export function renderBracket(container, savedCodes)
{
    container.textContent = "";

    // always exactly 16 spots, "" for any that are not set
    const codes = [];

    for (let i = 0; i < TEAM_COUNT; i++)
    {
        codes.push(Array.isArray(savedCodes) && typeof savedCodes[i] === "string" ? savedCodes[i] : "");
    }

    const setCount = codes.filter(function(code) {
        return code !== "";
    }).length;

    if (setCount === 0)
    {
        const none = document.createElement("p");
        none.textContent = "The playoff teams haven't been set yet.";
        container.appendChild(none);
        return;
    }

    if (setCount < TEAM_COUNT)
    {
        const progress = document.createElement("p");
        progress.className = "hint";
        progress.textContent = setCount + " of " + TEAM_COUNT + " teams have clinched so far.";
        container.appendChild(progress);
    }

    const names = {};
    NHL_TEAMS.forEach(function(team) {
        names[team.code] = team.name;
    });

    // scrolls sideways on small screens
    const scroll = document.createElement("div");
    scroll.className = "scroll";

    const bracket = document.createElement("div");
    bracket.className = "bracket";

    ROUND_NAMES.forEach(function(roundName, round) {
        const column = document.createElement("div");
        column.className = "bracket-round";

        const title = document.createElement("div");
        title.className = "bracket-title";
        title.textContent = roundName;

        const matches = document.createElement("div");
        matches.className = "bracket-matches";

        // 8 matches in round 1, then 4, 2, and 1
        const matchCount = TEAM_COUNT / Math.pow(2, round + 1);

        for (let m = 0; m < matchCount; m++)
        {
            const match = document.createElement("div");
            match.className = "bracket-match";

            for (let side = 0; side < 2; side++)
            {
                // only round 1 has known teams, later rounds fill in as winners are known
                const code = round === 0 ? codes[m * 2 + side] : "";

                const team = document.createElement("div");
                team.className = code ? "bracket-team" : "bracket-team tbd";
                team.textContent = code ? (names[code] || code) : "TBD";
                match.appendChild(team);
            }

            matches.appendChild(match);
        }

        column.append(title, matches);
        bracket.appendChild(column);
    });

    scroll.appendChild(bracket);
    container.appendChild(scroll);
}