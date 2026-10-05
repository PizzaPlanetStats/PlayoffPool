// Pizza Planet - space background (stars and shooting stars)
//
// The stars are not drawn right away. Pages fill in after they load (team lists, leagues, and so on),
// so the stars wait until the page has stopped changing size, then fade in once.
// If the page gets taller or shorter later, only the new space gets stars, so nothing visibly changes.

let shootingStarInterval;
let starfield;
let settleTimer;
let started = false;
let drawnWidth = 0;
let drawnHeight = 0;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SETTLE_WAIT = 250;    // how long the page size must stay the same before the first stars appear
const LONGEST_WAIT = 1000;  // draw the stars anyway after this long, even if the page keeps changing
const DENSITY = 5400;       // one star for every this many square pixels

// The height of the page itself. Stars and shooting stars are not counted
// (they are positioned on top of the page), so they can't change this number.
function pageHeight()
{
    return Math.max(window.innerHeight, document.body.offsetHeight);
}

if (document.readyState === "loading")
{
    document.addEventListener("DOMContentLoaded", init);
}
else
{
    init();
}

function init()
{
    // an invisible box that holds every background star, so they can all fade in together
    starfield = document.createElement("div");
    starfield.id = "starfield";
    document.body.appendChild(starfield);

    if (document.readyState === "complete")
    {
        beginWatching();
    }
    else
    {
        window.addEventListener("load", beginWatching);
    }
}

// watch the page's size, and draw the stars once it settles
function beginWatching()
{
    if (typeof ResizeObserver === "function")
    {
        new ResizeObserver(onSizeChange).observe(document.body);
    }
    else
    {
        window.addEventListener("resize", onSizeChange);
    }

    onSizeChange();

    // don't wait forever on a page that never stops changing
    setTimeout(function() {
        if (!started)
        {
            startStars();
        }
    }, LONGEST_WAIT);
}

function onSizeChange()
{
    clearTimeout(settleTimer);
    settleTimer = setTimeout(updateStars, started ? 250 : SETTLE_WAIT);
}

// the first time: draw every star and fade the field in
function startStars()
{
    started = true;
    drawnWidth = window.innerWidth;
    drawnHeight = pageHeight();

    createBackgroundStars(0, drawnHeight, 60);
    starfield.classList.add("visible");

    if (!reducedMotion)
    {
        startShootingStars();
    }
}

// after that: only touch the stars if the page really got bigger or smaller
function updateStars()
{
    if (!started)
    {
        startStars();
        return;
    }

    const width = window.innerWidth;
    const height = pageHeight();

    if (Math.abs(width - drawnWidth) > 40)
    {
        // the window changed width, so start the star field over
        removeBackgroundStars(0);
        createBackgroundStars(0, height, 60);
    }
    else if (height - drawnHeight > 40)
    {
        // the page got taller: add stars to the new space and leave the old ones alone
        createBackgroundStars(drawnHeight, height, 0);
    }
    else if (drawnHeight - height > 40)
    {
        // the page got shorter: remove the stars that are now past the bottom
        removeBackgroundStars(height);
    }
    else
    {
        return;
    }

    drawnWidth = width;
    drawnHeight = height;
}

// create shooting stars at random intervals
function startShootingStars() 
{
    // 25% chance every 3 seconds
    shootingStarInterval = setInterval(() => {
        if (Math.random() > 0.75) 
        {
            createShootingStar();
        }
    }, 3000); 
}

// create and place stars randomly between two heights on the page
function createBackgroundStars(top, bottom, minimum) 
{
    const width = window.innerWidth;
    const area = width * (bottom - top);
    const totalStars = Math.min(800, Math.max(minimum, Math.round(area / DENSITY)));

    for (let i = 0; i < totalStars; i++) 
    {
        let star = document.createElement('div');
        star.classList.add('backgroundStar');

        // Randomize position
        let x = Math.random() * (width - 4);
        let y = top + Math.random() * (bottom - top - 4);

        star.style.left = x + 'px';
        star.style.top = y + 'px';

        // randomize animation delay for twinkling effect
        star.style.animationDelay = Math.random() * 5 + 's';

        starfield.appendChild(star);
    }
}

// remove the stars that are lower than the given height (0 removes all of them)
function removeBackgroundStars(fromHeight) 
{
    const stars = starfield.querySelectorAll('.backgroundStar');

    stars.forEach(star => {
        if (parseFloat(star.style.top) >= fromHeight)
        {
            star.remove();
        }
    });
}

function createShootingStar() 
{
    // create a shooting star
    let shootingStar = document.createElement('div');
    shootingStar.classList.add('shootingStar');

    // randomize start position
    let x, y
    if (Math.random() > 0.5)
    {
        x = window.innerWidth - 100;
    }
    else
    {
        x = 100;
    }
    y = Math.random() * pageHeight() / 2;

    shootingStar.style.left = x + 'px';
    shootingStar.style.top = y + 'px';

    // determine direction based on star position
    if (x > window.innerWidth / 2) 
    {
        // down left
        shootingStar.style.animation = 'shootingLeft 1.5s linear forwards';
        shootingStar.classList.add('left');
    } 
    else 
    {
        // down right
        shootingStar.style.animation = 'shootingRight 1.5s linear forwards';
        shootingStar.classList.add('right');
    }

    document.body.appendChild(shootingStar);

    // remove shooting star after animation is done
    shootingStar.addEventListener('animationend', () => {
        shootingStar.remove();
    });
}

function stopShootingStars() 
{
    // stop any future shooting stars from creating
    clearInterval(shootingStarInterval);

    // remove any current shooting stars in animation
    const shootingStars = document.querySelectorAll('.shootingStar');
    shootingStars.forEach(star => {
        star.remove();
    });
}