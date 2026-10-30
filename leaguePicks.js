// Pizza Planet - every player and goalie picked in a league, best first (used by league.html)
// Same kind of table as the leaderboards: the top 20 show, a button shows all of them, and clicking Pts flips the order.
// Names come from the NHL data and from what teams typed, so everything is shown with textContent, never as HTML.

import { normalizeName } from "./nhlPlayers.js";
import { formatPoints } from "./standings.js";

const TOP = 20;

// rows = the league's teams with their picks (see buildRow in standings.js).
// Returns { players: [...], goalies: [...] }, each { name, team, picked, points }.
export function pickedPlayers(rows)
{
    const found = new Map();

    rows.forEach(function(row) {
        (row.picks || []).forEach(function(pick) {
            if (!pick.name)
            {
                return;
            }

            const key = (pick.goalie ? "g" : "p") + (pick.id ? "id" + pick.id : normalizeName(pick.name));
            const item = found.get(key) || { name: pick.name, team: pick.team || "", picked: 0, points: pick.points || 0, goalie: pick.goalie };

            item.picked++;
            found.set(key, item);
        });
    });

    const all = Array.from(found.values());

    return {
        players: all.filter(function(item) { return !item.goalie; }),
        goalies: all.filter(function(item) { return item.goalie; })
    };
}

// a table of the picked players or goalies. title = "Players" or "Goalies" (also the first column heading, singular)
export function makePickBoard(title, singular, items)
{
    const wrap = document.createElement("div");
    wrap.className = "board";

    const heading = document.createElement("h4");
    heading.className = "sub-title";
    heading.textContent = title;
    wrap.appendChild(heading);

    if (items.length === 0)
    {
        const none = document.createElement("p");
        none.className = "hint";
        none.textContent = "Nobody picked.";
        wrap.appendChild(none);
        return wrap;
    }

    const table = document.createElement("table");
    table.className = "stats board-table";
    table.style.minWidth = "440px";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");

    function th(text, className)
    {
        const cell = document.createElement("th");
        cell.textContent = text;
        cell.className = className || "";
        headRow.appendChild(cell);
        return cell;
    }

    th("#", "num");
    th(singular, "");
    th("Team", "num");
    th("Picked", "num");

    const valueHead = th("", "num sortable");
    valueHead.tabIndex = 0;
    valueHead.setAttribute("role", "button");

    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");
    table.appendChild(body);

    const scroller = document.createElement("div");
    scroller.className = "scroll";
    scroller.appendChild(table);
    wrap.appendChild(scroller);

    let best = true;
    let showAll = false;

    const ranked = items.slice().sort(function(a, b) {
        return (b.points - a.points) || a.name.localeCompare(b.name);
    });

    ranked.forEach(function(item, index) {
        item.place = index > 0 && ranked[index - 1].points === item.points ? ranked[index - 1].place : index + 1;
    });

    function render()
    {
        const shown = (best ? ranked : ranked.slice().reverse()).slice(0, showAll ? ranked.length : TOP);

        valueHead.textContent = (best ? "▼" : "▲") + " Pts";
        body.textContent = "";

        shown.forEach(function(item) {
            const row = document.createElement("tr");

            [String(item.place), item.name, item.team, String(item.picked), formatPoints(item.points)].forEach(function(text, index) {
                const cell = document.createElement("td");
                cell.className = index === 1 ? "" : "num";
                cell.textContent = text;
                row.appendChild(cell);
            });

            body.appendChild(row);
        });
    }

    function flip()
    {
        best = !best;
        render();
    }

    if (ranked.length > TOP)
    {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "btn small";
        more.textContent = "Show All";
        more.addEventListener("click", function() {
            showAll = !showAll;
            more.textContent = showAll ? "Show Top " + TOP : "Show All";
            render();
        });

        const moreWrap = document.createElement("p");
        moreWrap.className = "board-more";
        moreWrap.appendChild(more);
        wrap.appendChild(moreWrap);
    }

    valueHead.addEventListener("click", flip);
    valueHead.addEventListener("keydown", function(event) {
        if (event.key === "Enter" || event.key === " ")
        {
            event.preventDefault();
            flip();
        }
    });

    render();

    return wrap;
}