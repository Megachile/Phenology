console.log('content.js has been loaded');

let buttonPosition = 'top-left'; // Default position
let idDisplay;

chrome.storage.sync.get('buttonPosition', function(data) {
    if (data.buttonPosition) {
        buttonPosition = data.buttonPosition;
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
                document.querySelector('.tooltip').style.display = 'none';
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
        ensureCorrectObservationId((observationId) => {
            chrome.runtime.sendMessage(
                {action: "makeApiCall", fieldId: fieldId, value: value, observationId: observationId},
                function(response) {
                    if (chrome.runtime.lastError) {
                        console.error(`Error in adding observation field: ${chrome.runtime.lastError.message}`);
                        if (button) animateButtonResult(button, false);
                        reject(chrome.runtime.lastError);
                    } else {
                        console.log(`Observation field added: ${JSON.stringify(response)}`);
                        if (button) animateButtonResult(button, true);
                        resolve(response);
                    }
                }
            );
        });
    });
}

function animateButtonResult(button, success) {
    button.classList.add(success ? 'button-success' : 'button-failure');
    setTimeout(() => {
        button.classList.remove('button-success', 'button-failure');
    }, 1500); 
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in content:', message);
    if (message.action === "updateButtonPosition") {
        buttonPosition = message.position;
        updatePositions();
    }
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
  }
  .button-failure {
      animation: pulseRed 1.5s ease-out;
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
        updatePositions(); // Position the display when it's first created
    }
    
    idDisplay.textContent = `Current Observation ID: ${id}`;
    idDisplay.classList.add('updated');
    
    setTimeout(() => {
        idDisplay.classList.remove('updated');
    }, 500);
}

window.addEventListener('load', () => {
    extractObservationId();
    if (!currentObservationId) {
        createOrUpdateIdDisplay('None');
    }
});

document.addEventListener('keydown', function(event) {
    // Check if the pressed key is 'u' or 'b'
    if (event.key.toLowerCase() === 'u' || event.key.toLowerCase() === 'b') {
        // Check if the modal is open
        const modal = document.querySelector('.ObservationModal.FullScreenModal');
        if (modal) {
            // Check if the active element is not an input or textarea
            const activeElement = document.activeElement;
            const isInput = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
            
            if (!isInput) {
                // Prevent the default action to avoid interfering with other shortcuts
                event.preventDefault();
                
                let fieldValue, buttonText;
                if (event.key.toLowerCase() === 'u') {
                    fieldValue = 'unisexual';
                    buttonText = "Generation: unisexual";
                } else {
                    fieldValue = 'bisexual';
                    buttonText = "Generation: bisexual";
                }
                
                // Find the corresponding button
                const button = Array.from(document.querySelectorAll('button')).find(button => button.innerText === buttonText);
                
                // Trigger the OF addition
                addObservationField(5251, fieldValue)
                    .then(() => {
                        if (button) {
                            animateButton(button);
                            animateButtonResult(button, true);
                        }
                    })
                    .catch(() => {
                        if (button) {
                            animateButton(button);
                            animateButtonResult(button, false);
                        }
                    });
            }
        }
    }
});







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
                    console.log('Annotation added successfully:', data);
                    resolve(data);
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

let deadAdultButton = document.createElement('button');
deadAdultButton.innerText = 'Dead Adult';
deadAdultButton.onclick = function() {
    if (currentObservationId) {
        addDeadAdultAnnotations(currentObservationId)
            .then(() => console.log('Dead Adult annotations added successfully'))
            .catch(error => console.error('Error adding Dead Adult annotations:', error));
    } else {
        console.error('No current observation ID available');
    }
};
buttonContainer.appendChild(deadAdultButton);
