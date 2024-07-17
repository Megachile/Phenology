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

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
  
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
    let modalFound = false;
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        const modal = document.querySelector('.ObservationModal.FullScreenModal');
        if (modal) {
          modalFound = true;
          break;
        }
      }
    }
  
    if (modalFound) {
      debouncedStartObservationCheck();
    } else {
      debouncedStopAndClear();
    }
  
  });

function createShortcutList() {
    console.log('Creating shortcut list');
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
        console.log('Shortcut list created and appended to body');
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
            console.log('Custom shortcut matched:', shortcut.name);
            if (shortcut.button && shortcut.button.isConnected) {
                console.log('Clicking button:', shortcut.button.innerText);
                shortcut.button.click();
            } else {
                console.log('Button not found or not connected to DOM for shortcut:', shortcut.name);
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

function updateObservationId() {
    console.log('updateObservationId called');
    const urlObservationId = extractObservationIdFromUrl();
    if (urlObservationId) {
        currentObservationId = urlObservationId;
        console.log('Current Observation ID (from URL):', currentObservationId);
        createOrUpdateIdDisplay(currentObservationId);
    } else {
        console.log('No ID from URL, falling back to extractObservationId');
        extractObservationId(); // Your existing function for the identify page
    }
}

function setupObservationTabsObserver() {
    console.log('Setting up observation tabs observer');
    observationTabsContainer = document.querySelector('.ObservationsPane');
    if (!observationTabsContainer) {
        console.log('Observation tabs container not found, retrying in 1 second...');
        setTimeout(setupObservationTabsObserver, 1000);
        return;
    }

    console.log('Observation tabs container found');
    const observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-id') {
                const newId = observationTabsContainer.getAttribute('data-id');
                console.log('New data-id detected:', newId);
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

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded event fired");
    if (window.location.href.includes('/observations/identify')) {
        console.log("On identify page");
        extractObservationId();
    } else if (window.location.pathname.match(/^\/observations\/\d+/)) {
        console.log("On individual observation page");
        const observationId = window.location.pathname.split('/').pop();
        console.log("Observation ID from URL:", observationId);
        currentObservationId = observationId;
        createOrUpdateIdDisplay(observationId);
    }
    checkForConfigUpdates();
    initializeDragAndDrop();
    loadButtonOrder();
});

// Handle URL changes
window.addEventListener('popstate', () => {
    console.log('popstate event fired');
    updateObservationId();
});

// Overriding pushState and replaceState
const originalPushState = history.pushState;
history.pushState = function() {
    console.log('pushState called');
    originalPushState.apply(this, arguments);
    updateObservationId();
};

const originalReplaceState = history.replaceState;
history.replaceState = function() {
    console.log('replaceState called');
    originalReplaceState.apply(this, arguments);
    updateObservationId();
};

function logModalStructure() {
    const modal = document.querySelector('.ObservationModal.FullScreenModal');
    if (modal) {
        const header = modal.querySelector('.obs-modal-header');
        if (header) {
            console.log('Header structure:', header.innerHTML);
        } else {
            console.log('Header not found in modal');
        }
    } else {
        console.log('Modal not found');
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
    return ensureCorrectObservationId().then(async id => {
        if (!id) {
            console.log('No current observation ID available. Please select an observation first.');
            return { success: false, error: 'No current observation ID' };
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
    });
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
            console.log('Annotation not added (may already exist):', responseData.errors);
            return { success: false, message: 'Annotation may already exist', data: responseData };
        } else {
            console.log('Annotation added successfully:', responseData);
            return { success: true, data: responseData };
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
            return { success: true, data: responseData };
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
    extractObservationId();
    if (!currentObservationId) {
        createOrUpdateIdDisplay('None');
    }
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

function performActions(actions) {
    const lockedObservationId = currentObservationId;
    if (!lockedObservationId) {
        alert('Please open an observation before using this button.');
        return Promise.resolve();
    }

    const isIdentifyPage = window.location.pathname.includes('/identify');
    const isObservationPage = window.location.pathname.match(/^\/observations\/\d+/);
    let needsPageUpdate = true;

    return actions.reduce((promise, action) => {
        return promise.then(() => {
            switch (action.type) {
                case 'observationField':
                    return addObservationField(lockedObservationId, action.fieldId, action.fieldValue);
                case 'annotation':
                    return addAnnotation(lockedObservationId, action.annotationField, action.annotationValue);
                case 'addToProject':
                    return addObservationToProject(lockedObservationId, action.projectId);
                case 'addComment':
                    return addComment(lockedObservationId, action.commentBody);
                case 'addTaxonId':
                    return addTaxonId(lockedObservationId, action.taxonId, action.comment);
                case 'qualityMetric':
                    if (isIdentifyPage || action.metric === 'needs_id') {
                        return handleQualityMetricAPI(lockedObservationId, action.metric, action.vote);
                    } else {
                        needsPageUpdate = false; // Don't update page for non-needs_id quality actions on observation page
                        return handleQualityMetric(lockedObservationId, action.metric, action.vote);
                    }
                case 'copyObservationField':
                    return copyObservationField(lockedObservationId, action.sourceFieldId, action.targetFieldId);
           
            }
        });
    }, Promise.resolve())
    .then(() => {
        if (isIdentifyPage) {
            console.log('Attempting to refresh observation');
            return refreshObservation().catch(error => {
                console.error('Error in refreshObservation:', error);
            });
        } else if (isObservationPage && needsPageUpdate) {
            console.log('Updating observation page');
            return updateObservationPage(currentObservationId).catch(error => {
                console.error('Error in updateObservationPage:', error);
            });
        }
    })
    .catch(error => {
        console.error('Error in performActions:', error);
    });
}

function refreshObservation() {
    console.log('refreshObservation called');
    return new Promise((resolve, reject) => {
        console.log('refreshEnabled:', refreshEnabled);
        console.log('currentObservationId:', currentObservationId);
        if (!refreshEnabled || !currentObservationId) {
            console.log('Refresh not enabled or no current observation ID');
            resolve();
            return;
        }

        if (window.location.pathname.match(/^\/observations\/\d+/)) {
            console.log('On individual observation page, reloading');
            window.location.reload();
        }

        const grid = document.querySelector("#Identify > div > div.mainrow.false.row > div.main-col > div.ObservationsGrid.flowed.false.row");
        console.log('Grid element found:', !!grid);
        if (!grid) {
            console.log('Grid not found, rejecting');
            reject(new Error('Grid not found'));
            return;
        }

        const observationLink = grid.querySelector(`a[href="/observations/${currentObservationId}"]`);
        console.log('Observation link found:', !!observationLink);
        if (observationLink) {
            console.log('Clicking observation link');
            observationLink.click();
            const observer = new MutationObserver((mutations, obs) => {
                if (document.querySelector('.ObservationModal')) {
                    console.log('ObservationModal found, resolving');
                    obs.disconnect();
                    resolve();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            console.log('Observation not found in grid, rejecting');
            reject(new Error('Observation not found in grid'));
        }
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
    browserAPI.storage.sync.get(['customButtons', 'buttonOrder'], function(data) {
        if (data.customButtons && data.customButtons.length > 0) {
            customShortcuts = [];
            buttonContainer.innerHTML = ''; // Clear existing buttons

            const orderedButtons = data.buttonOrder || data.customButtons.map(config => config.id);

            orderedButtons.forEach(buttonId => {
                const config = data.customButtons.find(c => c.id === buttonId);
                if (config && !config.configurationDisabled) {
                    createButton(config);
                }
            });

            initializeDragAndDrop();
        }
    });
}

function createButton(config) {
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
                .then(() => {
                    animateButtonResult(this, true);
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
        console.log('Extension context invalidated. This is likely due to the extension being reloaded.');
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
        //console.log('Button order saved:', order);
    });
}

function loadButtonOrder() {
    browserAPI.storage.sync.get('buttonOrder', (data) => {
        if (data.buttonOrder) {
            const container = document.getElementById('custom-extension-container');
            data.buttonOrder.forEach(buttonId => {
                const button = container.querySelector(`[data-button-id="${buttonId}"]`);
                if (button) container.appendChild(button);
            });
        }
    });
}

createDynamicButtons();

