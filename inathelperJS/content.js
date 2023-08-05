console.log('content.js has been loaded');

// let apiCall = false; // Variable to store the state of whether to make API calls
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
addButton1.innerText = "Add Generation: unisexual";
addButton1.onclick = function() {
    animateButton(this);
    addObservationField(5251, 'unisexual'); };

let addButton2 = document.createElement('button');
addButton2.innerText = "Add Generation: bisexual";
addButton2.onclick = function() { 
    animateButton(this);
    addObservationField(5251, 'bisexual'); };

let addButton3 = document.createElement('button');
addButton3.innerText = "Add Phenophase: developing";
addButton3.onclick = function() { 
    animateButton(this);
    addObservationField(15121, 'developing'); };

let addButton4 = document.createElement('button');
addButton4.innerText = "Add Phenophase: dormant";
addButton4.onclick = function() { 
    animateButton(this);
    addObservationField(15121, 'dormant'); };

let addButton5 = document.createElement('button');
    addButton5.innerText = "Add Phenophase: maturing";
    addButton5.onclick = function() { 
        animateButton(this);
        addObservationField(15121, 'maturing'); };

let addButton6 = document.createElement('button');
addButton6.innerText = "Add Phenophase: perimature";
addButton6.onclick = function() { 
    animateButton(this);
    addObservationField(15121, 'perimature'); };

let addButton7 = document.createElement('button');
addButton7.innerText = "Add Phenophase: senescent";
addButton7.onclick = function() { 
    animateButton(this);
    addObservationField(15121, 'senescent'); };

 // Add the buttons to the div
 buttonDiv.appendChild(addButton1);
 buttonDiv.appendChild(addButton2);
 buttonDiv.appendChild(addButton3);
 buttonDiv.appendChild(addButton4);
 buttonDiv.appendChild(addButton5);
 buttonDiv.appendChild(addButton6);
 buttonDiv.appendChild(addButton7);
 // Add the div to the body of the document
 document.body.appendChild(buttonDiv);   

// I think not going to use this but if desired this will reload the current observation to show that the info has been added. 
//It is inconvenient at speed though so undesirable for our intended use (speed)
// function simulateNavigation() {
//     let previousButton = document.querySelector('button[alt="Previous Observation"]');
//     let nextButton = document.querySelector('button[alt="Next Observation"]');
    
//     if (previousButton && nextButton) {
//         previousButton.click();

//         // Use a timeout to wait for the page to load the previous observation
//         setTimeout(() => {
//             nextButton.click();
//         }, 1);  // Adjust the delay as needed
//     } else {
//         console.log('Navigation buttons not found');
//     }
// }

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

