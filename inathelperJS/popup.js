document.getElementById("makeApiCall").addEventListener("click", () => {
    console.log("API call button clicked. Sending message to background script...");
    chrome.runtime.sendMessage({action: "makeApiCall"});
});


