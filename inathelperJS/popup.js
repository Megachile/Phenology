// document.getElementById("makeApiCall").addEventListener("click", () => {
//     console.log("API call button clicked. Sending message to background script...");
//     chrome.runtime.sendMessage({action: "makeApiCall"});
// });

// // Get the iframe element
// const iframe = document.getElementById('authFrame');

// // Set the src to your authorization URL
// iframe.src = 'https://www.inaturalist.org/oauth/authorize?client_id=e2RUzw_g08SfNA_XeckoECYgPu9g0FDefi4wQDbYXNE&redirect_uri=https://caiabpkbpfdelfbbhehgoakfbnfgbofj.chromium.app.org/&response_type=code&code_challenge_method=S256&code_challenge=[YOUR_CODE_CHALLENGE]';

// // Listen for changes to the iframe's URL
// iframe.addEventListener('load', () => {
//     try {
//         // Try to read the URL
//         const url = new URL(iframe.contentWindow.location.href);

//         // If successful, extract the code
//         const code = url.searchParams.get('code');
//         console.log('Received authorization code:', code);
        
//         // Send the code back to your background script
//         chrome.runtime.sendMessage({ type: 'AUTHORIZATION_CODE', payload: code });
//     } catch (error) {
//         // Ignore any errors (which will occur if the URL is not a chrome-extension URL)
//     }
// });
