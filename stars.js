// Pizza Planet - space background (stars and shooting stars)

let shootingStarInterval;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", function() {
    createBackgroundStars();

    if (!reducedMotion)
    {
        startShootingStars();
    }

    // redraw the stars if the window size changes so they cover the whole page
    let resizeTimer;
    window.addEventListener("resize", function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            removeBackgroundStars();
            createBackgroundStars();
        }, 250);
    });
});

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

// create and place stars randomly for background
function createBackgroundStars() 
{
    const totalStars = 200;

    for (let i = 0; i < totalStars; i++) 
    {
        let star = document.createElement('div');
        star.classList.add('backgroundStar');

        // Randomize position
        let x = Math.random() * window.innerWidth - 20;
        let y = Math.random() * document.documentElement.scrollHeight - 20;

        star.style.left = x + 'px';
        star.style.top = y + 'px';

        // randomize animation delay for twinkling effect
        star.style.animationDelay = Math.random() * 5 + 's';

        document.body.appendChild(star);
    }
}

// remove stars
function removeBackgroundStars() 
{
    const stars = document.querySelectorAll('.backgroundStar');

    stars.forEach(star => {
        document.body.removeChild(star);
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
    y = Math.random() * document.documentElement.scrollHeight / 2;

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