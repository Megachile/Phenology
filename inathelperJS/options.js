let customButtons = [];
let currentConfig = { actions: [] };
let dateSortNewestFirst = true;
let alphaSortAtoZ = true;
let lastUsedSort = 'date';
let searchTerm = '';
let observationFieldMap = {};
let configurationSets = [];
let currentSetName = '';

const iNatSingleKeyPresses = [
    'x', 'r', 'c', 'a', 'i', 'f', 'z', 'space', 'left', 'right', 'up', 'down', '?',
    'e', 'l', 's', 'p'
];

const forbiddenShortcuts = [
    { ctrlKey: true, key: 'W' },  // Close tab
    { ctrlKey: true, key: 'T' },  // New tab
    { altKey: true, key: 'F4' },  // Close window
    { ctrlKey: true, shiftKey: true, key: 'W' },  // Close window
    { ctrlKey: true, shiftKey: true, key: 'T' }, // Reopen closed tab
    { altKey: true, key: 'B' },  // Firefox bookmarks
    { shiftKey: true, key: 'B' },  // Cycle button position
    { altKey: true, key: 'N' },    // Toggle button visibility
    { ctrlKey: true, shiftKey: true, key: 'R' },  // Toggle refresh
    { altKey: true, key: 'H' },     // Toggle shortcut list
    { shiftKey: true, key: 'V' },     // Toggle bulk action box
    { altKey: true, key: 'S' },     // Cycle button sets
    { altKey: true, key: 'M' }    // Toggle bulk action mode
];

const qualityMetrics = [
    { value: 'needs_id', label: 'Can the Community Taxon still be confirmed or improved?' },
    { value: 'date', label: 'Date is accurate' },
    { value: 'location', label: 'Location is accurate' },
    { value: 'wild', label: 'Organism is wild' },
    { value: 'evidence', label: 'Evidence of organism' },
    { value: 'recent', label: 'Recent evidence of organism' },
    { value: 'subject', label: 'Evidence related to a single subject' }
];

document.getElementById('openBulkActionsButton').addEventListener('click', () => {
    browserAPI.runtime.sendMessage({ action: "openBulkActionsPage" });
  });


function isShortcutForbidden(shortcut) {
    if (!shortcut) return false; // If no shortcut, it can't be forbidden

    // Check against predefined forbidden shortcuts
    const isForbidden = forbiddenShortcuts.some(forbidden => {
        return Object.keys(forbidden).every(key => 
            key === 'key' ? 
                forbidden[key].toLowerCase() === (shortcut.key || '').toLowerCase() :
                !!forbidden[key] === !!shortcut[key]
        );
    });

    // Check if it's a single key press used by iNaturalist
    const isSingleKeyPress = !shortcut.ctrlKey && !shortcut.shiftKey && !shortcut.altKey &&
                             iNatSingleKeyPresses.includes(shortcut.key.toLowerCase());

    return isForbidden || isSingleKeyPress;
}

function filterConfigurations() {
    searchTerm = document.getElementById('searchInput').value.toLowerCase();
    displayConfigurations();
}

function updateSortButtons() {
    const dateButton = document.getElementById('toggleDateSort');
    const alphaButton = document.getElementById('toggleAlphaSort');

    dateButton.textContent = dateSortNewestFirst ? 'Sorted Newest First' : 'Sorted Oldest First';
    alphaButton.textContent = alphaSortAtoZ ? 'Sorted A-Z' : 'Sorted Z-A';

    // Reset all button styles
    dateButton.classList.remove('active-sort', 'inactive-sort');
    alphaButton.classList.remove('active-sort', 'inactive-sort');
    dateButton.classList.add('sort-button');
    alphaButton.classList.add('sort-button');

    // Apply active and inactive styles
    if (lastUsedSort === 'date') {
        dateButton.classList.add('active-sort');
        alphaButton.classList.add('inactive-sort');
    } else {
        alphaButton.classList.add('active-sort');
        dateButton.classList.add('inactive-sort');
    }
}

function toggleDateSort() {
    dateSortNewestFirst = !dateSortNewestFirst;
    lastUsedSort = 'date';
    updateSortButtons();
    displayConfigurations();
}

function toggleAlphaSort() {
    alphaSortAtoZ = !alphaSortAtoZ;
    lastUsedSort = 'alpha';
    updateSortButtons();
    displayConfigurations();
}

function extractFormData() {
    return {
        name: document.getElementById('buttonName').value.trim(),
        shortcut: {
            key: document.getElementById('shortcut').value.trim().toUpperCase(),
            ctrlKey: document.getElementById('ctrlKey').checked,
            shiftKey: document.getElementById('shiftKey').checked,
            altKey: document.getElementById('altKey').checked
        },
        actions: extractActionsFromForm()
    };
}

function extractActionsFromForm() {
    return Array.from(document.querySelectorAll('.action-item')).map(actionDiv => {
        const actionType = actionDiv.querySelector('.actionType').value;
        const action = { type: actionType };

        switch (actionType) {
            case 'follow':
                action.follow = actionDiv.querySelector('input[name^="followToggle"]:checked').value; // Extract "follow" or "unfollow"
                break;
            case 'reviewed':
                action.reviewed = actionDiv.querySelector('input[name^="reviewedToggle"]:checked').value; // Extract "mark" or "unmark"
                break;                  
            case 'withdrawId' :
                break;
            case 'observationField':
                action.fieldId = actionDiv.querySelector('.fieldId').value.trim();
                action.fieldName = actionDiv.querySelector('.fieldName').value.trim();
                const fieldValueElement = actionDiv.querySelector('.fieldValue');
                action.fieldValue = fieldValueElement.dataset.taxonId || fieldValueElement.value.trim();
                action.displayValue = fieldValueElement.value.trim();
                break;
            case 'annotation':
                action.annotationField = actionDiv.querySelector('.annotationField').value;
                action.annotationValue = actionDiv.querySelector('.annotationValue').value;
                break;
            case 'addToProject':
                action.projectId = actionDiv.querySelector('.projectId').value.trim();
                action.projectName = actionDiv.querySelector('.projectName').value.trim();
                action.remove = actionDiv.querySelector('.removeFromProject').checked;
                break;
            case 'addComment':
                action.commentBody = actionDiv.querySelector('.commentBody').value.trim();
                break;
            case 'addTaxonId':
                const taxonNameInput = actionDiv.querySelector('.taxonName');
                action.taxonId = taxonNameInput.dataset.taxonId;
                action.taxonName = taxonNameInput.value.trim();
                action.comment = actionDiv.querySelector('.taxonComment').value.trim();
                action.disagreement = actionDiv.querySelector('.disagreementCheckbox').checked;
                break;
            case 'qualityMetric':
                action.metric = actionDiv.querySelector('.qualityMetricType').value;
                action.vote = actionDiv.querySelector('.qualityMetricVote').value;
                break;
            case 'copyObservationField':
                action.sourceFieldId = actionDiv.querySelector('.sourceFieldId').value.trim();
                action.sourceFieldName = actionDiv.querySelector('.sourceFieldName').value.trim();
                action.targetFieldId = actionDiv.querySelector('.targetFieldId').value.trim();
                action.targetFieldName = actionDiv.querySelector('.targetFieldName').value.trim();
                break;
            case 'addToList':
                action.listId = actionDiv.querySelector('.listSelect').value;
                action.remove = actionDiv.querySelector('.removeFromList').checked;
                break;
        }
        return action;
    });
}

function validateNewConfiguration(config) {
    if (!config.name) {
        throw new Error("Please enter a button name.");
    }

    const currentSet = configurationSets.find(set => set.name === currentSetName);
    if (!currentSet) {
        throw new Error("Current set not found");
    }

    // Check for name duplication within the current set
    const duplicateName = currentSet.buttons.find(button => button.name === config.name);
    if (duplicateName) {
        throw new Error("This button name is already in use in the current set. Please choose a different name.");
    }

    if (config.shortcut && isShortcutForbidden(config.shortcut)) {
        throw new Error("This shortcut is not allowed as it conflicts with iNat shortcuts, browser functionality, or extension shortcuts.");
    }

    if (config.shortcut && (config.shortcut.key || config.shortcut.ctrlKey || config.shortcut.shiftKey || config.shortcut.altKey)) {
        const conflictingShortcut = currentSet.buttons.find((button) => {
            return button.shortcut &&
                   button.shortcut.key === config.shortcut.key &&
                   button.shortcut.ctrlKey === config.shortcut.ctrlKey &&
                   button.shortcut.shiftKey === config.shortcut.shiftKey &&
                   button.shortcut.altKey === config.shortcut.altKey;
        });

        if (conflictingShortcut) {
            throw new Error(`This shortcut is already used for the button: "${conflictingShortcut.name}" in the current set. Please choose a different shortcut.`);
        }
    }

    validateCommonConfiguration(config);
}

function validateEditConfiguration(config, originalConfig) {
    if (!config.name) {
        throw new Error("Please enter a button name.");
    }

    const currentSet = configurationSets.find(set => set.name === currentSetName);
    if (!currentSet) {
        throw new Error("Current set not found");
    }

    // Check for name duplication within the current set, excluding the original config
    const duplicateName = currentSet.buttons.find(button => button.name === config.name && button.id !== originalConfig.id);
    if (duplicateName) {
        throw new Error("This button name is already in use in the current set. Please choose a different name.");
    }

    if (config.shortcut && isShortcutForbidden(config.shortcut)) {
        throw new Error("This shortcut is not allowed as it conflicts with browser functionality or extension shortcuts.");
    }

    if (config.shortcut && (config.shortcut.key || config.shortcut.ctrlKey || config.shortcut.shiftKey || config.shortcut.altKey)) {
        const conflictingShortcut = currentSet.buttons.find((button) => {
            return button.id !== originalConfig.id && // Ignore the original config
                   button.shortcut &&
                   button.shortcut.key === config.shortcut.key &&
                   button.shortcut.ctrlKey === config.shortcut.ctrlKey &&
                   button.shortcut.shiftKey === config.shortcut.shiftKey &&
                   button.shortcut.altKey === config.shortcut.altKey;
        });

        if (conflictingShortcut) {
            throw new Error(`This shortcut is already used for the button: "${conflictingShortcut.name}" in the current set. Please choose a different shortcut.`);
        }
    }

    validateCommonConfiguration(config);
}

function validateCommonConfiguration(config) {
    if (config.actions.length === 0) {
        throw new Error("Please add at least one action to the configuration.");
    }

    if (config.shortcut) {
        if (!config.shortcut.key && (config.shortcut.ctrlKey || config.shortcut.shiftKey || config.shortcut.altKey)) {
            throw new Error("A key must be selected along with modifier keys for the shortcut.");
        }
    }

    config.actions.forEach(action => {
        switch (action.type) {
            case 'follow':
                if (!['follow', 'unfollow'].includes(action.follow)) {
                    throw new Error("Invalid follow action type. Must be 'follow' or 'unfollow'.");
                }
                break;
            case 'reviewed':
                if (!['mark', 'unmark'].includes(action.reviewed)) {
                    throw new Error("Invalid reviewed action type. Must be 'mark' or 'unmark'.");
                }
                break;                      
            case 'withdrawId' :
                break;
            case 'observationField':
                if (!action.fieldId || !action.fieldName || !action.fieldValue) {
                    throw new Error("Please enter Field Name, ID, and Value for all Observation Field actions.");
                }
                break;
            case 'annotation':
                if (!action.annotationField || !action.annotationValue) {
                    throw new Error("Please select both Annotation Field and Annotation Value for all Annotation actions.");
                }
                break;
            case 'addToProject':
                if (!action.projectId || !action.projectName) {
                    throw new Error("Please enter both Project Name and ID for all Add to Project actions.");
                }
                break;
            case 'addComment':
                if (!action.commentBody) {
                    throw new Error("Please enter a comment body for all Add Comment actions.");
                }
                break;
            case 'addTaxonId':
                if (!action.taxonId || !action.taxonName) {
                    throw new Error("Please select a valid taxon for all Add Taxon ID actions.");
                }
                break;
            case 'qualityMetric':
                if (!action.metric || !action.vote) {
                    throw new Error("Please select both a metric and a vote for all Quality Metric actions.");
                }
                break;
            case 'copyObservationField':
                if (!action.sourceFieldId || !action.sourceFieldName || !action.targetFieldId || !action.targetFieldName) {
                    throw new Error("Please enter Source Field Name, ID, Target Field Name, and ID for all Copy Observation Field actions.");
                }
                break;
        }
    });
}

function saveConfiguration() {
    try {
        const formData = extractFormData();
        const editId = document.getElementById('saveButton').dataset.editIndex; 
        
        const currentSet = getCurrentSet();
        if (!currentSet) {
            throw new Error("Current set not found");
        }

        let originalConfig = null;
        if (editId) {
            originalConfig = currentSet.buttons.find(c => c.id === editId);
            if (!originalConfig) {
                throw new Error(`Original configuration with ID ${editId} not found for editing.`);
            }
            validateEditConfiguration(formData, originalConfig);
        } else {
            validateNewConfiguration(formData);
        }

        const newConfig = {
            id: editId || Date.now().toString(), 
            ...formData,
            // Preserve existing hidden/disabled states if editing, otherwise default for new
            buttonHidden: (editId && originalConfig) ? originalConfig.buttonHidden : false,
            configurationDisabled: (editId && originalConfig) ? originalConfig.configurationDisabled : false
        };

        // Store the current expanded states BEFORE the DOM is potentially changed by displayConfigurations
        const expandedStates = {};
        document.querySelectorAll('.config-item').forEach(item => {
            const details = item.querySelector('.config-details');
            if (details) { 
                expandedStates[item.dataset.id] = details.style.display === 'block';
            }
        });

        updateOrAddConfiguration(newConfig, currentSet);

        // Save and trigger a full refresh of the displayed configurations.
        // The callback will run after storage is set and displayConfigurations (called by saveConfigurationSets) completes.
        saveConfigurationSets(() => {
            console.log('Configuration saved and display refreshed.');
            clearForm();
            
            // Attempt to restore expanded states AFTER displayConfigurations has run
            // This relies on saveConfigurationSets(..., true) calling displayConfigurations
            // and displayConfigurations being an async function that completes.
            // This part can be a bit fragile with async rendering.
            // A more robust solution would be for displayConfigurations to handle this.
            setTimeout(() => { // Use a short timeout to allow DOM to settle after async displayConfigurations
                Object.entries(expandedStates).forEach(([id, isExpanded]) => {
                    // If we just edited newConfig, make sure its own state is restored correctly
                    // or if it's a new item, it won't be in expandedStates unless we add it.
                    const idToRestore = (editId === id || newConfig.id === id) ? newConfig.id : id;

                    const configDiv = document.querySelector(`.config-item[data-id="${idToRestore}"]`);
                    if (configDiv) {
                        const details = configDiv.querySelector('.config-details');
                        const toggle = configDiv.querySelector('.toggle-details');
                        if (details && toggle) {
                            const shouldBeExpanded = (editId === id || newConfig.id === id) ? expandedStates[editId] || expandedStates[newConfig.id] || false : isExpanded;
                            
                            details.style.display = shouldBeExpanded ? 'block' : 'none';
                            toggle.innerHTML = shouldBeExpanded ? '▲' : '▼';
                        }
                    }
                });
                // Also, ensure the newly saved/edited item itself reflects the correct expansion if it was the one open
                if (expandedStates[newConfig.id]) {
                     const configDiv = document.querySelector(`.config-item[data-id="${newConfig.id}"]`);
                     if (configDiv) {
                        const details = configDiv.querySelector('.config-details');
                        const toggle = configDiv.querySelector('.toggle-details');
                        if (details && toggle) {
                            details.style.display = 'block';
                            toggle.innerHTML = '▲';
                        }
                     }
                }


            }, 100); // Small delay for DOM updates from async display

        }, true); // true for refreshDisplay, which calls displayConfigurations

    } catch (error) {
        alert(error.message);
        console.error("Error saving configuration:", error);
    }
}

function updateSingleConfigurationDisplay(config, configDiv) {
    const actionsPromises = config.actions.map(formatAction);
    Promise.all(actionsPromises).then(formattedActions => {
        const actionsHtml = formattedActions.map(action => `<p>${action}</p>`).join('');
        
        configDiv.querySelector('.config-name').textContent = config.name;
        configDiv.querySelector('.config-shortcut').textContent = formatShortcut(config.shortcut);
        const detailsDiv = configDiv.querySelector('.config-details');
        const actionsContainer = document.createElement('div');
        actionsContainer.innerHTML = actionsHtml;
        
        // Preserve the button actions div
        const buttonActions = detailsDiv.querySelector('.button-actions');
        detailsDiv.innerHTML = '';
        detailsDiv.appendChild(actionsContainer);
        detailsDiv.appendChild(buttonActions);
    });
}

function updateOrAddConfiguration(config, currentSet) {
    const existingIndex = currentSet.buttons.findIndex(c => c.id === config.id);
    if (existingIndex !== -1) {
        currentSet.buttons[existingIndex] = config;
    } else {
        currentSet.buttons.push(config);
    }
}

function editConfiguration(configId) {
    const currentSet = getCurrentSet();
    if (!currentSet) return;

    const config = currentSet.buttons.find(c => c.id === configId);
    if (!config) {
        console.error(`Configuration with id ${configId} not found`);
        return;
    }

    // Populate form fields with config data
    document.getElementById('buttonName').value = config.name;
    
    if (config.shortcut) {
        document.getElementById('ctrlKey').checked = config.shortcut.ctrlKey;
        document.getElementById('shiftKey').checked = config.shortcut.shiftKey;
        document.getElementById('altKey').checked = config.shortcut.altKey;
        document.getElementById('shortcut').value = config.shortcut.key;
    } else {
        document.getElementById('ctrlKey').checked = false;
        document.getElementById('shiftKey').checked = false;
        document.getElementById('altKey').checked = false;
        document.getElementById('shortcut').value = '';
    }

    document.getElementById('actionsContainer').innerHTML = '';
    config.actions.forEach(action => {
        const actionDiv = addActionToForm(action);
        populateActionInputs(actionDiv, action);
    });

    const saveButton = document.getElementById('saveButton');
    saveButton.textContent = 'Update Configuration';
    saveButton.dataset.editIndex = configId;

    window.scrollTo(0, 0);
}

function populateActionInputs(actionDiv, action) {
    console.log('Populating action inputs for:', action.type);
    const actionType = actionDiv.querySelector('.actionType');
    actionType.value = action.type;
    actionType.dispatchEvent(new Event('change'));

    switch (action.type) {
        case 'follow':
            const followRadios = actionDiv.querySelectorAll('input[name^="followToggle"]');
            followRadios.forEach(radio => {
                if (radio.value === action.follow) {
                    radio.checked = true;
                }
            });
            break;
        case 'reviewed':
            const reviewedRadios = actionDiv.querySelectorAll('input[name^="reviewedToggle"]');
            reviewedRadios.forEach(radio => {
                if (radio.value === action.reviewed) {
                    radio.checked = true;
                }
            });
            break;
        case 'withdrawId':
            break;
        case 'withdrawId' :
            break;
        case 'observationField':
            actionDiv.querySelector('.fieldName').value = action.fieldName || '';
            actionDiv.querySelector('.fieldId').value = action.fieldId || '';
            actionDiv.querySelector('.fieldValue').value = action.fieldValue || '';
            break;
        case 'annotation':
            actionDiv.querySelector('.annotationField').value = action.annotationField || '';
            const annotationValue = actionDiv.querySelector('.annotationValue');
            updateAnnotationValues(actionDiv.querySelector('.annotationField'), annotationValue);
            annotationValue.value = action.annotationValue || '';
            break;
        case 'addToProject':
            actionDiv.querySelector('.projectName').value = action.projectName || '';
            actionDiv.querySelector('.projectId').value = action.projectId || '';
            const removeCheckbox = actionDiv.querySelector('.removeFromProject');
            if (removeCheckbox) {
                removeCheckbox.checked = action.remove || false;
            }
            break;
        case 'addComment':
            actionDiv.querySelector('.commentBody').value = action.commentBody || '';
            break;
        case 'addTaxonId':
            actionDiv.querySelector('.taxonName').value = action.taxonName || '';
            actionDiv.querySelector('.taxonId').value = action.taxonId || '';
            actionDiv.querySelector('.taxonComment').value = action.comment || '';
            if (actionDiv.querySelector('.disagreementCheckbox')) {
                actionDiv.querySelector('.disagreementCheckbox').checked = action.disagreement || false;
            }
            break;
        case 'qualityMetric':
            actionDiv.querySelector('.qualityMetricType').value = action.metric || '';
            actionDiv.querySelector('.qualityMetricVote').value = action.vote || '';
            break;
        case 'copyObservationField':
            actionDiv.querySelector('.sourceFieldName').value = action.sourceFieldName || '';
            actionDiv.querySelector('.sourceFieldId').value = action.sourceFieldId || '';
            actionDiv.querySelector('.targetFieldName').value = action.targetFieldName || '';
            actionDiv.querySelector('.targetFieldId').value = action.targetFieldId || '';
            break;
        case 'addToList':
            const listSelect = actionDiv.querySelector('.listSelect');
            if (listSelect) {
                console.log('Refreshing list select for existing Add to List action');
                refreshListSelect(listSelect);
                setTimeout(() => {
                    console.log('Setting list select value to:', action.listId);
                    listSelect.value = action.listId || '';
                }, 100);
            }
            break;
    }
}

function duplicateConfiguration(configId) {
    const currentSet = getCurrentSet();
    if (!currentSet) return;

    const config = currentSet.buttons.find(c => c.id === configId);
    if (!config) {
        console.error(`Configuration with id ${configId} not found`);
        return;
    }

    editConfiguration(configId); // Reuse edit logic to populate form

    document.getElementById('buttonName').value = `${config.name} (Copy)`;

    const saveButton = document.getElementById('saveButton');
    saveButton.textContent = 'Save New Configuration';
    delete saveButton.dataset.editIndex;
}

function mergeConfigurations(importedData) {
    console.log('Starting merge process');
    console.log('Existing buttons:', customButtons);
    console.log('Imported buttons:', importedData.customButtons);

    const newButtons = importedData.customButtons || [];
    const conflicts = [];

    newButtons.forEach(newButton => {
        console.log('Processing button:', newButton.name);
        
        const existingButton = customButtons.find(b => b.name === newButton.name);
        if (existingButton) {
            console.log('Name conflict found:', existingButton.name);
            conflicts.push({existing: existingButton, imported: newButton});
        } else {
            const shortcutConflict = newButton.shortcut && newButton.shortcut.key ? 
                customButtons.find(b => 
                    b.shortcut && 
                    b.shortcut.key === newButton.shortcut.key &&
                    b.shortcut.ctrlKey === newButton.shortcut.ctrlKey &&
                    b.shortcut.shiftKey === newButton.shortcut.shiftKey &&
                    b.shortcut.altKey === newButton.shortcut.altKey
                ) : null;
            
            if (shortcutConflict) {
                console.log('Shortcut conflict found:', newButton.shortcut);
                conflicts.push({existing: shortcutConflict, imported: newButton, type: 'shortcut'});
            } else {
                console.log('No conflicts, adding button');
                customButtons.push(newButton);
            }
        }
    });

    console.log('Conflicts found:', conflicts);

    // Get current button order
    browserAPI.storage.local.get('buttonOrder', function(data) {
        let buttonOrder = data.buttonOrder || [];
        console.log('Current button order before update:', buttonOrder);

        const newButtonIds = newButtons.map(button => button.id);
        const updatedButtonOrder = [...new Set([...buttonOrder, ...newButtonIds])];
        console.log('Updated button order:', updatedButtonOrder);

        const saveAndNotify = () => {
            browserAPI.storage.local.set({
                customButtons: customButtons,
                observationFieldMap: {...observationFieldMap, ...(importedData.observationFieldMap || {})},
                lastConfigUpdate: Date.now(),
                buttonOrder: updatedButtonOrder
            }, function() {
                console.log('Configurations merged and lastConfigUpdate set');
                console.log('Final customButtons:', customButtons);
                
                // Check storage usage
                browserAPI.storage.local.getBytesInUse(null, function(bytesInUse) {
                    console.log('Storage bytes in use:', bytesInUse);
                    console.log('Storage quota:', browserAPI.storage.local.QUOTA_BYTES);
                    const percentageUsed = (bytesInUse / browserAPI.storage.local.QUOTA_BYTES) * 100;
                    console.log('Storage usage: ' + percentageUsed.toFixed(2) + '%');
                });
                
                // Notify background script to reload content scripts
                browserAPI.runtime.sendMessage({action: "configUpdated"});

                // Delay the reload and alert slightly to ensure storage is updated
                setTimeout(() => {
                    loadConfigurations();
                    alert('Import completed successfully.');
                }, 100);
            });
        };

        if (conflicts.length > 0) {
            resolveConflicts(conflicts, saveAndNotify);
        } else {
            saveAndNotify();
        }
    });
}

function addActionToForm(action = null) {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'action-item';
    actionDiv.innerHTML = `
        <select class="actionType">
            <option value="addTaxonId">Add Taxon ID</option>
            <option value="withdrawId">Withdraw ID</option>
            <option value="addComment">Add Comment</option>
            <option value="annotation">Annotation</option> 
            <option value="addToProject">Add to/Remove from Project</option>
            <option value="observationField">Observation Field</option>
            <option value="copyObservationField">Copy Observation Field</option>
            <option value="qualityMetric">Data Quality Indicators</option>
            <option value="follow">Follow/Unfollow Observation</option>
            <option value="reviewed">Mark Observation as Reviewed/Unreviewed</option>                                    
            <option value="addToList">Add/Remove Observation To/From List</option>
        </select>
       <div class="follow-options" style="display: none;">
            <div class="inline-radio">
                <input type="radio" id="follow" name="followToggle" value="follow" checked>
                <label for="follow">Follow</label>
                <input type="radio" id="unfollow" name="followToggle" value="unfollow">
                <label for="unfollow">Unfollow</label>
            </div>
        </div>
        <div class="reviewed-options" style="display: none;">
            <div class="inline-radio">
                <input type="radio" id="markReviewed" name="reviewedToggle" value="mark" checked>
                <label for="markReviewed">Mark as Reviewed</label>
                <input type="radio" id="unmarkReviewed" name="reviewedToggle" value="unmark">
                <label for="unmarkReviewed">Mark as Unreviewed</label>
            </div>
        </div>
        <div class="ofInputs">
            <input type="text" class="fieldName" placeholder="Observation Field Name">
            <input type="number" class="fieldId" placeholder="Field ID" readonly>
            <div class="fieldValueContainer">
                <input type="text" class="fieldValue" placeholder="Field Value">
            </div>
            <p class="fieldDescription"></p>
        </div>
        <div class="annotationInputs" style="display:none;">
            <select class="annotationField"></select>
            <select class="annotationValue"></select>
        </div>
        <div class="projectInputs" style="display:none;">
            <input type="text" class="projectName" placeholder="Project Name">
            <input type="number" class="projectId" placeholder="Project ID" readonly>
            <div class="checkboxContainer" style="display: flex; align-items: center; margin-top: 10px;">
                <input type="checkbox" id="removeFromProject-${Date.now()}" class="removeFromProject">
                <label for="removeFromProject-${Date.now()}" style="margin-left: 5px; font-size: 14px; cursor: pointer;">
                    Remove from project instead of adding (NOTE: observations cannot be removed from projects with automatic inclusion! You also may not have permission to remove observations other users have added to projects.)
                </label>
            </div>
        </div>
        <div class="commentInput" style="display:none;">
            <textarea class="commentBody" placeholder="Enter comment"></textarea>
        </div>
        <div class="taxonIdInputs" style="display:none;">
            <input type="text" class="taxonName" placeholder="Taxon Name (or ID)">
            <input type="hidden" class="taxonId">
        </div>
        <div class="qualityMetricInputs" style="display:none;">
            <select class="qualityMetricType">
                ${qualityMetrics.map(metric => `<option value="${metric.value}">${metric.label}</option>`).join('')}
            </select>
            <select class="qualityMetricVote">
                <option value="agree">Agree</option>
                <option value="disagree">Disagree</option>
                <option value="remove">Remove Vote</option>
            </select>
        </div>
        <div class="copyObservationFieldInputs" style="display:none;">
            <input type="text" class="sourceFieldName" placeholder="Source Field Name">
            <input type="number" class="sourceFieldId" placeholder="Source Field ID" readonly>
            <input type="text" class="targetFieldName" placeholder="Target Field Name">
            <input type="number" class="targetFieldId" placeholder="Target Field ID" readonly>
        </div>        
        <div class="addToListInputs" style="display:none;">
            <select class="listSelect">
                <option value="">Select a List</option>
            </select>
            <!-- Add checkbox and label directly here -->
            <div class="checkboxContainer" style="display: flex; align-items: center; margin-top: 10px;">
                <input type="checkbox" id="removeFromList-${Date.now()}" class="removeFromList">
                <label for="removeFromList-${Date.now()}" style="margin-left: 5px; font-size: 14px; cursor: pointer;">
                    Remove from list instead of adding
                </label>
            </div>
        </div>
        <button class="removeActionButton">Remove Action</button>

    `;
    document.getElementById('actionsContainer').appendChild(actionDiv);

    const actionType = actionDiv.querySelector('.actionType');
    const followOptions = actionDiv.querySelector('.follow-options');
    const reviewedOptions = actionDiv.querySelector('.reviewed-options');
    const ofInputs = actionDiv.querySelector('.ofInputs');
    const annotationInputs = actionDiv.querySelector('.annotationInputs');
    const commentInput = actionDiv.querySelector('.commentInput');
    const projectInputs = actionDiv.querySelector('.projectInputs');
    const taxonIdInputs = actionDiv.querySelector('.taxonIdInputs');
    const qualityMetricInputs = actionDiv.querySelector('.qualityMetricInputs');
    const copyObservationFieldInputs = actionDiv.querySelector('.copyObservationFieldInputs');
    const addToListInputs = actionDiv.querySelector('.addToListInputs');
    const listSelect = actionDiv.querySelector('.listSelect');
    console.log('Setting up action form for type:', action ? action.type : 'new action');
    if (taxonIdInputs) {
        taxonIdInputs.innerHTML += `
        <textarea class="taxonComment" placeholder="Enter comment (optional)"></textarea>
        <div class="checkboxContainer" style="display: flex; align-items: center; margin-top: 10px; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="disagreement-${Date.now()}" class="disagreementCheckbox" style="margin: 0;">
                <label for="disagreement-${Date.now()}" style="margin: 0; font-size: 14px; cursor: pointer; line-height: 1.4;">
                    Disagree with current ID (only affects higher level IDs; otherwise default behavior applies)
                </label>
            </div>
        </div>
    `;
    }
    actionType.addEventListener('change', () => {
        ofInputs.style.display = actionType.value === 'observationField' ? 'block' : 'none';
        annotationInputs.style.display = actionType.value === 'annotation' ? 'block' : 'none';
        projectInputs.style.display = actionType.value === 'addToProject' ? 'block' : 'none';
        commentInput.style.display = actionType.value === 'addComment' ? 'block' : 'none';
        taxonIdInputs.style.display = actionType.value === 'addTaxonId' ? 'block' : 'none';
        qualityMetricInputs.style.display = actionType.value === 'qualityMetric' ? 'block' : 'none';
        copyObservationFieldInputs.style.display = actionType.value === 'copyObservationField' ? 'block' : 'none';
        addToListInputs.style.display = actionType.value === 'addToList' ? 'block' : 'none';
        followOptions.style.display = actionType.value === 'follow' ? 'block' : 'none'; // Add this line
        reviewedOptions.style.display = actionType.value === 'reviewed' ? 'block' : 'none'; // Add this line
    
        if (actionType.value === 'addToList') {
            console.log('Add to List selected, refreshing list select');
            refreshListSelect(listSelect);
            
            // Clear only the list select element, not the entire div
            const listSelectElement = addToListInputs.querySelector('.listSelect');
            
            if (listSelectElement) {
                addToListInputs.removeChild(listSelectElement); // Remove only the list select element
            }
            
            // Re-append the list select element in the correct order
            if (!addToListInputs.querySelector('.listSelect')) {
                addToListInputs.insertBefore(listSelect, addToListInputs.firstChild); // Insert before any existing children
            }
        }
              
        
    });

    // Populate list select
    browserAPI.storage.local.get('customLists', function(data) {
    const customLists = data.customLists || [];
    customLists.forEach(list => {
        const option = document.createElement('option');
        option.value = list.id;
        option.textContent = list.name;
        listSelect.appendChild(option);
    });
    });

    if (action && action.type === 'addToList') {
        console.log('Populating Add to List action:', action);
        actionType.value = 'addToList';
        actionType.dispatchEvent(new Event('change'));
        setTimeout(() => {
            console.log('Setting list select value to:', action.listId);
            listSelect.value = action.listId || '';
            const removeCheckbox = actionDiv.querySelector('.removeFromList');
            if (removeCheckbox) {
                removeCheckbox.checked = action.remove || false;
            }
        }, 100);
    }

    const fieldNameInput = actionDiv.querySelector('.fieldName');
    const fieldIdInput = actionDiv.querySelector('.fieldId');
    const fieldValueContainer = actionDiv.querySelector('.fieldValueContainer');
    const fieldValueInput = fieldValueContainer.querySelector('.fieldValue');
    
    setupAutocompleteDropdown(fieldNameInput, lookupObservationField, (result) => {
        fieldIdInput.value = result.id;
        const updatedFieldValueInput = updateFieldValueInput(result, fieldValueContainer);
        if (result.datatype === 'taxon') {
            setupTaxonAutocompleteForInput(updatedFieldValueInput);
        }
    });

    const taxonNameInput = actionDiv.querySelector('.taxonName');
    const taxonIdInput = actionDiv.querySelector('.taxonId');
    
    function setupTaxonAutocompleteForInput(input, idInput) {
        if (input) {
            setupTaxonAutocomplete(input, idInput);
            input.addEventListener('focus', () => {
                if (input.value.length >= 2) {
                    input.dispatchEvent(new Event('input'));
                }
            });
        }
    }
          
    setupTaxonAutocompleteForInput(taxonNameInput, taxonIdInput);

    const projectNameInput = actionDiv.querySelector('.projectName');
    const projectIdInput = actionDiv.querySelector('.projectId');
    setupAutocompleteDropdown(projectNameInput, lookupProject, (result) => {
        projectIdInput.value = result.id;
    });

    const annotationField = actionDiv.querySelector('.annotationField');
    const annotationValue = actionDiv.querySelector('.annotationValue');
    populateAnnotationFields(annotationField);
    annotationField.addEventListener('change', () => updateAnnotationValues(annotationField, annotationValue));

    const sourceFieldNameInput = actionDiv.querySelector('.sourceFieldName');
    const sourceFieldIdInput = actionDiv.querySelector('.sourceFieldId');
    setupAutocompleteDropdown(sourceFieldNameInput, lookupObservationField, (result) => {
        sourceFieldIdInput.value = result.id;
    });

    const targetFieldNameInput = actionDiv.querySelector('.targetFieldName');
    const targetFieldIdInput = actionDiv.querySelector('.targetFieldId');
    setupAutocompleteDropdown(targetFieldNameInput, lookupObservationField, (result) => {
        targetFieldIdInput.value = result.id;
    });

    const removeButton = actionDiv.querySelector('.removeActionButton');
    removeButton.addEventListener('click', () => actionDiv.remove());

    if (action) {
        actionType.value = action.type;
        actionType.dispatchEvent(new Event('change'));
        
        switch (action.type) {
            case 'follow' :
                break;
            case 'reviewed' :
                break;
            case 'withdrawId' :
                break;
            case 'observationField':
                fieldNameInput.value = action.fieldName || '';
                fieldIdInput.value = action.fieldId;
                lookupObservationField(action.fieldName).then(results => {
                    const field = results.find(f => f.id.toString() === action.fieldId);
                    if (field) {
                        let displayValue = action.fieldValue;
                        if (field.datatype === 'taxon' && action.displayValue) {
                            displayValue = action.displayValue; // Use the display value for taxon fields
                        }
                        const updatedFieldValueInput = updateFieldValueInput(field, fieldValueContainer, displayValue);
                        if (field.datatype === 'taxon') {
                            setupTaxonAutocompleteForInput(updatedFieldValueInput);
                            updatedFieldValueInput.dataset.taxonId = action.fieldValue; // Store the taxon ID
                        }
                    }
                });
                break;
            case 'addTaxonId':
                if (taxonNameInput && taxonIdInput) {
                    taxonNameInput.value = action.taxonName;
                    taxonIdInput.value = action.taxonId;
                    taxonNameInput.dataset.taxonId = action.taxonId;
                    actionDiv.querySelector('.taxonComment').value = action.comment || '';
                }
                break;
            case 'annotation':
                annotationField.value = action.annotationField;
                updateAnnotationValues(annotationField, annotationValue);
                annotationValue.value = action.annotationValue;
                break;
            case 'addToProject':
                projectIdInput.value = action.projectId;
                projectNameInput.value = action.projectName;
                break;
            case 'addComment':
                actionDiv.querySelector('.commentBody').value = action.commentBody;
                break;
            case 'qualityMetric':
                actionDiv.querySelector('.qualityMetricType').value = action.metric;
                actionDiv.querySelector('.qualityMetricVote').value = action.vote;
                break;    
            case 'copyObservationField':
                actionDiv.querySelector('.sourceFieldId').value = action.sourceFieldId;
                actionDiv.querySelector('.sourceFieldName').value = action.sourceFieldName;
                actionDiv.querySelector('.targetFieldId').value = action.targetFieldId;
                actionDiv.querySelector('.targetFieldName').value = action.targetFieldName;
                break;     
            case 'addToList':
                const listSelect = actionDiv.querySelector('.listSelect');
                if (listSelect) {
                    listSelect.value = action.listId;
                }
                break;        
        }
    }
    return actionDiv;  // Make sure to return the actionDiv
}

function refreshListSelect(selectElement) {
    console.log('Refreshing list select');
    browserAPI.storage.local.get('customLists', function(data) {
        const customLists = data.customLists || [];
        console.log('Custom lists:', customLists);
        selectElement.innerHTML = '<option value="">Select a List</option>';
        customLists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.name;
            selectElement.appendChild(option);
        });
        console.log('List select refreshed with options:', selectElement.innerHTML);
    });
}


function updateAllListSelects() {
    const listSelects = document.querySelectorAll('.listSelect');
    listSelects.forEach(refreshListSelect);
}

function loadConfigurations() {
    browserAPI.storage.local.get(['configurationSets', 'currentSetName'], function(data) {
        configurationSets = data.configurationSets || [{ name: 'Default Set', buttons: [], observationFieldMap: {} }];
        currentSetName = data.currentSetName || configurationSets[0].name;
        displayConfigurations();
        updateSetSelector();
        updateSetManagementButtons();
    });
}

function migrateConfigurations(configs) {
    return configs.map(config => {
        if (!config.actions) {
            config.actions = [{
                type: config.actionType || 'observationField',
                fieldId: config.fieldId,
                fieldValue: config.fieldValue,
                annotationField: config.annotationField,
                annotationValue: config.annotationValue
            }];
            delete config.actionType;
            delete config.fieldId;
            delete config.fieldValue;
            delete config.annotationField;
            delete config.annotationValue;
        }
        if (!config.id) {
            config.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        }
        return config;
    });
}

async function displayConfigurations() {
    const container = document.getElementById('buttonConfigs');
    container.innerHTML = '';

    const currentSet = getCurrentSet();
    if (!currentSet) {
        console.error('Current set not found');
        return;
    }

    let buttonsToDisplay = [...currentSet.buttons];
    
    if (lastUsedSort === 'date') {
        buttonsToDisplay.sort((a, b) => {
            return dateSortNewestFirst ? 
                (parseInt(b.id) - parseInt(a.id)) : 
                (parseInt(a.id) - parseInt(b.id));
        });
    } else {
        buttonsToDisplay.sort((a, b) => {
            return alphaSortAtoZ ? 
                a.name.localeCompare(b.name) : 
                b.name.localeCompare(a.name);
        });
    }

    for (const config of buttonsToDisplay.filter(config => 
        config.name.toLowerCase().includes(searchTerm) ||
        config.actions.some(action => formatAction(action).toLowerCase().includes(searchTerm))
    )) {
        const configDiv = document.createElement('div');
        configDiv.className = 'config-item';
        configDiv.dataset.id = config.id;
        if (config.configurationDisabled) {
            configDiv.classList.add('disabled-config');
        }

        const actionsHtml = await Promise.all(config.actions.map(async action => {
            const formattedAction = await formatAction(action);
            return `<p>${formattedAction}</p>`;
        }));

        configDiv.innerHTML = `
            <div class="config-header">
                <input type="checkbox" class="configuration-checkbox" data-config-id="${config.id}">
                <span class="config-name">${config.name}</span>
                <span class="config-shortcut">${formatShortcut(config.shortcut)}</span>
                <span class="toggle-details">&#9660;</span>
            </div>
            <div class="config-details" style="display: none;">
                ${actionsHtml.join('')}
                <div class="button-actions">
                    <label><input type="checkbox" class="hide-button-checkbox" ${config.buttonHidden ? 'checked' : ''}> Hide Button</label>
                    <label><input type="checkbox" class="disable-config-checkbox" ${config.configurationDisabled ? 'checked' : ''}> Disable Configuration</label>
                    <button class="edit-button">Edit</button>
                    <button class="duplicate-button">Duplicate</button>
                    <button class="delete-button">Delete</button>
                </div>
            </div>
        `;
        const checkbox = configDiv.querySelector('.configuration-checkbox');
        checkbox.checked = selectedConfigurations.has(config.id);
        checkbox.addEventListener('change', handleConfigurationSelection);
        
        // Prevent checkbox clicks from triggering the header click event
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        const header = configDiv.querySelector('.config-header');
        const detailsDiv = configDiv.querySelector('.config-details');
        const toggleSpan = configDiv.querySelector('.toggle-details');

        header.addEventListener('click', () => {
            detailsDiv.style.display = detailsDiv.style.display === 'none' ? 'block' : 'none';
            toggleSpan.innerHTML = detailsDiv.style.display === 'none' ? '&#9660;' : '&#9650;';
        });

        const hideButtonCheckbox = configDiv.querySelector('.hide-button-checkbox');
        const disableConfigCheckbox = configDiv.querySelector('.disable-config-checkbox');
        const editButton = configDiv.querySelector('.edit-button');
        const deleteButton = configDiv.querySelector('.delete-button');
        const duplicateButton = configDiv.querySelector('.duplicate-button');

        hideButtonCheckbox.addEventListener('change', (event) => {
            toggleHideButton(config.id, event.target);
        });
        
        disableConfigCheckbox.addEventListener('change', (event) => {
            toggleDisableConfiguration(config.id, event.target);
        });

        editButton.addEventListener('click', () => editConfiguration(config.id));
        deleteButton.addEventListener('click', () => deleteConfiguration(config.id));
        duplicateButton.addEventListener('click', () => duplicateConfiguration(config.id));

        container.appendChild(configDiv);
    }
}


async function formatAction(action) {
    switch (action.type) {
        case 'follow':
            return action.follow === 'follow' ? 'Follow the observation' : 'Unfollow the observation';
        case 'reviewed':
            return action.reviewed === 'mark' ? 'Mark the observation as reviewed' : 'Mark the observation as unreviewed';        
        case 'observationField':
            let displayValue = action.displayValue || action.fieldValue;
            return `Add value "${displayValue}" to ${action.fieldName || `Field ${action.fieldId}`}`;
        case 'annotation':
            const fieldName = getAnnotationFieldName(action.annotationField);
            const valueName = getAnnotationValueName(action.annotationField, action.annotationValue);
            return `Set "${fieldName}" to "${valueName}"`;
        case 'addToProject':
                return action.remove ? 
                    `Remove from project: ${action.projectName || action.projectId}` :
                    `Add to project: ${action.projectName || action.projectId}`;            
        case 'addComment':
            return `Add comment: "${action.commentBody.substring(0, 30)}${action.commentBody.length > 30 ? '...' : ''}"`;
        case 'addTaxonId':
            let taxonDisplay = `Add taxon ID: ${action.taxonName} (ID: ${action.taxonId})`;
            if (action.disagreement) {
                taxonDisplay += ' [Disagreement]';
            }
            if (action.comment) {
                taxonDisplay += `\nwith\ncomment: "${action.comment.substring(0, 30)}${action.comment.length > 30 ? '...' : ''}"`;
            }
            return taxonDisplay;
        case 'qualityMetric':
            const metricLabel = qualityMetrics.find(m => m.value === action.metric).label;
            return `Quality Metric: "${metricLabel}" - ${action.vote}`;
        case 'copyObservationField':
            return `Copy value from "${action.sourceFieldName}" to "${action.targetFieldName}"`;
        case 'withdrawId' :
            return 'Withdraw active identification';
        case 'addToList':
            const listName = await getListName(action.listId);
            return action.remove ? 
                `Remove from list: ${listName}` : 
                `Add to list: ${listName}`;
        default:
            return 'Unknown action';       
    }
}

function getListName(listId) {
    return new Promise((resolve) => {
        browserAPI.storage.local.get('customLists', function(data) {
            const customLists = data.customLists || [];
            const list = customLists.find(l => l.id === listId);
            resolve(list ? list.name : 'Unknown List');
        });
    });
}

function toggleHideButton(configId, checkbox) {
    const currentSet = getCurrentSet();
    if (!currentSet) return;

    const config = currentSet.buttons.find(c => c.id === configId);
    if (config) {
        config.buttonHidden = checkbox.checked;
        
        // Instead of rebuilding everything, just update this config's display
        const configDiv = document.querySelector(`.config-item[data-id="${configId}"]`);
        if (configDiv) {
            updateConfigurationDisplay(config);
            saveConfigurationSets(() => {}, false); // Pass false to prevent display refresh
        }
    }
}

function toggleDisableConfiguration(configId, checkbox) {
    const currentSet = getCurrentSet();
    if (!currentSet) return;

    const config = currentSet.buttons.find(c => c.id === configId);
    if (config) {
        config.configurationDisabled = checkbox.checked;
        
        const configDiv = document.querySelector(`.config-item[data-id="${configId}"]`);
        if (configDiv) {
            updateConfigurationDisplay(config);
            saveConfigurationSets(() => {}, false);
        }
    }
}

function updateConfigurationDisplay(config) {
    const configDiv = document.querySelector(`.config-item[data-id="${config.id}"]`);
    if (configDiv) {
        configDiv.classList.toggle('disabled-config', config.configurationDisabled);
        
        // Update checkboxes without triggering change events
        const hideCheckbox = configDiv.querySelector('.hide-button-checkbox');
        if (hideCheckbox) {
            hideCheckbox.checked = config.buttonHidden;
        }
        
        const disableCheckbox = configDiv.querySelector('.disable-config-checkbox');
        if (disableCheckbox) {
            disableCheckbox.checked = config.configurationDisabled;
        }
    }
}

function saveConfigurations() {
    browserAPI.storage.local.set({
        customButtons: customButtons,
        lastConfigUpdate: Date.now()
    }, function() {
        console.log('Configuration updated');
    });
}

function saveAndReloadConfigurations(updateTimestamp = false) {
    const dataToSave = { customButtons: customButtons };
    if (updateTimestamp) {
        dataToSave.lastConfigUpdate = Date.now();
    }
    browserAPI.storage.local.set(dataToSave, function() {
        console.log('Configuration updated');
        loadConfigurations();
    });
    console.log('Saving configurations:', customButtons);
    console.log('Setting lastConfigUpdate:', Date.now());
}

function formatShortcut(shortcut) {
    if (!shortcut || (!shortcut.ctrlKey && !shortcut.shiftKey && !shortcut.altKey && !shortcut.key)) {
        return 'None';
    }
    let parts = [];
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.key) parts.push(shortcut.key);
    return parts.join(' + ');
}





function clearForm() {
    document.getElementById('buttonName').value = '';
    document.getElementById('ctrlKey').checked = false;
    document.getElementById('shiftKey').checked = false;
    document.getElementById('altKey').checked = false;
    document.getElementById('shortcut').value = '';
    document.getElementById('actionsContainer').innerHTML = '';
    const saveButton = document.getElementById('saveButton');
    saveButton.textContent = 'Save Configuration';
    delete saveButton.dataset.editIndex;
}

function updateConfigurations(configId) {
    const config = customButtons.find(c => c.id === configId);
    if (!config) return;

    const updatedConfig = {
        id: config.id,
        name: document.getElementById('buttonName').value,
        shortcut: {
            ctrlKey: document.getElementById('ctrlKey').checked,
            shiftKey: document.getElementById('shiftKey').checked,
            altKey: document.getElementById('altKey').checked,
            key: document.getElementById('shortcut').value.toUpperCase()
        },
        actionType: currentActionType
    };

    if (currentActionType === 'observationField') {
        updatedConfig.fieldId = document.getElementById('fieldId').value;
        updatedConfig.fieldValue = document.getElementById('fieldValue').value;
    } else {
        updatedConfig.annotationField = document.getElementById('annotationField').value;
        updatedConfig.annotationValue = document.getElementById('annotationValue').value;
    }

    const index = customButtons.findIndex(c => c.id === configId);
    if (index !== -1) {
        customButtons[index] = updatedConfig;
        browserAPI.storage.local.set({customButtons: customButtons}, function() {
            console.log('Configuration updated');
            loadConfigurations();
            clearForm();
            // Reset the save button
            const saveButton = document.getElementById('saveButton');
            saveButton.textContent = 'Save Configuration';
            saveButton.onclick = saveConfiguration;
        });
    }
}

function toggleHideConfiguration(configId) {
    const config = customButtons.find(c => c.id === configId);
    if (config) {
        config.buttonHidden = !config.buttonHidden;
        browserAPI.storage.local.set({customButtons: customButtons}, function() {
            console.log('Configuration visibility toggled');
            loadConfigurations();
        });
    }
}

function deleteConfiguration(configId) {
    if (confirm('Are you sure you want to delete this configuration?')) {
        const currentSet = getCurrentSet();
        if (!currentSet) return;

        currentSet.buttons = currentSet.buttons.filter(c => c.id !== configId);
        saveConfigurationSets(function() {
            console.log('Configuration deleted');
        });
    }
}

function setActionType(type) {
    currentActionType = type;
    document.getElementById('ofInputs').classList.toggle('hidden', type !== 'observationField');
    document.getElementById('annotationInputs').classList.toggle('hidden', type !== 'annotation');
    document.getElementById('ofButton').classList.toggle('active', type === 'observationField');
    document.getElementById('annotationButton').classList.toggle('active', type === 'annotation');
    document.getElementById('ofUrlContainer').classList.toggle('hidden', type !== 'observationField');
}

function populateAnnotationFields(select) {
    select.innerHTML = '<option value="">Select Field</option>';
    Object.keys(controlledTerms).forEach(term => {
        const option = document.createElement('option');
        option.value = controlledTerms[term].id;
        option.textContent = term;
        select.appendChild(option);
    });
}

function updateAnnotationValues(fieldSelect, valueSelect) {
    valueSelect.innerHTML = '<option value="">Select Value</option>';
    const selectedField = controlledTerms[fieldSelect.options[fieldSelect.selectedIndex].text];
    if (selectedField) {
        Object.entries(selectedField.values).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = key;
            valueSelect.appendChild(option);
        });
    }
}

function populateFieldDatalist() {
    const datalist = document.getElementById('fieldDatalist') || document.createElement('datalist');
    datalist.id = 'fieldDatalist';
    datalist.innerHTML = '';
    Object.entries(observationFieldMap).forEach(([id, name]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        datalist.appendChild(option);
    });
    document.body.appendChild(datalist);
}

document.addEventListener('DOMContentLoaded', function() {
    loadConfigurationSets();
    populateFieldDatalist();
    document.getElementById('saveButton').addEventListener('click', saveConfiguration);
    document.getElementById('cancelButton').addEventListener('click', clearForm);
    document.getElementById('addActionButton').addEventListener('click', addActionToForm);
     document.getElementById('searchInput').addEventListener('input', filterConfigurations);
     document.getElementById('toggleDateSort').addEventListener('click', toggleDateSort);
     document.getElementById('toggleAlphaSort').addEventListener('click', toggleAlphaSort);
     updateSortButtons();
    const shortcutsToggle = document.getElementById('hardcoded-shortcuts-toggle');
    const shortcutsList = document.getElementById('hardcoded-shortcuts-list');

    shortcutsToggle.addEventListener('click', function() {
        if (shortcutsList.style.display === 'none') {
            shortcutsList.style.display = 'block';
            shortcutsToggle.textContent = 'General Shortcuts [-]';
        } else {
            shortcutsList.style.display = 'none';
            shortcutsToggle.textContent = 'General Shortcuts [+]';
        }
    });
    document.getElementById('exportButton').addEventListener('click', exportConfigurations);
    document.getElementById('importInput').addEventListener('change', importConfigurations);
    
    document.getElementById('importButton').addEventListener('click', () => {
        document.getElementById('importInput').click();
    });
    document.getElementById('showUndoRecordsButton').addEventListener('click', showUndoRecordsModal);
    document.getElementById('createSetButton').addEventListener('click', createNewSet);
    document.getElementById('setSelector').addEventListener('change', switchConfigurationSet);
    document.getElementById('duplicateSetButton').addEventListener('click', duplicateCurrentSet);
    document.getElementById('renameSetButton').addEventListener('click', renameCurrentSet);
    document.getElementById('removeSetButton').addEventListener('click', removeCurrentSet);

    loadAutoFollowSettings();
    
    document.getElementById('preventTaxonFollow').addEventListener('change', saveAutoFollowSettings);
    document.getElementById('preventFieldFollow').addEventListener('change', saveAutoFollowSettings);
    document.getElementById('preventTaxonReview').addEventListener('change', saveAutoFollowSettings);

    const preventionToggle = document.getElementById('auto-prevention-toggle');
    const preventionSettings = document.getElementById('auto-prevention-settings');

    preventionToggle.addEventListener('click', function() {
        if (preventionSettings.style.display === 'none') {
            preventionSettings.style.display = 'block';
            preventionToggle.textContent = 'Prevent Auto-reviewed/Followed [-]';
        } else {
            preventionSettings.style.display = 'none';
            preventionToggle.textContent = 'Prevent Auto-reviewed/Followed [+]';
        }
    });

});

function showUndoRecordsModal() {
    getUndoRecords(function(undoRecords) {
        console.log('Retrieved undo records:', undoRecords);
        if (undoRecords.length === 0) {
            alert('No undo records available.');
            return;
        }

        const modal = createUndoRecordsModal(undoRecords, function(record) {
            // For the options page, we might want to just mark the record as undone
            // without actually performing the undo action
            markRecordAsUndone(record.id);
        });

        document.body.appendChild(modal);
    });
}

function exportConfigurations() {
    browserAPI.storage.local.get(['configurationSets', 'currentSetName', 'customLists'], function(data) {
        const exportData = {
            configurationSets: data.configurationSets || [],
            currentSetName: data.currentSetName || '',
            customLists: data.customLists || []
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `iNaturalist_tool_config_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

function importConfigurations(event) {
    console.log('Starting import process');
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                console.log('Imported data:', importedData);
                
                if (importedData.configurationSets) {
                    try {
                        const importResults = await createImportModal(importedData.configurationSets);
                        processImportChoices(importResults);
                        if (importedData.customLists) {
                            mergeLists(importedData.customLists);
                        }
                    } catch (error) {
                        if (error.message !== 'Import cancelled') {
                            console.error('Import error:', error);
                            alert('Error during import process');
                        }
                    }
                } else if (importedData.customButtons) {
                    // Handle old format
                    const setName = prompt("Enter a name for the imported set:", `Imported Set ${new Date().toLocaleString()}`);
                    if (setName) {
                        const newSet = {
                            name: setName,
                            buttons: importedData.customButtons,
                            observationFieldMap: importedData.observationFieldMap || {}
                        };
                        processImportedSets([newSet]);
                    }
                } else {
                    throw new Error('Invalid import format');
                }
            } catch (error) {
                alert('Error parsing the imported file. Please make sure it\'s a valid JSON file.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }
    // Reset the file input to allow re-importing the same file
    event.target.value = '';
}

function processImportedSets(importedSets) {
    let setsToAdd = [];
    let duplicateContentSets = [];
    let duplicateNameSets = [];

    importedSets.forEach(importedSet => {
        const existingSetByContent = configurationSets.find(set => isSetEqual(set, importedSet));
        const existingSetByName = configurationSets.find(set => set.name === importedSet.name);
        
        if (existingSetByContent) {
            duplicateContentSets.push(importedSet.name);
        } else if (existingSetByName) {
            // If there's a name conflict but content is different,
            // generate a unique name by appending a number
            let newName = importedSet.name;
            let counter = 1;
            while (configurationSets.some(set => set.name === newName)) {
                newName = `${importedSet.name} (${counter})`;
                counter++;
            }
            duplicateNameSets.push({
                oldName: importedSet.name,
                newName: newName
            });
            const modifiedSet = { ...importedSet, name: newName };
            setsToAdd.push(modifiedSet);
        } else {
            setsToAdd.push(importedSet);
        }
    });

    let messages = [];
    if (duplicateContentSets.length > 0) {
        messages.push(`The following sets are exact duplicates and will be skipped: ${duplicateContentSets.join(', ')}`);
    }
    if (duplicateNameSets.length > 0) {
        messages.push(`The following sets had name conflicts and were renamed:\n${duplicateNameSets.map(set => 
            `"${set.oldName}" -> "${set.newName}"`).join('\n')}`);
    }

    if (setsToAdd.length > 0) {
        configurationSets.push(...setsToAdd);
        currentSetName = setsToAdd[setsToAdd.length - 1].name;
        saveConfigurationSets();
        messages.push(`Successfully imported ${setsToAdd.length} new configuration set(s).`);
    } else {
        messages.push('No new configuration sets were imported.');
    }

    alert(messages.join('\n\n'));
}    

function isSetEqual(set1, set2) {
    return JSON.stringify(set1) === JSON.stringify(set2);
}

function mergeConfigurationSets(importedSets) {
    importedSets.forEach(importedSet => {
        const existingSetIndex = configurationSets.findIndex(set => set.name === importedSet.name);
        if (existingSetIndex !== -1) {
            // Merge buttons
            importedSet.buttons.forEach(importedButton => {
                const existingButtonIndex = configurationSets[existingSetIndex].buttons.findIndex(b => b.name === importedButton.name);
                if (existingButtonIndex !== -1) {
                    // Ask user what to do
                    if (confirm(`Button "${importedButton.name}" already exists in set "${importedSet.name}". Replace it?`)) {
                        configurationSets[existingSetIndex].buttons[existingButtonIndex] = importedButton;
                    }
                } else {
                    configurationSets[existingSetIndex].buttons.push(importedButton);
                }
            });
            // Merge observationFieldMap
            configurationSets[existingSetIndex].observationFieldMap = {
                ...configurationSets[existingSetIndex].observationFieldMap,
                ...importedSet.observationFieldMap
            };
        } else {
            configurationSets.push(importedSet);
        }
    });

    browserAPI.storage.local.set({ 
        configurationSets: configurationSets,
        lastConfigUpdate: Date.now()
    }, function() {
        console.log('Configuration sets updated');
        updateSetSelector();
        displayConfigurations();
        alert('Import completed successfully.');
    });
}

function resolveConflicts(conflicts, callback) {
    if (conflicts.length === 0) {
        callback();
        return;
    }

    const conflict = conflicts.shift();
    const message = conflict.type === 'shortcut' 
        ? `Shortcut conflict for "${conflict.imported.name}". Choose an action:`
        : `Configuration "${conflict.existing.name}" already exists. Choose an action:`;

    const options = conflict.type === 'shortcut'
        ? ['Keep existing', 'Use imported', 'Assign new']
        : ['Keep existing', 'Replace with imported', 'Rename and add'];

    const choice = prompt(`${message}\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\nEnter the number of your choice:`);

    switch (choice) {
        case '1':
            // Keep existing (do nothing)
            break;
        case '2':
            if (conflict.type === 'shortcut') {
                conflict.existing.shortcut = null;
                customButtons.push(conflict.imported);
            } else {
                const index = customButtons.findIndex(b => b.id === conflict.existing.id);
                customButtons[index] = conflict.imported;
            }
            break;
        case '3':
            if (conflict.type === 'shortcut') {
                const newShortcut = prompt('Enter new shortcut (e.g., "Ctrl+Shift+A"):');
                if (newShortcut) {
                    const parts = newShortcut.split('+');
                    conflict.imported.shortcut = {
                        ctrlKey: parts.includes('Ctrl'),
                        shiftKey: parts.includes('Shift'),
                        altKey: parts.includes('Alt'),
                        key: parts[parts.length - 1]
                    };
                    customButtons.push(conflict.imported);
                }
            } else {
                const newName = prompt('Enter new name for the imported configuration:');
                if (newName) {
                    conflict.imported.name = newName;
                    customButtons.push(conflict.imported);
                }
            }
            break;
        default:
            alert('Invalid choice. Keeping the existing configuration.');
    }

    resolveConflicts(conflicts, callback);
}

function loadUndoRecords() {
    const container = document.getElementById('undoRecordsContainer');
    if (!container) {
        console.log('Undo records container not found. This is expected if the modal is not open.');
        return;
    }

    browserAPI.storage.local.get('undoRecords', function(result) {
        const undoRecords = result.undoRecords || [];
        if (undoRecords.length === 0) {
            container.textContent = 'No undo records available.';
            return;
        }

        undoRecords.forEach(record => {
            const recordDiv = document.createElement('div');
            recordDiv.className = 'undo-record';
            
            const actionInfo = document.createElement('p');
            actionInfo.textContent = `${record.action} - ${new Date(record.timestamp).toLocaleString()}`;
            recordDiv.appendChild(actionInfo);
            
            const observationIds = Object.keys(record.observations);
            const observationUrl = generateObservationURL(observationIds);
            
            const linkParagraph = document.createElement('a');
            linkParagraph.href = observationUrl;
            linkParagraph.textContent = 'View affected observations';
            linkParagraph.target = '_blank';
            recordDiv.appendChild(linkParagraph);
            
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove Record';
            removeButton.onclick = function() {
                removeUndoRecord(record.id, function() {
                    recordDiv.remove();
                });
            };
            recordDiv.appendChild(removeButton);
            
            container.appendChild(recordDiv);
        });
    });
}

// Call this function when the options page loads
document.addEventListener('DOMContentLoaded', loadUndoRecords);

function createList() {
    const listName = document.getElementById('newListName').value.trim();
    if (listName) {
        browserAPI.storage.local.get('customLists', function(data) {
            const customLists = data.customLists || [];
            const newList = {
                id: Date.now().toString(),
                name: listName,
                observations: []
            };
            customLists.push(newList);
            browserAPI.storage.local.set({customLists: customLists}, function() {
                displayLists();
                updateAllListSelects();
                document.getElementById('newListName').value = '';
            });
        });
    }
}
  
function displayLists() {
    const container = document.getElementById('existingLists');
    container.innerHTML = '';
    browserAPI.storage.local.get('customLists', function(data) {
        const customLists = data.customLists || [];
        customLists.forEach(list => {
            const listDiv = document.createElement('div');
            listDiv.className = 'list-item';
            listDiv.innerHTML = `
                <div class="list-name">${list.name} (${list.observations.length} observations)</div>
                <div class="list-actions">
                    <button class="viewList" data-id="${list.id}">View</button>
                    <button class="renameList" data-id="${list.id}">Rename</button>
                    <button class="deleteList" data-id="${list.id}">Delete</button>
                </div>
            `;
            container.appendChild(listDiv);
        });
    });
}
  
  // Add event listeners
  document.getElementById('createList').addEventListener('click', createList);
  document.addEventListener('DOMContentLoaded', displayLists);

  function renameList(listId) {
    const newName = prompt("Enter new name for the list:");
    if (newName) {
        browserAPI.storage.local.get('customLists', function(data) {
            const customLists = data.customLists || [];
            const listIndex = customLists.findIndex(list => list.id === listId);
            if (listIndex !== -1) {
                customLists[listIndex].name = newName;
                browserAPI.storage.local.set({customLists: customLists}, function() {
                    displayLists();
                    updateAllListSelects();
                });
            }
        });
    }
}

function deleteList(listId) {
    if (confirm("Are you sure you want to delete this list?")) {
        browserAPI.storage.local.get('customLists', function(data) {
            const customLists = data.customLists || [];
            const updatedLists = customLists.filter(list => list.id !== listId);
            browserAPI.storage.local.set({customLists: updatedLists}, function() {
                displayLists();
                updateAllListSelects();
            });
        });
    }
}
  
  // Add event listeners for rename and delete
  document.getElementById('existingLists').addEventListener('click', function(e) {
    if (e.target.classList.contains('viewList')) {
        viewList(e.target.dataset.id);
    }  else if (e.target.classList.contains('renameList')) {
      renameList(e.target.dataset.id);
    } else if (e.target.classList.contains('deleteList')) {
      deleteList(e.target.dataset.id);
    }
  });

  async function viewList(listId) {
    const url = await generateListObservationURL(listId);
    if (url) {
        window.open(url, '_blank');
    } else {
        alert('This list is empty or not found.');
    }
}

function loadConfigurationSets() {
    browserAPI.storage.local.get(['configurationSets', 'currentSetName'], function(data) {
        configurationSets = data.configurationSets || [{ name: 'Default Set', buttons: [], observationFieldMap: {} }];
        currentSetName = data.currentSetName || configurationSets[0].name;
        updateSetSelector();
        displayConfigurations();
        updateSetManagementButtons();
    });
}

function updateSetSelector() {
    const selector = document.getElementById('setSelector');
    selector.innerHTML = '';
    configurationSets.forEach(set => {
        const option = document.createElement('option');
        option.value = set.name;
        option.textContent = set.name;
        selector.appendChild(option);
    });
    selector.value = currentSetName;
}

function switchConfigurationSet() {
    currentSetName = document.getElementById('setSelector').value;
    saveConfigurationSets();
}

function updateSetManagementButtons() {
    const disableButtons = configurationSets.length <= 1;
    document.getElementById('duplicateSetButton').disabled = false;
    document.getElementById('renameSetButton').disabled = false;
    document.getElementById('removeSetButton').disabled = disableButtons;
}

function createNewSet() {
    const setName = prompt("Enter a name for the new configuration set:");
    if (setName) {
        if (configurationSets.some(set => set.name === setName)) {
            alert("A set with this name already exists. Please choose a different name.");
            return;
        }
        const newSet = { name: setName, buttons: [], observationFieldMap: {} };
        configurationSets.push(newSet);
        currentSetName = setName;
        saveConfigurationSets();
    }
}

function duplicateCurrentSet() {
    const currentSet = configurationSets.find(set => set.name === currentSetName);
    if (currentSet) {
        const newSetName = prompt("Enter a name for the duplicated set:", `${currentSet.name} (Copy)`);
        if (newSetName) {
            if (configurationSets.some(set => set.name === newSetName)) {
                alert("A set with this name already exists. Please choose a different name.");
                return;
            }
            const newSet = JSON.parse(JSON.stringify(currentSet));
            newSet.name = newSetName;
            configurationSets.push(newSet);
            currentSetName = newSetName;
            saveConfigurationSets();
        }
    }
}

function renameCurrentSet() {
    const currentSet = configurationSets.find(set => set.name === currentSetName);
    if (currentSet) {
        const newName = prompt("Enter a new name for the current set:", currentSet.name);
        if (newName && newName !== currentSet.name) {
            if (configurationSets.some(set => set.name === newName)) {
                alert("A set with this name already exists. Please choose a different name.");
                return;
            }
            currentSet.name = newName;
            currentSetName = newName;
            saveConfigurationSets();
        }
    }
}

function removeCurrentSet() {
    if (configurationSets.length > 1) {
        if (confirm(`Are you sure you want to remove the "${currentSetName}" set?`)) {
            configurationSets = configurationSets.filter(set => set.name !== currentSetName);
            currentSetName = configurationSets[0].name;
            saveConfigurationSets();
        }
    } else {
        alert("You cannot remove the last configuration set.");
    }
}

function saveConfigurationSets(callback, refreshDisplay = true) {
    browserAPI.storage.local.set({ 
        configurationSets: configurationSets,
        currentSetName: currentSetName,
        lastConfigUpdate: Date.now()
    }, function() {
        console.log('Configuration sets updated');
        if (refreshDisplay) {
            updateSetSelector();
            displayConfigurations();
            updateSetManagementButtons();
        }
        if (callback) callback();
    });
}

function mergeLists(importedLists) {
    browserAPI.storage.local.get('customLists', async function(data) {
        let existingLists = data.customLists || [];
        
        try {
            const importResults = await createListImportModal(importedLists, existingLists);
            processListImportChoices(importResults, existingLists);
        } catch (error) {
            if (error.message !== 'Import cancelled') {
                console.error('Error during list import:', error);
                alert('Error importing lists');
            }
        }
    });
}

function processListImportChoices(results, existingLists) {
    let listsToAdd = [];
    let listsToMerge = [];
    let skippedLists = [];

    results.forEach(result => {
        switch (result.action) {
            case 'new':
                listsToAdd.push(result.list);
                break;
            case 'rename':
                listsToAdd.push({ 
                    ...result.list, 
                    name: result.newName,
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
                });
                break;
            case 'merge':
                listsToMerge.push(result.list);
                break;
            case 'skip':
                skippedLists.push(result.list.name);
                break;
        }
    });

    // Handle merges first
    listsToMerge.forEach(listToMerge => {
        const existingList = existingLists.find(list => list.id === listToMerge.id);
        if (existingList) {
            // Merge observations, removing duplicates
            existingList.observations = [...new Set([
                ...existingList.observations,
                ...listToMerge.observations
            ])];
        }
    });

    // Add new lists
    if (listsToAdd.length > 0) {
        existingLists = [...existingLists, ...listsToAdd];
    }

    // Save changes
    browserAPI.storage.local.set({customLists: existingLists}, function() {
        console.log('Lists updated');
        
        // Show summary
        let summary = [];
        if (listsToAdd.length > 0) summary.push(`Added ${listsToAdd.length} new list(s)`);
        if (listsToMerge.length > 0) summary.push(`Merged ${listsToMerge.length} list(s)`);
        if (skippedLists.length > 0) summary.push(`Skipped ${skippedLists.length} identical list(s): ${skippedLists.join(', ')}`);
        
        alert(summary.join('\n'));
        
        // Refresh the lists display
        displayLists();
    });
}

function finalizeMerge(existingLists, listsToAdd) {
    const updatedLists = [...existingLists, ...listsToAdd];
    browserAPI.storage.local.set({customLists: updatedLists}, function() {
        console.log('Lists merged successfully');
        displayLists();
        updateAllListSelects();
        alert('Import completed successfully. Lists have been merged.');
    });
}

function getCurrentSet() {
    return configurationSets.find(set => set.name === currentSetName);
}


let selectedConfigurations = new Set();

function handleSelectAll() {
    const currentSet = getCurrentSet();
    if (!currentSet) return;
    
    // Add all visible (filtered) configuration IDs to the selection
    const configItems = document.querySelectorAll('.config-item');
    configItems.forEach(item => {
        const checkbox = item.querySelector('.configuration-checkbox');
        checkbox.checked = true;
        selectedConfigurations.add(item.dataset.id);
    });
    
    updateSelectedCount();
    updateActionButtonStates();
}

function clearSelection() {
    const configItems = document.querySelectorAll('.config-item');
    configItems.forEach(item => {
        const checkbox = item.querySelector('.configuration-checkbox');
        checkbox.checked = false;
    });
    selectedConfigurations.clear();
    updateSelectedCount();
    updateActionButtonStates();
}

function handleConfigurationSelection(event) {
    const checkbox = event.target;
    const configId = checkbox.dataset.configId;
    
    if (checkbox.checked) {
        selectedConfigurations.add(configId);
    } else {
        selectedConfigurations.delete(configId);
    }
    
    updateSelectedCount();
    updateActionButtonStates();
}

function updateSelectedCount() {
    const count = selectedConfigurations.size;
    document.getElementById('selectedCount').textContent = `${count} selected`;
}

function updateActionButtonStates() {
    const hasSelection = selectedConfigurations.size > 0;
    document.querySelectorAll('.configuration-action-btn').forEach(btn => {
        btn.disabled = !hasSelection;
    });
}

function performConfigurationAction(action) {
    if (selectedConfigurations.size === 0) return;
    
    const currentSet = getCurrentSet();
    if (!currentSet) return;

    const actionMap = {
        delete: {
            prompt: 'Are you sure you want to delete these configurations?',
            action: () => {
                if (!confirm(actionMap.delete.prompt)) return;
                currentSet.buttons = currentSet.buttons.filter(c => !selectedConfigurations.has(c.id));
                selectedConfigurations.forEach(id => {
                    const configDiv = document.querySelector(`.config-item[data-id="${id}"]`);
                    if (configDiv) configDiv.remove();
                });
                clearSelection();
                saveConfigurationSets();
            }
        },
        hide: {
            action: () => {
                currentSet.buttons.forEach(c => {
                    if (selectedConfigurations.has(c.id)) {
                        c.buttonHidden = true;
                        const configDiv = document.querySelector(`.config-item[data-id="${c.id}"]`);
                        if (configDiv) {
                            const hideCheckbox = configDiv.querySelector('.hide-button-checkbox');
                            if (hideCheckbox) hideCheckbox.checked = true;
                        }
                    }
                });
                saveConfigurationSets(null, false); // Pass false to prevent refresh
                expandConfigurations(selectedConfigurations);
            }
        },
        show: {
            action: () => {
                currentSet.buttons.forEach(c => {
                    if (selectedConfigurations.has(c.id)) {
                        c.buttonHidden = false;
                        const configDiv = document.querySelector(`.config-item[data-id="${c.id}"]`);
                        if (configDiv) {
                            const hideCheckbox = configDiv.querySelector('.hide-button-checkbox');
                            if (hideCheckbox) hideCheckbox.checked = false;
                        }
                    }
                });
                saveConfigurationSets(null, false);
                expandConfigurations(selectedConfigurations);
            }
        },
        disable: {
            action: () => {
                currentSet.buttons.forEach(c => {
                    if (selectedConfigurations.has(c.id)) {
                        c.configurationDisabled = true;
                        const configDiv = document.querySelector(`.config-item[data-id="${c.id}"]`);
                        if (configDiv) {
                            const disableCheckbox = configDiv.querySelector('.disable-config-checkbox');
                            if (disableCheckbox) disableCheckbox.checked = true;
                            configDiv.classList.add('disabled-config');
                        }
                    }
                });
                saveConfigurationSets(null, false);
                expandConfigurations(selectedConfigurations);
            }
        },
        enable: {
            action: () => {
                currentSet.buttons.forEach(c => {
                    if (selectedConfigurations.has(c.id)) {
                        c.configurationDisabled = false;
                        const configDiv = document.querySelector(`.config-item[data-id="${c.id}"]`);
                        if (configDiv) {
                            const disableCheckbox = configDiv.querySelector('.disable-config-checkbox');
                            if (disableCheckbox) disableCheckbox.checked = false;
                            configDiv.classList.remove('disabled-config');
                        }
                    }
                });
                saveConfigurationSets(null, false);
                expandConfigurations(selectedConfigurations);
            }
        }
    };

    actionMap[action].action();
}

// Add these event listeners in the DOMContentLoaded section
document.getElementById('selectAllConfigs').addEventListener('click', handleSelectAll);
document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
document.getElementById('deleteSelectedBtn').addEventListener('click', () => performConfigurationAction('delete'));
document.getElementById('hideSelectedBtn').addEventListener('click', () => performConfigurationAction('hide'));
document.getElementById('showSelectedBtn').addEventListener('click', () => performConfigurationAction('show'));
document.getElementById('disableSelectedBtn').addEventListener('click', () => performConfigurationAction('disable'));
document.getElementById('enableSelectedBtn').addEventListener('click', () => performConfigurationAction('enable'));
document.getElementById('toggleAllConfigs').addEventListener('click', toggleAllConfigurations);
let allExpanded = false;

function updateToggleAllButton() {
    const configDivs = document.querySelectorAll('.config-item');
    const allDivsExpanded = Array.from(configDivs).every(div => 
        div.querySelector('.config-details').style.display === 'block'
    );
    
    allExpanded = allDivsExpanded;
    const button = document.getElementById('toggleAllConfigs');
    button.textContent = allExpanded ? 'Collapse All' : 'Expand All';
}

function toggleAllConfigurations() {
    allExpanded = !allExpanded;
    const button = document.getElementById('toggleAllConfigs');
    button.textContent = allExpanded ? 'Collapse All' : 'Expand All';
    
    document.querySelectorAll('.config-item').forEach(configDiv => {
        const detailsDiv = configDiv.querySelector('.config-details');
        const toggleSpan = configDiv.querySelector('.toggle-details');
        if (detailsDiv && toggleSpan) {
            detailsDiv.style.display = allExpanded ? 'block' : 'none';
            toggleSpan.innerHTML = allExpanded ? '&#9650;' : '&#9660;';
        }
    });
}

function expandConfigurations(configIds) {
    configIds.forEach(id => {
        const configDiv = document.querySelector(`.config-item[data-id="${id}"]`);
        if (configDiv) {
            const detailsDiv = configDiv.querySelector('.config-details');
            const toggleSpan = configDiv.querySelector('.toggle-details');
            if (detailsDiv && toggleSpan) {
                detailsDiv.style.display = 'block';
                toggleSpan.innerHTML = '&#9650;';
            }
        }
    });
    updateToggleAllButton();
}

function createImportModal(importedSets) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;
    `;

    let html = '<h2>Import Configuration Sets</h2>';
    html += '<p>Please select how to handle each configuration set:</p>';
    
    importedSets.forEach((set, index) => {
        const existingSet = configurationSets.find(existing => existing.name === set.name);
        const isIdentical = existingSet ? isSetEqual(existingSet, set) : false;
        
        html += `
            <div class="import-set-item" style="margin: 10px 0; padding: 10px; border: 1px solid #ccc;">
                <h3>${set.name}</h3>
                <p>Contains ${set.buttons.length} buttons</p>
                ${existingSet ? 
                    isIdentical ? 
                        '<p style="color: #666;">This set is identical to an existing set and will be skipped</p>' :
                        `<select id="action-${index}" class="import-action">
                            <option value="rename">Import as new set with different name</option>
                            <option value="merge">Merge with existing set</option>
                            <option value="skip">Skip this set</option>
                        </select>
                        <div id="rename-${index}" style="margin-top: 10px;">
                            <input type="text" id="newname-${index}" value="${set.name} (New)" 
                                style="width: 200px; margin-right: 10px;">
                        </div>`
                    : '<p style="color: green;">Will be imported as new set</p>'
                }
            </div>`;
    });

    html += `
        <div style="margin-top: 20px; text-align: right;">
            <button id="import-cancel" style="margin-right: 10px;">Cancel</button>
            <button id="import-confirm">Import</button>
        </div>
    `;

    content.innerHTML = html;
    modal.appendChild(content);

    // Add event listeners for action selects
    importedSets.forEach((set, index) => {
        const existingSet = configurationSets.find(existing => existing.name === set.name);
        if (existingSet && !isSetEqual(existingSet, set)) {
            setTimeout(() => {
                const actionSelect = document.getElementById(`action-${index}`);
                const renameDiv = document.getElementById(`rename-${index}`);
                if (actionSelect && renameDiv) {
                    actionSelect.addEventListener('change', () => {
                        renameDiv.style.display = actionSelect.value === 'rename' ? 'block' : 'none';
                    });
                }
            }, 0);
        }
    });

    return new Promise((resolve, reject) => {
        document.body.appendChild(modal);

        document.getElementById('import-cancel').onclick = () => {
            document.body.removeChild(modal);
            reject(new Error('Import cancelled'));
        };

        document.getElementById('import-confirm').onclick = () => {
            const results = importedSets.map((set, index) => {
                const existingSet = configurationSets.find(existing => existing.name === set.name);
                if (!existingSet) {
                    return { action: 'new', set: set };
                }
                if (isSetEqual(existingSet, set)) {
                    return { action: 'skip', set: set };
                }
                const actionSelect = document.getElementById(`action-${index}`);
                const newNameInput = document.getElementById(`newname-${index}`);
                return {
                    action: actionSelect.value,
                    set: set,
                    newName: newNameInput ? newNameInput.value : null
                };
            });
            document.body.removeChild(modal);
            resolve(results);
        };
    });
}

function processImportChoices(results) {
    let setsToAdd = [];
    let setsToMerge = [];
    let skippedSets = [];

    results.forEach(result => {
        switch (result.action) {
            case 'new':
                setsToAdd.push(result.set);
                break;
            case 'rename':
                setsToAdd.push({ ...result.set, name: result.newName });
                break;
            case 'merge':
                setsToMerge.push(result.set);
                break;
            case 'skip':
                skippedSets.push(result.set.name);
                break;
        }
    });

    // Handle merges first
    setsToMerge.forEach(setToMerge => {
        const existingSet = configurationSets.find(set => set.name === setToMerge.name);
        if (existingSet) {
            existingSet.buttons = [...existingSet.buttons, ...setToMerge.buttons];
            existingSet.observationFieldMap = { 
                ...existingSet.observationFieldMap, 
                ...setToMerge.observationFieldMap 
            };
        }
    });

    // Add new sets
    if (setsToAdd.length > 0) {
        configurationSets.push(...setsToAdd);
        currentSetName = setsToAdd[setsToAdd.length - 1].name;
    }

    // Save changes
    saveConfigurationSets();

    // Show summary
    let summary = [];
    if (setsToAdd.length > 0) summary.push(`Added ${setsToAdd.length} new set(s)`);
    if (setsToMerge.length > 0) summary.push(`Merged ${setsToMerge.length} set(s)`);
    if (skippedSets.length > 0) summary.push(`Skipped ${skippedSets.length} identical set(s): ${skippedSets.join(', ')}`);
    
    alert(summary.join('\n'));
}

document.addEventListener('DOMContentLoaded', function() {
    const importInput = document.getElementById('importInput');
    const importButton = document.getElementById('importButton');
    
    if (importInput && importButton) {
        importInput.addEventListener('change', importConfigurations);
        importButton.addEventListener('click', () => {
            importInput.click();
        });
    }
});

function createListImportModal(importedLists, existingLists) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;
    `;

    let html = '<h2>Import Lists</h2>';
    html += '<p>Please select how to handle each list:</p>';
    
    importedLists.forEach((list, index) => {
        const existingList = existingLists.find(existing => existing.id === list.id);
        const isIdentical = existingList ? 
            JSON.stringify(existingList.observations.sort()) === JSON.stringify(list.observations.sort()) : 
            false;
        
        html += `
            <div class="import-list-item" style="margin: 10px 0; padding: 10px; border: 1px solid #ccc;">
                <h3>${list.name}</h3>
                <p>Contains ${list.observations.length} observations</p>
                ${existingList ? 
                    isIdentical ? 
                        '<p style="color: #666;">This list is identical to an existing list and will be skipped</p>' :
                        `<select id="list-action-${index}" class="import-action">
                            <option value="rename">Import as new list with different name</option>
                            <option value="merge">Merge with existing list</option>
                            <option value="skip">Skip this list</option>
                        </select>
                        <div id="list-rename-${index}" style="margin-top: 10px;">
                            <input type="text" id="list-newname-${index}" value="${list.name} (New)" 
                                style="width: 200px; margin-right: 10px;">
                        </div>`
                    : '<p style="color: green;">Will be imported as new list</p>'
                }
            </div>`;
    });

    html += `
        <div style="margin-top: 20px; text-align: right;">
            <button id="list-import-cancel" style="margin-right: 10px;">Cancel</button>
            <button id="list-import-confirm">Import</button>
        </div>
    `;

    content.innerHTML = html;
    modal.appendChild(content);

    // Add event listeners for action selects
    importedLists.forEach((list, index) => {
        const existingList = existingLists.find(existing => existing.id === list.id);
        if (existingList && !JSON.stringify(existingList.observations.sort()) === JSON.stringify(list.observations.sort())) {
            setTimeout(() => {
                const actionSelect = document.getElementById(`list-action-${index}`);
                const renameDiv = document.getElementById(`list-rename-${index}`);
                if (actionSelect && renameDiv) {
                    actionSelect.addEventListener('change', () => {
                        renameDiv.style.display = actionSelect.value === 'rename' ? 'block' : 'none';
                    });
                }
            }, 0);
        }
    });

    return new Promise((resolve, reject) => {
        document.body.appendChild(modal);

        document.getElementById('list-import-cancel').onclick = () => {
            document.body.removeChild(modal);
            reject(new Error('Import cancelled'));
        };

        document.getElementById('list-import-confirm').onclick = () => {
            const results = importedLists.map((list, index) => {
                const existingList = existingLists.find(existing => existing.id === list.id);
                if (!existingList) {
                    return { action: 'new', list: list };
                }
                if (JSON.stringify(existingList.observations.sort()) === JSON.stringify(list.observations.sort())) {
                    return { action: 'skip', list: list };
                }
                const actionSelect = document.getElementById(`list-action-${index}`);
                const newNameInput = document.getElementById(`list-newname-${index}`);
                return {
                    action: actionSelect.value,
                    list: list,
                    newName: newNameInput ? newNameInput.value : null
                };
            });
            document.body.removeChild(modal);
            resolve(results);
        };
    });
}

function loadAutoFollowSettings() {
    browserAPI.storage.local.get(
        ['preventTaxonFollow', 'preventFieldFollow', 'preventTaxonReview'], 
        function(data) {
            document.getElementById('preventTaxonFollow').checked = !!data.preventTaxonFollow;
            document.getElementById('preventFieldFollow').checked = !!data.preventFieldFollow;
            document.getElementById('preventTaxonReview').checked = !!data.preventTaxonReview;
        }
    );
}

function saveAutoFollowSettings() {
    const settings = {
        preventTaxonFollow: document.getElementById('preventTaxonFollow').checked,
        preventFieldFollow: document.getElementById('preventFieldFollow').checked,
        preventTaxonReview: document.getElementById('preventTaxonReview').checked
    };
    browserAPI.storage.local.set(settings);
}