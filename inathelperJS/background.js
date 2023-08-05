console.log('Background script loaded');
importScripts('axios.min.js');

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
   
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      for (var i = 0; i < details.requestHeaders.length; ++i) {
        if (details.requestHeaders[i].name === 'Origin') {
          details.requestHeaders.splice(i, 1);
          break;
        }
      }
      return { requestHeaders: details.requestHeaders };
    },
    { urls: ["https://api.inaturalist.org/*"] },
    ["requestHeaders", "extraHeaders"]
  );

// Function to get the access token
async function getAccessToken() {
    const params = {
        client_id: 'e2RUzw_g08SfNA_XeckoECYgPu9g0FDefi4wQDbYXNE',
        client_secret: 'ecs1gccegsiALWnlohbctj_5MBRSCOt9-wI324D3qW8',
        grant_type: 'password',
        username: 'Megachile',
        password: 'Lk73Y9glgU^^',
    };

    const url = 'https://www.inaturalist.org/oauth/token';

    try {
        console.log('Getting access token...');
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params) // Convert the parameters into JSON string
        });
    
        const data = await response.json();
    
        if (response.ok) {
          console.log('Access token received:', data.access_token);
          return data.access_token;
        } else {
          console.error('Error response from server:', data);
          return null;
        }
      } catch (error) {
        console.error(`Error in getting access token: ${error}`);
        return null;
      }
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
    
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'makeApiCall') {
        console.log("Received 'makeApiCall' message from popup script. Using observation ID: " + observationId);
        getAccessToken().then(token => {
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
