// Pizza Planet - league home page (league.html?id=LEAGUE_ID)
// Anyone can view this page. League names are typed in by the admin,
// so everything is shown with textContent, never as HTML.

import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { SKATER_STATS, GOALIE_STATS } from "./stats.js";
import { renderBracket } from "./bracket.js";

const status = document.getElementById("status");
const leagueArea = document.getElementById("league");
const leagueName = document.getElementById("league-name");
const registrationText = document.getElementById("registration-text");
const signupPlaceholder = document.getElementById("signup-placeholder");

const leagueId = new URLSearchParams(location.search).get("id");

loadLeague();

async function loadLeague()
{
    if (!leagueId || !/^[A-Za-z0-9]{1,40}$/.test(leagueId))
    {
        status.textContent = "League not found.";
        return;
    }

    let data;

    try
    {
        const snap = await getDoc(doc(db, "leagues", leagueId));

        if (!snap.exists())
        {
            status.textContent = "League not found.";
            return;
        }

        data = snap.data();
    }
    catch (err)
    {
        status.textContent = "Could not load this league. Try again later.";
        return;
    }

    // leagues made before names existed show their year as the name
    const name = String(data.name || (data.year + " League"));

    leagueName.textContent = name;
    document.title = name + " - Pizza Planet";

    renderRegistration(data.signupsOpen === true);

    const scoring = data.scoring || {};
    renderRules(document.getElementById("skater-rules"), SKATER_STATS, scoring.skaters || {}, "No skater stats are tracked.");
    renderRules(document.getElementById("goalie-rules"), GOALIE_STATS, scoring.goalies || {}, "No goalie stats are tracked.");

    renderBracket(document.getElementById("playoff-teams"), data.playoffTeams, {
        winners: data.results ? data.results.winners : []
    });

    status.classList.add("hidden");
    leagueArea.classList.remove("hidden");
}

function renderRegistration(open)
{
    if (open)
    {
        registrationText.textContent = "Registration is open.";
        signupPlaceholder.classList.remove("hidden");
    }
    else
    {
        registrationText.textContent = "Registration is closed.";
    }
}

// a table of the stats this league scores and what each one is worth
function renderRules(container, statList, values, emptyText)
{
    const tracked = statList.filter(function(stat) {
        return Object.prototype.hasOwnProperty.call(values, stat.key);
    });

    if (tracked.length === 0)
    {
        const none = document.createElement("p");
        none.textContent = emptyText;
        container.appendChild(none);
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "scroll";

    const table = document.createElement("table");
    table.className = "stats";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Stat", "Points each"].forEach(function(title) {
        const th = document.createElement("th");
        th.textContent = title;
        headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");
    tracked.forEach(function(stat) {
        const row = document.createElement("tr");

        const statCell = document.createElement("td");
        statCell.textContent = stat.label;

        const pointsCell = document.createElement("td");
        pointsCell.textContent = values[stat.key];

        row.append(statCell, pointsCell);
        body.appendChild(row);
    });
    table.appendChild(body);

    wrapper.appendChild(table);
    container.appendChild(wrapper);
}