console.log('Background script loaded');
importScripts('axios.min.js');


chrome.storage.local.get(['accessToken'], function(result) {
    const token = result.accessToken;
    
    if (token) {
        console.log(`This access token was already cached: ${token}; about to test`);
        addObservationField("175564666", 15121, 'na', token)
        .then(response => {
            if (response.status && response.status === 'error') {
                console.log(`Error in adding observation field: ${response.message}. This typically means the API token is not valid; waiting for iNat ID page to be loaded to trigger auth flow`);
                listenForCodeVerifier()
            } else {
                console.log(`Test field added successfully. API token valid; normal use can proceed. Response: ${JSON.stringify(response)}`);
            }
        });
        
    } else {
        console.error('No access token found; waiting for iNat ID page to be loaded to trigger auth flow');
        listenForCodeVerifier()
    }
});


let storedTabId;
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "contentScriptLoaded") {
        console.log("Content script is loaded and ready in tab:", sender.tab.id);
        storedTabId = sender.tab.id;
        console.log(`Stored tab ID: ${storedTabId}`);
        // If needed, send a message back or perform other actions
        // chrome.tabs.sendMessage(sender.tab.id, { action: "testMessage", text: "Hello from background!" });
    }
});


// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in background:', message);

    if (message.from === 'content' && message.subject === 'helloBackground') {
        sendResponse({ from: 'background', subject: 'helloContentResponse', data: 'Hello, Content Script!' });
    }
});

function listenForCodeVerifier() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Received message:', request, 'from sender:', sender);
        
        if (request.type === 'CODE_VERIFIER') {
            const codeVerifier = request.payload;
            console.log('Received codeVerifier:', codeVerifier);
            
            sendResponse({status: "Received the codeVerifier"});
            
            chrome.storage.local.set({codeVerifier: codeVerifier}, function() {
                // Once the codeVerifier is stored, start the authorization process
                startAuthorizationProcess(codeVerifier);
            });
        }
    });
}



function addObservationField(observationId, observationFieldId, value, token) {
    console.log('Adding observation field...');
    const requestUrl = 'https://api.inaturalist.org/v1/observation_field_values';
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    const data = {
        observation_field_value: {
            observation_id: observationId,
            observation_field_id: observationFieldId,
            value: value
        }
    };
    const options = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    };
    console.log(`Generated a URL to send to the API: ${requestUrl} with these options:`, JSON.stringify(options, null, 2));
    return fetch(requestUrl, options)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok'); 
            }
            return response.json();
        })
        .then(data => {
            console.log('Added observation field:', data);
            return data;
        })
        .catch((error) => {
            console.error('Error in adding observation field:', error);
            
            return {status: 'error', message: error.message};
        });
}

let observationId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateObservationId') {
        console.log("Received 'updateObservationId' message from content script. New observation ID: " + request.observationId);
        observationId = request.observationId;
        sendResponse({status: 'observation ID updated'});
    } else {
        return; 
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'makeApiCall') {
         // Ensure a valid observation ID is present
         if (!observationId || observationId === "null") {
            sendResponse({ status: 'error', message: 'Invalid observation ID' });
            return;
        }
        // Get the stored token
        chrome.storage.local.get(['accessToken'], function(result) {
            const token = result.accessToken;

            console.log(`using this access token ${token}`)
            if (!token) {
                console.error('No access token found');
                return;
            }
            addObservationField(observationId, request.fieldId, request.value, token)
                .then(response => {
                    console.log(`Observation field added successfully. Response: ${JSON.stringify(response.data)}`);
                    sendResponse({status: `${request.fieldId} successfully set to ${request.value} for observation ${observationId}`, data: response.data});
                })
                .catch(err => {
                          console.log(`Error in adding observation field: ${err}`);
                    sendResponse({status: "Error in adding observation field", message: err.message});
                });
        });
        
        return true; // To enable async sendResponse
    } else {
        return;
    }
});

async function sha256base64(message) {
    // encode as UTF-8
    const msgBuffer = new TextEncoder().encode(message);

    // hash the message
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

    // convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer));
console.log( "SHA-256 Hash:", hashArray.map(byte => ('00' + byte.toString(16)).slice(-2)).join(''));
    // convert bytes to base64
    const hashBase64 = btoa(String.fromCharCode.apply(null, hashArray));

    return hashBase64;
}
    
async function generateCodeChallenge(codeVerifier) {
    // Hash the code verifier
    const hash = await sha256base64(codeVerifier);
    console.log(`Hashed code ${hash}`);
    let encoded = hash;
    encoded = encoded.split('=')[0]; // Remove any trailing '='
    encoded = encoded.replace('+', '-'); // 62nd char of encoding
    encoded = encoded.replace('/', '_'); // 63rd char of encoding
    console.log(`processed hash ${encoded}`)
    return encoded;
}

async function startAuthorizationProcess(codeVerifier) {    
    if(!codeVerifier) {
        console.error("codeVerifier is not set");
        return;
    }
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    console.log(`Code challenge ${codeChallenge}`)
    const clientId = 'e2RUzw_g08SfNA_XeckoECYgPu9g0FDefi4wQDbYXNE';
    const redirectUri = encodeURIComponent('https://caiabpkbpfdelfbbhehgoakfbnfgbofj.chromium.app.org/'); 
    const authorizeUrl = `https://www.inaturalist.org/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&code_challenge_method=S256&code_challenge=${codeChallenge}`;
    chrome.tabs.create({ url: authorizeUrl });
}


    async function getAccessTokenWithCodeVerifier(code, codeVerifier) {
            const params = {
            client_id: 'e2RUzw_g08SfNA_XeckoECYgPu9g0FDefi4wQDbYXNE',
            code: code,
            redirect_uri: 'https://caiabpkbpfdelfbbhehgoakfbnfgbofj.chromium.app.org/', // Update this with your redirect_uri
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
        };
                // Define the token URL
        const tokenUrl = 'https://www.inaturalist.org/oauth/token';
    
        console.log("Requesting token from URL:", tokenUrl);
        console.log("Payload:", params);

        try {
            console.log('Getting access token...');
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
    
            // Check the response
            if (!response.ok) {
                const errorText = await response.text();  // Capture the response body as text
                throw new Error(`Response not OK: ${response.status} ${response.statusText}. Body: ${errorText}`);
            };
    
            // Get the access token from the response body
            const { access_token: accessToken } = await response.json();
            console.log('Access token received:', accessToken);
    
            // Return the access token
            return accessToken;
        } catch (error) {
            console.error(`Error getting access token: ${error}`);
            return null;
        }
    }

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
        chrome.tabs.get(tabId, async (tab) => {
            if (tab.url && tab.url.startsWith('https://caiabpkbpfdelfbbhehgoakfbnfgbofj.chromium.app.org/')) {
                const url = new URL(tab.url);
                const code = url.searchParams.get('code');
                
                if (code) {
                    console.log('Extracted code:', code);
                    chrome.tabs.remove(tabId);
                    chrome.storage.local.get(['codeVerifier'], async function(result) {
                        let codeVerifier = result.codeVerifier;
                        if (codeVerifier) {
                            const accessToken = await getAccessTokenWithCodeVerifier(code, codeVerifier);
                            if (accessToken) {
                                console.log(`access token exists`);
                                chrome.storage.local.set({ accessToken: accessToken }, function() {
                                    if (chrome.runtime.lastError) {
                                        console.log('Error storing the access token:', chrome.runtime.lastError);
                                    } else {
                                        console.log(`Access token ${accessToken} stored successfully.`);
                                    }
                                });
                            } else {
                                console.log(`access token doesn't exist`);
                                chrome.tabs.sendMessage(storedTabId, {
                                    action: "showAlert", 
                                    text: "Failed to retrieve the API access token. Unless this problem is resolved, pressing the buttons will not add data."
                                });
                                return;
                            }
                        }
                    });
                } else {
                    console.log('No code found in the URL.');
                }
            }
        });
    } else {
        return;
    }
});
