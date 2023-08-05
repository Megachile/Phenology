console.log('content.js has been loaded');

// let apiCall = false; // Variable to store the state of whether to make API calls
let observationId = null; // Variable to store the current observation ID
let lastObservationId = null; // Variable to store the last observation ID
// Create a new button element
let button = document.createElement('button');

// Set some styles for the button
button.style.position = 'fixed';
button.style.top = '20px';
button.style.left = '20px';
button.style.zIndex = '10000';  // Set a high z-index so it appears over other page elements

// Add some text to the button
button.textContent = 'Add observation field';

// Add a click event listener to the button
button.addEventListener('click', function() {
    // Send a message to the background script to make the API call
    chrome.runtime.sendMessage(
        {action: "makeApiCall"},
        function(response) {
            if (chrome.runtime.lastError) {
                console.log(`Error sending message: ${chrome.runtime.lastError.message}`);
            } else {
                console.log(`Message sent, response: ${JSON.stringify(response)}`);
            }
        }
    );
});

// Add the button to the body of the page
document.body.appendChild(button);

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
                                console.log(`Error sending message: ${chrome.runtime.lastError.message}`);
                              } else {
                                console.log(`Message sent, response: ${JSON.stringify(response)}`);
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

