export const NHL_PROXY = "https://playoffpool.pizzaplanet1137.workers.dev";

export function proxyReady()
{
    return /^https:\/\//.test(NHL_PROXY);
}