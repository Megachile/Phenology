const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Listen for browser action clicks
browserAPI.action.onClicked.addListener((tab) => {
    browserAPI.runtime.openOptionsPage();
});