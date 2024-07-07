let customButtons = [];
let currentConfig = { actions: [] };
let sortNewestFirst = true;
let searchTerm = '';
let observationFieldMap = {};
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const controlledTerms = {
    "Alive or Dead": {
      id: 17,
      values: {
        "Alive": 18,
        "Dead": 19,
        "Cannot Be Determined": 20
      }
    },
    "Established": {
      id: 33,
      values: {
        "Not Established": 34
      }
    },
    "Life Stage": {
      id: 1,
      values: {
        "Adult": 2,
        "Teneral": 3,
        "Pupa": 4,
        "Nymph": 5,
        "Larva": 6,
        "Egg": 7,
        "Juvenile": 8,
        "Subimago": 16
      }
    },
    "Evidence of Presence": {
      id: 22,
      values: {
        "Feather": 23,
        "Organism": 24,
        "Scat": 25,
        "Gall": 29,
        "Track": 26,
        "Bone": 27,
        "Molt": 28,
        "Egg": 30,
        "Hair": 31,
        "Leafmine": 32,
        "Construction": 35
      }
    },
    "Leaves": {
      id: 36,
      values: {
        "Breaking Leaf Buds": 37,
        "Green Leaves": 38,
        "Colored Leaves": 39,
        "No Live Leaves": 40
      }
    },
    "Sex": {
      id: 9,
      values: {
        "Female": 10,
        "Male": 11,
        "Cannot Be Determined": 20
      }
    },
    "Flowers and Fruits": {
      id: 12,
      values: {
        "Flowers": 13,
        "Fruits or Seeds": 14,
        "Flower Buds": 15,
        "No Flowers or Fruits": 21
      }
    }
};

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



function isShortcutForbidden(shortcut) {
    if (!shortcut) return false; // If no shortcut, it can't be forbidden
    return forbiddenShortcuts.some(forbidden => {
        return Object.keys(forbidden).every(key => 
            key === 'key' ? 
                forbidden[key].toLowerCase() === (shortcut.key || '').toLowerCase() :
                !!forbidden[key] === !!shortcut[key]
        );
    });
}

function toggleSort() {
    sortNewestFirst = !sortNewestFirst;
    updateSortButtonText();
    displayConfigurations();
}

function updateSortButtonText() {
    const button = document.getElementById('toggleSort');
    button.textContent = sortNewestFirst ? 'Sorted Newest First' : 'Sorted Oldest First';
}

function filterConfigurations() {
    searchTerm = document.getElementById('searchInput').value.toLowerCase();
    displayConfigurations();
}

function updateFieldValueInput(field, container) {
    container.innerHTML = '';
    let input;

    switch (field.datatype) {
        case 'text':
        case 'date':
        case 'datetime':
        case 'time':
            input = document.createElement('input');
            input.type = field.datatype;
            break;
        case 'numeric':
            input = document.createElement('input');
            input.type = 'number';
            break;
        case 'boolean':
            input = document.createElement('select');
            ['', 'Yes', 'No'].forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option;
                input.appendChild(opt);
            });
            break;
        case 'taxon':
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'fieldValue taxonInput';
            input.placeholder = 'Enter species name';
            
            const suggestionContainer = document.createElement('div');
            suggestionContainer.className = 'taxonSuggestions';
            container.appendChild(input);
            container.appendChild(suggestionContainer);

            let debounceTimeout;
            input.addEventListener('input', () => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    if (input.value.length < 2) {
                        suggestionContainer.innerHTML = '';
                        return;
                    }
                    lookupTaxon(input.value)
                        .then(taxa => {
                            suggestionContainer.innerHTML = '';
                            taxa.forEach(taxon => {
                                const suggestion = document.createElement('div');
                                suggestion.className = 'taxonSuggestion';
                                suggestion.innerHTML = `
                                    <img src="${taxon.default_photo?.square_url || 'placeholder.jpg'}" alt="${taxon.name}">
                                    <span class="taxon-name">
                                        ${taxon.preferred_common_name ? `${taxon.preferred_common_name} (` : ''}
                                        <a href="https://www.inaturalist.org/taxa/${taxon.id}" target="_blank" class="taxon-link">
                                            ${taxon.name}
                                        </a>
                                        ${taxon.preferred_common_name ? ')' : ''}
                                    </span>
                                `;
                                suggestion.addEventListener('click', (event) => {
                                    if (event.target.tagName !== 'A') {
                                        event.preventDefault();
                                        input.value = taxon.preferred_common_name ? 
                                            `${taxon.preferred_common_name} (${taxon.name})` : 
                                            taxon.name;
                                        input.dataset.taxonId = taxon.id;
                                        suggestionContainer.innerHTML = '';
                                    }
                                });
                                suggestionContainer.appendChild(suggestion);
                            });
                        })
                        .catch(error => console.error('Error fetching taxa:', error));
                }, 300);
            });
            break;
        default:
            input = document.createElement('input');
            input.type = 'text';
    }

    input.className = 'fieldValue';
    input.placeholder = 'Field Value';
    container.appendChild(input);

    if (field.allowed_values && field.datatype !== 'taxon') {
        const allowedValues = field.allowed_values.split('|');
        if (allowedValues.length > 0) {
            const datalist = document.createElement('datalist');
            datalist.id = `allowedValues-${field.id || Date.now()}`;
            allowedValues.forEach(value => {
                const option = document.createElement('option');
                option.value = value.trim();
                datalist.appendChild(option);
            });
            container.appendChild(datalist);
            input.setAttribute('list', datalist.id);
        }
    }
}

function editConfiguration(configId) {
    const config = customButtons.find(c => c.id === configId);
    if (!config) return;
    document.getElementById('buttonName').value = config.name;
    
    if (config.shortcut) {
        document.getElementById('ctrlKey').checked = config.shortcut.ctrlKey;
        document.getElementById('shiftKey').checked = config.shortcut.shiftKey;
        document.getElementById('altKey').checked = config.shortcut.altKey;
        document.getElementById('shortcut').value = config.shortcut.key;
    }

    document.getElementById('actionsContainer').innerHTML = '';
    config.actions.forEach(action => {
        addActionToForm();
        const actionDiv = document.querySelector('.action-item:last-child');
        actionDiv.querySelector('.actionType').value = action.type;
        if (action.type === 'observationField') {
            actionDiv.querySelector('.fieldId').value = action.fieldId;
            actionDiv.querySelector('.fieldName').value = action.fieldName || '';
            lookupObservationField(action.fieldName || action.fieldId)
                .then(fields => {
                    const field = fields.find(f => f.id.toString() === action.fieldId.toString());
                    if (field) {
                        actionDiv.querySelector('.fieldDescription').textContent = field.description;
                        updateFieldValueInput(field, actionDiv.querySelector('.fieldValueContainer'));
                        const fieldValueInput = actionDiv.querySelector('.fieldValue');
                        fieldValueInput.value = action.fieldValue;
                        if (field.datatype === 'taxon' && action.taxonId) {
                            fieldValueInput.dataset.taxonId = action.taxonId;
                        }
                    } else {
                        throw new Error('Field not found');
                    }
                })
                .catch(error => {
                    console.error('Error fetching observation field details:', error);
                    actionDiv.querySelector('.fieldDescription').textContent = 'Error: Unable to fetch field details';
                    // Still populate the field value even if lookup fails
                    const fieldValueInput = actionDiv.querySelector('.fieldValue');
                    fieldValueInput.value = action.fieldValue;
                    if (action.taxonId) {
                        fieldValueInput.dataset.taxonId = action.taxonId;
                    }
                });
        } else if (action.type === 'annotation') {
            const annotationField = actionDiv.querySelector('.annotationField');
            const annotationValue = actionDiv.querySelector('.annotationValue');
            annotationField.value = action.annotationField;
            updateAnnotationValues(annotationField, annotationValue);
            annotationValue.value = action.annotationValue;
        }
        actionDiv.querySelector('.actionType').dispatchEvent(new Event('change'));
    });

    const saveButton = document.getElementById('saveButton');
    saveButton.textContent = 'Update Configuration';
    saveButton.dataset.editIndex = configId;

    window.scrollTo(0, 0);
}

function lookupTaxon(query, per_page = 10) {
    const baseUrl = 'https://api.inaturalist.org/v1/taxa/autocomplete';
    const params = new URLSearchParams({
        q: query,
        per_page: per_page
    });
    const url = `${baseUrl}?${params.toString()}`;

    return fetch(url)
        .then(response => response.json())
        .then(data => data.results.map(taxon => ({
            ...taxon,
            displayName: taxon.preferred_common_name ? `${taxon.preferred_common_name} (${taxon.name})` : taxon.name
        })));
}

function addActionToForm() {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'action-item';
    actionDiv.innerHTML = `
        <select class="actionType">
            <option value="observationField">Observation Field</option>
            <option value="annotation">Annotation</option>
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
        <button class="removeActionButton">Remove Action</button>
    `;
    document.getElementById('actionsContainer').appendChild(actionDiv);

    const actionType = actionDiv.querySelector('.actionType');
    const ofInputs = actionDiv.querySelector('.ofInputs');
    const annotationInputs = actionDiv.querySelector('.annotationInputs');
    const annotationField = actionDiv.querySelector('.annotationField');
    const annotationValue = actionDiv.querySelector('.annotationValue');
    const removeButton = actionDiv.querySelector('.removeActionButton');

    actionType.addEventListener('change', () => {
        ofInputs.style.display = actionType.value === 'observationField' ? 'block' : 'none';
        annotationInputs.style.display = actionType.value === 'annotation' ? 'block' : 'none';
    });

    populateAnnotationFields(annotationField);
    annotationField.addEventListener('change', () => updateAnnotationValues(annotationField, annotationValue));

    removeButton.addEventListener('click', () => actionDiv.remove());

    const fieldNameInput = actionDiv.querySelector('.fieldName');
    const fieldIdInput = actionDiv.querySelector('.fieldId');
    const fieldValueContainer = actionDiv.querySelector('.fieldValueContainer');
    const fieldDescription = actionDiv.querySelector('.fieldDescription');

    let justSelected = false;
    let autocompleteTimeout;
    fieldNameInput.addEventListener('input', () => {
    if (justSelected) {
        justSelected = false;
        return;
    }
    clearTimeout(autocompleteTimeout);
    autocompleteTimeout = setTimeout(() => {
        if (fieldNameInput.value.length < 2) return;

            lookupObservationField(fieldNameInput.value)
                .then(fields => {
                    // Create and populate datalist
                    let datalist = document.getElementById('observationFieldsList') || document.createElement('datalist');
                    datalist.id = 'observationFieldsList';
                    datalist.innerHTML = '';
                    fields.forEach(field => {
                        const option = document.createElement('option');
                        option.value = field.name;
                        option.dataset.id = field.id;
                        option.dataset.description = field.description;
                        option.dataset.datatype = field.datatype;
                        option.dataset.allowed_values = field.allowed_values;
                        datalist.appendChild(option);
                    });
                    document.body.appendChild(datalist);
                    fieldNameInput.setAttribute('list', 'observationFieldsList');
                })
                .catch(error => console.error('Error fetching observation fields:', error));
        }, 300);
    });

    fieldNameInput.addEventListener('change', () => {
        justSelected = true;
        const selectedOption = document.querySelector(`#observationFieldsList option[value="${fieldNameInput.value}"]`);
        if (selectedOption) {
            fieldIdInput.value = selectedOption.dataset.id;
            fieldDescription.textContent = selectedOption.dataset.description;
            updateFieldValueInput({
                id: selectedOption.dataset.id,
                datatype: selectedOption.dataset.datatype,
                allowed_values: selectedOption.dataset.allowed_values
            }, fieldValueContainer);
        }
        const datalist = document.getElementById('observationFieldsList');
    if (datalist) {
        datalist.innerHTML = '';
    }
    // Remove focus from the input
    fieldNameInput.blur();
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
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
    if (sortNewestFirst) {
        buttonsToDisplay.reverse();
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
    if (action.type === 'observationField') {
        let displayValue = action.displayValue || action.fieldValue;
        return `Add value "${displayValue}" to ${action.fieldName || `Field ${action.fieldId}`}`;
    } else {
        const fieldName = getAnnotationFieldName(action.annotationField);
        const valueName = getAnnotationValueName(action.annotationField, action.annotationValue);
        return `Set "${fieldName}" to "${valueName}"`;
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
        // Update other visual indicators as needed
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

function duplicateConfiguration(configId) {
    const config = customButtons.find(c => c.id === configId);
    if (!config) return;
    document.getElementById('buttonName').value = `${config.name} (Copy)`;
    
    if (config.shortcut) {
        document.getElementById('ctrlKey').checked = config.shortcut.ctrlKey;
        document.getElementById('shiftKey').checked = config.shortcut.shiftKey;
        document.getElementById('altKey').checked = config.shortcut.altKey;
        document.getElementById('shortcut').value = config.shortcut.key;
    }

    document.getElementById('actionsContainer').innerHTML = '';
    config.actions.forEach(action => {
        addActionToForm();
        const actionDiv = document.querySelector('.action-item:last-child');
        actionDiv.querySelector('.actionType').value = action.type;
        if (action.type === 'observationField') {
            actionDiv.querySelector('.fieldId').value = action.fieldId;
            actionDiv.querySelector('.fieldName').value = action.fieldName || '';
            lookupObservationField(action.fieldName || action.fieldId)
                .then(fields => {
                    const field = fields.find(f => f.id.toString() === action.fieldId.toString());
                    if (field) {
                        actionDiv.querySelector('.fieldDescription').textContent = field.description;
                        updateFieldValueInput(field, actionDiv.querySelector('.fieldValueContainer'));
                        const fieldValueInput = actionDiv.querySelector('.fieldValue');
                        fieldValueInput.value = action.fieldValue;
                        if (field.datatype === 'taxon' && action.taxonId) {
                            fieldValueInput.dataset.taxonId = action.taxonId;
                        }
                    } else {
                        throw new Error('Field not found');
                    }
                })
                .catch(error => {
                    console.error('Error fetching observation field details:', error);
                    actionDiv.querySelector('.fieldDescription').textContent = 'Error: Unable to fetch field details';
                    // Still populate the field value even if lookup fails
                    const fieldValueInput = actionDiv.querySelector('.fieldValue');
                    fieldValueInput.value = action.fieldValue;
                    if (action.taxonId) {
                        fieldValueInput.dataset.taxonId = action.taxonId;
                    }
                });
        } else if (action.type === 'annotation') {
            const annotationField = actionDiv.querySelector('.annotationField');
            const annotationValue = actionDiv.querySelector('.annotationValue');
            annotationField.value = action.annotationField;
            updateAnnotationValues(annotationField, annotationValue);
            annotationValue.value = action.annotationValue;
        }
        actionDiv.querySelector('.actionType').dispatchEvent(new Event('change'));
    });

    const saveButton = document.getElementById('saveButton');
    saveButton.textContent = 'Save New Configuration';
    delete saveButton.dataset.editIndex;

    window.scrollTo(0, 0);
}
function saveConfiguration() {
    const name = document.getElementById('buttonName').value.trim();
    const shortcutKey = document.getElementById('shortcut').value.trim().toUpperCase();
    const ctrlKey = document.getElementById('ctrlKey').checked;
    const shiftKey = document.getElementById('shiftKey').checked;
    const altKey = document.getElementById('altKey').checked;
    
    // Validation checks...
    if (!name) {
        alert("Please enter a button name.");
        return;
    }

    const editIndex = document.getElementById('saveButton').dataset.editIndex;

    let shortcutConfig = null;
    if (shortcutKey || ctrlKey || shiftKey || altKey) {
        shortcutConfig = {
            ctrlKey: ctrlKey,
            shiftKey: shiftKey,
            altKey: altKey,
            key: shortcutKey
        };

        if (isShortcutForbidden(shortcutConfig)) {
            alert("This shortcut is not allowed as it conflicts with browser functionality or extension shortcuts.");
            return;
        }

        const conflictingShortcut = customButtons.find((button, index) => {
            if (editIndex && button.id === editIndex) {
                return false; // Skip the current button being edited
            }
            return button.shortcut &&
                   button.shortcut.key === shortcutKey &&
                   button.shortcut.ctrlKey === ctrlKey &&
                   button.shortcut.shiftKey === shiftKey &&
                   button.shortcut.altKey === altKey;
        });

        if (conflictingShortcut) {
            alert(`This shortcut is already used for the button: "${conflictingShortcut.name}". Please choose a different shortcut.`);
            return;
        }
    }

    const newConfig = {
        id: editIndex || Date.now().toString(),
        name: name,
        shortcut: shortcutConfig,
        actions: [],
        buttonHidden: false,
        configurationDisabled: false
    };

    document.querySelectorAll('.action-item').forEach(actionDiv => {
        const actionTypeElement = actionDiv.querySelector('.actionType');
        if (!actionTypeElement) return; // Skip if element not found

        const actionType = actionTypeElement.value;
        const action = { type: actionType };

        if (actionType === 'observationField') {
            const fieldIdElement = actionDiv.querySelector('.fieldId');
            const fieldNameElement = actionDiv.querySelector('.fieldName');
            const fieldValueElement = actionDiv.querySelector('.fieldValue');
            if (fieldIdElement && fieldNameElement && fieldValueElement) {
                action.fieldId = fieldIdElement.value.trim();
                action.fieldName = fieldNameElement.value.trim();
                if (fieldValueElement.dataset.taxonId) {
                    action.fieldValue = fieldValueElement.dataset.taxonId; // Use the taxon ID
                    action.displayValue = fieldValueElement.value; // Store the display name
                } else {
                    action.fieldValue = fieldValueElement.value.trim();
                    action.displayValue = action.fieldValue; // For non-taxon fields, display value is the same as field value
                }
                if (!action.fieldId || !action.fieldName || !action.fieldValue) {
                    alert("Please enter Field Name, ID, and Value for all Observation Field actions.");
                    return;
                }
            }
        } else {
            const annotationFieldElement = actionDiv.querySelector('.annotationField');
            const annotationValueElement = actionDiv.querySelector('.annotationValue');
            if (annotationFieldElement && annotationValueElement) {
                action.annotationField = annotationFieldElement.value;
                action.annotationValue = annotationValueElement.value;
                if (!action.annotationField || !action.annotationValue) {
                    alert("Please select both Annotation Field and Annotation Value for all Annotation actions.");
                    return;
                }
            }
        }

        newConfig.actions.push(action);
    });


    // Check if a modifier is selected but no key is specified
    if ((ctrlKey || shiftKey || altKey) && !shortcutKey) {
        alert("You've selected a modifier key (Ctrl, Shift, or Alt) but haven't specified a key. Please either add a key or uncheck the modifier(s).");
        return;
    }

    // Check for conflicts with iNat shortcuts
    if (!ctrlKey && !shiftKey && !altKey && iNatSingleKeyPresses.includes(shortcutKey.toLowerCase())) {
        alert("This key is already used by iNaturalist shortcuts. Please choose a different key or add a modifier.");
        return;
    }


    if (isShortcutForbidden(newConfig.shortcut)) {
        alert("This shortcut is already in use by this extension or the browser.");
        return;
    }

    if (newConfig.actions.length === 0) {
        alert("Please add at least one action to the configuration.");
        return;
    }

    if (editIndex) {
        const index = customButtons.findIndex(config => config.id === editIndex);
        if (index !== -1) {
            customButtons[index] = newConfig;
        }
    } else {
        customButtons.push(newConfig);
    }

    browserAPI.storage.sync.set({
        customButtons: customButtons,
        observationFieldMap: observationFieldMap,
        lastConfigUpdate: Date.now(),
    }, function() {
        console.log('Configuration and settings saved');
        loadConfigurations();
        clearForm();
    });
}

function lookupObservationField(name, perPage = 10) {
    return new Promise((resolve, reject) => {
        const baseUrl = 'https://api.inaturalist.org/v1/observation_fields/autocomplete';
        const params = new URLSearchParams({
            q: name,
            per_page: perPage
        });
        const url = `${baseUrl}?${params.toString()}`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.results && data.results.length > 0) {
                    resolve(data.results);
                } else {
                    reject(new Error('No observation fields found'));
                }
            })
            .catch(reject);
    });
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
    document.getElementById('toggleSort').addEventListener('click', toggleSort);
    document.getElementById('searchInput').addEventListener('input', filterConfigurations);
    updateSortButtonText();
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
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                mergeConfigurations(importedData);
            } catch (error) {
                alert('Error parsing the imported file. Please make sure it\'s a valid JSON file.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }
}

function mergeConfigurations(importedData) {
    const newButtons = importedData.customButtons || [];
    const conflicts = [];

    newButtons.forEach(newButton => {
        const existingButton = customButtons.find(b => b.name === newButton.name);
        if (existingButton) {
            conflicts.push({existing: existingButton, imported: newButton});
        } else {
            const shortcutConflict = customButtons.find(b => 
                b.shortcut && newButton.shortcut &&
                b.shortcut.ctrlKey === newButton.shortcut.ctrlKey &&
                b.shortcut.shiftKey === newButton.shortcut.shiftKey &&
                b.shortcut.altKey === newButton.shortcut.altKey &&
                b.shortcut.key === newButton.shortcut.key
            );
            if (shortcutConflict) {
                conflicts.push({existing: shortcutConflict, imported: newButton, type: 'shortcut'});
            } else {
                customButtons.push(newButton);
            }
        }
    });

    const saveAndNotify = () => {
        browserAPI.storage.sync.set({
            customButtons: customButtons,
            observationFieldMap: {...observationFieldMap, ...(importedData.observationFieldMap || {})},
            lastConfigUpdate: Date.now()
        }, function() {
            console.log('Configurations merged and lastConfigUpdate set');
            loadConfigurations();
            alert('Import completed successfully.');
        });
    };

    if (conflicts.length > 0) {
        resolveConflicts(conflicts, saveAndNotify);
    } else {
        saveAndNotify();
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

