function declination(dayOfYear) {
    return 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
}

function posPart(x) {
    return Math.max(x, 0);
}

function eq(doy, lat = 49) {
    const latRad = lat * Math.PI / 180;
    const declRad = declination(doy) * Math.PI / 180;

    const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad);
    const clampedCos = Math.max(-1, Math.min(1, cosHourAngle));

    const daylength = (2 * (24 / (2 * Math.PI)) * Math.acos(clampedCos)) - (0.1 * lat + 5);
    return daylength;
}

function trapz(x, y) {
    let sum = 0;
    for (let i = 0; i < x.length - 1; i++) {
        sum += (x[i + 1] - x[i]) * (y[i] + y[i + 1]) / 2;
    }
    return sum;
}

function singlesi(doy, lat) {
    const daysToDoy = Array.from({length: doy}, (_, i) => i + 1);
    const daysFullYear = Array.from({length: 365}, (_, i) => i + 1);

    const numeratorY = daysToDoy.map(d => posPart(eq(d, lat)));
    const denominatorY = daysFullYear.map(d => posPart(eq(d, lat)));

    const numerator = trapz(daysToDoy, numeratorY);
    const denominator = trapz(daysFullYear, denominatorY);

    return numerator / denominator;
}

function calculateSeasind(date, latitude) {
    const startOfYear = new Date(date.getFullYear(), 0, 0);
    const diff = date - startOfYear;
    const oneDay = 1000 * 60 * 60 * 24;
    const doy = Math.floor(diff / oneDay);

    return singlesi(doy, latitude);
}

function findDoyFromSeasind(targetSeasind, latitude) {
    for (let doy = 1; doy <= 365; doy++) {
        const si = singlesi(doy, latitude);
        if (si >= targetSeasind) {
            return doy;
        }
    }
    return 365;
}

function doyToDate(doy, year = 2023) {
    const date = new Date(year, 0);
    date.setDate(doy);
    return date;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

async function fetchInatObservations(params, maxPages = 1) {
    const baseUrl = 'https://api.inaturalist.org/v1/observations';
    const allResults = [];
    let page = 1;
    let totalResults = 0;

    const urlParams = new URLSearchParams(params);
    urlParams.set('per_page', '200');

    while (page <= maxPages) {
        urlParams.set('page', page);
        const url = `${baseUrl}?${urlParams.toString()}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (page === 1) {
                totalResults = data.total_results;
            }

            if (!data.results || data.results.length === 0) {
                break;
            }

            allResults.push(...data.results);

            if (data.results.length < 200) {
                break;
            }

            page++;
        } catch (error) {
            console.error('Error fetching observations:', error);
            break;
        }
    }

    return {
        results: allResults,
        totalResults: totalResults,
        fetchedPages: page - 1
    };
}

function processObservations(rawObservations) {
    const processed = [];

    for (const obs of rawObservations) {
        if (!obs.location || !obs.observed_on) continue;

        const [lat, lon] = obs.location.split(',').map(parseFloat);
        const date = new Date(obs.observed_on);
        const doy = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const seasind = calculateSeasind(date, lat);

        processed.push({
            id: obs.id,
            date: date,
            doy: doy,
            latitude: lat,
            longitude: lon,
            seasind: seasind,
            taxonName: obs.taxon?.name || 'Unknown'
        });
    }

    return processed;
}

function summarizeObservations(observations) {
    if (observations.length === 0) {
        return null;
    }

    const doys = observations.map(o => o.doy);
    const lats = observations.map(o => o.latitude);
    const lons = observations.map(o => o.longitude);
    const seasinds = observations.map(o => o.seasind);

    return {
        count: observations.length,
        doy: {
            min: Math.min(...doys),
            max: Math.max(...doys),
            mean: doys.reduce((a, b) => a + b, 0) / doys.length
        },
        latitude: {
            min: Math.min(...lats),
            max: Math.max(...lats),
            mean: lats.reduce((a, b) => a + b, 0) / lats.length
        },
        longitude: {
            min: Math.min(...lons),
            max: Math.max(...lons),
            mean: lons.reduce((a, b) => a + b, 0) / lons.length
        },
        seasind: {
            min: Math.min(...seasinds),
            max: Math.max(...seasinds),
            mean: seasinds.reduce((a, b) => a + b, 0) / seasinds.length,
            std: Math.sqrt(seasinds.reduce((sq, n) => sq + Math.pow(n - (seasinds.reduce((a, b) => a + b, 0) / seasinds.length), 2), 0) / seasinds.length)
        }
    };
}

function predictPhenologyDates(observations, targetLatitude, thresholdMethod = 'minmax', stdevMultiplier = 1.64) {
    const summary = summarizeObservations(observations);
    if (!summary) return null;

    let minSeasind, maxSeasind;

    if (observations.length < 10 || thresholdMethod === 'minmax') {
        minSeasind = summary.seasind.min;
        maxSeasind = summary.seasind.max;
    } else {
        minSeasind = Math.max(0, summary.seasind.mean - (stdevMultiplier * summary.seasind.std));
        maxSeasind = Math.min(1, summary.seasind.mean + (stdevMultiplier * summary.seasind.std));
    }

    const startDoy = findDoyFromSeasind(minSeasind, targetLatitude);
    const endDoy = findDoyFromSeasind(maxSeasind, targetLatitude);

    const startDate = doyToDate(startDoy);
    const endDate = doyToDate(endDoy);

    return {
        targetLatitude: targetLatitude,
        minSeasind: minSeasind,
        maxSeasind: maxSeasind,
        startDoy: startDoy,
        endDoy: endDoy,
        startDate: startDate,
        endDate: endDate,
        sampleSize: observations.length,
        thresholdMethod: thresholdMethod
    };
}
