console.log('content.js has been loaded');

let buttonPosition = 'bottom-right'; // Default position
let idDisplay;
let refreshEnabled = true;
let isButtonsVisible = true;

let customShortcuts = [];

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
            chrome.runtime.sendMessage(
                { action: "updateObservationId", observationId: id },
                function(response) {
                    if (chrome.runtime.lastError) {
                        console.error(`Error sending ID to background: ${chrome.runtime.lastError.message}`);
                    } else {
                        console.log(`ID sent to background, response:`, response);
                    }
                }
            );
        } else if (!id) {
            console.log('Could not find observation ID in modal');
            logModalStructure();
        }
    } else {
        console.log('Modal not found');
        clearObservationId();
        chrome.runtime.sendMessage(
            { action: "updateObservationId", observationId: null },
            function(response) {
                if (chrome.runtime.lastError) {
                    console.error(`Error sending cleared ID to background: ${chrome.runtime.lastError.message}`);
                } else {
                    console.log(`Cleared ID sent to background, response:`, response);
                }
            }
        );
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
            break;
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });

function ensureCorrectObservationId(callback) {
    extractObservationId();
    setTimeout(() => {
        callback(currentObservationId);
    }, 50);
}

window.addEventListener('load', extractObservationId);

function generateRandomString() {
    var array = new Uint32Array(28);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

const codeVerifier = generateRandomString();
console.log(codeVerifier);
chrome.runtime.sendMessage({type: "CODE_VERIFIER", payload: codeVerifier}, (response) => {
    if (chrome.runtime.lastError) {
        console.log('Error in sending message:', chrome.runtime.lastError);
    } else {
        console.log('Message sent, response:', response);
    }
});

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

const buttons = [
    { text: "Generation: unisexual", field: 5251, value: 'unisexual' },
    { text: "Generation: bisexual", field: 5251, value: 'bisexual' },
    { text: "Phenophase: developing", field: 15121, value: 'developing' },
    { text: "Phenophase: dormant", field: 15121, value: 'dormant' },
    { text: "Phenophase: maturing", field: 15121, value: 'maturing' },
    { text: "Phenophase: perimature", field: 15121, value: 'perimature' },
    { text: "Phenophase: senescent", field: 15121, value: 'senescent' },
    { text: "Rearing: viable", field: 15215, value: 'viable' },
    { text: "Rearing: pending", field: 15215, value: 'pending' },
];

const buttonContainer = document.createElement('div');
buttonContainer.id = 'custom-extension-container';

buttons.forEach(btn => {
    let button = document.createElement('button');
    button.innerText = btn.text;
    button.onclick = function() {
        animateButton(this);
        addObservationField(btn.field, btn.value, this);
    };
    buttonContainer.appendChild(button);
});

let addButton8 = document.createElement('button');
addButton8.innerText = `Add GF Code`;
addButton8.onclick = function() {
    const gfCode = inputBox.value;
    if (gfCode) {
        addObservationField(13979, gfCode, this);
    }
};

const inputWrapper = document.createElement('div');
inputWrapper.style.position = 'relative';
inputWrapper.style.display = 'inline-block';

const inputBox = document.createElement('input');
inputBox.setAttribute('id', 'custom-extension-input');
inputBox.setAttribute('placeholder', 'Gallformers code');
inputBox.addEventListener('input', function() {
    addButton8.innerText = `Add GF Code: ${inputBox.value}`;
});

const tooltip = document.createElement('div');
tooltip.className = 'tooltip';
tooltip.textContent = 'Close the modal to edit';

inputBox.addEventListener('mouseenter', function() {
    if (document.querySelector('.ObservationModal.FullScreenModal')) {
        tooltip.style.display = 'block';
    }
});

inputBox.addEventListener('mouseleave', function() {
    tooltip.style.display = 'none';
});

inputWrapper.appendChild(inputBox);
inputWrapper.appendChild(tooltip);

buttonContainer.appendChild(addButton8);
buttonContainer.appendChild(inputWrapper);
buttonDiv.appendChild(buttonContainer);
document.body.appendChild(buttonDiv);


function addObservationField(fieldId, value, button = null) {
    return new Promise((resolve, reject) => {
        if (!currentObservationId) {
            console.log('No current observation ID available. Please select an observation first.');
            if (button) animateButtonResult(button, false);
            resolve({ success: false, error: 'No current observation ID' });
            return;
        }

        chrome.runtime.sendMessage(
            {action: "makeApiCall", fieldId: fieldId, value: value, observationId: currentObservationId},
            function(response) {
                if (chrome.runtime.lastError) {
                    console.error(`Error in adding observation field: ${chrome.runtime.lastError.message}`);
                    if (button) animateButtonResult(button, false);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log(`Observation field added: ${JSON.stringify(response)}`);
                    refreshObservation()
                        .then(() => {
                            if (button) animateButtonResult(button, true);
                            resolve({ success: true, data: response });
                        })
                        .catch(error => {
                            console.error('Error refreshing after adding field:', error);
                            if (button) animateButtonResult(button, true); // Still consider it a success if only refresh failed
                            resolve({ success: true, data: response, refreshError: error });
                        });
                }
            }
        );
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


function addAnnotation(currentObservationId, attributeId, valueId) {
    const url = 'https://api.inaturalist.org/v1/annotations';
    const data = {
        annotation: {
            resource_type: "Observation",
            resource_id: currentObservationId,
            controlled_attribute_id: attributeId,
            controlled_value_id: valueId
        }
    };

    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['accessToken'], function(result) {
            if (result.accessToken) {
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${result.accessToken}`
                    },
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.errors) {
                        // If there's an error (e.g., annotation already exists), resolve instead of reject
                        console.log('Annotation not added (may already exist):', data.errors);
                        resolve(data);
                    } else {
                        console.log('Annotation added successfully:', data);
                        resolve(data);
                    }
                })
                .catch(error => {
                    console.error('Error adding annotation:', error);
                    reject(error);
                });
            } else {
                reject('No access token found');
            }
        });
    });
}


function addDeadAdultAnnotations(currentObservationId) {
    const annotations = [
        { attribute: 17, value: 19 },  // Alive or Dead: Dead
        { attribute: 22, value: 24 },  // Evidence of Presence: Organism
        { attribute: 1, value: 2 }     // Life Stage: Adult
    ];

    return Promise.all(annotations.map(ann => 
        addAnnotation(currentObservationId, ann.attribute, ann.value)
    ));
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

let deadAdultButton = document.createElement('button');
deadAdultButton.innerText = 'Dead Adult';
deadAdultButton.onclick = function() {
    if (currentObservationId) {
        animateButton(this);
        addDeadAdultAnnotations(currentObservationId)
            .then(result => {
                console.log('Annotations added, starting refresh');
                return refreshObservation().then(() => true);
            })
            .then(success => {
                console.log('Dead Adult annotations added and observation refreshed');
                animateButtonResult(deadAdultButton, true);
            })
            .catch(error => {
                console.error('Error:', error);
                animateButtonResult(deadAdultButton, false);
            });
    } else {
        console.error('No current observation ID available');
        animateButtonResult(deadAdultButton, false);
    }
};
buttonContainer.appendChild(deadAdultButton);

function createDynamicButtons() {
    chrome.storage.sync.get('customButtons', function(data) {
        if (data.customButtons && data.customButtons.length > 0) {
            customShortcuts = [];

            data.customButtons.forEach(config => {
                if (!config.configurationDisabled) {
                        let button = document.createElement('button');
                        button.innerText = config.name;
                        button.onclick = function() {
                            if (config.actionType === 'observationField') {
                                addObservationField(config.fieldId, config.fieldValue, this);
                            } else if (config.actionType === 'annotation') {
                                if (currentObservationId) {
                                    addAnnotation(currentObservationId, config.annotationField, config.annotationValue)
                                        .then(() => {
                                            console.log('Annotation added successfully');
                                            return refreshObservation();
                                        })
                                        .then(() => {
                                            animateButtonResult(this, true);
                                        })
                                        .catch(error => {
                                            console.error('Error adding annotation:', error);
                                            animateButtonResult(this, false);
                                        });
                                } else {
                                    console.error('No current observation ID available');
                                    animateButtonResult(this, false);
                                }
                            }
                        };
                        button.style.display = config.buttonHidden ? 'none' : 'inline-block';
     
                        buttonContainer.appendChild(button);
                    

                    // Add shortcut regardless of button visibility
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

// Call this function after your existing button creation logic
createDynamicButtons();
