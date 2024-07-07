console.log('content.js has been loaded');

let buttonPosition = 'bottom-right'; // Default position
let idDisplay;
let refreshEnabled = true;
let isButtonsVisible = true;
let customShortcuts = [];
let lastKnownUpdate = 0;
const API_URL = 'https://api.inaturalist.org/v1';
let shortcutListVisible = false;

function toggleShortcutList() {
    if (shortcutListVisible) {
        document.getElementById('shortcut-list-container').remove();
        shortcutListVisible = false;
    } else {
        createShortcutList();
        shortcutListVisible = true;
    }
}

const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
        if (mutation.type === 'childList') {
            const modal = document.querySelector('.ObservationModal.FullScreenModal');
            if (modal) {
                startObservationCheck();
            } else {
                stopObservationCheck();
                clearObservationId();
                if (idDisplay) {
                    idDisplay.style.display = 'none';
                }
            }

            // Check for the ID page element
            const idPageElement = document.querySelector('.ObservationModal');
            if (idPageElement) {
                console.log('ID page detected');
            }

            break;
        }
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
        <li>Alt + B: Toggle button visibility</li>
        <li>Alt + N: Cycle button position</li>
        <li>Ctrl + Shift + R: Toggle refresh</li>
        <li>Alt + H: Toggle this shortcut list</li>
    `;

    // Add custom shortcuts
    chrome.storage.sync.get('customButtons', function(data) {
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

function formatShortcut(shortcut) {
    let parts = [];
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.key) parts.push(shortcut.key);
    return parts.join(' + ');
}

function handleAllShortcuts(event) {
    // Always allow these shortcuts, even when typing
    if (event.altKey && event.key === 'b') {
        toggleButtonVisibility();
        return;
    }
    if (event.altKey && event.key === 'n') {
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
            // Find and click the corresponding button
            const button = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText === shortcut.name);
            if (button) button.click();
        }
    });
}

document.addEventListener('keydown', handleAllShortcuts);

function checkForConfigUpdates() {
    chrome.storage.sync.get(['lastConfigUpdate'], function(result) {
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
    chrome.storage.sync.set({buttonPosition: buttonPosition});
  }


chrome.storage.sync.get('buttonPosition', function(data) {
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

let currentObservationId = null;
let checkInterval = null;

function extractObservationId() {
    const modal = document.querySelector('.ObservationModal.FullScreenModal');
    if (modal) {
        const selectors = [
            '.obs-modal-header .comname.display-name',
            '.obs-modal-header .sciname.secondary-name',
            '.obs-modal-header a[href^="/observations/"]'
        ];

        let id = null;
        for (let selector of selectors) {
            const element = modal.querySelector(selector);
            if (element) {
                const href = element.getAttribute('href');
                id = href.split('/').pop();
                break;
            }
        }

        if (id && id !== currentObservationId) {
            currentObservationId = id;
            console.log('New Observation ID:', id);
            createOrUpdateIdDisplay(id);  
        } else if (!id) {
            console.log('Could not find observation ID in modal');
            logModalStructure();
        }
    } else {
        console.log('Modal not found');
        clearObservationId();

    }
}

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

function addObservationField(observationId, fieldId, value, button = null) {
    return ensureCorrectObservationId().then(id => {
        if (!id) {
            console.log('No current observation ID available. Please select an observation first.');
            return { success: false, error: 'No current observation ID' };
        }

        return new Promise((resolve, reject) => {
            if (!observationId) {
                console.log('No current observation ID available. Please select an observation first.');
                resolve({ success: false, error: 'No current observation ID' });
                return;
            }

            chrome.storage.local.get(['jwt'], function(result) {
                const token = result.jwt;
                if (!token) {
                    console.error('No JWT found');
                    sendResponse({ status: "error", message: "No JWT found" });
                    return;
                }

                const requestUrl = `https://api.inaturalist.org/v1/observation_field_values`;
                const headers = {
                    'Authorization': `Bearer ${token}`,
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

                fetch(requestUrl, options)
                    .then(response => {
                        if (!response.ok) {
                            return response.text().then(text => {
                                throw new Error(`Network response was not ok. Status: ${response.status}, Body: ${text}`);
                            });
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('Added observation field:', data);
                        resolve({ success: true, data: data });
                    })
                    .catch(error => {
                        if (error.message.includes("Observation user does not accept fields from others")) {
                            console.log('User does not accept fields from others:', error);
                            resolve({ success: false, error: 'User does not accept fields from others' });
                        } else {
                            console.error('Error in adding observation field:', error);
                            resolve({ success: false, error: error.message });
                        }
                    });
            });
        });
    });
}


function animateButtonResult(button, success) {
    button.classList.add(success ? 'button-success' : 'button-failure');
    setTimeout(() => {
        button.classList.remove('button-success', 'button-failure');
    }, 1200); 
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in content:', message);
    if (message.action === 'showAlert') {
        alert(message.text);
    } else if (message.from === 'background') {
        if (message.subject === 'initMessage') {
            console.log('Init message from background:', message.data);
        } else if (message.subject === 'helloContentResponse') {
            console.log('Response from background:', message.data);
        }
    }
});

chrome.runtime.sendMessage({ from: 'content', subject: 'helloBackground', data: 'Hello, Background!' });

chrome.runtime.sendMessage({action: "getJWT"}, function(response) {
    if (response.jwt) {
      // Use the JWT for API calls
      const jwt = response.jwt;
      // Make API calls using this JWT
    } else {
      console.error('Failed to get JWT:', response.error);
      // Handle the error (e.g., prompt user to re-authenticate)
    }
  });

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
      background-color: rgba(0, 255, 0, 0.7);
  }
  .button-failure {
      animation: pulseRed 1.5s ease-out;
      background-color: rgba(255, 0, 0, 0.7);
  }
  #custom-extension-container {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      max-width: 600px;
  }
  button, #custom-extension-input {
    font-size: 14px;
    padding: 5px 10px;
    margin: 3px;
    flex-grow: 1;
    min-width: 100px;
    background-color: rgba(0, 0, 0, 0.5); /* 50% transparency */
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }
  button:hover {
      background-color: rgba(0, 0, 0, 0.7); /* Darker background on hover */
  }
  #custom-extension-input {
      width: 120px;
  }
  .tooltip {
      position: absolute;
      background-color: #333;
      color: #fff;
      padding: 5px;
      border-radius: 3px;
      font-size: 12px;
      top: -25px;
      left: 0;
      white-space: nowrap;
      display: none;
      z-index: 10002;
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

function clearObservationId() {
    currentObservationId = null;
    if (idDisplay) {
        idDisplay.textContent = 'Current Observation ID: None';
    }
    console.log('Observation ID cleared');
}

function addAnnotation(observationId, attributeId, valueId) {
    return new Promise((resolve, reject) => {
        if (!observationId) {
            console.log('No observation ID provided. Please select an observation first.');
            return resolve({ success: false, error: 'No observation ID provided' });
        }

        chrome.storage.local.get(['jwt'], function(result) {
            const token = result.jwt;
            if (!token) {
                console.error('No JWT found');
                return resolve({ success: false, error: 'No JWT found' });
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

            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                if (data.errors) {
                    console.log('Annotation not added (may already exist):', data.errors);
                    return resolve({ success: false, message: 'Annotation may already exist', data: data });
                } else {
                    console.log('Annotation added successfully:', data);
                    return resolve({ success: true, data: data });
                }
            })
            .catch(error => {
                console.error('Error adding annotation:', error);
                return resolve({ success: false, error: error.toString() });
            });
        });
    });
}

function performActions(actions) {
    const currentId = currentObservationId;
    if (!currentId) {
        console.error('No observation selected. Please open an observation before performing actions.');
        alert('Please open an observation before using this button.');
        return Promise.resolve();
    }

    return actions.reduce((promise, action) => {
        return promise.then(() => {
            if (action.type === 'observationField') {
                return addObservationField(currentId, action.fieldId, action.fieldValue);
            } else if (action.type === 'annotation') {
                return addAnnotation(currentId, action.annotationField, action.annotationValue);
            }
        }).then(() => {
            return new Promise(resolve => setTimeout(resolve, 500));
        });
    }, Promise.resolve())
    .then(() => {
        console.log('All actions completed, refreshing observation');
        return refreshObservation();
    })
    .catch(error => {
        console.error('Error in performActions:', error);
    });
}

function refreshObservation() {
    return new Promise((resolve, reject) => {
        if (!refreshEnabled) {
            console.log('Refresh is disabled');
            resolve();
            return;
        }
        const prevButton = document.querySelector('.ObservationModal button.nav-button[alt="Previous Observation"]');
        const nextButton = document.querySelector('.ObservationModal button.nav-button[alt="Next Observation"]');

        if (!prevButton || !nextButton) {
            console.error('Navigation buttons not found');
            reject(new Error('Navigation buttons not found'));
            return;
        }

        prevButton.click();
        setTimeout(() => {
            nextButton.click();
            setTimeout(resolve, 1);
        }, 1);
    });
}

function toggleRefresh() {
    refreshEnabled = !refreshEnabled;
    updateRefreshIndicator();
}

function createDynamicButtons() {
    chrome.storage.sync.get('customButtons', function(data) {
        if (data.customButtons && data.customButtons.length > 0) {
            customShortcuts = [];

            data.customButtons.forEach(config => {
                if (!config.configurationDisabled) {
                    let button = document.createElement('button');
                    button.innerText = config.name;
                    button.onclick = function() {
                        animateButton(this);
                        performActions(config.actions)
                            .then(() => {
                                animateButtonResult(this, true);
                            })
                            .catch(error => {
                                console.error('Error performing actions:', error);
                                animateButtonResult(this, false);
                            });
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
                            button: button
                        });
                    }
                }
            });
        }
    });
}


createDynamicButtons();

window.addEventListener('error', function(event) {
    if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
        console.log('Extension context invalidated. This is likely due to the extension being reloaded.');
        event.preventDefault(); // Prevent the error from being thrown
    }
});

