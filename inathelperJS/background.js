console.log('Background script loaded');

const CLIENT_ID = 'e2RUzw_g08SfNA_XeckoECYgPu9g0FDefi4wQDbYXNE';
const REDIRECT_URI = 'https://caiabpkbpfdelfbbhehgoakfbnfgbofj.chromium.app.org/';
const AUTH_URL = 'https://www.inaturalist.org/oauth/authorize';
const TOKEN_URL = 'https://www.inaturalist.org/oauth/token';
const API_URL = 'https://api.inaturalist.org/v1';

let observationId = null;
let storedTabId;
let currentObservationId = null;

// Utility Functions
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
    const encoded = hash.split('=')[0].replace(/\+/g, '-').replace(/\//g, '_');
    console.log(`Processed hash: ${encoded}`);
    return encoded;
}

// API Functions
async function getJWT(accessToken) {
    try {
        const response = await fetch('https://www.inaturalist.org/users/api_token', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = await response.json();
        if (data.api_token) {
            return data.api_token;
        } else {
            throw new Error('Failed to retrieve JWT');
        }
    } catch (error) {
        console.error('Error retrieving JWT:', error);
        throw error;
    }
}

// Authentication Functions
async function initiateAuthFlow() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const authUrl = `${AUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&code_challenge_method=S256&code_challenge=${codeChallenge}`;
    chrome.storage.local.set({ codeVerifier }, () => {
        chrome.tabs.create({ url: authUrl });
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
        const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Response not OK: ${response.status} ${response.statusText}. Body: ${errorText}`);
        }
        const { access_token: accessToken } = await response.json();
        console.log('Access token received:', accessToken);
        return accessToken;
    } catch (error) {
        console.error('Error getting access token:', error);
        return null;
    }
}

function storeTokens(accessToken, jwt) {
    const jwtExpiration = Date.now() + 24 * 60 * 60 * 1000; // JWT typically expires in 24 hours
    chrome.storage.local.set({ accessToken, jwt, jwtExpiration }, () => {
        console.log('Access token and JWT stored successfully.');
    });
}

async function refreshJWT(accessToken) {
    try {
        const response = await fetch('https://www.inaturalist.org/users/api_token', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = await response.json();
        if (data.api_token) {
            storeTokens(accessToken, data.api_token);
            return data.api_token;
        } else {
            throw new Error('Failed to refresh JWT');
        }
    } catch (error) {
        console.error('Error refreshing JWT:', error);
        throw error;
    }
}

async function makeAuthenticatedRequest(url, options = {}) {
    const { accessToken, jwt, jwtExpiration } = await chrome.storage.local.get(['accessToken', 'jwt', 'jwtExpiration']);

    if (!jwt || Date.now() > jwtExpiration) {
        try {
            const newJwt = await refreshJWT(accessToken);
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${newJwt}`
            };
        } catch (error) {
            console.error('Failed to refresh JWT, initiating new auth flow');
            initiateAuthFlow();
            throw new Error('Authentication required');
        }
    } else {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${jwt}`
        };
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Test Functions
async function testToken(accessToken, jwt) {
    // Function to test JWT
    async function testJWT(token) {
        try {
            const response = await fetch('https://api.inaturalist.org/v1/users/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            console.log('JWT test response:', data);
            return data.results && data.results[0] && data.results[0].id;
        } catch (error) {
            console.error('Error in JWT test:', error);
            return false;
        }
    }

    // Test with valid JWT
    console.log('Testing with valid JWT');
    const validJwtResult = await testJWT(jwt);
    console.log('Valid JWT test result:', validJwtResult);

    // Test with invalid JWT
    console.log('Testing with invalid JWT');
    const invalidJwt = jwt + 'invalid';
    const invalidJwtResult = await testJWT(invalidJwt);
    console.log('Invalid JWT test result:', invalidJwtResult);

    if (validJwtResult && !invalidJwtResult) {
        console.log('JWT validation behaving as expected');
        return true;
    } else {
        console.log('JWT validation not behaving as expected');
        return false;
    }
}

// Event Listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getJWT") {
        chrome.storage.local.get(['jwt', 'jwtExpiration'], async (result) => {
            if (!result.jwt || Date.now() > result.jwtExpiration) {
                try {
                    const { accessToken } = await chrome.storage.local.get('accessToken');
                    const newJwt = await refreshJWT(accessToken);
                    sendResponse({jwt: newJwt});
                } catch (error) {
                    console.error('Failed to refresh JWT:', error);
                    sendResponse({error: 'Failed to get valid JWT'});
                }
            } else {
                sendResponse({jwt: result.jwt});
            }
        });
        return true;  // Indicates an asynchronous response
    } else if (message.action === "contentScriptLoaded") {
        console.log("Content script is loaded and ready in tab:", sender.tab.id);
        storedTabId = sender.tab.id;
        console.log(`Stored tab ID: ${storedTabId}`);
    } else if (message.action === 'makeApiCall') {
        chrome.storage.local.get(['jwt'], function (result) {
            const jwt = result.jwt;
            if (!jwt) {
                console.error('No JWT found');
                sendResponse({ status: "error", message: "No JWT found" });
                return;
            }
            // Example API call using the JWT
            const apiUrl = `${API_URL}/observations/${currentObservationId}`;
            makeAuthenticatedRequest(apiUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${jwt}` } })
                .then(response => {
                    console.log(`API call successful. Response: ${JSON.stringify(response)}`);
                    sendResponse({ status: "success", data: response });
                })
                .catch(err => {
                    console.log(`Error in API call: ${err}`);
                    sendResponse({ status: "error", message: err.message });
                });
        });
        return true; // To enable async sendResponse
    }
    return true;  // This is important for asynchronous response
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith(REDIRECT_URI)) {
      const url = new URL(tab.url);
      const code = url.searchParams.get('code');
  
      if (code) {
        console.log('Extracted code:', code);
        
        const closeTab = () => {
          chrome.tabs.remove(tabId).catch(error => {
            console.log('Error closing tab:', error);
            // If we can't close the tab, we'll just continue with the auth flow
            handleAuthCode(code);
          });
        };
  
        // Attempt to close the tab, but set a timeout in case it fails
        closeTab();
        setTimeout(() => {
          handleAuthCode(code);
        }, 1000);
      }
    }
  });
  
  function handleAuthCode(code) {
    chrome.storage.local.get(['codeVerifier'], async function (result) {
      const codeVerifier = result.codeVerifier;
      if (codeVerifier) {
        const accessToken = await getAccessTokenWithCodeVerifier(code, codeVerifier);
        if (accessToken) {
          try {
            const jwt = await getJWT(accessToken);
            chrome.storage.local.set({ accessToken, jwt }, function() {
              console.log('Access token and JWT stored successfully.');
            });
          } catch (error) {
            console.error('Error getting JWT:', error);
          }
        } else {
          console.log('Failed to retrieve access token. Initiating new auth flow.');
          initiateAuthFlow();
        }
      }
    });
  }

// Initialization
chrome.storage.local.get(['accessToken'], function (result) {
    const token = result.accessToken;
    if (token) {
        chrome.storage.local.get(['jwt'], function (result) {
            const jwt = result.jwt;
            if (jwt) {
                testToken(token, jwt);
            } else {
                console.log('No JWT found; initiating auth flow');
                initiateAuthFlow();
            }
        });
    } else {
        console.log('No access token found; initiating auth flow');
        initiateAuthFlow();
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage();
});
