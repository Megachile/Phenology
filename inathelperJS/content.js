console.log("Content script loaded. URL:", window.location.href);
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
let buttonPosition = 'bottom-right'; // Default position
let idDisplay;
let refreshEnabled = true;
let isButtonsVisible = true;
let customShortcuts = [];
let lastKnownUpdate = 0;
const API_URL = 'https://api.inaturalist.org/v1';
let shortcutListVisible = false;
let currentJWT = null;
let currentObservationId = null;
let checkInterval = null;
let observationTabsContainer = null;
let hasMoved = false;
let debugMode = false; 
let bulkActionModeEnabled = false;
let selectedObservations = new Set();

function debugLog(message) {
    if (debugMode) {
        console.log(message);
    }
}

function enableDebugMode() {
    debugMode = true;
}

function disableDebugMode() {
    debugMode = false;
}

const qualityMetrics = [
    { value: 'needs_id', label: 'Can the Community Taxon still be confirmed or improved?' },
    { value: 'date', label: 'Date is accurate' },
    { value: 'location', label: 'Location is accurate' },
    { value: 'wild', label: 'Organism is wild' },
    { value: 'evidence', label: 'Evidence of organism' },
    { value: 'recent', label: 'Recent evidence of an organism' },
    { value: 'subject', label: 'Evidence related to a single subject' }
];

function getJWTFromPage() {
    const metaTag = document.querySelector('meta[name="inaturalist-api-token"]');
    return metaTag ? metaTag.getAttribute('content') : null;
}

async function getJWT() {
    if (currentJWT) return currentJWT;
    
    currentJWT = getJWTFromPage();
    if (currentJWT) {
        chrome.storage.local.set({jwt: currentJWT});
        return currentJWT;
    }
    
    // If not on page, try to get from storage
    const stored = await chrome.storage.local.get('jwt');
    if (stored.jwt) {
        currentJWT = stored.jwt;
        return currentJWT;
    }
    
    console.error('No JWT available');
    return null;
}

async function makeAPIRequest(endpoint, options = {}) {
    const jwt = await getJWT();
    if (!jwt) {
        console.error('No JWT available');
        return null;
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${jwt}`
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token might be expired, try to get a new one from the page
                currentJWT = null;
                return makeAPIRequest(endpoint, options);
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Function to test the JWT
async function testJWT() {
    try {
        const response = await makeAPIRequest('/users/me');
        console.log('JWT test response:', response);
        return response && response.results && response.results[0] && response.results[0].id;
    } catch (error) {
        console.error('Error in JWT test:', error);
        return false;
    }
}

// Initialize and test JWT when the script loads
(async function() {
    const jwt = await getJWT();
    if (jwt) {
        const isValid = await testJWT();
        if (isValid) {
            console.log('JWT is valid');
        } else {
            console.log('JWT is invalid, will try to get a new one on next API call');
            currentJWT = null;
        }
    } else {
        console.log('No JWT found');
    }
})();

function toggleShortcutList() {
    if (shortcutListVisible) {
        document.getElementById('shortcut-list-container').remove();
        shortcutListVisible = false;
    } else {
        createShortcutList();
        shortcutListVisible = true;
    }
}

 
  const debouncedStartObservationCheck = debounce(startObservationCheck, 100);
  const debouncedStopAndClear = debounce(() => {
    stopObservationCheck();
    if (!window.location.pathname.match(/^\/observations\/\d+/)) {
    clearObservationId();
    }
    if (idDisplay) {
      idDisplay.style.display = 'none';
    }
  }, 100);
  
  const observer = new MutationObserver((mutations) => {
    const modal = document.querySelector('.ObservationModal.FullScreenModal');
    const enableButton = document.getElementById('enable-bulk-mode-button');
    const bulkContainer = document.getElementById('bulk-action-container');

    if (modal) {
        if (enableButton) enableButton.style.display = 'none';
    } else {
        if (enableButton && !bulkActionModeEnabled) enableButton.style.display = 'block';
    }

    if (modal) {
        debouncedStartObservationCheck();
    } else {
        debouncedStopAndClear();
    }
});


function createShortcutList() {
    debugLog('Creating shortcut list');
    const container = document.createElement('div');
    container.id = 'shortcut-list-container';
    container.style.cssText = `
        position: fixed;
        top: 50%;
        left: 20px;
        transform: translateY(-50%);
        background-color: white;
        border: 1px solid #ccc;
        padding: 20px;
        z-index: 10001;
        max-height: 90vh;
        width: 300px;
        overflow-y: auto;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        font-size: 16px;
        line-height: 1.5;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Keyboard Shortcuts';
    title.style.fontSize = '20px';
    title.style.marginBottom = '15px';
    container.appendChild(title);

    const list = document.createElement('ul');
    list.style.paddingLeft = '20px';
    list.innerHTML = `
        <li>Shift + B: Toggle button visibility</li>
        <li>Alt + N: Cycle button position</li>
        <li>Ctrl + Shift + R: Toggle refresh</li>
        <li>Alt + H: Toggle this shortcut list</li>
    `;

    // Add custom shortcuts
    browserAPI.storage.sync.get('customButtons', function(data) {
        const customButtons = data.customButtons || [];
        customButtons.forEach(button => {
            if (button.shortcut && button.shortcut.key) {
                const li = document.createElement('li');
                li.textContent = `${formatShortcut(button.shortcut)}: ${button.name}`;
                list.appendChild(li);
            }
        });
        container.appendChild(list);
        document.body.appendChild(container);
        debugLog('Shortcut list created and appended to body');
    });
}

function handleAllShortcuts(event) {
    // Always allow these shortcuts, even when typing
    if (event.shiftKey && event.key.toLowerCase() === 'b') {
        toggleButtonVisibility();
        return;
    }
    if (event.altKey && event.key.toLowerCase() === 'n') {
        cycleButtonPosition();
        return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        toggleRefresh();
        return;
    }
    if (event.altKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        toggleShortcutList();
        return;
    }

    // Check if the active element is an input or textarea
    const activeElement = document.activeElement;
    const isTyping = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable;

    // If user is typing, don't process other shortcuts
    if (isTyping) {
        return;
    }

    // Process custom shortcuts only if not typing
    customShortcuts.forEach(shortcut => {
        if (event.key.toLowerCase() === shortcut.key.toLowerCase() &&
            event.ctrlKey === shortcut.ctrlKey &&
            event.shiftKey === shortcut.shiftKey &&
            event.altKey === shortcut.altKey) {
            debugLog('Custom shortcut matched:', shortcut.name);
            if (shortcut.button && shortcut.button.isConnected) {
                debugLog('Clicking button:', shortcut.button.innerText);
                shortcut.button.click();
            } else {
                debugLog('Button not found or not connected to DOM for shortcut:', shortcut.name);
            }
        }
    });
}

document.addEventListener('keydown', handleAllShortcuts);

function checkForConfigUpdates() {
    browserAPI.storage.sync.get(['lastConfigUpdate'], function(result) {
        if (result.lastConfigUpdate) {
            if (lastKnownUpdate === 0) {
                // First time checking, just update lastKnownUpdate without showing notification
                lastKnownUpdate = result.lastConfigUpdate;
            } else if (result.lastConfigUpdate > lastKnownUpdate) {
                // Configuration has been updated since last check
                showUpdateNotification();
                lastKnownUpdate = result.lastConfigUpdate;
            }
/*             debugLog('Checking for config updates. Current lastKnownUpdate:', lastKnownUpdate);
            debugLog('Storage lastConfigUpdate:', result.lastConfigUpdate); */
        }
        // If lastConfigUpdate doesn't exist, do nothing
    });
}

function showUpdateNotification() {
    let notification = document.getElementById('config-update-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'config-update-notification';
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #ffff00;
            color: #000;
            padding: 10px;
            border-radius: 5px;
            z-index: 10001;
            cursor: pointer;
        `;
        notification.textContent = 'Configuration updated. Click here to refresh.';
        notification.addEventListener('click', () => location.reload());
        document.body.appendChild(notification);
    }
    notification.style.display = 'block';
}

// Check for updates every 60 seconds
setInterval(checkForConfigUpdates, 4000);

// Initial check on page load
document.addEventListener('DOMContentLoaded', checkForConfigUpdates);

const positions = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
let currentPositionIndex = 0;

function toggleButtonVisibility() {
    const buttonDiv = document.getElementById('custom-extension-container').parentElement;
    isButtonsVisible = !isButtonsVisible;
    buttonDiv.style.display = isButtonsVisible ? 'block' : 'none';
}

function cycleButtonPosition() {
    currentPositionIndex = (currentPositionIndex + 1) % positions.length;
    buttonPosition = positions[currentPositionIndex];
    updatePositions();
    updateBulkButtonPosition();
    browserAPI.storage.sync.set({buttonPosition: buttonPosition});
}


browserAPI.storage.sync.get('buttonPosition', function(data) {
    if (data.buttonPosition) {
        buttonPosition = data.buttonPosition;
        currentPositionIndex = positions.indexOf(buttonPosition);
        updatePositions();
    }
});

function updatePositions() {
    const buttonDiv = document.getElementById('custom-extension-container').parentElement;
    buttonDiv.style.top = buttonDiv.style.left = buttonDiv.style.bottom = buttonDiv.style.right = 'auto';
    
    if (idDisplay) {
        idDisplay.style.top = idDisplay.style.left = idDisplay.style.bottom = idDisplay.style.right = 'auto';
    }
    
    switch (buttonPosition) {
        case 'top-left':
            buttonDiv.style.top = '10px';
            buttonDiv.style.left = '10px';
            if (idDisplay) {
                idDisplay.style.top = '10px';
                idDisplay.style.right = '10px';
            }
            break;
        case 'top-right':
            buttonDiv.style.top = '10px';
            buttonDiv.style.right = '10px';
            if (idDisplay) {
                idDisplay.style.top = '10px';
                idDisplay.left = '10px';
            }
            break;
        case 'bottom-left':
            buttonDiv.style.bottom = '10px';
            buttonDiv.style.left = '10px';
            if (idDisplay) {
                idDisplay.style.bottom = '10px';
                idDisplay.style.right = '10px';
            }
            break;
        case 'bottom-right':
            buttonDiv.style.bottom = '10px';
            buttonDiv.style.right = '10px';
            if (idDisplay) {
                idDisplay.style.bottom = '10px';
                idDisplay.style.left = '10px';
            }
            break;
    }
    updateBulkButtonPosition();
}

function updateBulkButtonPosition() {
    console.log('Updating bulk button position');
    const bulkButtonContainer = document.getElementById('bulk-action-container');
    if (!bulkButtonContainer) return;

    bulkButtonContainer.style.top = bulkButtonContainer.style.left = bulkButtonContainer.style.bottom = bulkButtonContainer.style.right = 'auto';
    
    switch (buttonPosition) {
        case 'top-left':
            bulkButtonContainer.style.top = '10px';
            bulkButtonContainer.style.right = '10px';
            break;
        case 'top-right':
            bulkButtonContainer.style.top = '10px';
            bulkButtonContainer.style.left = '10px';
            break;
        case 'bottom-left':
            bulkButtonContainer.style.bottom = '10px';
            bulkButtonContainer.style.right = '10px';
            break;
        case 'bottom-right':
            bulkButtonContainer.style.bottom = '10px';
            bulkButtonContainer.style.left = '10px';
            break;
    }
}

let lastLoggedState = {
    url: null,
    observationId: null,
    modalFound: null,
    gridFound: null
};

function extractObservationId() {
    const currentUrl = window.location.href;
    const currentState = {
        url: currentUrl,
        observationId: null,
        modalFound: false,
        gridFound: false
    };

    // Check if we're on an individual observation page
    if (window.location.pathname.match(/^\/observations\/\d+$/)) {
        const id = window.location.pathname.split('/').pop();
        if (id && /^\d+$/.test(id)) {
            currentState.observationId = id;
        }
    }

    const modal = document.querySelector('.ObservationModal.FullScreenModal');
    currentState.modalFound = !!modal;

    if (modal) {
        const selectors = [
            '.obs-modal-header a[href^="/observations/"]',
            '.obs-modal-header .comname.display-name',
            '.obs-modal-header .sciname.secondary-name'
        ];

        for (let selector of selectors) {
            const element = modal.querySelector(selector);
            if (element) {
                const href = element.getAttribute('href');
                if (href) {
                    const potentialId = href.split('/').pop();
                    if (potentialId && /^\d+$/.test(potentialId)) {
                        currentState.observationId = potentialId;
                        break;
                    }
                }
            }
        }
    }

    const grid = document.querySelector("#Identify > div > div.mainrow.false.row > div.main-col > div.ObservationsGrid.flowed.false.row");
    currentState.gridFound = !!grid;

    // Only log if there's a change or unexpected state
    if (JSON.stringify(currentState) !== JSON.stringify(lastLoggedState)) {
        console.log('extractObservationId: State changed', {
            url: currentState.url,
            observationId: currentState.observationId,
            modalFound: currentState.modalFound,
            gridFound: currentState.gridFound
        });

        if (!currentState.observationId) {
            console.log('extractObservationId: No valid observation ID found');
        }

        if (!currentState.modalFound && !currentState.gridFound) {
            console.log('extractObservationId: Neither modal nor grid found');
        }

        lastLoggedState = currentState;
    }

    if (currentState.observationId !== currentObservationId) {
        console.log('extractObservationId: New Observation ID:', currentState.observationId);
        currentObservationId = currentState.observationId;
        createOrUpdateIdDisplay(currentState.observationId || 'Unknown');
    }
}

function extractObservationIdFromUrl() {
    const url = window.location.href;
    console.log('Current URL:', url);
    const urlPattern = /https:\/\/www\.inaturalist\.org\/observations\/(\d+)/;
    const match = url.match(urlPattern);

    if (match && match[1]) {
        console.log('Extracted observation ID from URL:', match[1]);
        return match[1];
    }

    if (url.includes('/observations/identify')) {
        console.log('On identify page, no observation ID in URL');
        return null;
    }

    console.log('Unable to extract observation ID from URL:', url);
    return null;
}

function setupObservationTabsObserver() {
    debugLog('Setting up observation tabs observer');
    observationTabsContainer = document.querySelector('.ObservationsPane');
    if (!observationTabsContainer) {
        console.log('Observation tabs container not found, retrying in 1 second...');
        setTimeout(setupObservationTabsObserver, 1000);
        return;
    }

    debugLog('Observation tabs container found');
    const observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-id') {
                const newId = observationTabsContainer.getAttribute('data-id');
                debugLog('New data-id detected:', newId);
                if (newId && newId !== currentObservationId) {
                    currentObservationId = newId;
                    console.log('Current Observation ID (from tab change):', currentObservationId);
                    createOrUpdateIdDisplay(currentObservationId);
                }
                break;
            }
        }
    });

    observer.observe(observationTabsContainer, { attributes: true, attributeFilter: ['data-id'] });
    console.log('Observer set up successfully');
}

function logModalStructure() {
    const modal = document.querySelector('.ObservationModal.FullScreenModal');
    if (modal) {
        const header = modal.querySelector('.obs-modal-header');
        if (header) {
            debugLog('Header structure:', header.innerHTML);
        } else {
            debugLog('Header not found in modal');
        }
    } else {
        debugLog('Modal not found');
    }
}

function startObservationCheck() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(extractObservationId, 250);
}

function stopObservationCheck() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}



observer.observe(document.body, { childList: true, subtree: true });

function ensureCorrectObservationId() {
    return new Promise((resolve) => {
        extractObservationId();
        setTimeout(() => {
            resolve(currentObservationId);
        }, 50);
    });
}

window.addEventListener('load', extractObservationId);

function animateButton(button) {
    button.style.transform = 'scale(0.9)';
    setTimeout(() => {
        button.style.transform = '';
    }, 100);
}

// Create buttons and add them to the page
let buttonDiv = document.createElement('div');
buttonDiv.style.position = 'fixed';
buttonDiv.style.zIndex = '10000';

const buttonContainer = document.createElement('div');
buttonContainer.id = 'custom-extension-container';

buttonDiv.appendChild(buttonContainer);
document.body.appendChild(buttonDiv);

async function addObservationField(observationId, fieldId, value, button = null) {
        if (!observationId) {
        console.log('No observation ID provided. Please select an observation first.');
        return { success: false, error: 'No observation ID provided' };
        }

       const jwt = await getJWT();
        if (!jwt) {
            console.error('No JWT found');
            return { success: false, error: 'No JWT found' };
        }

        const requestUrl = `https://api.inaturalist.org/v1/observation_field_values`;
        const headers = {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json'
        };
        const data = {
            observation_field_value: {
                observation_id: observationId,
                observation_field_id: fieldId,
                value: value
            }
        };
        const options = {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        };

        try {
            const response = await fetch(requestUrl, options);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Network response was not ok. Status: ${response.status}, Body: ${text}`);
            }
            const responseData = await response.json();
            console.log('Added observation field:', responseData);
            return { success: true, data: responseData };
        } catch (error) {
            if (error.message.includes("Observation user does not accept fields from others")) {
                console.log('User does not accept fields from others:', error);
                return { success: false, error: 'User does not accept fields from others' };
            } else {
                console.error('Error in adding observation field:', error);
                return { success: false, error: error.message };
            }
        }
}

async function addAnnotation(observationId, attributeId, valueId) {
    if (!observationId) {
        console.log('No observation ID provided. Please select an observation first.');
        return { success: false, error: 'No observation ID provided' };
    }

    const jwt = await getJWT();
    if (!jwt) {
        console.error('No JWT found');
        return { success: false, error: 'No JWT found' };
    }

    const url = 'https://api.inaturalist.org/v1/annotations';
    const data = {
        annotation: {
            resource_type: "Observation",
            resource_id: observationId,
            controlled_attribute_id: attributeId,
            controlled_value_id: valueId
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify(data)
        });
        const responseData = await response.json();
        if (responseData.errors) {
            console.log('Annotation not added:', responseData.errors);
            return { success: false, message: 'Annotation not added', data: responseData };
        } else {
            console.log('Annotation added successfully:', responseData);
            return { success: true, data: responseData, uuid: responseData.uuid };
        }
    } catch (error) {
        console.error('Error adding annotation:', error);
        return { success: false, error: error.toString() };
    }
}

async function addObservationToProject(observationId, projectId) {
    if (!observationId) {
        console.log('No observation ID provided. Please select an observation first.');
        return { success: false, error: 'No observation ID provided' };
    }

    const jwt = await getJWT();
    if (!jwt) {
        console.error('No JWT found');
        return { success: false, error: 'No JWT found' };
    }

    const url = 'https://api.inaturalist.org/v1/project_observations';
    const data = {
        project_observation: {
            observation_id: observationId,
            project_id: projectId
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify(data)
        });
        const responseData = await response.json();
        if (responseData.errors) {
            console.log('Observation not added to project:', responseData.errors);
            return { success: false, message: 'Observation not added to project', data: responseData };
        } else {
            console.log('Observation added to project successfully:', responseData);
            return { success: true, data: responseData };
        }
    } catch (error) {
        console.error('Error adding observation to project:', error);
        return { success: false, error: error.toString() };
    }
}

async function addComment(observationId, commentBody) {
    if (!observationId) {
        console.log('No observation ID provided. Please select an observation first.');
        return { success: false, error: 'No observation ID provided' };
    }

    const jwt = await getJWT();
    if (!jwt) {
        console.error('No JWT found');
        return { success: false, error: 'No JWT found' };
    }

    const url = 'https://api.inaturalist.org/v1/comments';
    const data = {
        comment: {
            parent_type: 'Observation',
            parent_id: observationId,
            body: commentBody
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify(data)
        });
        const responseData = await response.json();
        if (responseData.errors) {
            console.log('Comment not added:', responseData.errors);
            return { success: false, message: 'Comment not added', data: responseData };
        } else {
            console.log('Comment added successfully:', responseData);
            return { success: true, data: responseData, uuid: responseData.uuid };
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        return { success: false, error: error.toString() };
    }
}

async function addTaxonId(observationId, taxonId, comment = '') {
    if (!observationId) {
        console.log('No observation ID provided. Please select an observation first.');
        return { success: false, error: 'No observation ID provided' };
    }

    const jwt = await getJWT();
    if (!jwt) {
        console.error('No JWT found');
        return { success: false, error: 'No JWT found' };
    }

    const url = 'https://api.inaturalist.org/v1/identifications';
    const data = {
        identification: {
            observation_id: observationId,
            taxon_id: taxonId,
            body: comment
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify(data)
        });
        const responseData = await response.json();
        if (responseData.errors) {
            console.log('Taxon ID not added:', responseData.errors);
            return { success: false, message: 'Taxon ID not added', data: responseData };
        } else {
            console.log('Taxon ID added successfully:', responseData);
            return { success: true, data: responseData };
        }
    } catch (error) {
        console.error('Error adding Taxon ID:', error);
        return { success: false, error: error.toString() };
    }
}
async function handleQualityMetricAPI(observationId, metric, vote) {
    const jwt = await getJWT();
    if (!jwt) {
        console.error('No JWT found');
        return { success: false, error: 'No JWT found' };
    }

    let url, method, body;

    if (metric === 'needs_id') {
        if (vote === 'remove') {
            url = `https://api.inaturalist.org/v1/votes/unvote/observation/${observationId}?scope=needs_id`;
            method = 'DELETE';
            body = null;
        } else {
            url = `https://api.inaturalist.org/v1/votes/vote/observation/${observationId}`;
            method = 'POST';
            body = JSON.stringify({ vote: vote === 'agree' ? 'yes' : 'no', scope: 'needs_id' });
        }
    } else {
        url = `https://api.inaturalist.org/v1/observations/${observationId}/quality/${metric}`;
        method = vote === 'remove' ? 'DELETE' : 'POST';
        body = vote === 'disagree' ? JSON.stringify({ agree: "false" }) : null;
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            },
            body: body
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log(`Quality metric ${metric} ${vote} successful:`, responseData);

        if (metric !== 'needs_id') {
            await updateQualityMetrics(observationId);
        }

        return { success: true, data: responseData };
    } catch (error) {
        console.error(`Error in quality metric ${metric} ${vote}:`, error);
        return { success: false, error: error.toString() };
    }
}

async function handleQualityMetric(observationId, metricValue, vote) {
    const metricLabel = getMetricLabel(metricValue);
    console.log(`Handling quality metric: ${metricLabel}, vote: ${vote}`);
    
    const metricsContainer = document.querySelector('.QualityMetrics');
    if (!metricsContainer) {
        console.error('QualityMetrics container not found');
        return { success: false, error: 'QualityMetrics container not found' };
    }

    const rows = metricsContainer.querySelectorAll('tr');
    const targetRow = Array.from(rows).find(row => {
        const titleCell = row.querySelector('td.metric_title');
        return titleCell && titleCell.textContent.trim() === metricLabel;
    });

    if (!targetRow) {
        console.error(`Metric "${metricLabel}" not found`);
        return { success: false, error: 'Metric not found' };
    }

    const agreeCell = targetRow.querySelector('td.agree');
    const disagreeCell = targetRow.querySelector('td.disagree');
    const agreeButton = agreeCell.querySelector('button');
    const disagreeButton = disagreeCell.querySelector('button');
    
    if (!agreeButton || !disagreeButton) {
        console.error(`Buttons for "${metricLabel}" not found`);
        return { success: false, error: 'Buttons not found' };
    }

    const currentState = getCurrentState(agreeCell, disagreeCell);
    console.log(`Current state for ${metricLabel}: ${currentState}`);

    let buttonToClick;
    switch (vote) {
        case 'agree':
            buttonToClick = currentState !== 'agree' ? agreeButton : null;
            break;
        case 'disagree':
            buttonToClick = currentState !== 'disagree' ? disagreeButton : null;
            break;
        case 'remove':
            buttonToClick = currentState === 'agree' ? agreeButton : 
                            currentState === 'disagree' ? disagreeButton : null;
            break;
    }

    if (buttonToClick) {
        console.log(`Clicking ${buttonToClick === agreeButton ? 'agree' : 'disagree'} button for "${metricLabel}"`);
        buttonToClick.click();
        await waitForStateChange(targetRow, currentState);
    } else {
        console.log(`No action needed for ${metricLabel} - already in desired state`);
    }

    console.log(`${metricLabel} ${vote} action completed`);
    return { success: true };
}

function getCurrentState(agreeCell, disagreeCell) {
    const agreeButton = agreeCell.querySelector('button');
    const disagreeButton = disagreeCell.querySelector('button');

    if (agreeButton.querySelector('.fa-thumbs-up')) {
        return 'agree';
    } else if (disagreeButton.querySelector('.fa-thumbs-down')) {
        return 'disagree';
    } else {
        return 'none';
    }
}

function waitForStateChange(row, originalState) {
    return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
            const newState = getCurrentState(row.querySelector('td.agree'), row.querySelector('td.disagree'));
            if (newState !== originalState) {
                observer.disconnect();
                resolve();
            }
        });

        observer.observe(row, { 
            subtree: true, 
            childList: true,
            attributes: true,
            attributeFilter: ['class']
        });

        // Timeout after 5 seconds in case the state doesn't change
        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 50);
    });
}

function getMetricLabel(value) {
    const metric = qualityMetrics.find(m => m.value === value);
    return metric ? metric.label : value;
}

async function copyObservationField(observationId, sourceFieldId, targetFieldId) {
    try {
        // GET request to fetch the observation details
        const observationResponse = await makeAPIRequest(`/observations/${observationId}`);
        if (!observationResponse.results || observationResponse.results.length === 0) {
            throw new Error('Observation not found');
        }

        const observation = observationResponse.results[0];
        const sourceFieldValue = observation.ofvs.find(ofv => ofv.field_id === parseInt(sourceFieldId));

        if (!sourceFieldValue) {
            throw new Error('Source field not found on the observation');
        }

        // POST request to add the value to the target field
        const postResponse = await makeAPIRequest('/observation_field_values', {
            method: 'POST',
            body: JSON.stringify({
                observation_field_value: {
                    observation_id: observationId,
                    observation_field_id: targetFieldId,
                    value: sourceFieldValue.value
                }
            })
        });

        console.log('Field value copied successfully:', postResponse);
        return { success: true, data: postResponse };
    } catch (error) {
        console.error('Error in copyObservationField:', error);
        return { success: false, error: error.toString() };
    }
}

function animateButtonResult(button, success) {
    button.classList.add(success ? 'button-success' : 'button-failure');
    setTimeout(() => {
        button.classList.remove('button-success', 'button-failure');
    }, 1200); 
}
const style = document.createElement('style');
style.textContent = `
  #observation-id-display {
    position: fixed;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    z-index: 10000;
    transition: background-color 0.3s ease;
  }
  #observation-id-display.updated {
    background-color: rgba(0, 255, 0, 0.7);
    animation: pulseGreen 1.5s ease-out;
  }
  @keyframes pulseGreen {
      0% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.7); transform: scale(1); }
      50% { box-shadow: 0 0 0 20px rgba(0, 255, 0, 0.3); transform: scale(1.1); }
      100% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0); transform: scale(1); }
  }
  @keyframes pulseRed {
      0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); transform: scale(1); }
      50% { box-shadow: 0 0 0 20px rgba(255, 0, 0, 0.3); transform: scale(1.1); }
      100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); transform: scale(1); }
  }
  .button-success {
      animation: pulseGreen 1.5s ease-out;
      background-color: rgba(0, 255, 0, 0.7) !important;
  }
  .button-failure {
      animation: pulseRed 1.5s ease-out;
      background-color: rgba(255, 0, 0, 0.7) !important;
  }
  #custom-extension-container {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      max-width: 600px;
  }
    #custom-extension-container.dragging {
    height: var(--original-height);
    width: var(--original-width);
  }
  .button-ph {
    font-size: 14px;
    padding: 5px 10px;
    margin: 3px;
    flex-grow: 1;
    min-width: 100px;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s ease;
    position: relative;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .button-ph:hover {
      background-color: rgba(0, 0, 0, 0.7);
  }
  .button-ph.dragging {
    opacity: 0.5;
    position: fixed;
    pointer-events: none;
    z-index: 1000;
  }
  .button-placeholder {
    border: 2px dashed #ccc;
    background-color: #f0f0f0;
    min-width: 100px;
    flex-grow: 1;
    margin: 3px;
    border-radius: 5px;
  }
  #custom-extension-input {
      width: 120px;
  }
  .button-ph .tooltip {
    visibility: visible;
    background-color: black;
    color: white;
    text-align: center;
    border-radius: 6px;
    padding: 5px;
    position: absolute;
    z-index: 10002;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .button-ph:hover .tooltip {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
  }
  #custom-extension-input:focus + .tooltip {
      display: block;
  }
 .bulk-action-button {
        background-color: #4CAF50;
        border: none;
        color: white;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 14px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 4px;
        padding: 10px 20px;
    }
    .ObservationsGridItem.selected {
        box-shadow: 0 0 0 4px #4CAF50;
    }
    #enable-bulk-mode-button {
        position: fixed;
        z-index: 10000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    #enable-bulk-mode-button:before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        border: 2px solid white;
        border-radius: 6px;
        z-index: -1;
    }
 .modal-link {
            word-break: break-all;
            color: blue;
            text-decoration: underline;
            cursor: pointer;
        }

        .modal-button {
            margin-top: 10px;
            padding: 5px 10px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }

        .modal-button:hover {
            background-color: #45a049;
        }
`;
document.head.appendChild(style);

function createOrUpdateIdDisplay(id) {
    if (!idDisplay) {
        idDisplay = document.createElement('div');
        idDisplay.id = 'observation-id-display';
        document.body.appendChild(idDisplay);
        updatePositions();
    }
    
    idDisplay.innerHTML = `Current Observation ID: ${id}`;
    idDisplay.style.display = 'block'; // Ensure it's visible
    
    // Add refresh indicator if it doesn't exist
    if (!idDisplay.querySelector('#refresh-indicator')) {
        const refreshIndicator = document.createElement('span');
        refreshIndicator.id = 'refresh-indicator';
        refreshIndicator.style.marginLeft = '10px';
        idDisplay.appendChild(refreshIndicator);
    }
    
    updateRefreshIndicator();
    
    idDisplay.classList.add('updated');
    setTimeout(() => {
        idDisplay.classList.remove('updated');
    }, 300);
}

window.addEventListener('load', () => {
    console.log('Window load event fired');
    extractObservationId();
    if (window.location.href.includes('/observations/identify')) {
        console.log('On identify page, creating bulk action buttons');
        createBulkActionButtons();
        
        // Add this check
        setTimeout(() => {
            const enableButton = document.getElementById('enable-bulk-mode-button');
            if (enableButton) {
                console.log('Enable button exists after timeout');
                console.log('Enable button display:', getComputedStyle(enableButton).display);
                console.log('Enable button position:', enableButton.style.cssText);
            } else {
                console.log('Enable button not found after timeout');
            }
        }, 1000);
    } else if (window.location.pathname.match(/^\/observations\/\d+/)) {
        console.log('On individual observation page');
        const observationId = window.location.pathname.split('/').pop();
        console.log('Observation ID from URL:', observationId);
        currentObservationId = observationId;
        createOrUpdateIdDisplay(observationId);
    }
    if (!currentObservationId) {
        createOrUpdateIdDisplay('None');
    }
    createDynamicButtons();
});


function createRefreshIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'refresh-indicator';
    indicator.style.display = 'inline-block';
    indicator.style.marginLeft = '10px';
    indicator.style.padding = '5px';
    indicator.style.borderRadius = '5px';
    indicator.style.transition = 'background-color 0.3s';
    updateRefreshIndicator(indicator);
    return indicator;
}

function updateRefreshIndicator(indicator = document.getElementById('refresh-indicator')) {
    if (indicator) {
        indicator.textContent = refreshEnabled ? 'Refresh On' : 'Refresh Off';
        indicator.style.backgroundColor = refreshEnabled ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
    }
}

async function updateQualityMetrics(observationId) {
    try {
        const jwt = await getJWT();
        if (!jwt) {
            console.error('No JWT found');
            return;
        }

        const qualityMetricsUrl = `https://api.inaturalist.org/v1/observations/${observationId}/quality_metrics?ttl=-1`;
        const response = await fetch(qualityMetricsUrl, {
            headers: {
                'Authorization': `Bearer ${jwt}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        updateQualityMetricsUI(data.results);
    } catch (error) {
        console.error('Error fetching quality metrics:', error);
    }
}


function updateQualityMetricsUI(metrics) {
    const qualityContainer = document.querySelector('.quality_assessment');
    if (!qualityContainer) return;

    metrics.forEach(metric => {
        if (metric.metric === 'needs_id') return; // Skip the needs_id metric

        const metricElement = qualityContainer.querySelector(`[data-metric="${metric.metric}"]`);
        if (metricElement) {
            metricElement.classList.toggle('assessed', metric.agree);
            const icon = metricElement.querySelector('.fa');
            if (icon) {
                icon.classList.toggle('fa-check-circle', metric.agree);
                icon.classList.toggle('fa-circle-o', !metric.agree);
            }
        }
    });
}


function clearObservationId() {
    currentObservationId = null;
    if (idDisplay) {
        idDisplay.textContent = 'Current Observation ID: None';
    }
    console.log('Observation ID cleared');
}

async function performActions(actions) {
    let observationId = await ensureCorrectObservationId();
    if (!observationId) {
        alert('Please open an observation before using this button.');
        return [];
    }
    
    const lockedObservationId = observationId;
    const isIdentifyPage = window.location.pathname.includes('/identify');
    const isObservationPage = window.location.pathname.match(/^\/observations\/\d+/);
    let needsPageUpdate = true;
    const results = [];

    try {
        for (const action of actions) {
            const result = await performSingleAction(action, lockedObservationId, isIdentifyPage);
            results.push(result);
        }

        if (isIdentifyPage) {
            console.log('Attempting to refresh observation');
            await refreshObservation().catch(error => {
                console.error('Error in refreshObservation:', error);
            });
        } else if (isObservationPage && needsPageUpdate) {
            console.log('Updating observation page');
            await updateObservationPage(lockedObservationId).catch(error => {
                console.error('Error in updateObservationPage:', error);
            });
        }
    } catch (error) {
        console.error('Error in performActions:', error);
        alert(`Error performing actions: ${error.message}`);
    }

    return results;
}

async function performSingleAction(action, observationId, isIdentifyPage) {
    switch (action.type) {
        case 'observationField':
            return addObservationField(observationId, action.fieldId, action.fieldValue);
        case 'copyObservationField':
            const sourceValue = await getObservationFieldValue(observationId, action.sourceFieldId);
            if (sourceValue === null) {
                console.error(`Failed to copy field: source value is null for observation ${observationId}, field ${action.sourceFieldId}`);
                return { success: false, error: 'Source field value is null' };
            }
            return addObservationField(observationId, action.targetFieldId, sourceValue);    
        case 'annotation':
            const annotationResult = await addAnnotation(observationId, action.annotationField, action.annotationValue);
            return { ...annotationResult, annotationUUID: annotationResult.uuid };
        case 'addToProject':
            return addObservationToProject(observationId, action.projectId);
        case 'addComment':
            const commentResult = await addComment(observationId, action.commentBody);
            return { ...commentResult, commentUUID: commentResult.uuid };
        case 'addTaxonId':
            const idResult = await addTaxonId(observationId, action.taxonId, action.comment);
            return { ...idResult, identificationId: idResult.data.id };
        case 'qualityMetric':
            return handleQualityMetricAPI(observationId, action.metric, action.vote);
        default:
            console.warn(`Unknown action type: ${action.type}`);
            return Promise.resolve();
    }
}

async function getCurrentQualityMetricState(observationId) {
    console.log(`Getting current quality metric state for observation ${observationId}`);
    try {
        const response = await makeAPIRequest(`/observations/${observationId}`);
        const observation = response.results[0];
        console.log(`Observation data:`, observation);

        const qualityMetrics = {};
        observation.quality_metrics.forEach(qm => {
            qualityMetrics[qm.metric] = qm.agree ? 'agree' : 'disagree';
        });

        // Handle 'needs_id' separately
        if (observation.owners_identification && observation.owners_identification.current) {
            qualityMetrics['needs_id'] = 'agree';
        } else if (observation.community_taxon && observation.taxon.id !== observation.community_taxon.id) {
            qualityMetrics['needs_id'] = 'disagree';
        } else {
            qualityMetrics['needs_id'] = null;  // No vote for needs_id
        }

        console.log(`Current quality metrics:`, qualityMetrics);
        return qualityMetrics;
    } catch (error) {
        console.error(`Error fetching quality metric state for observation ${observationId}:`, error);
        return {};
    }
}

async function getObservationFieldValue(observationId, fieldId) {
    try {
        const response = await makeAPIRequest(`/observations/${observationId}`);
        if (response.results && response.results[0]) {
            const ofv = response.results[0].ofvs.find(ofv => ofv.field_id === parseInt(fieldId));
            return ofv ? ofv.value : null;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching observation field value: ${error}`);
        return null;
    }
}

function generateUndoRecord(preliminaryUndoRecord, results) {
    let finalUndoRecord = {...preliminaryUndoRecord};
    finalUndoRecord.observations = {};

    results.forEach(result => {
        if (result.success) {
            const observationId = result.observationId;
            if (preliminaryUndoRecord.observations[observationId]) {
                finalUndoRecord.observations[observationId] = preliminaryUndoRecord.observations[observationId];
                console.log(`Undo record for observation ${observationId}:`, finalUndoRecord.observations[observationId]);
            }
        }
    });

    finalUndoRecord.affectedObservationsCount = Object.keys(finalUndoRecord.observations).length;
    console.log('Final undo record:', finalUndoRecord);
    
    return finalUndoRecord;
}

function refreshObservation() {
    console.log('refreshObservation called');
    return new Promise((resolve, reject) => {
        const logState = {
            url: window.location.href,
            readyState: document.readyState,
            refreshEnabled,
            currentObservationId,
            userAgent: navigator.userAgent,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            timeStamp: new Date().toISOString()
        };
        console.log('Refresh attempt state:', logState);

        if (!refreshEnabled || !currentObservationId) {
            console.log('Refresh not enabled or no current observation ID');
            resolve();
            return;
        }

        if (window.location.pathname.match(/^\/observations\/\d+/)) {
            console.log('On individual observation page, reloading');
            window.location.reload();
            return;
        }

        const selectors = [
            "#Identify > div > div.mainrow.false.row > div.main-col > div.ObservationsGrid.flowed.false.row",
            ".ObservationsGrid",
            "#Identify .ObservationsGrid",
            "div[data-react-class='ObservationsGrid']"
        ];

        let grid = null;
        for (let selector of selectors) {
            grid = document.querySelector(selector);
            if (grid) {
                debugLog('Grid found with selector:', selector);
                break;
            }
        }

        if (!grid) {
            console.error('Grid not found, logging page structure');
            logPageStructure();
            reject(new Error('Grid not found'));
            return;
        }

        const gridInfo = {
            childCount: grid.childElementCount,
            classes: grid.className,
            id: grid.id,
            rect: grid.getBoundingClientRect()
        };
        debugLog('Grid info:', gridInfo);

        const observationLink = findObservationLink(grid, currentObservationId);
        
        if (observationLink) {
            debugLog('Clicking observation link');
            try {
                observationLink.click();
            } catch (error) {
                console.error('Error clicking observation link:', error);
                reject(error);
                return;
            }

            let modalCheckAttempts = 0;
            const modalCheckInterval = setInterval(() => {
                modalCheckAttempts++;
                const modal = document.querySelector('.ObservationModal');
                if (modal) {
                    debugLog('ObservationModal found after', modalCheckAttempts, 'attempts');
                    clearInterval(modalCheckInterval);
                    resolve();
                } else if (modalCheckAttempts >= 20) { // 2 seconds (100ms * 20)
                    console.error('ObservationModal not found after 2 seconds');
                    clearInterval(modalCheckInterval);
                    reject(new Error('ObservationModal not found after timeout'));
                }
            }, 100);
        } else {
            console.error('Observation not found in grid, rejecting');
            reject(new Error('Observation not found in grid'));
        }
    });
}

function findObservationLink(gridElement, observationId) {
    debugLog('Searching for observation link with ID:', observationId);
    
    const directLink = gridElement.querySelector(`a[href="/observations/${observationId}"]`);
    if (directLink) {
        debugLog('Direct link found');
        return directLink;
    }
    
    const allLinks = gridElement.querySelectorAll('a[href^="/observations/"]');
    debugLog('Total observation links found:', allLinks.length);
    
    for (let link of allLinks) {
        if (link.href.endsWith(observationId)) {
            debugLog('Matching link found:', link.href);
            return link;
        }
    }
    
    console.error('No matching observation link found');
    logLinkDetails(allLinks);
    return null;
}

function logPageStructure() {
    debugLog('Body classes:', document.body.className);
    debugLog('Identify element:', document.getElementById('Identify')?.outerHTML);
    const mainContent = document.querySelector('main');
    debugLog('Main content classes:', mainContent?.className);
    debugLog('Main content child elements:', Array.from(mainContent?.children || []).map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className
    })));
    debugLog('All grid-like elements:', Array.from(document.querySelectorAll('[class*="grid" i], [class*="list" i]')).map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className
    })));
}

function logLinkDetails(links) {
    debugLog('Detailed link information:');
    Array.from(links).forEach((link, index) => {
        debugLog(`Link ${index}:`, {
            href: link.href,
            textContent: link.textContent,
            className: link.className,
            rect: link.getBoundingClientRect()
        });
    });
}

async function updateObservationPage(observationId) {
    try {
        const favContainer = document.querySelector('.Faves');
        if (!favContainer) {
            console.log('Fav button container not found');
            return false;
        }

        const linkText = favContainer.querySelector('.linky').textContent;
        const originalState = linkText === "You faved this!" ? 'faved' : 'unfaved';
        console.log(`Original fav state: ${originalState}`);

        // Click the fav button
        const favButton = favContainer.querySelector('.action');
        favButton.click();

        // Wait for the state to change
        await waitForFavStateChange(originalState);

        // Click again to revert to the original state
        await new Promise(resolve => setTimeout(resolve, 500)); // Short delay
        favButton.click();

        // Wait for the state to revert
        await waitForFavStateChange(originalState === 'faved' ? 'unfaved' : 'faved');

        console.log('Fav button clicked twice, returned to original state');
        console.log('Triggered site refresh mechanism');
        return true;
    } catch (error) {
        console.error('Error triggering site refresh:', error);
        return false;
    }
}

function waitForFavStateChange(originalState) {
    return new Promise((resolve, reject) => {
        const maxWaitTime = 10000; // 10 seconds
        const checkInterval = 100; // 0.1 seconds
        let elapsedTime = 0;

        const checkState = () => {
            const favContainer = document.querySelector('.Faves');
            const linkText = favContainer.querySelector('.linky').textContent;
            const currentState = linkText === "You faved this!" ? 'faved' : 'unfaved';

            if (currentState !== originalState) {
                resolve();
            } else if (elapsedTime >= maxWaitTime) {
                reject(new Error('Timeout waiting for fav state change'));
            } else {
                elapsedTime += checkInterval;
                setTimeout(checkState, checkInterval);
            }
        };

        checkState();
    });
}


function toggleRefresh() {
    refreshEnabled = !refreshEnabled;
    updateRefreshIndicator();
}

function createDynamicButtons() {
    console.log('createDynamicButtons called');
    browserAPI.storage.sync.get(['customButtons', 'buttonOrder'], function(data) {
        if (data.customButtons && data.customButtons.length > 0) {
            debugLog('Retrieved buttonOrder from storage:', data.buttonOrder);
            debugLog('Retrieved customButtons from storage:', data.customButtons);
            customShortcuts = [];
            buttonContainer.innerHTML = ''; // Clear existing buttons

            const orderedButtons = data.buttonOrder || data.customButtons.map(config => config.id);

            orderedButtons.forEach((buttonId, index) => {
                debugLog(`Processing button ${index + 1}/${orderedButtons.length}: ID ${buttonId}`);
                const config = data.customButtons.find(c => c.id === buttonId);
                if (config && !config.configurationDisabled) {
                    createButton(config);
                } else {
                    debugLog(`Button ${buttonId} skipped: ${config ? 'Disabled' : 'Not found'}`);
                }
            });

            initializeDragAndDrop();
        }
        debugLog('All buttons created. Total buttons:', buttonContainer.children.length);
    });
}

function debugButtonCreation(config) {
    debugLog("Debug: Button Creation Start for", config.name);
    debugLog("Button Config:", JSON.stringify(config));

    try {
        // Create a test button
        const testButton = document.createElement('button');
        testButton.textContent = config.name || "Test Button";
        testButton.setAttribute('data-shortcut', formatShortcut(config.shortcut));
        
        // Log button properties
        debugLog("Button Text:", testButton.textContent);
        debugLog("Button Shortcut:", testButton.getAttribute('data-shortcut'));
        
        // Check if the button is valid
        debugLog("Is button valid HTML:", testButton.outerHTML.length > 0);
        
        // Test button visibility
        document.body.appendChild(testButton);
        const isVisible = window.getComputedStyle(testButton).display !== 'none';
        debugLog("Is button visible:", isVisible);
        document.body.removeChild(testButton);

        // Log character codes
        debugLog("Name character codes:", Array.from(config.name || "").map(c => c.charCodeAt(0)));
        debugLog("Shortcut character codes:", Array.from(formatShortcut(config.shortcut) || "").map(c => c.charCodeAt(0)));

        // Check for potential problematic characters
        const problematicChars = /[~!@#$%^&*()]/;
        debugLog("Contains problematic chars in name:", problematicChars.test(config.name || ""));
        debugLog("Contains problematic chars in shortcut:", problematicChars.test(formatShortcut(config.shortcut) || ""));

    } catch (error) {
        console.error("Error in button creation:", error);
    }

    debugLog("Debug: Button Creation End for", config.name);
}

function createButton(config) {
    debugButtonCreation(config);

    function hasNonASCII(str) {
        return /[^\u0000-\u007f]/.test(str);
    }
    
    debugLog('Button name contains non-ASCII:', hasNonASCII(config.name));
    if (config.shortcut && config.shortcut.key) {
        debugLog('Shortcut key contains non-ASCII:', hasNonASCII(config.shortcut.key));
    }

    let button = document.createElement('button');
    button.classList.add('button-ph');
    button.draggable = true;
    button.dataset.buttonId = config.id;
    button.innerText = config.name;
    
    // Create tooltip if shortcut exists
    if (config.shortcut && config.shortcut.key) {
        let tooltip = document.createElement('span');
        tooltip.classList.add('tooltip');
        tooltip.textContent = formatShortcut(config.shortcut);
        button.appendChild(tooltip);
    }
    
    button.onclick = function(e) {
        if (!hasMoved) {  // Only trigger click if not dragging
            animateButton(this);
            performActions(config.actions)
                .then((results) => {
                    // Ensure results is always an array
                    const resultsArray = Array.isArray(results) ? results : [results];
                    const allSuccessful = resultsArray.every(r => r.success);
                    animateButtonResult(this, allSuccessful);
                    if (!allSuccessful) {
                        console.error('Some actions failed:', resultsArray.filter(r => !r.success));
                    }
                })
                .catch(error => {
                    console.error('Error performing actions:', error);
                    animateButtonResult(this, false);
                });
        }
        hasMoved = false; // Reset hasMoved after the click event
    };
    
    button.style.display = config.buttonHidden ? 'none' : 'inline-block';
    buttonContainer.appendChild(button);
    if (config.shortcut) {
        customShortcuts.push({
            name: config.name,
            key: config.shortcut.key,
            ctrlKey: config.shortcut.ctrlKey,
            shiftKey: config.shortcut.shiftKey,
            altKey: config.shortcut.altKey,
            button: button  // Store the button element itself
        });
    }

    debugLog("Button created and added to DOM:", button.outerHTML);
}

function formatShortcut(shortcut) {
    if (!shortcut || !shortcut.key) return '';
    let parts = [];
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    parts.push(shortcut.key);
    return parts.join(' + ');
}


window.addEventListener('error', function(event) {
    if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
        debugLog('Extension context invalidated. This is likely due to the extension being reloaded.');
        event.preventDefault(); // Prevent the error from being thrown
    }
});

function initializeDragAndDrop() {
    const container = document.getElementById('custom-extension-container');
    let draggingElement = null;
    let placeholder = null;
    let dragStartX, dragStartY;
    const moveThreshold = 5; // pixels

    container.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('button-ph')) {
            draggingElement = e.target;
            const rect = draggingElement.getBoundingClientRect();
            dragStartX = e.clientX - rect.left;
            dragStartY = e.clientY - rect.top;
            hasMoved = false; // Reset hasMoved when starting a drag

            // Store original container dimensions
            container.style.setProperty('--original-height', `${container.offsetHeight}px`);
            container.style.setProperty('--original-width', `${container.offsetWidth}px`);

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            
            e.preventDefault();
        }
    });

    function onMouseMove(e) {
        if (draggingElement) {
            const deltaX = e.clientX - dragStartX - draggingElement.offsetLeft;
            const deltaY = e.clientY - dragStartY - draggingElement.offsetTop;
            
            if (!hasMoved && (Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold)) {
                hasMoved = true; // Set hasMoved to true when movement threshold is exceeded
                placeholder = document.createElement('div');
                placeholder.classList.add('button-placeholder');
                placeholder.style.width = `${draggingElement.offsetWidth}px`;
                placeholder.style.height = `${draggingElement.offsetHeight}px`;
                draggingElement.parentNode.insertBefore(placeholder, draggingElement.nextSibling);
                draggingElement.classList.add('dragging');
                container.classList.add('dragging');
            }

            if (hasMoved) {
                draggingElement.style.left = `${e.clientX - dragStartX}px`;
                draggingElement.style.top = `${e.clientY - dragStartY}px`;
                
                const closestButton = getClosestButton(container, e.clientX, e.clientY);
                if (closestButton && closestButton !== placeholder) {
                    if (isBeforeButton(e.clientY, closestButton)) {
                        closestButton.parentNode.insertBefore(placeholder, closestButton);
                    } else {
                        closestButton.parentNode.insertBefore(placeholder, closestButton.nextSibling);
                    }
                }
            }
        }
    }

    function onMouseUp() {
        if (draggingElement) {
            draggingElement.classList.remove('dragging');
            draggingElement.style.removeProperty('left');
            draggingElement.style.removeProperty('top');
            container.classList.remove('dragging');
            if (placeholder) {
                placeholder.parentNode.insertBefore(draggingElement, placeholder);
                placeholder.remove();
            }
            if (hasMoved) {
                saveButtonOrder();
            }
        }
        
        draggingElement = null;
        placeholder = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}


function getClosestButton(container, x, y) {
    const buttons = Array.from(container.querySelectorAll('.button-ph:not(.dragging), .button-placeholder'));
    return buttons.reduce((closest, button) => {
        const box = button.getBoundingClientRect();
        const offsetX = x - (box.left + box.width / 2);
        const offsetY = y - (box.top + box.height / 2);
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        
        if (distance < closest.distance) {
            return { distance, element: button };
        } else {
            return closest;
        }
    }, { distance: Number.POSITIVE_INFINITY }).element;
}

function isBeforeButton(y, button) {
    const box = button.getBoundingClientRect();
    return y < box.top + box.height / 2;
}

function saveButtonOrder() {
    const buttons = document.querySelectorAll('.button-ph');
    const order = Array.from(buttons).map(button => button.dataset.buttonId);
    browserAPI.storage.sync.set({ buttonOrder: order }, function() {
        //debugLog('Button order saved:', order);
    });
}

function loadButtonOrder() {
    debugLog('Loading button order');
    browserAPI.storage.sync.get('buttonOrder', (data) => {
        if (data.buttonOrder) {
            debugLog('Stored button order:', data.buttonOrder);
            const container = document.getElementById('custom-extension-container');
            data.buttonOrder.forEach(buttonId => {
                const button = container.querySelector(`[data-button-id="${buttonId}"]`);
                if (button) container.appendChild(button);
            });
        }
    });
}

createDynamicButtons();

function createBulkActionButtons() {
    console.log('Creating bulk action buttons');
    const bulkButtonContainer = document.createElement('div');
    bulkButtonContainer.id = 'bulk-action-container';
    bulkButtonContainer.style.position = 'fixed';
    bulkButtonContainer.style.zIndex = '10000';
    bulkButtonContainer.style.backgroundColor = 'white';
    bulkButtonContainer.style.padding = '10px';
    bulkButtonContainer.style.border = '1px solid black';
    bulkButtonContainer.style.display = 'none';

    const selectAllButton = createBulkActionButton('Select All', selectAllObservations);
    const invertSelectionButton = createBulkActionButton('Invert Selection', invertSelection);
    const applyActionButton = createBulkActionButton('Apply Action', applyBulkAction);
    const disableBulkModeButton = createBulkActionButton('Disable Bulk Mode', disableBulkActionMode);

    // Add this line to create the undo records button
    const showUndoRecordsButton = createBulkActionButton('Show Undo Records', showUndoRecordsModal);

    bulkButtonContainer.appendChild(selectAllButton);
    bulkButtonContainer.appendChild(invertSelectionButton);
    bulkButtonContainer.appendChild(applyActionButton);
    bulkButtonContainer.appendChild(disableBulkModeButton);
    bulkButtonContainer.appendChild(showUndoRecordsButton); // Add this line

    document.body.appendChild(bulkButtonContainer);

    // Create the "Enable Bulk Action Mode" button
    const enableBulkModeButton = document.createElement('button');
    enableBulkModeButton.textContent = 'Enable Bulk Action Mode';
    enableBulkModeButton.id = 'enable-bulk-mode-button';
    enableBulkModeButton.classList.add('bulk-action-button');
    enableBulkModeButton.addEventListener('click', enableBulkActionMode);
    document.body.appendChild(enableBulkModeButton);

    console.log('Bulk action buttons created');
    updateBulkButtonPosition();
}

function createBulkActionButton(text, onClickFunction) {
    const button = document.createElement('button');
    button.textContent = text;
    button.classList.add('bulk-action-button');
    button.style.margin = '5px';
    button.style.padding = '5px 10px';
    button.addEventListener('click', onClickFunction);
    return button;
}


function enableBulkActionMode() {
    bulkActionModeEnabled = true;
    document.getElementById('bulk-action-container').style.display = 'block';
    document.getElementById('enable-bulk-mode-button').style.display = 'none';
    // Restore previously selected observations
    getObservationElements().forEach(obs => {
        const observationId = obs.querySelector('a[href^="/observations/"]')?.href.split('/').pop();
        if (observationId && selectedObservations.has(observationId)) {
            obs.classList.add('selected');
        }
    });
    updateAllSelections();
}

function disableBulkActionMode() {
    bulkActionModeEnabled = false;
    document.getElementById('bulk-action-container').style.display = 'none';
    document.getElementById('enable-bulk-mode-button').style.display = 'block';
    // Remove visual selection but keep the IDs in selectedObservations
    getObservationElements().forEach(obs => obs.classList.remove('selected'));
}

function updateBulkButtonPosition() {
    console.log('Updating bulk button position');
    const bulkButtonContainer = document.getElementById('bulk-action-container');
    const enableBulkModeButton = document.getElementById('enable-bulk-mode-button');
    if (!bulkButtonContainer || !enableBulkModeButton) {
        console.log('Bulk button container or enable button not found');
        return;
    }

    console.log('Current button position:', buttonPosition);

    const setPosition = (element) => {
        element.style.top = element.style.left = element.style.bottom = element.style.right = 'auto';
        switch (buttonPosition) {
            case 'top-left':
                element.style.bottom = '10px';
                element.style.right = '10px';
                break;
            case 'top-right':
                element.style.bottom = '10px';
                element.style.left = '10px';
                break;
            case 'bottom-right':
                element.style.top = '10px';
                element.style.left = '10px';
                break;
            case 'bottom-left':
                element.style.top = '10px';
                element.style.right = '10px';
                break;
        }
        console.log(`Set position for ${element.id}:`, element.style.cssText);
    };

    setPosition(bulkButtonContainer);
    setPosition(enableBulkModeButton);

    console.log('Enable button display after positioning:', getComputedStyle(enableBulkModeButton).display);
}

function getObservationElements() {
    return document.querySelectorAll('.ObservationsGridItem');
}

function toggleSelection(element) {
    if (bulkActionModeEnabled) {
        const observationId = element.querySelector('a[href^="/observations/"]')?.href.split('/').pop();
        if (observationId) {
            if (element.classList.toggle('selected')) {
                selectedObservations.add(observationId);
            } else {
                selectedObservations.delete(observationId);
            }
            console.log('Updated selections:', selectedObservations);
        }
    }
}

function updateAllSelections() {
    selectedObservations.clear();
    getObservationElements().forEach(obs => {
        if (obs.classList.contains('selected')) {
            const observationId = obs.querySelector('a[href^="/observations/"]')?.href.split('/').pop();
            if (observationId) {
                selectedObservations.add(observationId);
            }
        }
    });
    console.log('Updated all selections:', selectedObservations);
}

function selectAllObservations() {
    console.log('Selecting all observations');
    getObservationElements().forEach(obs => obs.classList.add('selected'));
    updateAllSelections();
}

function invertSelection() {
    console.log('Inverting selection');
    getObservationElements().forEach(obs => obs.classList.toggle('selected'));
    updateAllSelections();
}

document.body.addEventListener('click', (e) => {
    if (bulkActionModeEnabled) {
        const obs = e.target.closest('.ObservationsGridItem');
        if (obs) {
            toggleSelection(obs);
            e.preventDefault();
            e.stopPropagation();
        }
    }
});

async function applyBulkAction() {
    console.log('Applying bulk action');
    const availableActions = await getAvailableActions();
    if (availableActions.length === 0) {
        alert('No available actions found. Please configure some actions first.');
        return;
    }

    const modal = createActionModal();
    const { actionSelect, applyButton, cancelButton } = createModalControls(availableActions);
    modal.appendChild(actionSelect);
    modal.appendChild(applyButton);
    modal.appendChild(cancelButton);

    document.body.appendChild(modal);

    setupTitleUpdater(modal);
    setupModalCloseHandler(cancelButton, modal);

    applyButton.onclick = async () => {
        if (!actionSelect.value) {
            alert('Please select an action before applying.');
            return;
        }
        const selectedAction = availableActions.find(button => button.id === actionSelect.value);
        if (selectedAction) {
            const hasDQIRemoval = selectedAction.actions.some(action => action.type === 'qualityMetric' && action.vote === 'remove');

            let confirmMessage = `Are you sure you want to apply "${selectedAction.name}" to ${selectedObservations.size} observation(s)?\n\n`;
            confirmMessage += "This action includes:\n";

            selectedAction.actions.forEach(action => {
                switch (action.type) {
                    case 'observationField':
                        confirmMessage += `- Add observation field: ${action.fieldName} = ${action.fieldValue}\n`;
                        break;
                    case 'annotation':
                        const attribute = Object.entries(controlledTerms).find(([_, value]) => value.id === parseInt(action.annotationField));
                        const attributeName = attribute ? attribute[0] : 'Unknown';
                        const valueName = attribute ? Object.entries(attribute[1].values).find(([_, id]) => id === parseInt(action.annotationValue))[0] : 'Unknown';
                        confirmMessage += `- Add annotation: ${attributeName} = ${valueName}\n`;
                        break;
                    case 'addToProject':
                        confirmMessage += `- Add to project: ${action.projectName}\n`;
                        break;
                    case 'addComment':
                        confirmMessage += `- Add comment: "${action.commentBody.substring(0, 50)}${action.commentBody.length > 50 ? '...' : ''}"\n`;
                        break;
                    case 'addTaxonId':
                        confirmMessage += `- Add taxon ID: ${action.taxonName}\n`;
                        break;
                    case 'qualityMetric':
                        const metricName = getQualityMetricName(action.metric);
                        confirmMessage += `- Set quality metric: ${metricName} to ${action.vote}\n`;
                        break;
                    case 'copyObservationField':
                        confirmMessage += `- Copy field: ${action.sourceFieldName} to ${action.targetFieldName}\n`;
                        break;
                }
            });

            confirmMessage += "\nNote: iNaturalist policy requires that you have individually inspected every observation before you apply this action.";

            if (hasDQIRemoval) {
                confirmMessage += "\n\nPlease note: Removing DQI votes cannot be undone in bulk due to API limitations.";
            }

            if (confirm(confirmMessage)) {
                await executeBulkAction(selectedAction, modal);
            }
        } else {
            alert('Selected action not found.');
        }
        document.body.removeChild(modal);
    };
}
async function getAvailableActions() {
    const customButtons = await new Promise(resolve => browserAPI.storage.sync.get('customButtons', resolve));
    return (customButtons.customButtons || []).filter(button => !button.configurationDisabled);
}

function createActionModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: white;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 10001;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;
    `;
    const progressBar = createProgressBar();
    modal.appendChild(progressBar);

    const disclaimer = document.createElement('p');
    disclaimer.id = 'action-disclaimer';
    disclaimer.style.color = 'red';
    disclaimer.style.display = 'none';
    modal.appendChild(disclaimer);

    return modal;
}

function createProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        width: 100%;
        height: 20px;
        background-color: #f0f0f0;
        border-radius: 10px;
        margin-top: 10px;
        overflow: hidden;
    `;
    const progressFill = document.createElement('div');
    progressFill.classList.add('progress-fill');
    progressFill.style.cssText = `
        width: 0%;
        height: 100%;
        background-color: #4CAF50;
        transition: width 0.3s ease;
    `;
    progressBar.appendChild(progressFill);
    return progressBar;
}

function createModalControls(availableActions) {
    const actionSelect = document.createElement('select');
    actionSelect.style.marginBottom = '10px';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Select an action";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    actionSelect.appendChild(defaultOption);

    availableActions.forEach(button => {
        const option = document.createElement('option');
        option.value = button.id;
        option.textContent = button.name;
        actionSelect.appendChild(option);
    });

    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply Action';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';

    actionSelect.onchange = () => {
        const selectedAction = availableActions.find(button => button.id === actionSelect.value);
        const disclaimer = document.getElementById('action-disclaimer');
        
        if (selectedAction) {
            const hasDQIRemoval = selectedAction.actions.some(action => action.type === 'qualityMetric' && action.vote === 'remove');


                if (hasDQIRemoval) {
                    disclaimer.textContent += " Removing DQI votes cannot be undone in bulk due to API limitations.";
                    disclaimer.style.display = 'block';
                }                
                else {
                disclaimer.style.display = 'none';
            }
        } else {
            disclaimer.style.display = 'none';
        }
    };

    return { actionSelect, applyButton, cancelButton };
}

function setupTitleUpdater(modal) {
    const title = document.createElement('h2');
    title.id = 'action-selection-title';
    modal.insertBefore(title, modal.firstChild);

    function updateTitle() {
        title.textContent = `Select Action for ${selectedObservations.size} Observations`;
    }

    updateTitle();

    const observer = new MutationObserver(updateTitle);
    observer.observe(document.body, { 
        subtree: true, 
        attributes: true, 
        attributeFilter: ['class']
    });

    return observer;
}

function setupModalCloseHandler(cancelButton, modal) {
    cancelButton.onclick = () => document.body.removeChild(modal);
}

async function executeBulkAction(selectedAction, modal) {
    const observationIds = Array.from(selectedObservations);
    const totalObservations = observationIds.length;
    let processedObservations = 0;
    const progressFill = modal.querySelector('.progress-fill');
    progressFill.style.width = '0%';

    const preActionStates = await generatePreActionStates(observationIds);
    const preliminaryUndoRecord = await generatePreliminaryUndoRecord(selectedAction, observationIds, preActionStates);  
    
    const results = [];
    const skippedObservations = [];

    for (const observationId of observationIds) {
        for (const action of selectedAction.actions) {
            await executeAction(action, observationId, preActionStates, preliminaryUndoRecord, results, skippedObservations);
        }
        processedObservations++;
        await updateProgressBar(progressFill, (processedObservations / totalObservations) * 100);
    }
    await updateProgressBar(progressFill, 100);
    await new Promise(resolve => setTimeout(resolve, 300));
    await handleActionResults(results, skippedObservations, preliminaryUndoRecord);
}

async function executeAction(action, observationId, preActionStates, preliminaryUndoRecord, results, skippedObservations) {
    try {
        const shouldExecuteAction = determineIfActionShouldExecute(action, observationId, preActionStates, skippedObservations);
        if (shouldExecuteAction) {
            console.log(`Performing action ${action.type} for observation ${observationId}`);
            const result = await performSingleAction(action, observationId, true);
            console.log(`Action result:`, result);
            handleActionResult(result, action, observationId, preliminaryUndoRecord, results, skippedObservations);
        }
    } catch (error) {
        console.error(`Failed to perform action ${action.type} for observation ${observationId}:`, error);
        results.push({ observationId, action: action.type, success: false, error: error.toString() });
    }
}

function determineIfActionShouldExecute(action, observationId, preActionStates, skippedObservations) {
    if (action.type === 'qualityMetric') {
        const currentState = getCurrentQualityMetricState(observationId, action.metric);
        console.log(`Current state for ${action.metric}:`, currentState);
        
        if (currentState === action.vote) {
            console.log(`Skipping ${action.metric} for observation ${observationId} as it's already in the desired state`);
            return false;
        }
    } else if (action.type === 'observationField' || action.type === 'copyObservationField') {
        let fieldId = action.fieldId;
        let fieldValue = action.fieldValue;

        if (action.type === 'copyObservationField') {
            fieldId = action.targetFieldId;
            fieldValue = getExistingObservationFieldValue(preActionStates[observationId], action.sourceFieldId);
            if (fieldValue === null) {
                console.log(`Observation ${observationId}: Source field ${action.sourceFieldId} does not exist or is empty - skipping`);
                return false;
            }
        }

        const existingValue = getExistingObservationFieldValue(preActionStates[observationId], fieldId);
        console.log(`Observation ${observationId}: Existing value: "${existingValue}", Desired value: "${fieldValue}"`);
        
        if (existingValue !== null) {
            if (existingValue === fieldValue) {
                console.log(`Observation ${observationId}: Existing value matches desired value - silently skipping`);
                return false;
            } else {
                console.log(`Observation ${observationId}: Existing value differs from desired value - skipping and adding to skipped list`);
                skippedObservations.push(observationId);
                return false;
            }
        }
    }
    return true;
}

function handleActionResult(result, action, observationId, preliminaryUndoRecord, results, skippedObservations) {
    if (result.success) {
        if (action.type === 'addComment' && result.commentUUID) {
            const undoAction = preliminaryUndoRecord.observations[observationId].undoActions.find(
                ua => ua.type === 'removeComment' && ua.commentBody === action.commentBody
            );
            if (undoAction) {
                undoAction.commentUUID = result.commentUUID;
                console.log(`Updated undo action with comment UUID: ${result.commentUUID}`);
            }
        } else if (action.type === 'annotation' && result.annotationUUID) {
            const undoAction = preliminaryUndoRecord.observations[observationId].undoActions.find(
                ua => ua.type === 'removeAnnotation' && 
                    ua.attributeId === action.annotationField && 
                    ua.valueId === action.annotationValue
            );
            if (undoAction) {
                undoAction.uuid = result.annotationUUID;
            }
        }
    } else {
        console.error(`Action failed for observation ${observationId}:`, result.error);
        skippedObservations.push(observationId);
    }
    results.push({ observationId, action: action.type, success: result.success, error: result.error });
}

async function handleActionResults(results, skippedObservations, preliminaryUndoRecord) {
    const successCount = results.filter(r => r.success).length;
    const totalActions = results.length;
    const skippedCount = skippedObservations.length;
    
    if (skippedCount > 0) {
        const skippedURL = generateObservationURL(skippedObservations);
        console.log('Generated URL for skipped observations:', skippedURL);
        createSkippedActionsModal(skippedCount, skippedURL);
    } else {
        console.log('No skipped actions to report');
        alert(`Bulk action applied: ${successCount} out of ${totalActions} actions completed successfully.`);
    }
    
    const successfulResults = results.filter(r => r.success);
    const undoRecord = generateUndoRecord(preliminaryUndoRecord, successfulResults);
    if (undoRecord.affectedObservationsCount > 0) {
        await storeUndoRecord(undoRecord);
        console.log('Undo record stored:', undoRecord);
    } else {
        console.log('No actions to undo, undo record not stored');
    }

    console.log('Bulk action results:', results);
}

async function updateProgressBar(progressFill, progress) {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            progressFill.style.width = `${progress}%`;
            void progressFill.offsetWidth;
            requestAnimationFrame(resolve);
        });
    });
}

async function getCurrentQualityMetricState(observationId, metric) {
    try {
        const response = await makeAPIRequest(`/observations/${observationId}`);
        const observation = response.results[0];
        const qualityMetric = observation.quality_metrics.find(qm => qm.metric === metric);
        if (qualityMetric) {
            return qualityMetric.agree ? 'agree' : 'disagree';
        }
        return 'unknown';
    } catch (error) {
        console.error(`Error fetching quality metric state for observation ${observationId}:`, error);
        return 'unknown';
    }
}

function getExistingObservationFieldValue(observationState, fieldId) {
    console.log('Checking existing value for field:', fieldId, 'in state:', observationState);
    if (observationState && observationState.ofvs) {
        const field = observationState.ofvs.find(f => f.field_id.toString() === fieldId);
        console.log('Found field:', field);
        return field ? field.value : null;
    }
    console.log('No existing value found');
    return null;
}


function storeUndoRecord(undoRecord) {
    return new Promise((resolve, reject) => {
        browserAPI.storage.local.get('undoRecords', function(result) {
            let undoRecords = result.undoRecords || [];
            undoRecords.push(undoRecord);
            browserAPI.storage.local.set({undoRecords: undoRecords}, function() {
                console.log('Undo record stored:', undoRecord);
                console.log('Total undo records:', undoRecords.length);
                // Notify other tabs about the new undo record
                browserAPI.runtime.sendMessage({action: "undoRecordAdded", record: undoRecord});
                resolve();
            });
        });
    });
}

function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function generatePreActionStates(observationIds) {
    const preActionStates = {};
    for (const id of observationIds) {
        try {
            const response = await fetch(`https://api.inaturalist.org/v1/observations/${id}`);
            const data = await response.json();
            preActionStates[id] = data.results[0];  // Store the entire observation object
        } catch (error) {
            console.error(`Failed to fetch pre-action state for observation ${id}:`, error);
        }
    }
    return preActionStates;
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function generatePreliminaryUndoRecord(action, observationIds, preActionStates) {
    console.log('Generating preliminary undo record for action:', action.name);
    let undoRecord = {
        id: generateUniqueId(),
        timestamp: new Date().toISOString(),
        action: action.name,
        observations: {}
    };

    for (const observationId of observationIds) {
        undoRecord.observations[observationId] = {
            undoActions: []
        };

        const currentQualityMetrics = await getCurrentQualityMetricState(observationId);
        console.log(`Current quality metrics for observation ${observationId}:`, currentQualityMetrics);

        for (const actionItem of action.actions) {
            let undoAction;
            switch (actionItem.type) {
                case 'observationField':
                    undoAction = {
                        type: 'updateObservationField',
                        fieldId: actionItem.fieldId,
                        originalValue: preActionStates[observationId].ofvs.find(ofv => ofv.field_id === parseInt(actionItem.fieldId))?.value
                    };
                    break;
                case 'annotation':
                    undoAction = {
                        type: 'removeAnnotation',
                        attributeId: actionItem.annotationField,
                        valueId: actionItem.annotationValue,
                        uuid: null // This will be filled in after the action is performed
                    };
                    break;
                case 'addToProject':
                    undoRecord.observations[observationId].undoActions.push({
                        type: 'removeFromProject',
                        projectId: actionItem.projectId
                    });
                    break;
                case 'addComment':
                    undoAction = {
                        type: 'removeComment',
                        commentBody: actionItem.commentBody,
                        commentUUID: null // This will be filled in after the action is performed
                    };
                    break;
                case 'addTaxonId':
                    undoRecord.observations[observationId].undoActions.push({
                        type: 'removeIdentification',
                        taxonId: actionItem.taxonId
                    });
                    break;
                case 'qualityMetric':
                    if (actionItem.vote !== 'remove') {
                        undoAction = {
                            type: 'qualityMetric',
                            metric: actionItem.metric,
                            vote: actionItem.vote
                        };
                        console.log(`Generated undo action for quality metric addition:`, undoAction);
                    } else {
                        console.log(`Skipping undo action generation for DQI removal`);
                    }
                    break;
                case 'copyObservationField':
                    undoRecord.observations[observationId].undoActions.push({
                        type: 'updateObservationField',
                        fieldId: actionItem.targetFieldId,
                        originalValue: preActionStates[observationId].ofvs.find(ofv => ofv.field_id === parseInt(actionItem.targetFieldId))?.value
                    });
                    break;
            }
            if (undoAction) {
                undoRecord.observations[observationId].undoActions.push(undoAction);
            }
        }
    }

    console.log('Generated preliminary undo record:', undoRecord);
    return undoRecord;
}


function updateUndoRecord(undoRecord, actionResults) {
    for (const [observationId, results] of Object.entries(actionResults)) {
        undoRecord.observations[observationId].undoActions.forEach(undoAction => {
            if (undoAction.type === 'removeComment') {
                undoAction.commentId = results.addedCommentId;
            } else if (undoAction.type === 'removeIdentification') {
                undoAction.identificationId = results.addedIdentificationId;
            }
        });
    }
    return undoRecord;
}

function generateUndoSummary(undoRecord) {
    let summary = `Undo Record for action: ${undoRecord.action}\n\n`;
    
    for (const [observationId, observationData] of Object.entries(undoRecord.observations)) {
        summary += `Observation ${observationId}:\n`;
        observationData.undoActions.forEach(undoAction => {
            switch (undoAction.type) {
                case 'updateAnnotation':
                    summary += `  - Revert annotation ${undoAction.attributeId} to ${undoAction.originalValue || 'None'}\n`;
                    break;
                case 'updateObservationField':
                    summary += `  - Revert observation field ${undoAction.fieldId} to ${undoAction.originalValue || 'None'}\n`;
                    break;
                case 'removeFromProject':
                    summary += `  - Remove from project ${undoAction.projectId}\n`;
                    break;
                case 'removeComment':
                    summary += `  - Remove added comment (ID: ${undoAction.commentId || 'Unknown'})\n`;
                    break;
                case 'removeIdentification':
                    summary += `  - Remove added identification (ID: ${undoAction.identificationId || 'Unknown'})\n`;
                    break;
                case 'removeQualityMetric':
                    summary += `  - Remove quality metric ${undoAction.metric}\n`;
                    break;
            }
        });
        summary += '\n';
    }
    
    return summary;
}


function downloadUndoRecord(undoRecord) {
    const content = JSON.stringify(undoRecord, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'undo_record.json';
    a.click();
    URL.revokeObjectURL(url);
}


function generateUndoApiCalls(undoRecord) {
    let apiCalls = [];

    for (const [observationId, observationData] of Object.entries(undoRecord.observations)) {
        observationData.undoActions.forEach(undoAction => {
            switch (undoAction.type) {
                case 'updateAnnotation':
                    if (undoAction.originalValue) {
                        apiCalls.push(`POST /annotations\nBody: {"annotation": {"resource_type": "Observation", "resource_id": ${observationId}, "controlled_attribute_id": ${undoAction.attributeId}, "controlled_value_id": ${undoAction.originalValue}}}`);
                    } else {
                        apiCalls.push(`DELETE /annotations?observation_id=${observationId}&controlled_attribute_id=${undoAction.attributeId}`);
                    }
                    break;
                case 'updateObservationField':
                    if (undoAction.originalValue) {
                        apiCalls.push(`POST /observation_field_values\nBody: {"observation_field_value": {"observation_id": ${observationId}, "observation_field_id": ${undoAction.fieldId}, "value": "${undoAction.originalValue}"}}`);
                    } else {
                        apiCalls.push(`DELETE /observation_field_values/${undoAction.fieldId}?observation_id=${observationId}`);
                    }
                    break;
                case 'removeFromProject':
                    apiCalls.push(`DELETE /project_observations?observation_id=${observationId}&project_id=${undoAction.projectId}`);
                    break;
                case 'removeComment':
                    apiCalls.push(`DELETE /comments/:id (ID to be determined after action execution)`);
                    break;
                case 'removeIdentification':
                    apiCalls.push(`DELETE /identifications/:id (ID to be determined after action execution)`);
                    break;
                case 'removeQualityMetric':
                    if (undoAction.metric === 'needs_id') {
                        apiCalls.push(`DELETE /votes/unvote/observation/${observationId}?scope=needs_id`);
                    } else {
                        apiCalls.push(`DELETE /observations/${observationId}/quality/${undoAction.metric}`);
                    }
                    break;
            }
        });
    }

    return apiCalls;
}

function getQualityMetricName(metric) {
    const metricNames = {
        'needs_id': 'Needs ID',
        'date': 'Date',
        'location': 'Location',
        'wild': 'Wild',
        'evidence': 'Evidence',
        'recent': 'Recent',
        'subject': 'Subject'
    };
    return metricNames[metric] || metric;
}

function generateDryRunFile(action, observationIds) {
    let content = `Dry Run for Action: ${action.name}\n`;
    content += `Observations: ${observationIds.join(', ')}\n\n`;

    observationIds.forEach(observationId => {
        content += `For Observation ID ${observationId}:\n`;
        action.actions.forEach(actionItem => {
            switch (actionItem.type) {
                case 'observationField':
                    content += `POST /observation_field_values\n`;
                    content += `Body: {"observation_field_value": {"observation_id": ${observationId}, "observation_field_id": ${actionItem.fieldId}, "value": "${actionItem.fieldValue}"}}\n`;
                    content += `Description: Add observation field "${actionItem.fieldName}" with value "${actionItem.fieldValue}"\n\n`;
                    break;
                    case 'annotation':
                    const attributeId = parseInt(actionItem.annotationField);
                    const valueId = parseInt(actionItem.annotationValue);
                    let attributeLabel = 'Unknown';
                    let valueLabel = 'Unknown';

                    for (const [key, value] of Object.entries(controlledTerms)) {
                        if (value.id === attributeId) {
                            attributeLabel = key;
                            for (const [vKey, vId] of Object.entries(value.values)) {
                                if (vId === valueId) {
                                    valueLabel = vKey;
                                    break;
                                }
                            }
                            break;
                        }
                    }

                    content += `POST /annotations\n`;
                    content += `Body: {"annotation": {"resource_type": "Observation", "resource_id": ${observationId}, "controlled_attribute_id": ${actionItem.annotationField}, "controlled_value_id": ${actionItem.annotationValue}}}\n`;
                    content += `Description: Add annotation "${attributeLabel}" with value "${valueLabel}"\n\n`;
                    break;          
                    case 'addToProject':
                    content += `POST /project_observations\n`;
                    content += `Body: {"project_observation": {"observation_id": ${observationId}, "project_id": ${actionItem.projectId}}}\n`;
                    content += `Description: Add to project "${actionItem.projectName}"\n\n`;
                    break;
                case 'addComment':
                    content += `POST /comments\n`;
                    content += `Body: {"comment": {"parent_type": "Observation", "parent_id": ${observationId}, "body": "${actionItem.commentBody}"}}\n`;
                    content += `Description: Add comment: "${actionItem.commentBody.substring(0, 50)}..."\n\n`;
                    break;
                case 'addTaxonId':
                    content += `POST /identifications\n`;
                    content += `Body: {"identification": {"observation_id": ${observationId}, "taxon_id": ${actionItem.taxonId}, "body": "${actionItem.comment}"}}\n`;
                    content += `Description: Add taxon ID for "${actionItem.taxonName}"\n\n`;
                    break;
                case 'qualityMetric':
                    if (actionItem.metric === 'needs_id') {
                        content += actionItem.vote === 'remove' 
                            ? `DELETE /votes/unvote/observation/${observationId}?scope=needs_id\n`
                            : `POST /votes/vote/observation/${observationId}\n`;
                        content += `Body: {"vote": "${actionItem.vote === 'agree' ? 'yes' : 'no'}", "scope": "needs_id"}\n`;
                    } else {
                        content += actionItem.vote === 'remove'
                            ? `DELETE /observations/${observationId}/quality/${actionItem.metric}\n`
                            : `POST /observations/${observationId}/quality/${actionItem.metric}\n`;
                        if (actionItem.vote === 'disagree') {
                            content += `Body: {"agree": "false"}\n`;
                        }
                    }
                    content += `Description: Set quality metric "${getQualityMetricName(actionItem.metric)}" to ${actionItem.vote}\n\n`;
                    break;
                case 'copyObservationField':
                    content += `GET /observations/${observationId}\n`;
                    content += `Then: POST /observation_field_values\n`;
                    content += `Body: {"observation_field_value": {"observation_id": ${observationId}, "observation_field_id": ${actionItem.targetFieldId}, "value": "<value from source field ${actionItem.sourceFieldId}>"}}\n`;
                    content += `Description: Copy observation field from "${actionItem.sourceFieldName}" to "${actionItem.targetFieldName}"\n\n`;
                    break;
            }
        });
        content += '\n';
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_action_dry_run.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function showUndoRecordsModal() {
    getUndoRecords(function(undoRecords) {
        console.log('Retrieved undo records:', undoRecords);
        if (undoRecords.length === 0) {
            alert('No undo records available.');
            return;
        }

        const modal = createUndoRecordsModal(undoRecords, function(record) {
            performUndoActions(record)
                .then(() => {
                    removeUndoRecord(record.id, function() {
                        document.body.removeChild(modal);
                        showUndoRecordsModal(); // Refresh the modal
                    });
                })
                .catch(error => {
                    alert(`Error performing undo actions: ${error.message}`);
                });
        });

        document.body.appendChild(modal);
    });
}

function createSkippedActionsModal(skippedCount, skippedURL) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background-color: white;
        padding: 20px;
        border-radius: 5px;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;
    `;

    modalContent.innerHTML = `
        <h2>Bulk Action Results</h2>
        <p>${skippedCount} actions were skipped due to existing values or user permissions.</p>
        <p>View skipped observations: <a class="modal-link" href="${skippedURL}" target="_blank">${skippedURL}</a></p>
        <button id="closeModal" class="modal-button">Close</button>
    `;

    modal.appendChild(modalContent);

    document.body.appendChild(modal);

    document.getElementById('closeModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}