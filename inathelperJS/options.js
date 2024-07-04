let customButtons = [];
let currentConfig = { actions: [] };

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

function addActionToForm() {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'action-item';
    actionDiv.innerHTML = `
        <select class="actionType">
            <option value="observationField">Observation Field</option>
            <option value="annotation">Annotation</option>
        </select>
        <div class="ofInputs">
            <input type="number" class="fieldId" placeholder="Observation Field ID">
            <input type="text" class="fieldValue" placeholder="Field Value">
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
        return config;
    });
}

function toggleHideConfiguration(index) {
    customButtons[index].hidden = !customButtons[index].hidden;
    chrome.storage.sync.set({customButtons: customButtons}, function() {
        console.log('Configuration visibility toggled');
        loadConfigurations();
    });
}

function displayConfigurations() {
    const container = document.getElementById('buttonConfigs');
    container.innerHTML = '';
    customButtons.forEach((config, index) => {
        const configDiv = document.createElement('div');
        configDiv.className = 'config-item';
        if (config.configurationDisabled) {
            configDiv.classList.add('disabled-config');
        }
        let configContent = `
            <h3>${config.name}</h3>
            <p>Shortcut: ${formatShortcut(config.shortcut)}</p>
            <h4>Actions:</h4>
        `;

        config.actions.forEach((action, actionIndex) => {
            configContent += `
                <p>Action ${actionIndex + 1}: ${action.type === 'observationField' ? 'Observation Field' : 'Annotation'}</p>
            `;
            if (action.type === 'observationField') {
                configContent += `
                    <p>Field ID: ${action.fieldId}</p>
                    <p>Field Value: ${action.fieldValue}</p>
                `;
            } else {
                configContent += `
                    <p>Annotation: ${getAnnotationFieldName(action.annotationField)}</p>
                    <p>Value: ${getAnnotationValueName(action.annotationField, action.annotationValue)}</p>
                `;
            }
        });
        
        configContent += `
            <div class="button-actions">
                <label class="hide-checkbox-label">
                    <input type="checkbox" class="hide-button-checkbox" ${config.buttonHidden ? 'checked' : ''}>
                    <span>Hide Button</span>
                </label>
                <label class="disable-checkbox-label">
                    <input type="checkbox" class="disable-config-checkbox" ${config.configurationDisabled ? 'checked' : ''}>
                    <span>Disable Configuration</span>
                </label>
                <button class="edit-button">Edit</button>
                <button class="duplicate-button">Duplicate</button>
                <button class="delete-button">Delete</button>
            </div>
        `;
        
        configDiv.innerHTML = configContent;

        const hideButtonCheckbox = configDiv.querySelector('.hide-button-checkbox');
        const disableConfigCheckbox = configDiv.querySelector('.disable-config-checkbox');
        const editButton = configDiv.querySelector('.edit-button');
        const deleteButton = configDiv.querySelector('.delete-button');
        const duplicateButton = configDiv.querySelector('.duplicate-button');

        duplicateButton.addEventListener('click', () => duplicateConfiguration(index));
        hideButtonCheckbox.addEventListener('change', () => toggleHideButton(index));
        disableConfigCheckbox.addEventListener('change', () => toggleDisableConfiguration(index));
        editButton.addEventListener('click', () => editConfiguration(index));
        deleteButton.addEventListener('click', () => deleteConfiguration(index));

        container.appendChild(configDiv);
    });
}

function toggleHideButton(index) {
    customButtons[index].buttonHidden = !customButtons[index].buttonHidden;
    saveAndReloadConfigurations();
  }
  
  function toggleDisableConfiguration(index) {
    customButtons[index].configurationDisabled = !customButtons[index].configurationDisabled;
    saveAndReloadConfigurations();
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

function duplicateConfiguration(index) {
    const config = JSON.parse(JSON.stringify(customButtons[index])); // Deep copy
    config.name += ' (Copy)';
    customButtons.push(config);
    chrome.storage.sync.set({customButtons: customButtons}, function() {
        console.log('Configuration duplicated');
        loadConfigurations();
    });
}

function saveConfiguration() {
    const name = document.getElementById('buttonName').value.trim();
    const shortcutKey = document.getElementById('shortcut').value.trim().toUpperCase();
    const ctrlKey = document.getElementById('ctrlKey').checked;
    const shiftKey = document.getElementById('shiftKey').checked;
    const altKey = document.getElementById('altKey').checked;
    
    // Validation checks
    if (!name) {
        alert("Please enter a button name.");
        return;
    }

    if ((ctrlKey || shiftKey || altKey) && !shortcutKey) {
        alert("You've selected a modifier key (Ctrl, Shift, or Alt) but haven't specified a key. Please either add a key or uncheck the modifier(s).");
        return;
    }

    if (!ctrlKey && !shiftKey && !altKey && iNatSingleKeyPresses.includes(shortcutKey.toLowerCase())) {
        alert("This key is already used by iNaturalist shortcuts. Please choose a different key or add a modifier.");
        return;
    }

    const editIndex = parseInt(document.getElementById('saveButton').dataset.editIndex);
    const conflictingShortcut = customButtons.find((button, index) => 
        button.shortcut &&
        button.shortcut.key === shortcutKey &&
        button.shortcut.ctrlKey === ctrlKey &&
        button.shortcut.shiftKey === shiftKey &&
        button.shortcut.altKey === altKey &&
        index !== editIndex
    );

    if (conflictingShortcut) {
        alert(`This shortcut is already used for the button: "${conflictingShortcut.name}". Please choose a different shortcut.`);
        return;
    }

    const newConfig = {
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
        const actionType = actionDiv.querySelector('.actionType').value;
        const action = { type: actionType };

        if (actionType === 'observationField') {
            action.fieldId = actionDiv.querySelector('.fieldId').value.trim();
            action.fieldValue = actionDiv.querySelector('.fieldValue').value.trim();
            if (!action.fieldId || !action.fieldValue) {
                alert("Please enter both Field ID and Field Value for all Observation Field actions.");
                return;
            }
        } else {
            action.annotationField = actionDiv.querySelector('.annotationField').value;
            action.annotationValue = actionDiv.querySelector('.annotationValue').value;
            if (!action.annotationField || !action.annotationValue) {
                alert("Please select both Annotation Field and Annotation Value for all Annotation actions.");
                return;
            }
        }

        newConfig.actions.push(action);
    });

    if (newConfig.actions.length === 0) {
        alert("Please add at least one action to the configuration.");
        return;
    }

    if (!isNaN(editIndex)) {
        customButtons[editIndex] = newConfig;
    } else {
        customButtons.push(newConfig);
    }

    chrome.storage.sync.set({customButtons: customButtons}, function() {
        console.log('Configuration saved');
        loadConfigurations();
        clearForm();
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

function editConfiguration(index) {
    const config = customButtons[index];
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
            actionDiv.querySelector('.fieldValue').value = action.fieldValue;
        } else {
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
    saveButton.dataset.editIndex = index;
}
function updateConfiguration(index) {
    const updatedConfig = {
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

    customButtons[index] = updatedConfig;  // Replace the existing config instead of adding a new one
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

function deleteConfiguration(index) {
    if (confirm('Are you sure you want to delete this configuration?')) {
        customButtons.splice(index, 1);
        chrome.storage.sync.set({customButtons: customButtons}, function() {
            console.log('Configuration deleted');
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

document.addEventListener('DOMContentLoaded', function() {
    loadConfigurations();
    document.getElementById('saveButton').addEventListener('click', saveConfiguration);
    document.getElementById('cancelButton').addEventListener('click', clearForm);
    document.getElementById('addActionButton').addEventListener('click', addActionToForm);
});

