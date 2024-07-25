let customButtons = [];
let currentConfig = { actions: [] };
let dateSortNewestFirst = true;
let alphaSortAtoZ = true;
let lastUsedSort = 'date';
let searchTerm = '';
let observationFieldMap = {};
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

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
    { altKey: true, key: 'H' }     // Toggle shortcut list
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
                break;
            case 'addComment':
                action.commentBody = actionDiv.querySelector('.commentBody').value.trim();
                break;
            case 'addTaxonId':
                const taxonNameInput = actionDiv.querySelector('.taxonName');
                action.taxonId = taxonNameInput.dataset.taxonId;
                action.taxonName = taxonNameInput.value.trim();
                action.comment = actionDiv.querySelector('.taxonComment').value.trim();
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
        }

        return action;
    });
}

function validateNewConfiguration(config) {
    if (!config.name) {
        throw new Error("Please enter a button name.");
    }

    // Check for name duplication
    const duplicateName = customButtons.find(button => button.name === config.name);
    if (duplicateName) {
        throw new Error("This button name is already in use. Please choose a different name.");
    }

    if (config.shortcut && isShortcutForbidden(config.shortcut)) {
        throw new Error("This shortcut is not allowed as it conflicts with iNat shortcuts, browser functionality, or extension shortcuts.");
    }

    if (config.shortcut && (config.shortcut.key || config.shortcut.ctrlKey || config.shortcut.shiftKey || config.shortcut.altKey)) {
        const conflictingShortcut = customButtons.find((button) => {
            return button.shortcut &&
                   button.shortcut.key === config.shortcut.key &&
                   button.shortcut.ctrlKey === config.shortcut.ctrlKey &&
                   button.shortcut.shiftKey === config.shortcut.shiftKey &&
                   button.shortcut.altKey === config.shortcut.altKey;
        });

        if (conflictingShortcut) {
            throw new Error(`This shortcut is already used for the button: "${conflictingShortcut.name}". Please choose a different shortcut.`);
        }
    }

    validateCommonConfiguration(config);
}


function validateEditConfiguration(config, originalConfig) {
    if (!config.name) {
        throw new Error("Please enter a button name.");
    }

    // Check for name duplication, excluding the original config
    const duplicateName = customButtons.find(button => button.name === config.name && button.id !== originalConfig.id);
    if (duplicateName) {
        throw new Error("This button name is already in use. Please choose a different name.");
    }

    if (config.shortcut && isShortcutForbidden(config.shortcut)) {
        throw new Error("This shortcut is not allowed as it conflicts with browser functionality or extension shortcuts.");
    }

    if (config.shortcut && (config.shortcut.key || config.shortcut.ctrlKey || config.shortcut.shiftKey || config.shortcut.altKey)) {
        const conflictingShortcut = customButtons.find((button) => {
            return button.id !== originalConfig.id && // Ignore the original config
                   button.shortcut &&
                   button.shortcut.key === config.shortcut.key &&
                   button.shortcut.ctrlKey === config.shortcut.ctrlKey &&
                   button.shortcut.shiftKey === config.shortcut.shiftKey &&
                   button.shortcut.altKey === config.shortcut.altKey;
        });

        if (conflictingShortcut) {
            throw new Error(`This shortcut is already used for the button: "${conflictingShortcut.name}". Please choose a different shortcut.`);
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

async function saveConfiguration() {
    try {
        const formData = extractFormData();
        const editIndex = document.getElementById('saveButton').dataset.editIndex;
        
        if (editIndex) {
            const originalConfig = customButtons.find(c => c.id === editIndex);
            validateEditConfiguration(formData, originalConfig);
        } else {
            validateNewConfiguration(formData);
        }

        const newConfig = {
            id: editIndex || Date.now().toString(),
            ...formData,
            buttonHidden: false,
            configurationDisabled: false
        };

        updateOrAddConfiguration(newConfig);

        // Update button order
        let buttonOrder = await browserAPI.storage.sync.get('buttonOrder');
        buttonOrder = buttonOrder.buttonOrder || [];
        if (!editIndex) {
            // If it's a new button, add it to the end of the order
            buttonOrder.push(newConfig.id);
        }

        await browserAPI.storage.sync.set({
            customButtons: customButtons,
            observationFieldMap: observationFieldMap,
            buttonOrder: buttonOrder,
            lastConfigUpdate: Date.now(),
        });

        console.log('Configuration and settings saved');
        loadConfigurations();
        clearForm();
    } catch (error) {
        alert(error.message);
    }
}


function updateOrAddConfiguration(config) {
    const existingIndex = customButtons.findIndex(c => c.id === config.id);
    if (existingIndex !== -1) {
        customButtons[existingIndex] = config;
    } else {
        customButtons.push(config);
    }
}

function editConfiguration(configId) {
    try {
        console.log('Editing configuration:', configId);
        const config = customButtons.find(c => c.id === configId);
        if (!config) {
            console.error(`Configuration with id ${configId} not found`);
            return;
        }

        console.log('Found configuration:', config);

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
        console.log('Adding actions to form');
        config.actions.forEach((action, index) => {
            console.log(`Adding action ${index + 1}:`, action);
            addActionToForm(action);
        });

        const saveButton = document.getElementById('saveButton');
        saveButton.textContent = 'Update Configuration';
        saveButton.dataset.editIndex = configId;

        window.scrollTo(0, 0);
        console.log('Configuration loaded for editing');
    } catch (error) {
        console.error('Error in editConfiguration:', error);
        alert(`An error occurred while editing the configuration: ${error.message}\n\nPlease check the console for more details.`);
    }
}

function duplicateConfiguration(configId) {
    try {
        console.log('Duplicating configuration:', configId);
        const config = customButtons.find(c => c.id === configId);
        if (!config) {
            console.error(`Configuration with id ${configId} not found`);
            return;
        }

        console.log('Found configuration to duplicate:', config);
        editConfiguration(configId); // Reuse edit logic

        document.getElementById('buttonName').value = `${config.name} (Copy)`;

        const saveButton = document.getElementById('saveButton');
        saveButton.textContent = 'Save New Configuration';
        delete saveButton.dataset.editIndex;

        console.log('Configuration duplicated and ready for editing');
    } catch (error) {
        console.error('Error in duplicateConfiguration:', error);
        alert('An error occurred while duplicating the configuration. Please try again.');
    }
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
    browserAPI.storage.sync.get('buttonOrder', function(data) {
        let buttonOrder = data.buttonOrder || [];
        console.log('Current button order before update:', buttonOrder);

        const newButtonIds = newButtons.map(button => button.id);
        const updatedButtonOrder = [...new Set([...buttonOrder, ...newButtonIds])];
        console.log('Updated button order:', updatedButtonOrder);

        const saveAndNotify = () => {
            browserAPI.storage.sync.set({
                customButtons: customButtons,
                observationFieldMap: {...observationFieldMap, ...(importedData.observationFieldMap || {})},
                lastConfigUpdate: Date.now(),
                buttonOrder: updatedButtonOrder
            }, function() {
                console.log('Configurations merged and lastConfigUpdate set');
                console.log('Final customButtons:', customButtons);
                
                // Check storage usage
                browserAPI.storage.sync.getBytesInUse(null, function(bytesInUse) {
                    console.log('Storage bytes in use:', bytesInUse);
                    console.log('Storage quota:', browserAPI.storage.sync.QUOTA_BYTES);
                    const percentageUsed = (bytesInUse / browserAPI.storage.sync.QUOTA_BYTES) * 100;
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
            <option value="observationField">Observation Field</option>
            <option value="annotation">Annotation</option>
            <option value="addTaxonId">Add Taxon ID</option>
            <option value="addComment">Add Comment</option>            
            <option value="addToProject">Add to Project</option>
            <option value="qualityMetric">Data Quality Indicators</option>
            <option value="copyObservationField">Copy Observation Field</option>
        </select>
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
        </div>
        <div class="commentInput" style="display:none;">
            <textarea class="commentBody" placeholder="Enter comment"></textarea>
        </div>
        <div class="taxonIdInputs" style="display:none;">
            <input type="text" class="taxonName" placeholder="Taxon Name">
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
        <button class="removeActionButton">Remove Action</button>
    `;
    document.getElementById('actionsContainer').appendChild(actionDiv);

    const actionType = actionDiv.querySelector('.actionType');
    const ofInputs = actionDiv.querySelector('.ofInputs');
    const annotationInputs = actionDiv.querySelector('.annotationInputs');
    const projectInputs = actionDiv.querySelector('.projectInputs');
    const commentInput = actionDiv.querySelector('.commentInput');
    const taxonIdInputs = actionDiv.querySelector('.taxonIdInputs');
    const qualityMetricInputs = actionDiv.querySelector('.qualityMetricInputs');
    const copyObservationFieldInputs = actionDiv.querySelector('.copyObservationFieldInputs');
    if (taxonIdInputs) {
        taxonIdInputs.innerHTML += `
            <textarea class="taxonComment" placeholder="Enter comment (optional)"></textarea>
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
    });

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
            case 'observationField':
                fieldNameInput.value = action.fieldName || '';
                fieldIdInput.value = action.fieldId;
                fieldValueInput.value = action.displayValue || action.fieldValue;
                if (action.taxonId) {
                    fieldValueInput.dataset.taxonId = action.taxonId;
                }
                lookupObservationField(action.fieldName).then(results => {
                    const field = results.find(f => f.id.toString() === action.fieldId);
                    if (field) {
                        const updatedFieldValueInput = updateFieldValueInput(field, fieldValueContainer);
                        if (field.datatype === 'taxon') {
                            setupTaxonAutocompleteForInput(updatedFieldValueInput);
                        }
                    }
                });
                break;
            case 'addTaxonId':
                if (taxonNameInput && taxonIdInput) {
                    taxonNameInput.value = action.taxonName;
                    taxonIdInput.value = action.taxonId;
                    taxonNameInput.dataset.taxonId = action.taxonId;
                    taxonNameInput.dispatchEvent(new Event('focus'));
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
        }
    }
}

function loadConfigurations() {
    browserAPI.storage.sync.get(['customButtons', 'observationFieldMap'], function(data) {
        console.log('Loaded data:', data);
        customButtons = data.customButtons || [];
        observationFieldMap = data.observationFieldMap || {};
        displayConfigurations();
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

function displayConfigurations() {
    const container = document.getElementById('buttonConfigs');
    container.innerHTML = '';

    let buttonsToDisplay = [...customButtons];
    
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


    buttonsToDisplay.filter(config => 
        config.name.toLowerCase().includes(searchTerm) ||
        config.actions.some(action => formatAction(action).toLowerCase().includes(searchTerm))
    ).forEach((config) => {
        const configDiv = document.createElement('div');
        configDiv.className = 'config-item';
        configDiv.dataset.id = config.id;
                if (config.configurationDisabled) {
            configDiv.classList.add('disabled-config');
        }

        configDiv.innerHTML = `
            <div class="config-header">
                <span class="config-name">${config.name}</span>
                <span class="config-shortcut">${formatShortcut(config.shortcut)}</span>
                <span class="toggle-details">&#9660;</span>
            </div>
            <div class="config-details" style="display: none;">
                ${config.actions.map(action => `<p>${formatAction(action)}</p>`).join('')}
                 <div class="button-actions">
                    <label><input type="checkbox" class="hide-button-checkbox" ${config.buttonHidden ? 'checked' : ''}> Hide Button</label>
                    <label><input type="checkbox" class="disable-config-checkbox" ${config.configurationDisabled ? 'checked' : ''}> Disable Configuration</label>
                    <button class="edit-button">Edit</button>
                    <button class="duplicate-button">Duplicate</button>
                    <button class="delete-button">Delete</button>
                </div>
            </div>
        `;

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
    });
}

function formatAction(action) {
    switch (action.type) {
        case 'observationField':
            let displayValue = action.displayValue || action.fieldValue;
            return `Add value "${displayValue}" to ${action.fieldName || `Field ${action.fieldId}`}`;
        case 'annotation':
            const fieldName = getAnnotationFieldName(action.annotationField);
            const valueName = getAnnotationValueName(action.annotationField, action.annotationValue);
            return `Set "${fieldName}" to "${valueName}"`;
        case 'addToProject':
            return `Add to project: ${action.projectName || action.projectId}`;
        case 'addComment':
            return `Add comment: "${action.commentBody.substring(0, 30)}${action.commentBody.length > 30 ? '...' : ''}"`;
        case 'addTaxonId':
            let taxonDisplay = `Add taxon ID: ${action.taxonName} (ID: ${action.taxonId})`;
            if (action.comment) {
                taxonDisplay += `\nwith\ncomment: "${action.comment.substring(0, 30)}${action.comment.length > 30 ? '...' : ''}"`;
            }
            return taxonDisplay;
        case 'qualityMetric':
            const metricLabel = qualityMetrics.find(m => m.value === action.metric).label;
            return `Quality Metric: "${metricLabel}" - ${action.vote}`;
        case 'copyObservationField':
            return `Copy value from "${action.sourceFieldName}" to "${action.targetFieldName}"`;
        default:
            return 'Unknown action';       
    }
}

function toggleHideButton(configId, checkbox) {
    const config = customButtons.find(c => c.id === configId);
    if (config) {
        config.buttonHidden = checkbox.checked;
        updateConfigurationDisplay(config);
        saveConfigurations();
    }
}

function toggleDisableConfiguration(configId, checkbox) {
    const config = customButtons.find(c => c.id === configId);
    if (config) {
        config.configurationDisabled = checkbox.checked;
        updateConfigurationDisplay(config);
        saveConfigurations();
    }
}

function updateConfigurationDisplay(config) {
    const configDiv = document.querySelector(`.config-item[data-id="${config.id}"]`);
    if (configDiv) {
        configDiv.classList.toggle('disabled-config', config.configurationDisabled);
    }
}

function saveConfigurations() {
    browserAPI.storage.sync.set({
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
    browserAPI.storage.sync.set(dataToSave, function() {
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

function getAnnotationFieldName(fieldId) {
    for (let [key, value] of Object.entries(controlledTerms)) {
        if (value.id === parseInt(fieldId)) {
            return key;
        }
    }
    return 'Unknown';
}

function getAnnotationValueName(fieldId, valueId) {
    for (let [key, value] of Object.entries(controlledTerms)) {
        if (value.id === parseInt(fieldId)) {
            for (let [valueName, valueIdInner] of Object.entries(value.values)) {
                if (valueIdInner === parseInt(valueId)) {
                    return valueName;
                }
            }
        }
    }
    return 'Unknown';
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
        browserAPI.storage.sync.set({customButtons: customButtons}, function() {
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
        browserAPI.storage.sync.set({customButtons: customButtons}, function() {
            console.log('Configuration visibility toggled');
            loadConfigurations();
        });
    }
}

function deleteConfiguration(configId) {
    if (confirm('Are you sure you want to delete this configuration?')) {
        customButtons = customButtons.filter(c => c.id !== configId);
        browserAPI.storage.sync.set({
            customButtons: customButtons,
            lastConfigUpdate: Date.now()
        }, function() {
            console.log('Configuration deleted and lastConfigUpdate set');
            loadConfigurations();
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
    loadConfigurations();
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

});


function exportConfigurations() {
    const configData = {
        customButtons: customButtons,
        observationFieldMap: observationFieldMap
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iNaturalist_tool_config_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importConfigurations(event) {
    console.log('Starting import process');
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);                
                console.log('Imported data:', importedData);
                mergeConfigurations(importedData);
            } catch (error) {
                alert('Error parsing the imported file. Please make sure it\'s a valid JSON file.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }
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

