document.addEventListener('DOMContentLoaded', function() {
    // Load current setting
    chrome.storage.sync.get('buttonPosition', function(data) {
        if (data.buttonPosition) {
            document.getElementById('positionSelect').value = data.buttonPosition;
        }
    });

    // Save setting when button is clicked
    document.getElementById('saveButton').addEventListener('click', function() {
        var position = document.getElementById('positionSelect').value;
        chrome.storage.sync.set({buttonPosition: position}, function() {
            console.log('Button position saved:', position);
            // Notify the content script to update the button position
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "updateButtonPosition", position: position});
            });
        });
    });
});