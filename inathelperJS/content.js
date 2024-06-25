console.log('content.js has been loaded');

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
buttonDiv.style.top = '10px';
buttonDiv.style.right = '10px';
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

buttons.forEach(btn => {
    let button = document.createElement('button');
    button.innerText = btn.text;
    button.onclick = function() {
        animateButton(this);
        addObservationField(btn.field, btn.value, this);
    };
    buttonDiv.appendChild(button);
});

let addButton8 = document.createElement('button');
addButton8.innerText = `Add GF Code: `;
addButton8.onclick = createInputModal;;

function createInputModal() {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.left = '50%';
    modal.style.top = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = 'white';
    modal.style.padding = '20px';
    modal.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    modal.style.zIndex = '1000000';

    const input = document.createElement('input');
    input.setAttribute('placeholder', 'Gallformers code');
    
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.onclick = function() {
        addObservationField(13979, input.value, this);
        document.body.removeChild(modal);
    };

    modal.appendChild(input);
    modal.appendChild(submitButton);

    document.body.appendChild(modal);
    input.focus();
}

const inputBox = document.createElement('input');
inputBox.setAttribute('id', 'custom-extension-input');
inputBox.setAttribute('placeholder', 'Gallformers code');
inputBox.addEventListener('input', function() {
    addButton8.innerText = `Add GF Code: ${inputBox.value}`;
});

buttonDiv.appendChild(addButton8);
buttonDiv.appendChild(inputBox);
document.body.appendChild(buttonDiv);

function addObservationField(fieldId, value, button) {
    ensureCorrectObservationId((observationId) => {
        chrome.runtime.sendMessage(
            {action: "makeApiCall", fieldId: fieldId, value: value, observationId: observationId},
            function(response) {
                if (chrome.runtime.lastError) {
                    console.error(`Error in adding observation field: ${chrome.runtime.lastError.message}`);
                    animateButtonResult(button, false);
                } else {
                    console.log(`Observation field added: ${JSON.stringify(response)}`);
                    animateButtonResult(button, true);
                }
            }
        );
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
    top: 10px;
    left: 10px;
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

button {
    font-size: 14px;
    padding: 5px 10px;
    margin: 3px;
}

#custom-extension-input {
    font-size: 14px;
    padding: 5px 10px;
    margin: 3px;
    position: relative;
    z-index: 10001;
}

`;
document.head.appendChild(style);

let idDisplay;

function createOrUpdateIdDisplay(id) {
    if (!idDisplay) {
        idDisplay = document.createElement('div');
        idDisplay.id = 'observation-id-display';
        document.body.appendChild(idDisplay);
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


