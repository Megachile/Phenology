console.log('content.js has been loaded');
// content.js
chrome.runtime.sendMessage({ action: "contentScriptLoaded" });



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
    // Send a message to the background script to make the API call
    chrome.runtime.sendMessage(
        {action: "makeApiCall", fieldId: fieldId, value: value},
        function(response) {
            if (chrome.runtime.lastError) {
                console.error(`Error in adding observation field: ${chrome.runtime.lastError.message}`);
            } else {
                console.log(`Observation field added: ${JSON.stringify(response)}`);
            }
            // simulateNavigation();
        }
    );
}

// Function to generate the API URL
function getApiRequestUrl() {
    // Check if observationId is not null
    if (observationId !== null) {
        // Return the formatted URL
        return `https://api.inaturalist.org/v1/observations/${observationId}`;
    } else {
        return null;
    }
}
 
// Selectors for the iNaturalist modal and observation links
let modalSelector = '.ObservationModal.FullScreenModal';
let observationLinkSelector = '.obs-modal-header > span > a.display-name';

let observer = new MutationObserver((mutationsList, observer) => {
    for(let mutation of mutationsList) {
        if (mutation.type === 'childList') {
            let modalElement = document.querySelector(modalSelector);
            if(modalElement !== null) {
            
                let linkElement = modalElement.querySelector(observationLinkSelector);
                if(linkElement !== null) {
                    let observationURL = linkElement.getAttribute('href');
                    observationId = observationURL.split("/").pop(); // Update the observationId

                    // Check if the new observationId is different from the last one
                    if (observationId !== lastObservationId) {
                        console.log(`New observation loaded: ${observationId}`);
                        lastObservationId = observationId; // Update the last observation ID
                        
                        // Send a message to the background script with the new observationId
                        chrome.runtime.sendMessage(
                            {action: "updateObservationId",
                              observationId: observationId
                            },
                            function(response) {
                              if (chrome.runtime.lastError) {
                                console.log(`Error sending ID to background: ${chrome.runtime.lastError.message}`);
                              } else {
                                console.log(`ID sent to background, response: ${JSON.stringify(response)}`);
                              }
                            }
                          );
                    }
                                          
                }
            }
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });

