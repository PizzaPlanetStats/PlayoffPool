// Pizza Planet - a team's points in every league as stacked columns (player, goalie and team points).
// Drawn as plain SVG, no library. drawHistoryChart(container, seasons) where seasons are the rows from userStats.js (newest first).
// Names are typed by people, so every text is set with textContent.

import { formatPoints } from "./standings.js";

const NS = "http://www.w3.org/2000/svg";

const SERIES = [
    { key: "playerPoints", label: "Players", className: "chart-players" },
    { key: "goaliePoints", label: "Goalies", className: "chart-goalies" },
    { key: "teamPoints", label: "Team", className: "chart-team" }
];

const PLOT = { left: 46, right: 12, top: 24, bottom: 34, height: 220, slot: 64, bar: 24 };

function el(name, attributes, text)
{
    const node = document.createElementNS(NS, name);

    Object.keys(attributes || {}).forEach(function(key) { node.setAttribute(key, String(attributes[key])); });

    if (text !== undefined)
    {
        node.textContent = text;
    }

    return node;
}

// a clean top for the y axis: 10, 20, 50, 100, 200, 500 ...
function niceMax(value)
{
    const base = Math.pow(10, Math.floor(Math.log10(Math.max(value, 1))));

    return [1, 2, 2.5, 5, 10].map(function(step) { return step * base; }).find(function(step) { return step >= value; });
}

// a column's top segment has a rounded top, the others are square
function segmentPath(x, y, width, height, round)
{
    const r = round ? Math.min(4, height) : 0;

    return "M" + x + "," + (y + height) + " L" + x + "," + (y + r) + (r ? " Q" + x + "," + y + " " + (x + r) + "," + y : "")
        + " L" + (x + width - r) + "," + y + (r ? " Q" + (x + width) + "," + y + " " + (x + width) + "," + (y + r) : "")
        + " L" + (x + width) + "," + (y + height) + " Z";
}

export function drawHistoryChart(container, seasons)
{
    container.textContent = "";

    const items = seasons.slice().reverse();   // oldest on the left
    const years = items.map(function(season) { return season.year; });

    // two leagues in one year are told apart by name
    const labelOf = function(season) {
        return years.filter(function(year) { return year === season.year; }).length > 1 || !season.year ? season.leagueName : String(season.year);
    };

    const stacks = items.map(function(season) {
        // points taken away (a negative adjustment) can't be drawn as a column, the tooltip still has the real number
        return SERIES.map(function(series) { return Math.max(0, season[series.key]); });
    });

    const top = niceMax(Math.max.apply(null, stacks.map(function(stack) { return stack.reduce(function(a, b) { return a + b; }, 0); }).concat([1])));
    const width = PLOT.left + PLOT.right + items.length * PLOT.slot;
    const height = PLOT.top + PLOT.height + PLOT.bottom;
    const y = function(value) { return PLOT.top + PLOT.height - value / top * PLOT.height; };

    // the legend: always there, there are three series
    const legend = document.createElement("div");
    legend.className = "chart-legend";

    SERIES.forEach(function(series) {
        const entry = document.createElement("span");
        const swatch = document.createElement("span");
        swatch.className = "chart-swatch " + series.className;
        entry.append(swatch, series.label);
        legend.appendChild(entry);
    });

    container.appendChild(legend);

    const scroll = document.createElement("div");
    scroll.className = "scroll chart-scroll";

    const svg = el("svg", { width: width, height: height, viewBox: "0 0 " + width + " " + height, role: "img",
        "aria-label": "Points in each league: " + items.map(function(season) { return labelOf(season) + " " + formatPoints(season.total); }).join(", ") });

    // gridlines and the y axis, hairline and quiet
    [0, 0.25, 0.5, 0.75, 1].forEach(function(fraction) {
        const value = top * fraction;

        svg.appendChild(el("line", { x1: PLOT.left, x2: width - PLOT.right, y1: y(value), y2: y(value), class: "chart-grid" }));
        svg.appendChild(el("text", { x: PLOT.left - 8, y: y(value) + 4, "text-anchor": "end", class: "chart-axis" }, formatPoints(value)));
    });

    const tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip hidden";

    function showTip(season, column)
    {
        tooltip.textContent = "";

        const title = document.createElement("strong");
        title.textContent = season.leagueName + (season.place ? " - place " + season.place : "");
        tooltip.appendChild(title);

        SERIES.forEach(function(series) {
            const line = document.createElement("div");
            line.textContent = series.label + ": " + formatPoints(season[series.key]);
            tooltip.appendChild(line);
        });

        const total = document.createElement("div");
        total.textContent = "Total: " + formatPoints(season.total);
        tooltip.appendChild(total);

        tooltip.classList.remove("hidden");

        const box = column.getBoundingClientRect();
        const around = scroll.getBoundingClientRect();
        tooltip.style.left = Math.max(0, Math.min(box.left - around.left + scroll.scrollLeft + box.width / 2 - tooltip.offsetWidth / 2, scroll.scrollWidth - tooltip.offsetWidth)) + "px";
        tooltip.style.top = Math.max(0, box.top - around.top - tooltip.offsetHeight - 6) + "px";
    }

    items.forEach(function(season, index) {
        const slotLeft = PLOT.left + index * PLOT.slot;
        const x = slotLeft + (PLOT.slot - PLOT.bar) / 2;
        const group = el("g", { class: "chart-column", tabindex: 0 });

        // a wider invisible box so the column is easy to point at
        group.appendChild(el("rect", { x: slotLeft + 4, y: PLOT.top, width: PLOT.slot - 8, height: PLOT.height, fill: "transparent" }));

        let base = 0;
        const last = stacks[index].map(function(value) { return value > 0; }).lastIndexOf(true);

        SERIES.forEach(function(series, seriesIndex) {
            const value = stacks[index][seriesIndex];

            if (value <= 0)
            {
                return;
            }

            // a 2px gap of white between the segments of a column
            const segTop = y(base + value);
            const segHeight = Math.max(1, y(base) - segTop - (seriesIndex > 0 && base > 0 ? 2 : 0));

            group.appendChild(el("path", { d: segmentPath(x, segTop, PLOT.bar, segHeight, seriesIndex === last), class: series.className }));
            base += value;
        });

        // the total sits on top of its column, the year underneath
        group.appendChild(el("text", { x: x + PLOT.bar / 2, y: y(base) - 6, "text-anchor": "middle", class: "chart-value" }, formatPoints(season.total)));

        const label = labelOf(season);
        group.appendChild(el("text", { x: x + PLOT.bar / 2, y: PLOT.top + PLOT.height + 20, "text-anchor": "middle", class: "chart-axis" },
            label.length > 9 ? label.slice(0, 8) + "…" : label));

        group.addEventListener("mouseenter", function() { showTip(season, group); });
        group.addEventListener("focus", function() { showTip(season, group); });
        group.addEventListener("mouseleave", function() { tooltip.classList.add("hidden"); });
        group.addEventListener("blur", function() { tooltip.classList.add("hidden"); });

        svg.appendChild(group);
    });

    scroll.append(svg, tooltip);
    container.appendChild(scroll);
}