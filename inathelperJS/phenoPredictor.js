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
        let currentObservations = [];
        let currentParams = {};
        let totalResults = 0;
        let comparisonMode = false;
        let url1Params = null;
        let url2Params = null;
        let url1Observations = [];
        let url2Observations = [];

        // Check if we were passed URLs from URLgen
        window.addEventListener('DOMContentLoaded', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const url1 = urlParams.get('url1');
            const url2 = urlParams.get('url2');

            console.log('URL1:', url1);
            console.log('URL2:', url2);

            if (url1) {
                if (url2) {
                    // Comparison mode
                    comparisonMode = true;
                    document.getElementById('singleUrlMode').style.display = 'none';
                    document.getElementById('comparisonUrlMode').style.display = 'block';

                    // Set textareas
                    const textarea1 = document.getElementById('inatUrl1');
                    const textarea2 = document.getElementById('inatUrl2');

                    if (textarea1 && textarea2) {
                        textarea1.value = url1;
                        textarea2.value = url2;
                        console.log('Set textarea1 to:', textarea1.value);
                        console.log('Set textarea2 to:', textarea2.value);
                    } else {
                        console.error('Textareas not found!', textarea1, textarea2);
                    }

                    document.getElementById('queryTitle').textContent = 'Phenophase Transition Analysis';
                } else {
                    // Single URL mode
                    document.getElementById('inatUrl').value = url1;
                }
            }
        });

        function openUrlGen() {
            window.open('URLgen.html', '_blank');
        }

        document.getElementById('openUrlGenLink').addEventListener('click', (e) => {
            e.preventDefault();
            openUrlGen();
        });

        document.getElementById('openUrlGenButton').addEventListener('click', (e) => {
            e.preventDefault();
            openUrlGen();
        });

        document.getElementById('fetchButton').addEventListener('click', fetchObservations);

        function showStatus(message, type = 'info') {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = message;
            statusDiv.className = type;
        }

        function parseInatUrl(url) {
            try {
                const urlObj = new URL(url);
                const params = {};

                for (const [key, value] of urlObj.searchParams) {
                    params[key] = value;
                }

                return params;
            } catch (error) {
                showStatus('Invalid URL format. Please check the URL and try again.', 'error');
                return null;
            }
        }

        async function fetchObservations() {
            showStatus('Fetching observations from iNaturalist...', 'info');
            document.getElementById('fetchButton').disabled = true;
            document.getElementById('summary').style.display = 'none';
            document.getElementById('paginationWarning').style.display = 'none';

            let params;

            if (comparisonMode) {
                const url1Input = document.getElementById('inatUrl1').value.trim();
                const url2Input = document.getElementById('inatUrl2').value.trim();

                if (!url1Input || !url2Input) {
                    showStatus('Please enter both URLs for comparison mode', 'warning');
                    document.getElementById('fetchButton').disabled = false;
                    return;
                }

                url1Params = parseInatUrl(url1Input);
                url2Params = parseInatUrl(url2Input);

                if (!url1Params || !url2Params) {
                    document.getElementById('fetchButton').disabled = false;
                    return;
                }

                // Fetch both datasets
                showStatus('Fetching observations from both URLs...', 'info');

                try {
                    // Fetch URL 1
                    showStatus('Fetching phenophase 1 observations...', 'info');
                    const data1 = await fetchInatObservations(url1Params, 1);

                    if (data1.results.length === 0) {
                        const summaryDiv = document.getElementById('summary');
                        summaryDiv.style.display = 'block';
                        summaryDiv.innerHTML = `
                            <h2>No Observations Found (Phenophase 1)</h2>
                            <div class="validation-errors" style="background: #ffebee; border-left: 4px solid #c62828; padding: 15px; margin: 15px 0; border-radius: 4px;">
                                <h4 style="color: #c62828; margin-top: 0;">⚠ No Results</h4>
                                <p style="color: #c62828;">Your query for Phenophase 1 returned no observations from iNaturalist.</p>
                                <p style="color: #666;"><strong>Suggestions:</strong></p>
                                <ul style="margin: 5px 0; padding-left: 20px; color: #666;">
                                    <li>Expand the geographic area (use a larger place or remove place filters)</li>
                                    <li>Broaden the date range</li>
                                    <li>Check taxon filters - make sure the taxon exists and has observations</li>
                                    <li>Remove or relax observation field filters</li>
                                    <li>Try with "research grade" filter disabled</li>
                                </ul>
                            </div>
                        `;
                        showStatus('No observations found for Phenophase 1. See suggestions above.', 'warning');
                        document.getElementById('fetchButton').disabled = false;
                        return;
                    }

                    url1Observations = processObservations(data1.results);

                    // Fetch URL 2
                    showStatus(`Fetched ${url1Observations.length} observations from phenophase 1. Fetching phenophase 2...`, 'info');
                    const data2 = await fetchInatObservations(url2Params, 1);

                    if (data2.results.length === 0) {
                        const summaryDiv = document.getElementById('summary');
                        summaryDiv.style.display = 'block';
                        summaryDiv.innerHTML = `
                            <h2>No Observations Found (Phenophase 2)</h2>
                            <div style="background: #e3f2fd; padding: 15px; margin: 15px 0; border-radius: 4px;">
                                <p><strong>Phenophase 1:</strong> Found ${url1Observations.length} observations ✓</p>
                            </div>
                            <div class="validation-errors" style="background: #ffebee; border-left: 4px solid #c62828; padding: 15px; margin: 15px 0; border-radius: 4px;">
                                <h4 style="color: #c62828; margin-top: 0;">⚠ No Results</h4>
                                <p style="color: #c62828;">Your query for Phenophase 2 returned no observations from iNaturalist.</p>
                                <p style="color: #666;"><strong>Suggestions:</strong></p>
                                <ul style="margin: 5px 0; padding-left: 20px; color: #666;">
                                    <li>Expand the geographic area</li>
                                    <li>Broaden the date range</li>
                                    <li>Check observation field filters for the second phenophase</li>
                                    <li>Verify the phenophase distinction exists in your taxon</li>
                                </ul>
                            </div>
                        `;
                        showStatus('No observations found for Phenophase 2. See suggestions above.', 'warning');
                        document.getElementById('fetchButton').disabled = false;
                        return;
                    }

                    url2Observations = processObservations(data2.results);

                    showStatus(`Fetched ${url1Observations.length} observations from phenophase 1 and ${url2Observations.length} from phenophase 2`, 'success');

                    // Display comparison results
                    displayComparisonResults(url1Observations, url2Observations);

                } catch (error) {
                    showStatus('Error fetching observations: ' + error.message, 'error');
                }

                document.getElementById('fetchButton').disabled = false;
                return;
            } else {
                const urlInput = document.getElementById('inatUrl').value.trim();

                if (!urlInput) {
                    showStatus('Please enter an iNaturalist URL', 'warning');
                    document.getElementById('fetchButton').disabled = false;
                    return;
                }

                params = parseInatUrl(urlInput);
                if (!params) {
                    document.getElementById('fetchButton').disabled = false;
                    return;
                }
            }

            currentParams = params;

            try {
                const data = await fetchInatObservations(params, 1);
                totalResults = data.totalResults;

                showStatus(`Fetched ${data.results.length} observations`, 'success');

                if (data.results.length === 0) {
                    const summaryDiv = document.getElementById('summary');
                    summaryDiv.style.display = 'block';
                    summaryDiv.innerHTML = `
                        <h2>No Observations Found</h2>
                        <div class="validation-errors" style="background: #ffebee; border-left: 4px solid #c62828; padding: 15px; margin: 15px 0; border-radius: 4px;">
                            <h4 style="color: #c62828; margin-top: 0;">⚠ No Results</h4>
                            <p style="color: #c62828;">Your query returned no observations from iNaturalist.</p>
                            <p style="color: #666;"><strong>Common causes:</strong></p>
                            <ul style="margin: 5px 0; padding-left: 20px; color: #666;">
                                <li>Geographic area is too restrictive or has no observations</li>
                                <li>Date range doesn't match when this species is active</li>
                                <li>Taxon name is misspelled or doesn't exist</li>
                                <li>Observation field filters are too strict</li>
                                <li>Quality filters (research grade, etc.) exclude all results</li>
                            </ul>
                            <p style="color: #666;"><strong>Suggestions:</strong></p>
                            <ul style="margin: 5px 0; padding-left: 20px; color: #666;">
                                <li>Try removing some filters and search again</li>
                                <li>Check the URL works in a browser by visiting iNaturalist directly</li>
                                <li>Start with just a taxon and broad date/place, then add filters</li>
                            </ul>
                        </div>
                    `;
                    showStatus('No observations found. See suggestions above.', 'warning');
                    document.getElementById('fetchButton').disabled = false;
                    return;
                }

                const processed = processObservations(data.results);
                currentObservations = processed;

                if (totalResults > 200) {
                    document.getElementById('totalCount').textContent = totalResults;
                    document.getElementById('paginationWarning').style.display = 'block';
                } else {
                    displayResults(processed);
                }

            } catch (error) {
                showStatus('Error fetching observations: ' + error.message, 'error');
            }

            document.getElementById('fetchButton').disabled = false;
        }

        async function fetchAllPages() {
            showStatus('Fetching all pages... This may take a while.', 'info');
            document.getElementById('paginationWarning').style.display = 'none';

            const maxPages = Math.ceil(totalResults / 200);

            try {
                const data = await fetchInatObservations(currentParams, maxPages);
                const processed = processObservations(data.results);
                currentObservations = processed;

                showStatus(`Fetched all ${processed.length} observations`, 'success');
                displayResults(processed);

            } catch (error) {
                showStatus('Error fetching all pages: ' + error.message, 'error');
            }
        }

        function useCurrentData() {
            document.getElementById('paginationWarning').style.display = 'none';
            displayResults(currentObservations);
        }

        function refineParameters() {
            document.getElementById('paginationWarning').style.display = 'none';
            showStatus('Please adjust your parameters and try again.', 'info');
        }

        function validateObservations(observations, datasetName = 'dataset') {
            const warnings = [];
            const errors = [];

            // Check if we have any observations
            if (!observations || observations.length === 0) {
                errors.push(`No observations found in ${datasetName}. The query returned no results from iNaturalist.`);
                return { valid: false, warnings, errors };
            }

            const summary = summarizeObservations(observations);
            if (!summary) {
                errors.push(`No valid observations with location data in ${datasetName}.`);
                return { valid: false, warnings, errors };
            }

            // Warning for very small sample size
            if (observations.length < 5) {
                warnings.push(`Very small sample size (${observations.length} observations) in ${datasetName}. Predictions may be unreliable. Consider expanding your search criteria.`);
            } else if (observations.length < 10) {
                warnings.push(`Small sample size (${observations.length} observations) in ${datasetName}. Using min/max method. More observations would improve reliability.`);
            }

            // Check latitude range
            const latRange = summary.latitude.max - summary.latitude.min;
            if (latRange < 0.1) {
                errors.push(`All observations in ${datasetName} are at essentially the same latitude (${summary.latitude.mean.toFixed(2)}°). Cannot predict phenology across latitudes. Try expanding the geographic area of your search.`);
                return { valid: false, warnings, errors };
            } else if (latRange < 2) {
                warnings.push(`Narrow latitude range (${latRange.toFixed(1)}°) in ${datasetName}. Predictions for distant latitudes will be extrapolations and less reliable.`);
            }

            // Check seasind range
            const seasindRange = summary.seasind.max - summary.seasind.min;
            if (seasindRange < 0.01) {
                warnings.push(`Very narrow season index range (${seasindRange.toFixed(4)}) in ${datasetName}. All observations occur at nearly the same phenological timing. Predictions may be overly precise.`);
            }

            // Check DOY range
            const doyRange = summary.doy.max - summary.doy.min;
            if (doyRange < 7) {
                warnings.push(`Observations in ${datasetName} span only ${doyRange} days. Consider a wider date range for more robust predictions.`);
            }

            return { valid: true, warnings, errors };
        }

        function displayValidationMessages(validation, containerId = 'validationMessages') {
            let messagesHtml = '';

            if (validation.errors.length > 0) {
                messagesHtml += '<div class="validation-errors" style="background: #ffebee; border-left: 4px solid #c62828; padding: 15px; margin: 15px 0; border-radius: 4px;">';
                messagesHtml += '<h4 style="color: #c62828; margin-top: 0;">⚠ Errors</h4>';
                messagesHtml += '<ul style="margin: 5px 0; padding-left: 20px;">';
                validation.errors.forEach(err => {
                    messagesHtml += `<li style="color: #c62828;">${err}</li>`;
                });
                messagesHtml += '</ul></div>';
            }

            if (validation.warnings.length > 0) {
                messagesHtml += '<div class="validation-warnings" style="background: #fff3e0; border-left: 4px solid #f57c00; padding: 15px; margin: 15px 0; border-radius: 4px;">';
                messagesHtml += '<h4 style="color: #e65100; margin-top: 0;">⚠ Warnings</h4>';
                messagesHtml += '<ul style="margin: 5px 0; padding-left: 20px;">';
                validation.warnings.forEach(warn => {
                    messagesHtml += `<li style="color: #e65100;">${warn}</li>`;
                });
                messagesHtml += '</ul>';
                messagesHtml += '<p style="margin-bottom: 0; font-size: 0.9em; color: #666;"><strong>Suggestions:</strong> Expand geographic area, broaden date range, or include more taxa/observation fields.</p>';
                messagesHtml += '</div>';
            }

            return messagesHtml;
        }

        function comparePhases(obs1, obs2) {
            const summary1 = summarizeObservations(obs1);
            const summary2 = summarizeObservations(obs2);

            if (!summary1 || !summary2) {
                return null;
            }

            // Determine threshold method based on sample sizes
            const thresholdMethod1 = obs1.length < 10 ? 'minmax' : 'stdev';
            const thresholdMethod2 = obs2.length < 10 ? 'minmax' : 'stdev';

            // Calculate seasind bounds for each phenophase
            let phase1Min, phase1Max, phase2Min, phase2Max;

            if (thresholdMethod1 === 'minmax') {
                phase1Min = summary1.seasind.min;
                phase1Max = summary1.seasind.max;
            } else {
                phase1Min = Math.max(0, summary1.seasind.mean - (1.64 * summary1.seasind.std));
                phase1Max = Math.min(1, summary1.seasind.mean + (1.64 * summary1.seasind.std));
            }

            if (thresholdMethod2 === 'minmax') {
                phase2Min = summary2.seasind.min;
                phase2Max = summary2.seasind.max;
            } else {
                phase2Min = Math.max(0, summary2.seasind.mean - (1.64 * summary2.seasind.std));
                phase2Max = Math.min(1, summary2.seasind.mean + (1.64 * summary2.seasind.std));
            }

            // Determine transition window
            // If phases don't overlap: transition is the gap between them
            // If phases overlap: transition is the overlap region
            let transitionStart, transitionEnd, transitionType;

            if (phase1Max < phase2Min) {
                // Clear gap: phase 1 ends before phase 2 begins
                transitionStart = phase1Max;
                transitionEnd = phase2Min;
                transitionType = 'gap';
            } else if (phase2Max < phase1Min) {
                // Reverse gap: phase 2 ends before phase 1 begins (unusual but possible)
                transitionStart = phase2Max;
                transitionEnd = phase1Min;
                transitionType = 'reverse_gap';
            } else {
                // Overlap: use the midpoint of overlap region
                transitionStart = Math.max(phase1Min, phase2Min);
                transitionEnd = Math.min(phase1Max, phase2Max);
                transitionType = 'overlap';
            }

            return {
                summary1: summary1,
                summary2: summary2,
                phase1: { min: phase1Min, max: phase1Max, method: thresholdMethod1 },
                phase2: { min: phase2Min, max: phase2Max, method: thresholdMethod2 },
                transition: { start: transitionStart, end: transitionEnd, type: transitionType }
            };
        }

        function displayComparisonResults(obs1, obs2) {
            // Validate both datasets
            const validation1 = validateObservations(obs1, 'Phenophase 1 (URL 1)');
            const validation2 = validateObservations(obs2, 'Phenophase 2 (URL 2)');

            // Check for critical errors
            if (!validation1.valid || !validation2.valid) {
                const summaryDiv = document.getElementById('summary');
                summaryDiv.style.display = 'block';
                summaryDiv.innerHTML = `
                    <h2>Phenophase Comparison Analysis</h2>
                    ${displayValidationMessages(validation1)}
                    ${displayValidationMessages(validation2)}
                `;
                showStatus('Cannot proceed with comparison due to data quality issues.', 'error');
                return;
            }

            const comparison = comparePhases(obs1, obs2);
            if (!comparison) {
                showStatus('Unable to analyze comparison data.', 'warning');
                return;
            }

            const summaryDiv = document.getElementById('summary');
            summaryDiv.style.display = 'block';

            const minDate1 = doyToDate(comparison.summary1.doy.min);
            const maxDate1 = doyToDate(comparison.summary1.doy.max);
            const minDate2 = doyToDate(comparison.summary2.doy.min);
            const maxDate2 = doyToDate(comparison.summary2.doy.max);

            // Combine warnings from both validations
            const allWarnings = [...validation1.warnings, ...validation2.warnings];
            const validationHtml = allWarnings.length > 0 ? displayValidationMessages({ warnings: allWarnings, errors: [] }) : '';

            summaryDiv.innerHTML = `
                <h2>Phenophase Comparison Analysis</h2>
                ${validationHtml}

                <div class="comparison-section">
                    <h3 style="color: #1976d2;">Phenophase 1 (URL 1)</h3>
                    <div class="summary-grid">
                        <div class="summary-card">
                            <h4>Total Observations</h4>
                            <div class="value">${comparison.summary1.count}</div>
                        </div>
                        <div class="summary-card">
                            <h4>Day of Year Range</h4>
                            <div class="value">${comparison.summary1.doy.min} - ${comparison.summary1.doy.max}</div>
                            <div class="subvalue">${formatDate(minDate1)} to ${formatDate(maxDate1)}</div>
                        </div>
                        <div class="summary-card">
                            <h4>Season Index Range</h4>
                            <div class="value">${comparison.phase1.min.toFixed(4)} - ${comparison.phase1.max.toFixed(4)}</div>
                            <div class="subvalue">Method: ${comparison.phase1.method === 'minmax' ? 'Min/Max' : 'Mean ± 1.64 SD'}</div>
                        </div>
                    </div>
                </div>

                <div class="comparison-section" style="margin-top: 30px;">
                    <h3 style="color: #d32f2f;">Phenophase 2 (URL 2)</h3>
                    <div class="summary-grid">
                        <div class="summary-card">
                            <h4>Total Observations</h4>
                            <div class="value">${comparison.summary2.count}</div>
                        </div>
                        <div class="summary-card">
                            <h4>Day of Year Range</h4>
                            <div class="value">${comparison.summary2.doy.min} - ${comparison.summary2.doy.max}</div>
                            <div class="subvalue">${formatDate(minDate2)} to ${formatDate(maxDate2)}</div>
                        </div>
                        <div class="summary-card">
                            <h4>Season Index Range</h4>
                            <div class="value">${comparison.phase2.min.toFixed(4)} - ${comparison.phase2.max.toFixed(4)}</div>
                            <div class="subvalue">Method: ${comparison.phase2.method === 'minmax' ? 'Min/Max' : 'Mean ± 1.64 SD'}</div>
                        </div>
                    </div>
                </div>

                <div class="comparison-section" style="margin-top: 30px; background: #fff3e0; padding: 20px; border-radius: 8px;">
                    <h3 style="color: #e65100;">Transition Window</h3>
                    <p>${comparison.transition.type === 'gap'
                        ? 'Clear gap detected between phenophases'
                        : comparison.transition.type === 'overlap'
                        ? 'Phenophases overlap - showing transition zone'
                        : 'Unusual: Phase 2 occurs before Phase 1'}</p>
                    <div class="summary-card">
                        <h4>Transition Season Index Range</h4>
                        <div class="value">${comparison.transition.start.toFixed(4)} - ${comparison.transition.end.toFixed(4)}</div>
                    </div>
                </div>

                <div class="prediction-section" style="margin-top: 30px;">
                    <h2>Phenophase Timing Predictions by Latitude</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Latitude</th>
                                <th colspan="2">Phenophase 1</th>
                                <th colspan="2">Transition</th>
                                <th colspan="2">Phenophase 2</th>
                            </tr>
                            <tr>
                                <th></th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Start</th>
                                <th>End</th>
                            </tr>
                        </thead>
                        <tbody id="comparisonPredictionTable">
                        </tbody>
                    </table>
                </div>
            `;

            const predictionTable = document.getElementById('comparisonPredictionTable');

            for (let lat = 25; lat <= 50; lat += 5) {
                // Calculate DOYs for each phase and transition
                const phase1StartDoy = findDoyFromSeasind(comparison.phase1.min, lat);
                const phase1EndDoy = findDoyFromSeasind(comparison.phase1.max, lat);

                const transitionStartDoy = findDoyFromSeasind(comparison.transition.start, lat);
                const transitionEndDoy = findDoyFromSeasind(comparison.transition.end, lat);

                const phase2StartDoy = findDoyFromSeasind(comparison.phase2.min, lat);
                const phase2EndDoy = findDoyFromSeasind(comparison.phase2.max, lat);

                // Convert to dates
                const phase1Start = doyToDate(phase1StartDoy);
                const phase1End = doyToDate(phase1EndDoy);
                const transitionStart = doyToDate(transitionStartDoy);
                const transitionEnd = doyToDate(transitionEndDoy);
                const phase2Start = doyToDate(phase2StartDoy);
                const phase2End = doyToDate(phase2EndDoy);

                const row = predictionTable.insertRow();
                row.innerHTML = `
                    <td><strong>${lat}°N</strong></td>
                    <td style="background: #e3f2fd;">${formatDate(phase1Start)}</td>
                    <td style="background: #e3f2fd;">${formatDate(phase1End)}</td>
                    <td style="background: #fff3e0;">${formatDate(transitionStart)}</td>
                    <td style="background: #fff3e0;">${formatDate(transitionEnd)}</td>
                    <td style="background: #ffebee;">${formatDate(phase2Start)}</td>
                    <td style="background: #ffebee;">${formatDate(phase2End)}</td>
                `;
            }
        }

        function displayResults(observations) {
            // Validate observations
            const validation = validateObservations(observations, 'this dataset');

            // Check for critical errors
            if (!validation.valid) {
                const summaryDiv = document.getElementById('summary');
                summaryDiv.style.display = 'block';
                summaryDiv.innerHTML = `
                    <h2>Observation Summary</h2>
                    ${displayValidationMessages(validation)}
                `;
                showStatus('Cannot generate predictions due to data quality issues.', 'error');
                return;
            }

            const summary = summarizeObservations(observations);
            if (!summary) {
                showStatus('No valid observations to analyze.', 'warning');
                return;
            }

            const summaryDiv = document.getElementById('summary');
            summaryDiv.style.display = 'block';

            const minDate = doyToDate(summary.doy.min);
            const maxDate = doyToDate(summary.doy.max);

            const validationHtml = validation.warnings.length > 0 ? displayValidationMessages(validation) : '';

            summaryDiv.innerHTML = `
                <h2>Observation Summary</h2>
                ${validationHtml}
                <div class="summary-grid">
                    <div class="summary-card">
                        <h3>Total Observations</h3>
                        <div class="value">${summary.count}</div>
                    </div>
                    <div class="summary-card">
                        <h3>Day of Year Range</h3>
                        <div class="value">${summary.doy.min} - ${summary.doy.max}</div>
                        <div class="subvalue">${formatDate(minDate)} to ${formatDate(maxDate)}</div>
                    </div>
                    <div class="summary-card">
                        <h3>Latitude Range</h3>
                        <div class="value">${summary.latitude.min.toFixed(2)}° - ${summary.latitude.max.toFixed(2)}°</div>
                        <div class="subvalue">Mean: ${summary.latitude.mean.toFixed(2)}°</div>
                    </div>
                    <div class="summary-card">
                        <h3>Longitude Range</h3>
                        <div class="value">${summary.longitude.min.toFixed(2)}° - ${summary.longitude.max.toFixed(2)}°</div>
                        <div class="subvalue">Mean: ${summary.longitude.mean.toFixed(2)}°</div>
                    </div>
                    <div class="summary-card">
                        <h3>Season Index Range</h3>
                        <div class="value">${summary.seasind.min.toFixed(4)} - ${summary.seasind.max.toFixed(4)}</div>
                        <div class="subvalue">Mean: ${summary.seasind.mean.toFixed(4)} ± ${summary.seasind.std.toFixed(4)}</div>
                    </div>
                </div>

                <div class="prediction-section">
                    <h2>Phenology Predictions by Latitude</h2>
                    <p>Using ${summary.count < 10 ? 'min/max' : 'mean ± 1.64 SD'} threshold method</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Latitude</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>DOY Range</th>
                                <th>Season Index Range</th>
                            </tr>
                        </thead>
                        <tbody id="predictionTable">
                        </tbody>
                    </table>
                </div>
            `;

            const predictionTable = document.getElementById('predictionTable');
            const thresholdMethod = summary.count < 10 ? 'minmax' : 'stdev';

            for (let lat = 25; lat <= 50; lat += 5) {
                const prediction = predictPhenologyDates(observations, lat, thresholdMethod);
                if (prediction) {
                    const row = predictionTable.insertRow();
                    row.innerHTML = `
                        <td>${prediction.targetLatitude}°N</td>
                        <td>${formatDate(prediction.startDate)}</td>
                        <td>${formatDate(prediction.endDate)}</td>
                        <td>${prediction.startDoy} - ${prediction.endDoy}</td>
                        <td>${prediction.minSeasind.toFixed(4)} - ${prediction.maxSeasind.toFixed(4)}</td>
                    `;
                }
            }
        }
