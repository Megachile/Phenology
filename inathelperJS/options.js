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

const iNatSingleKeyPresses = [
    'x', 'r', 'c', 'a', 'i', 'f', 'z', 'space', 'left', 'right', 'up', 'down', '?',
    'e', 'l', 's', 'p'
];

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
        if (config.configurationDisabled) {
            configDiv.classList.add('disabled-config');
        }
        let configContent = `
            <h3>${config.name}</h3>
            <p>Shortcut: ${formatShortcut(config.shortcut)}</p>
             <p>Action: ${config.actionType === 'observationField' ? 'Observation Field' : 'Annotation'}</p>
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
    const config = customButtons[index];
    
    // Populate form fields with the configuration data
    document.getElementById('buttonName').value = `${config.name} (Copy)`;
    document.getElementById('ctrlKey').checked = config.shortcut.ctrlKey;
    document.getElementById('shiftKey').checked = config.shortcut.shiftKey;
    document.getElementById('altKey').checked = config.shortcut.altKey;
    document.getElementById('shortcut').value = config.shortcut.key;

    setActionType(config.actionType);
    if (config.actionType === 'observationField') {
        document.getElementById('fieldId').value = config.fieldId;
        document.getElementById('fieldValue').value = config.fieldValue;
    } else {
        document.getElementById('annotationField').value = config.annotationField;
        updateAnnotationValues();
        document.getElementById('annotationValue').value = config.annotationValue;
    }

    // Change the save button text and functionality
    const saveButton = document.getElementById('saveButton');
    saveButton.textContent = 'Save New Configuration';
    delete saveButton.dataset.editIndex; // Remove the edit index to treat this as a new configuration
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

    // Check for conflicts with existing custom shortcuts
    const editIndex = parseInt(document.getElementById('saveButton').dataset.editIndex);
    const conflictingShortcut = customButtons.find((button, index) => 
        button.shortcut &&
        button.shortcut.key === shortcutKey &&
        button.shortcut.ctrlKey === ctrlKey &&
        button.shortcut.shiftKey === shiftKey &&
        button.shortcut.altKey === altKey &&
        index !== editIndex  // Exclude the current configuration if we're editing
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
        actionType: currentActionType,
        buttonHidden: false,
        configurationDisabled: false
    };

    if (currentActionType === 'observationField') {
        const fieldId = document.getElementById('fieldId').value.trim();
        const fieldValue = document.getElementById('fieldValue').value.trim();
        if (!fieldId || !fieldValue) {
            alert("Please enter both Field ID and Field Value for Observation Field.");
            return;
        }
        newConfig.fieldId = fieldId;
        newConfig.fieldValue = fieldValue;
    } else {
        const annotationField = document.getElementById('annotationField').value;
        const annotationValue = document.getElementById('annotationValue').value;
        if (!annotationField || !annotationValue) {
            alert("Please select both Annotation Field and Annotation Value.");
            return;
        }
        newConfig.annotationField = annotationField;
        newConfig.annotationValue = annotationValue;
    }

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
    document.querySelector('.hide-button-checkbox').checked = config.buttonHidden || false;
    document.querySelector('.disable-config-checkbox').checked = config.configurationDisabled || false;
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