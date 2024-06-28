let customButtons = [];
let currentActionType = 'observationField';

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

function loadConfigurations() {
    chrome.storage.sync.get('customButtons', function(data) {
        customButtons = data.customButtons || [];
        displayConfigurations();
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
        if (config.hidden) {
            configDiv.classList.add('hidden-config');
        }
        let configContent = `
            <h3>${config.name}</h3>
            <p>Shortcut: ${formatShortcut(config.shortcut)}</p>
            <p>Action: ${config.actionType}</p>
        `;

        if (config.actionType === 'observationField') {
            configContent += `
                <p>Field ID: ${config.fieldId}</p>
                <p>Field Value: ${config.fieldValue}</p>
            `;
        } else {
            configContent += `
                <p>Annotation: ${getAnnotationFieldName(config.annotationField)}</p>
                <p>Value: ${getAnnotationValueName(config.annotationField, config.annotationValue)}</p>
            `;
        }
        
        configContent += `
            <div class="button-actions">
                <label class="hide-checkbox-label">
                    <input type="checkbox" class="hide-checkbox" ${config.hidden ? 'checked' : ''}>
                    <span>Hide</span>
                </label>
                <button class="edit-button">Edit</button>
                <button class="delete-button">Delete</button>
            </div>
        `;
        
        configDiv.innerHTML = configContent;

        const hideCheckbox = configDiv.querySelector('.hide-checkbox');
        const editButton = configDiv.querySelector('.edit-button');
        const deleteButton = configDiv.querySelector('.delete-button');

        hideCheckbox.addEventListener('change', () => toggleHideConfiguration(index));
        editButton.addEventListener('click', () => editConfiguration(index));
        deleteButton.addEventListener('click', () => deleteConfiguration(index));

        container.appendChild(configDiv);
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

function saveConfiguration() {
    const newConfig = {
        name: document.getElementById('buttonName').value,
        shortcut: {
            ctrlKey: document.getElementById('ctrlKey').checked,
            shiftKey: document.getElementById('shiftKey').checked,
            altKey: document.getElementById('altKey').checked,
            key: document.getElementById('shortcut').value.toUpperCase()
        },
        actionType: currentActionType,
        hidden: false 
    };

    if (currentActionType === 'observationField') {
        newConfig.fieldId = document.getElementById('fieldId').value;
        newConfig.fieldValue = document.getElementById('fieldValue').value;
    } else {
        newConfig.annotationField = document.getElementById('annotationField').value;
        newConfig.annotationValue = document.getElementById('annotationValue').value;
    }

    // Check if we're editing an existing config or creating a new one
    const editIndex = parseInt(document.getElementById('saveButton').dataset.editIndex);
    
    if (!isNaN(editIndex)) {
        // We're editing an existing config
        customButtons[editIndex] = newConfig;
    } else {
        // We're creating a new config
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
    setActionType('observationField');
    document.getElementById('fieldId').value = '';
    document.getElementById('fieldValue').value = '';
    document.getElementById('annotationField').selectedIndex = 0;
    document.getElementById('annotationValue').selectedIndex = 0;
    // Reset the save button
    const saveButton = document.getElementById('saveButton');
    saveButton.textContent = 'Save Configuration';
    delete saveButton.dataset.editIndex; // Remove the edit index
}

function editConfiguration(index) {
    const config = customButtons[index];
    document.getElementById('buttonName').value = config.name;
    
    // Set shortcut checkboxes and key
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

    setActionType(config.actionType);
    if (config.actionType === 'observationField') {
        document.getElementById('fieldId').value = config.fieldId;
        document.getElementById('fieldValue').value = config.fieldValue;
    } else {
        document.getElementById('annotationField').value = config.annotationField;
        updateAnnotationValues();
        document.getElementById('annotationValue').value = config.annotationValue;
    }
    if (config.hidden !== undefined) {
        document.querySelector('.hide-checkbox').checked = config.hidden;
    }
    // Change the save button text and functionality
    const saveButton = document.getElementById('saveButton');
    saveButton.textContent = 'Update Configuration';
    saveButton.dataset.editIndex = index; // Store the index we're editing
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

function populateAnnotationFields() {
    const select = document.getElementById('annotationField');
    select.innerHTML = '';
    Object.keys(controlledTerms).forEach(term => {
        const option = document.createElement('option');
        option.value = controlledTerms[term].id;
        option.textContent = term;
        select.appendChild(option);
    });
}

function updateAnnotationValues() {
    const fieldSelect = document.getElementById('annotationField');
    const valueSelect = document.getElementById('annotationValue');
    valueSelect.innerHTML = '';
    valueSelect.classList.remove('hidden');

    const selectedField = controlledTerms[fieldSelect.options[fieldSelect.selectedIndex].text];
    Object.entries(selectedField.values).forEach(([key, value]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = key;
        valueSelect.appendChild(option);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    loadConfigurations();
    populateAnnotationFields();
    document.getElementById('saveButton').addEventListener('click', saveConfiguration);
    document.getElementById('cancelButton').addEventListener('click', clearForm);
    document.getElementById('ofButton').addEventListener('click', () => setActionType('observationField'));
    document.getElementById('annotationButton').addEventListener('click', () => setActionType('annotation'));
    document.getElementById('annotationField').addEventListener('change', updateAnnotationValues);
});