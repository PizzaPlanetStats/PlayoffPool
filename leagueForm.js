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

// build the 16 dropdowns. Every dropdown is also added to the shared "selects" list.
export function buildPlayoffTeams(container, selects)
{
    // group the teams by conference and division so they are easy to find
    const groups = {};

    NHL_TEAMS.forEach(function(team) {
        const label = team.conference + " - " + team.division;
        groups[label] = groups[label] || [];
        groups[label].push(team);
    });

    for (let i = 0; i < PLAYOFF_SLOTS; i++)
    {
        const slot = document.createElement("div");
        slot.className = "team-slot";

        const id = "playoff-team-" + (i + 1);

        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = "Team " + (i + 1);

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
        container.appendChild(slot);
        selects.push(select);
    }
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

// returns { teams: ["BOS", ...] } with any number of teams from 0 to 16, or { error: "..." }
// (teams get added one by one as they clinch, so a partial list is fine)
export function collectPlayoffTeams(selects)
{
    const picks = selects.map(function(select) {
        return select.value;
    }).filter(function(value) {
        return value !== "";
    });

    if (new Set(picks).size !== picks.length)
    {
        return { error: "Each team can only be picked once." };
    }

    return { teams: picks };
}

// set the dropdowns from a saved list of team codes (used when editing)
export function fillPlayoffTeams(selects, teams)
{
    teams.forEach(function(code, index) {
        if (selects[index])
        {
            selects[index].value = code;
        }
    });

    refreshTeamOptions(selects);
}