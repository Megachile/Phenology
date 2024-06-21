console.log('content.js has been loaded');

chrome.runtime.sendMessage({ action: "contentScriptLoaded" });
let lastExtractedId = null;
let currentObservationId = null;
let checkInterval = null;

function extractObservationId() {
    const modal = document.querySelector('.ObservationModal.FullScreenModal');
    if (modal) {
        // Try multiple selectors to find the observation ID
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

        if (id) {
            if (id !== currentObservationId) {
                currentObservationId = id;
                console.log('New Observation ID:', id);
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
            }
        } else {
            console.log('Could not find observation ID in modal');
            console.log('Modal HTML:', modal.innerHTML);
        }
    } else {
        console.log('Modal not found');
    }
}

function checkObservation() {
    extractObservationId();
    if (!currentObservationId) {
        logModalStructure();
    }
}

function startObservationCheck() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkObservation, 250); // Check every 250ms
}

function stopObservationCheck() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
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


// Use MutationObserver to detect when the modal opens or closes
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

// Check before making API calls
function ensureCorrectObservationId(callback) {
    extractObservationId(); // Force an immediate check
    setTimeout(() => {
        callback(currentObservationId);
    }, 50); // Small delay to ensure async operations complete
}

/* // Start observing the document with the configured parameters
observer.observe(document.body, observerOptions); */

// Also check when the page loads
window.addEventListener('load', extractObservationId);

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in content:', message);

    if (message.from === 'background' && message.subject === 'initMessage') {
        console.log('Init message from background:', message.data);
    }

    if (message.from === 'background' && message.subject === 'helloContentResponse') {
        console.log('Response from background:', message.data);
    }
});

// Send an initial message to background
chrome.runtime.sendMessage({ from: 'content', subject: 'helloBackground', data: 'Hello, Background!' });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("The error script received a message:", message);

    if (message.action === 'showAlert') {
        alert(message.text);
    } else {
        alert(`well this is awkward ~-~`);
    }
});

           
function generateRandomString() {
    var array = new Uint32Array(28);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

const codeVerifier = generateRandomString();
console.log(codeVerifier)
chrome.runtime.sendMessage({type: "CODE_VERIFIER", payload: codeVerifier}, (response) => {
    if (chrome.runtime.lastError) {
        console.log('Error in sending message:', chrome.runtime.lastError);
    } else {
        console.log('Message sent, response:', response);
    }
});

let observationId = null; // Variable to store the current observation ID
let lastObservationId = null; // Variable to store the last observation ID

function animateButton(button) {
    button.style.transform = 'scale(0.9)'; // Shrink the button
    setTimeout(() => {
        button.style.transform = ''; // Restore the button size
    }, 100); // After 100ms
}

// Create a div to contain the buttons
let buttonDiv = document.createElement('div');
buttonDiv.style.position = 'fixed';
buttonDiv.style.top = '10px';
buttonDiv.style.right = '10px';
buttonDiv.style.zIndex = '10000'; // Ensure the div appears on top of other elements

// Create the buttons
let addButton1 = document.createElement('button');
addButton1.innerText = "Generation: unisexual";
addButton1.onclick = function() {
    animateButton(this);
    addObservationField(5251, 'unisexual'); };

let addButton2 = document.createElement('button');
addButton2.innerText = "Generation: bisexual";
addButton2.onclick = function() { 
    animateButton(this);
    addObservationField(5251, 'bisexual'); };

let addButton3 = document.createElement('button');
addButton3.innerText = "Phenophase: developing";
addButton3.onclick = function() { 
    animateButton(this);
    addObservationField(15121, 'developing'); };

let addButton4 = document.createElement('button');
addButton4.innerText = "Phenophase: dormant";
addButton4.onclick = function() { 
    animateButton(this);
    addObservationField(15121, 'dormant'); };

let addButton5 = document.createElement('button');
    addButton5.innerText = "Phenophase: maturing";
    addButton5.onclick = function() { 
        animateButton(this);
        addObservationField(15121, 'maturing'); };

let addButton6 = document.createElement('button');
addButton6.innerText = "Phenophase: perimature";
addButton6.onclick = function() { 
    animateButton(this);
    addObservationField(15121, 'perimature'); };

let addButton7 = document.createElement('button');
addButton7.innerText = "Phenophase: senescent";
addButton7.onclick = function() { 
    animateButton(this);
    addObservationField(15121, 'senescent'); };

    let addButton9 = document.createElement('button');
    addButton9.innerText = `Rearing: viable`;
    addButton9.onclick = function() { 
        // Use inputBox.value directly here.
        animateButton(this);
        addObservationField(15215, 'viable'); 
    };

    let addButton11 = document.createElement('button');
    addButton11.innerText = `Rearing: pending`;
    addButton11.onclick = function() { 
        // Use inputBox.value directly here.
        animateButton(this);
        addObservationField(15215, 'pending'); 
    };

      let addButton8 = document.createElement('button');
      addButton8.innerText = `Add GF Code: `;
      addButton8.onclick = function() { 
          // Use inputBox.value directly here.
          animateButton(this);
          addObservationField(13979, inputBox.value); 
      };

      const inputBox = document.createElement('input');
      inputBox.setAttribute('id', 'custom-extension-input');
      inputBox.setAttribute('placeholder', 'Gallformers code');
        // Listen for changes in the inputBox and update the button text.
    inputBox.addEventListener('input', function() {
        addButton8.innerText = `Add GF Code: ${inputBox.value}`;
    });
      
    //    let addButton10 = document.createElement('button');
    //   addButton10.innerText = 'Dead female';
    // need to write annotation function
    //   };


 // Add the buttons to the div
 buttonDiv.appendChild(addButton1);
 buttonDiv.appendChild(addButton2);
 buttonDiv.appendChild(addButton3);
 buttonDiv.appendChild(addButton4);
 buttonDiv.appendChild(addButton5);
 buttonDiv.appendChild(addButton6);
 buttonDiv.appendChild(addButton7);
 buttonDiv.appendChild(addButton9);
//  buttonDiv.appendChild(addButton10); 
 buttonDiv.appendChild(addButton11); 
 buttonDiv.appendChild(addButton8); 
 buttonDiv.appendChild(inputBox);
 document.body.appendChild(buttonDiv);   

 function addObservationField(fieldId, value) {
    ensureCorrectObservationId((observationId) => {
        chrome.runtime.sendMessage(
            {action: "makeApiCall", fieldId: fieldId, value: value, observationId: observationId},
            function(response) {
                if (chrome.runtime.lastError) {
                    console.error(`Error in adding observation field: ${chrome.runtime.lastError.message}`);
                } else {
                    console.log(`Observation field added: ${JSON.stringify(response)}`);
                }
            }
        );
    });
}

function getApiRequestUrl() {
    if (observationId !== null) {
        return `https://api.inaturalist.org/v1/observations/${observationId}`;
    } else {
        return null;
    }
}

function updateObservationId() {
    const modalElement = document.querySelector('.ObservationModal.FullScreenModal');
    if (modalElement) {
        const linkElement = modalElement.querySelector('.obs-modal-header > span > a.display-name');
        if (linkElement) {
            const observationURL = linkElement.getAttribute('href');
            const newObservationId = observationURL.split("/").pop();
            
            if (newObservationId !== observationId) {
                observationId = newObservationId;
                console.log(`New observation loaded: ${observationId}`);
                
                chrome.runtime.sendMessage(
                    { action: "updateObservationId", observationId: observationId },
                    function(response) {
                        if (chrome.runtime.lastError) {
                            console.log(`Error sending ID to background: ${chrome.runtime.lastError.message}`);
                        } else {
                            console.log(`ID sent to background, response:`, response);
                        }
                    }
                );
            }
        }
    }
}