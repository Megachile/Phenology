console.log('Background script loaded');
importScripts('axios.min.js');

const CLIENT_ID = 'e2RUzw_g08SfNA_XeckoECYgPu9g0FDefi4wQDbYXNE';
const REDIRECT_URI = 'https://caiabpkbpfdelfbbhehgoakfbnfgbofj.chromium.app.org/';
const AUTH_URL = 'https://www.inaturalist.org/oauth/authorize';
const TOKEN_URL = 'https://www.inaturalist.org/oauth/token';
const API_URL = 'https://api.inaturalist.org/v1';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "testMessage") {
        console.log('Test message received in background:', message.data);
        sendResponse({status: 'received'});
    }
    return true;  // This is important for asynchronous response
});

let observationId = null;
let storedTabId;

// Utility Functions
function generateTestString() {
    const testString = 'test_' + Math.random().toString(36).substring(2, 15);
    console.log('Generated test string:', testString);
    return testString;
}

function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

async function sha256base64(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    console.log("SHA-256 Hash:", hashArray.map(byte => ('00' + byte.toString(16)).slice(-2)).join(''));
    return btoa(String.fromCharCode.apply(null, hashArray));
}

async function generateCodeChallenge(codeVerifier) {
    const hash = await sha256base64(codeVerifier);
    console.log(`Hashed code ${hash}`);
    let encoded = hash.split('=')[0].replace('+', '-').replace('/', '_');
    console.log(`processed hash ${encoded}`);
    return encoded;
}

// API Functions
function testAddObservationField(observationId, observationFieldId, value, token) {
    console.log('Adding observation field...');
    const requestUrl = `${API_URL}/observation_field_values`;
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
                return response.text().then(text => {
                    throw new Error(`Network response was not ok. Status: ${response.status}, Body: ${text}`);
                });
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

function verifyObservationField(observationId, fieldId, expectedValue, token) {
    const requestUrl = `${API_URL}/observations/${observationId}`;
    return fetch(requestUrl, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Verification API response:', JSON.stringify(data, null, 2));
        const fieldValues = data.results[0].ofvs;
        const matchingField = fieldValues.find(field => field.field_id === fieldId);
        console.log('Matching field:', matchingField);
        return matchingField && matchingField.value === expectedValue;
    });
}

// Authentication Functions
function initiateAuthFlow() {
    const codeVerifier = generateCodeVerifier();
    generateCodeChallenge(codeVerifier).then(codeChallenge => {
        const authUrl = `${AUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&code_challenge_method=S256&code_challenge=${codeChallenge}`;
        chrome.storage.local.set({codeVerifier}, () => {
            chrome.tabs.create({url: authUrl});
        });
    });
}

async function getAccessTokenWithCodeVerifier(code, codeVerifier) {
    const params = {
        client_id: CLIENT_ID,
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
    };
    console.log("Requesting token from URL:", TOKEN_URL);
    console.log("Payload:", params);

    try {
        console.log('Getting access token...');
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Response not OK: ${response.status} ${response.statusText}. Body: ${errorText}`);
        }

        const { access_token: accessToken } = await response.json();
        console.log('Access token received:', accessToken);
        return accessToken;
    } catch (error) {
        console.error(`Error getting access token: ${error}`);
        return null;
    }
}

// Test Functions
function testAPIKey(token) {
    console.log(`Testing access token: ${token}`);
    const testObservationId = "175564666";
    const testFieldId = 13979;
    const testValue = generateTestString();

    testAddObservationField(testObservationId, testFieldId, testValue, token)
        .then(response => {
            console.log('Add observation field response:', JSON.stringify(response, null, 2));
            if (response.status && response.status === 'error') {
                console.log(`Error adding test field: ${response.message}`);
                initiateAuthFlow();
            } else {
                return verifyObservationField(testObservationId, testFieldId, testValue, token);
            }
        })
        .then(verified => {
            if (verified) {
                console.log('API test successful. Test value added and verified.');
            } else {
                console.log('Test value could not be verified');
                initiateAuthFlow();
            }
        })
        .catch(error => {
            console.log('API test failed:', error);
            initiateAuthFlow();
        });
}

chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage();
  });

// Event Listeners
let currentObservationId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "contentScriptLoaded") {
        console.log("Content script is loaded and ready in tab:", sender.tab.id);
        storedTabId = sender.tab.id;
        console.log(`Stored tab ID: ${storedTabId}`);
    } else if (message.action === 'makeApiCall') {
        chrome.storage.local.get(['accessToken'], function(result) {
            const token = result.accessToken;
            if (!token) {
                console.error('No access token found');
                sendResponse({status: "error", message: "No access token found"});
                return;
            }
            testAddObservationField(currentObservationId, message.fieldId, message.value, token)
                .then(response => {
                    console.log(`Observation field added successfully. Response: ${JSON.stringify(response)}`);
                    sendResponse({status: "success", data: response});
                })
                .catch(err => {
                    console.log(`Error in adding observation field: ${err}`);
                    sendResponse({status: "error", message: err.message});
                });
        });
        return true; // To enable async sendResponse
    }
    return true;  // This is important for asynchronous response
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
        chrome.tabs.get(tabId, async (tab) => {
            if (tab.url && tab.url.startsWith(REDIRECT_URI)) {
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
                                console.log(`Access token exists`);
                                chrome.storage.local.set({ accessToken: accessToken }, function() {
                                    if (chrome.runtime.lastError) {
                                        console.log('Error storing the access token:', chrome.runtime.lastError);
                                    } else {
                                        console.log(`Access token stored successfully.`);
                                    }
                                });
                            } else {
                                console.log(`Access token doesn't exist`);
                                chrome.tabs.sendMessage(storedTabId, {
                                    action: "showAlert", 
                                    text: "Failed to retrieve the API access token. Unless this problem is resolved, pressing the buttons will not add data."
                                });
                            }
                        }
                    });
                } else {
                    console.log('No code found in the URL.');
                }
            }
        });
    }
});

// Initialization
chrome.storage.local.get(['accessToken'], function(result) {
    const token = result.accessToken;
    if (token) {
        testAPIKey(token);
    } else {
        console.log('No access token found; initiating auth flow');
        initiateAuthFlow();
    }
});