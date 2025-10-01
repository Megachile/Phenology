# Phenology Predictor - Implementation Plan

## Project Overview
Integrate phenology prediction capabilities into the iNaturalist Helper browser extension. Users can generate iNaturalist queries using the URLgen page, then predict when phenological events will occur at different latitudes based on accumulated daylight (season index).

## Core Concept
- **Season Index (seasind)**: Accumulated daylight hours as a fraction of the annual total, adjusted for latitude
- **Prediction Logic**: Calculate seasind range from observations, then find corresponding day-of-year (DOY) for any target latitude
- **Route Around Weather Data**: Use synthetic season index instead of GridMET weather data (for now)

## Current Status (as of 2025-09-30)

### ✅ Completed
1. **URLgen Integration**
   - Added "Predict Phenology" button (purple) to URLgen.html
   - Added "Enable Comparison Mode" checkbox for phenophase transitions
   - Added "Save URL for Comparison" button (orange) that appears when comparison mode enabled
   - Fixed CSP violations by externalizing all JavaScript
   - Fixed scroll/padding issues (450px padding when comparison mode enabled)
   - Button stays visible after saving URL (allows re-saving URL 1)

2. **phenoPredictor.html Page**
   - Single URL mode (default)
   - Comparison mode (receives two URLs via query params)
   - URL detection and auto-population from URLgen
   - Display toggles between single/comparison modes

3. **Season Index Calculations (phenoPredictor.js)**
   - Ported R functions to JavaScript:
     - `declination(doy)` - solar declination angle
     - `eq(doy, lat)` - effective daylight hours accounting for twilight
     - `singlesi(doy, lat)` - season index for specific day and latitude
     - `trapz(x, y)` - trapezoidal integration
   - `calculateSeasind(date, latitude)` - main calculation function
   - `findDoyFromSeasind(targetSeasind, latitude)` - inverse lookup

4. **Data Processing**
   - `fetchInatObservations(params, maxPages)` - API calls with pagination
   - `processObservations(rawObservations)` - extract lat/lon/date, calculate seasind
   - `summarizeObservations(observations)` - statistical summary
   - `predictPhenologyDates(observations, targetLatitude, thresholdMethod)` - generate predictions

5. **UI Features**
   - Observation summary cards (count, DOY range, lat/lon range, seasind stats)
   - Prediction table showing dates across latitude gradient (25°N to 50°N by 5°)
   - Pagination warning when >200 observations (option to fetch all or use subset)
   - Threshold methods: min/max for small samples (<10), mean ± 1.64 SD for larger samples

### 🚧 Known Issues
None currently - latest fixes address scroll and button visibility

## Next Steps

### Priority 1: Test and Refine Current Workflow
1. **User Testing**
   - Test single URL mode end-to-end
   - Test comparison mode workflow (save URL 1, modify query, compare)
   - Verify 450px padding is sufficient for all screen sizes
   - Check predictions are accurate (compare to R version if needed)

2. **UI Polish**
   - Adjust latitude range in prediction table if needed (currently 25-50°N by 5°)
   - Add option to customize target latitudes
   - Add visualization (optional): date ranges plotted against latitude

### Priority 2: Implement Comparison Mode Logic
**Currently**: Comparison mode saves two URLs but only analyzes URL 1

**Need to**:
1. Fetch both URL datasets separately
2. Calculate seasind ranges for each
3. Determine transition window:
   - Option A: Range between max(URL1 seasind) and min(URL2 seasind)
   - Option B: Statistical approach if ranges overlap
4. Display comparison results:
   - Show both phenophase seasind ranges
   - Show predicted transition dates by latitude
   - Highlight differences in timing between states

**Files to modify**:
- `phenoPredictor.js` lines 290-332 (fetchObservations function)
- Add `comparePhases(obs1, obs2, targetLatitude)` function
- Modify `displayResults()` to handle comparison output

### Priority 3: Enhanced Features
1. **Export Predictions**
   - CSV download of prediction table
   - Copy-to-clipboard formatted text

2. **Custom Latitude Selection**
   - Allow user to specify target latitude(s)
   - Or detect latitude from saved places/observations

3. **Validation & Error Handling**
   - Handle edge cases (no observations, all same latitude, etc.)
   - Warn if observations span too narrow a seasind range
   - Check if date ranges in URL match observation data

4. **Performance Optimization**
   - Cache API responses (localStorage)
   - Debounce/throttle API calls
   - Progress indicator for multi-page fetches

### Priority 4: Integration with Weather Data (Future)
When ready to add GridMET weather data:
1. Add parallel fetch for weather data during observation processing
2. Compare seasind predictions vs. GDD/chill hour predictions
3. Display both models side-by-side
4. Allow user to choose which predictor to use

## File Structure
```
C:\Users\adam\Documents\GitHub\Phenology\inathelperJS\
├── URLgen.html           # Main URL builder with phenology buttons
├── URLgen.js             # URL generation + phenology button handlers
├── URLgen.css            # Shared styles (purple button styling)
├── phenoPredictor.html   # Phenology prediction page
├── phenoPredictor.js     # All logic: seasind calculations, API calls, predictions
└── background.js         # Extension background script (handles page opening)
```

## Key Functions Reference

### Season Index Calculations
- `declination(dayOfYear)` → degrees
- `eq(doy, lat=49)` → effective daylight hours
- `posPart(x)` → max(x, 0)
- `trapz(x, y)` → integrated area
- `singlesi(doy, lat)` → season index [0-1]
- `calculateSeasind(date, latitude)` → seasind for observation
- `findDoyFromSeasind(targetSeasind, latitude)` → day of year
- `doyToDate(doy, year=2023)` → Date object

### Data Processing
- `fetchInatObservations(params, maxPages=1)` → {results, totalResults, fetchedPages}
- `processObservations(rawObservations)` → array of processed obs with seasind
- `summarizeObservations(observations)` → {count, doy, latitude, longitude, seasind}
- `predictPhenologyDates(observations, targetLatitude, thresholdMethod)` → prediction object

## Testing Checklist
- [ ] Single URL: Load URLgen → build query → click "Predict Phenology" → verify results
- [ ] Comparison mode: Enable checkbox → save URL 1 → modify query → click phenology → verify both URLs received
- [ ] Pagination: Query with >200 results → verify warning → test "fetch all" option
- [ ] Edge cases: Empty results, single observation, all same latitude
- [ ] Scroll behavior: Verify all "Add" buttons visible with comparison mode enabled
- [ ] Button persistence: Verify "Save URL" button stays visible after clicking

## Notes
- Original Python PhenoEstimator repo exists at `C:\Users\adam\Documents\GitHub\PhenoEstimator` but focus is now on browser extension
- JavaScript port of R functions verified against original `seasind.R` calculations
- Browser extension manifest uses CSP - all scripts must be external files
- iNaturalist API returns max 200 results per page, supports pagination
