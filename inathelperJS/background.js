const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Listen for browser action clicks
browserAPI.action.onClicked.addListener((tab) => {
    browserAPI.runtime.openOptionsPage();
});

browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openBulkActionsPage") {
      browserAPI.tabs.create({ url: "bulk_actions.html" });
    }
  });