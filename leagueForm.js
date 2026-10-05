// Pizza Planet - form pieces used by both the create and edit league pages
// (the stat checklist, the league name and year checks, and the playoff team dropdowns).

import { NHL_TEAMS } from "./nhlTeams.js";

export const PLAYOFF_SLOTS = 16;

// Stat checklist: each stat gets a row: a "track" checkbox and a points box that only works while it is checked.

// build the rows for one table. Every row is also added to the shared "rows" list.
export function buildRows(body, group, stats, rows)
{
    stats.forEach(function(stat) {
        const id = group + "-" + stat.key;
        const row = document.createElement("tr");

        const checkCell = document.createElement("td");
        checkCell.className = "check";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = id;
        checkbox.setAttribute("aria-label", "Track " + stat.label);
        checkCell.appendChild(checkbox);

        const nameCell = document.createElement("td");
        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = stat.label;
        nameCell.appendChild(label);

        const pointsCell = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.step = "any";
        input.className = "points-input";
        input.disabled = true;
        input.setAttribute("aria-label", "Points for " + stat.label);
        pointsCell.appendChild(input);

        // the points box only works while the stat is checked
        checkbox.addEventListener("change", function() {
            input.disabled = !checkbox.checked;

            if (checkbox.checked)
            {
                input.focus();
            }
            else
            {
                input.value = "";
            }
        });

        row.append(checkCell, nameCell, pointsCell);
        body.appendChild(row);
        rows.push({ group: group, stat: stat, checkbox: checkbox, input: input });
    });
}

// returns { skaters: {...}, goalies: {...} }, or { error: "..." } if something is wrong
export function collectScoring(rows)
{
    const scoring = { skaters: {}, goalies: {} };
    let count = 0;

    for (const row of rows)
    {
        if (!row.checkbox.checked)
        {
            continue;
        }

        const text = row.input.value.trim();
        const points = Number(text);

        if (text === "" || !Number.isFinite(points))
        {
            return { error: "Enter a number of points for " + row.stat.label + " (" + row.group + ")." };
        }
        if (Math.abs(points) > 1000)
        {
            return { error: "Points for " + row.stat.label + " must be between -1000 and 1000." };
        }

        scoring[row.group][row.stat.key] = points;
        count++;
    }

    if (count === 0)
    {
        return { error: "Check at least one stat to track." };
    }

    return scoring;
}

// tick and fill in the rows from a saved league (used when editing)
export function fillScoring(rows, scoring)
{
    rows.forEach(function(row) {
        const saved = scoring[row.group] || {};

        if (Object.prototype.hasOwnProperty.call(saved, row.stat.key))
        {
            row.checkbox.checked = true;
            row.input.disabled = false;
            row.input.value = saved[row.stat.key];
        }
    });
}

// checks the league name and year boxes. Returns { name, year } or { error: "..." }
export function readDetails(nameText, yearText)
{
    const name = nameText.trim();
    const year = Number(yearText);

    if (name.length < 2 || name.length > 40)
    {
        return { error: "League name must be 2 to 40 characters." };
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
    {
        return { error: "Enter a year between 2000 and 2100." };
    }

    return { name: name, year: year };
}

// ---------- playoff teams ----------
// 16 dropdowns in BRACKET ORDER. Spot 1 is "Team 1" (East is teams 1-8, West is 9-16), and the saved list keeps every spot's place
// (an empty string for a spot that is not set yet), so the order can be used to draw the bracket.
//   Teams 1 and 2 play each other in round 1, so do 3 and 4, and so on.
//   The winners of match 1 and match 2 play in round 2, and so on for all 4 rounds.

// build the 16 dropdowns. Every dropdown is also added to the shared "selects" list, in order.
export function buildPlayoffTeams(container, selects)
{
    // older copies of the page put a grid class on this box, the groups below make their own grids
    container.classList.remove("team-grid");
    container.textContent = "";

    // group the teams by conference and division so they are easy to find
    const groups = {};

    NHL_TEAMS.forEach(function(team) {
        const label = team.conference + " - " + team.division;
        groups[label] = groups[label] || [];
        groups[label].push(team);
    });

    ["East", "West"].forEach(function(halfTitle, half) {
        const title = document.createElement("h4");
        title.className = "sub-title";
        title.textContent = halfTitle;

        // a row of two matches here feeds one round 2 match
        const grid = document.createElement("div");
        grid.className = "team-grid";

        for (let m = 0; m < 4; m++)
        {
            const matchNumber = half * 4 + m + 1;

            const box = document.createElement("div");
            box.className = "match-box";

            const boxTitle = document.createElement("div");
            boxTitle.className = "match-title";
            boxTitle.textContent = "Round 1 - Match " + matchNumber;
            box.appendChild(boxTitle);

            for (let side = 0; side < 2; side++)
            {
                const index = (matchNumber - 1) * 2 + side;
                box.appendChild(buildTeamSlot(index, groups, selects));
            }

            grid.appendChild(box);
        }

        container.append(title, grid);
    });
}

// one labeled dropdown ("Team 5") for a spot in the bracket
function buildTeamSlot(index, groups, selects)
{
    const slot = document.createElement("div");
    slot.className = "team-slot";

    const id = "playoff-team-" + (index + 1);

    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = "Team " + (index + 1);

    const select = document.createElement("select");
    select.id = id;

    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "(not set)";
    select.appendChild(blank);

    Object.keys(groups).forEach(function(groupLabel) {
        const group = document.createElement("optgroup");
        group.label = groupLabel;

        groups[groupLabel].forEach(function(team) {
            const option = document.createElement("option");
            option.value = team.code;
            option.textContent = team.name;
            group.appendChild(option);
        });

        select.appendChild(group);
    });

    select.addEventListener("change", function() {
        refreshTeamOptions(selects);
    });

    slot.append(label, select);
    selects[index] = select;
    return slot;
}

// grey out teams that are already picked in another dropdown
function refreshTeamOptions(selects)
{
    const chosen = selects.map(function(select) {
        return select.value;
    }).filter(function(value) {
        return value !== "";
    });

    selects.forEach(function(select) {
        Array.from(select.options).forEach(function(option) {
            option.disabled = option.value !== ""
                && chosen.includes(option.value)
                && select.value !== option.value;
        });
    });
}

// returns { teams: [...16 codes in bracket order, "" for spots not set] }, or { error: "..." }
export function collectPlayoffTeams(selects)
{
    const teams = selects.map(function(select) {
        return select.value;
    });

    const picked = teams.filter(function(code) {
        return code !== "";
    });

    if (new Set(picked).size !== picked.length)
    {
        return { error: "Each team can only be picked once." };
    }

    return { teams: teams };
}

// set the dropdowns from a saved list of team codes (used when editing)
export function fillPlayoffTeams(selects, teams)
{
    selects.forEach(function(select, index) {
        select.value = typeof teams[index] === "string" ? teams[index] : "";
    });

    refreshTeamOptions(selects);
}