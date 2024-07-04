let customButtons = [];
let currentConfig = { actions: [] };
let sortNewestFirst = true;
let searchTerm = '';
let observationFieldMap = {};

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
                                    <span>${taxon.name}</span>
                                `;
                                suggestion.addEventListener('click', () => {
                                    input.value = taxon.name;
                                    input.dataset.taxonId = taxon.id;
                                    suggestionContainer.innerHTML = '';
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
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => data.results);
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

    let autocompleteTimeout;
    fieldNameInput.addEventListener('input', () => {
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
    chrome.storage.sync.get('customButtons', function(data) {
        customButtons = data.customButtons || [];
        customButtons = migrateConfigurations(customButtons);
        chrome.storage.sync.set({customButtons: customButtons}, function() {
            console.log('Configurations migrated and saved');
            displayConfigurations();
        });
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

        hideButtonCheckbox.addEventListener('change', () => toggleHideButton(config.id));
        disableConfigCheckbox.addEventListener('change', () => toggleDisableConfiguration(config.id));
        editButton.addEventListener('click', () => editConfiguration(config.id));
        deleteButton.addEventListener('click', () => deleteConfiguration(config.id));
        duplicateButton.addEventListener('click', () => duplicateConfiguration(config.id));

        container.appendChild(configDiv);
    });
}

function formatAction(action) {
    if (action.type === 'observationField') {
        let value = action.fieldValue;
        if (action.taxonId) {
            value = `${action.fieldValue} (ID: ${action.taxonId})`;
        }
        return `Add value "${value}" to ${action.fieldName || `Field ${action.fieldId}`}`;
    } else {
        const fieldName = getAnnotationFieldName(action.annotationField);
        const valueName = getAnnotationValueName(action.annotationField, action.annotationValue);
        return `Set "${fieldName}" to "${valueName}"`;
    }
}

function toggleHideButton(configId) {
    const config = customButtons.find(c => c.id === configId);
    if (config) {
        config.buttonHidden = !config.buttonHidden;
        saveAndReloadConfigurations();
    }
}

function toggleDisableConfiguration(configId) {
    const config = customButtons.find(c => c.id === configId);
    if (config) {
        config.configurationDisabled = !config.configurationDisabled;
        saveAndReloadConfigurations();
    }
}
  
function saveAndReloadConfigurations() {
    chrome.storage.sync.set({customButtons: customButtons}, function() {
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
            actionDiv.querySelector('.fieldValue').value = action.fieldValue;
        } else {
            const annotationField = actionDiv.querySelector('.annotationField');
            const annotationValue = actionDiv.querySelector('.annotationValue');
            populateAnnotationFields(annotationField);
            annotationField.value = action.annotationField;
            updateAnnotationValues(annotationField, annotationValue);
            annotationValue.value = action.annotationValue;
        }
        actionDiv.querySelector('.actionType').dispatchEvent(new Event('change'));
    });

    const saveButton = document.getElementById('saveButton');
    saveButton.textContent = 'Save New Configuration';
    delete saveButton.dataset.editIndex;

    // Scroll to the top of the page
    window.scrollTo(0, 0);
}

function saveConfiguration() {
    const name = document.getElementById('buttonName').value.trim();
    const shortcutKey = document.getElementById('shortcut').value.trim().toUpperCase();
    const ctrlKey = document.getElementById('ctrlKey').checked;
    const shiftKey = document.getElementById('shiftKey').checked;
    const altKey = document.getElementById('altKey').checked;
    
    // Validation checks...

    const newConfig = {
        id: Date.now().toString(), // Unique identifier
        name: name,
        shortcut: {
            ctrlKey: ctrlKey,
            shiftKey: shiftKey,
            altKey: altKey,
            key: shortcutKey
        },
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
                action.fieldValue = fieldValueElement.value.trim();
                if (fieldValueElement.dataset.taxonId) {
                    action.taxonId = fieldValueElement.dataset.taxonId;
                    action.fieldValue = fieldValueElement.value; // This should be the taxon name
                } else {
                    action.fieldValue = fieldValueElement.value.trim();
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

    if (newConfig.actions.length === 0) {
        alert("Please add at least one action to the configuration.");
        return;
    }

    const editIndex = document.getElementById('saveButton').dataset.editIndex;
    if (editIndex) {
        const index = customButtons.findIndex(config => config.id === editIndex);
        if (index !== -1) {
            customButtons[index] = newConfig;
        }
    } else {
        customButtons.push(newConfig);
    }

    chrome.storage.sync.set({customButtons: customButtons, observationFieldMap: observationFieldMap}, function() {
        console.log('Configuration and field map saved');
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
        chrome.storage.sync.set({customButtons: customButtons}, function() {
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
        chrome.storage.sync.set({customButtons: customButtons}, function() {
            console.log('Configuration visibility toggled');
            loadConfigurations();
        });
    }
}

function deleteConfiguration(configId) {
    if (confirm('Are you sure you want to delete this configuration?')) {
        customButtons = customButtons.filter(c => c.id !== configId);
        saveAndReloadConfigurations();
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
});

