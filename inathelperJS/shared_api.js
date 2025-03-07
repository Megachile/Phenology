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

let currentJWT = null;
const API_URL = 'https://api.inaturalist.org/v1';

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

function lookupProject(query, perPage = 10) {
    const baseUrl = 'https://api.inaturalist.org/v1/projects';
    const params = new URLSearchParams({
        q: query,
        per_page: perPage,
        order_by: 'observation_count',
        order: 'desc'
    });
    const url = `${baseUrl}?${params.toString()}`;

    return fetch(url)
        .then(response => response.json())
        .then(data => data.results.map(project => ({
            ...project,
            displayName: `${project.title}`
        })));
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
                    const fieldsWithUsage = data.results.map(field => ({
                        ...field,
                        usageCount: field.values_count || 0 // Assuming 'values_count' represents usage
                    }));
                    resolve(fieldsWithUsage);
                } else {
                    reject(new Error('No observation fields found'));
                }
            })
            .catch(reject);
    });
}

function lookupPlace(query, perPage = 10) {
    const baseUrl = 'https://api.inaturalist.org/v1/places/autocomplete';
    const params = new URLSearchParams({
        q: query,
        per_page: perPage
    });
    const url = `${baseUrl}?${params.toString()}`;

    return fetch(url)
        .then(response => response.json())
        .then(data => data.results);
}

function lookupUser(query, perPage = 10) {
    const baseUrl = 'https://api.inaturalist.org/v1/users/autocomplete';
    const params = new URLSearchParams({
        q: query,
        per_page: perPage
    });
    const url = `${baseUrl}?${params.toString()}`;

    return fetch(url)
        .then(response => response.json())
        .then(data => data.results.map(user => ({
            ...user,
            displayName: `${user.login} (${user.name || ''})`,
            icon_url: user.icon_url
        })));
}

function setupAutocompleteDropdown(inputElement, lookupFunction, onSelectFunction) {
    const suggestionContainer = document.createElement('div');
    suggestionContainer.className = 'autocomplete-suggestions';
    inputElement.parentNode.insertBefore(suggestionContainer, inputElement.nextSibling);

    let debounceTimeout;
    inputElement.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            if (inputElement.value.length < 2) {
                suggestionContainer.innerHTML = '';
                suggestionContainer.style.display = 'none'; // Hide when input is too short
                return;
            }
            lookupFunction(inputElement.value)
            .then(results => {
                suggestionContainer.innerHTML = '';
                if (results.length > 0) {
                    suggestionContainer.style.display = 'block'; // Show when there are results
                    results.forEach(result => {
                        const suggestion = document.createElement('div');
                        suggestion.className = 'autocomplete-suggestion';
                        if (result.icon_url) {
                            suggestion.innerHTML = `<img src="${result.icon_url}" alt="${result.login}" style="width: 30px; height: 30px; margin-right: 10px;">`;
                        }
                        suggestion.innerHTML += result.displayName || result.name || result.title || result.login;
                        if (result.usageCount !== undefined) {
                            suggestion.innerHTML += ` (${result.usageCount} uses)`;
                        }
                        suggestion.addEventListener('click', () => {
                            onSelectFunction(result, inputElement);
                            inputElement.value = result.login || result.name || result.title;
                            suggestionContainer.innerHTML = '';
                            suggestionContainer.style.display = 'none'; // Hide after selection
                        });
                        suggestionContainer.appendChild(suggestion);
                    });
                } else {
                    suggestionContainer.style.display = 'none'; // Hide if no results
                }
            })
            .catch(error => {
                console.error('Error fetching suggestions:', error);
                suggestionContainer.style.display = 'none'; // Hide on error
            });
        }, 300);
    });

    // Hide suggestions when input loses focus
    inputElement.addEventListener('blur', () => {
        setTimeout(() => {
            suggestionContainer.style.display = 'none';
        }, 200); // Small delay to allow for selection
    });

    document.addEventListener('click', (event) => {
        if (!inputElement.contains(event.target) && !suggestionContainer.contains(event.target)) {
            suggestionContainer.innerHTML = '';
            suggestionContainer.style.display = 'none'; // Hide when clicking outside
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


function setupFieldAutocomplete(nameInput, idInput, fieldValueContainer, fieldDescriptionElement) {
    console.log('Setting up field autocomplete with:', {
        nameInput,
        idInput,
        fieldValueContainer,
        fieldDescriptionElement
    });

    setupAutocompleteDropdown(nameInput, lookupObservationField, (result) => {
        console.log('Field selected in autocomplete:', result);
        idInput.value = result.id;  // Changed from fieldIdInput to idInput
        if (fieldDescriptionElement) {
            fieldDescriptionElement.textContent = result.description || '';
        }
        updateFieldValueInput(result, fieldValueContainer);
    });
}

function setupTaxonAutocomplete(inputElement, idElement) {
    console.log('Setting up taxon autocomplete for:', inputElement);
    
    const suggestionContainer = document.createElement('div');
    suggestionContainer.className = 'taxonSuggestions';
    suggestionContainer.style.position = 'absolute';
    suggestionContainer.style.display = 'none';
    document.body.appendChild(suggestionContainer);

    let debounceTimeout;

    function showTaxonSuggestions() {
        console.log('showTaxonSuggestions called for:', inputElement.value);
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            if (inputElement.value.length < 2) {
                console.log('Input too short, hiding suggestions');
                suggestionContainer.innerHTML = '';
                suggestionContainer.style.display = 'none';
                return;
            }
            console.log('Fetching taxon suggestions for:', inputElement.value);
            lookupTaxon(inputElement.value)
                .then(taxa => {
                    console.log('Received taxa suggestions:', taxa);
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
                                const selectedName = taxon.preferred_common_name ? 
                                    `${taxon.preferred_common_name} (${taxon.name})` : 
                                    taxon.name;
                                console.log('Taxon selected:', {
                                    name: selectedName,
                                    id: taxon.id,
                                    inputElement: inputElement,
                                    idElement: idElement,
                                    dataset: inputElement.dataset
                                });
                                inputElement.value = selectedName;
                                inputElement.dataset.taxonId = taxon.id;
                                if (idElement) idElement.value = taxon.id;
                                suggestionContainer.innerHTML = '';
                                suggestionContainer.style.display = 'none';
                                console.log('Taxon selected:', taxon.name, 'ID:', taxon.id);
                            }
                        });
                        suggestionContainer.appendChild(suggestion);
                    });

                    const inputRect = inputElement.getBoundingClientRect();
                    suggestionContainer.style.top = `${inputRect.bottom + window.scrollY}px`;
                    suggestionContainer.style.left = `${inputRect.left + window.scrollX}px`;
                    suggestionContainer.style.width = `${inputRect.width}px`;
                    suggestionContainer.style.display = 'block';
                    console.log('Showing taxon suggestions');
                })
                .catch(error => console.error('Error fetching taxa:', error));
        }, 300);
    }

    inputElement.addEventListener('input', showTaxonSuggestions);
    inputElement.addEventListener('focus', showTaxonSuggestions);
    inputElement.addEventListener('blur', () => {
        setTimeout(() => {
            console.log('Hiding taxon suggestions on blur');
            suggestionContainer.innerHTML = '';
            suggestionContainer.style.display = 'none';
        }, 200);
    });

    console.log('Taxon autocomplete setup complete for:', inputElement);
}


function updateFieldValueInput(field, container, existingValue = null) {
    console.log('Updating field value input for:', {
        field,
        container,
        existingValue
    });
    
    // Always clear the container
    container.innerHTML = '';
    console.log('Container after clearing:', container.innerHTML);
    
    let input;
    console.log('Creating input for field type:', field.datatype);

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
            input.className = 'taxonInput';
            input.placeholder = 'Enter species name';
            console.log('Setting up taxon autocomplete for field:', field);
            setupTaxonAutocomplete(input, null); 
            console.log('Created taxon input:', input);
            break;
        default:
            input = document.createElement('input');
            input.type = 'text';
    }

    input.className = 'fieldValue';
    input.placeholder = 'Field Value';
    
    if (existingValue !== null) {
        input.value = existingValue;
    }    

    console.log('Created input:', input);
    container.appendChild(input);
    console.log('Final container state:', container.innerHTML);

    // Handle allowed values
    if (field.allowed_values && field.datatype !== 'taxon') {
        console.log('Setting up allowed values for non-taxon field');
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

    console.log('Field value input updated');
    return input;
}

function setupObservationFieldAutocomplete(nameInput, idInput) {
    setupAutocompleteDropdown(nameInput, lookupObservationField, (result) => {
        idInput.value = result.id;
        const actionItem = nameInput.closest('.action-item') || nameInput.closest('.field-group');
        if (actionItem) {
            const fieldDescription = actionItem.querySelector('.fieldDescription');
            if (fieldDescription) {
                fieldDescription.textContent = result.description || '';
            }
            const fieldValueContainer = actionItem.querySelector('.fieldValueContainer');
            if (fieldValueContainer) {
                updateFieldValueInput(result, fieldValueContainer);
            }
        }
    });
}


function generateObservationURL(observationIds) {
    const baseURL = 'https://www.inaturalist.org/observations/identify?quality_grade=casual,needs_id,research&reviewed=any&verifiable=any&place_id=any';
    return `${baseURL}&per_page=${observationIds.length}&id=${observationIds.join(',')}`;
}

function removeUndoRecord(id, callback) {
    browserAPI.storage.local.get('undoRecords', function(result) {
        let undoRecords = result.undoRecords || [];
        undoRecords = undoRecords.filter(record => record.id !== id);
        browserAPI.storage.local.set({undoRecords: undoRecords}, function() {
            console.log('Undo record removed');
            callback();
        });
    });
}
function createUndoRecordsModal(undoRecords, onUndoClick) {
    try {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10002;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background-color: white;
            border-radius: 5px;
            width: 80%;
            max-width: 600px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;

        const headerSection = document.createElement('div');
        headerSection.style.cssText = `
            position: sticky;
            top: 0;
            background-color: white;
            padding: 20px;
            border-bottom: 1px solid #ccc;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1;
        `;
        const title = document.createElement('h2');
        title.textContent = 'Undo Records';
        title.style.margin = '0';

        const closeButton = document.createElement('button');
        closeButton.textContent = '\u2715';
        closeButton.style.cssText = `
            font-size: 16px;
            background: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #333;
            padding: 0;
            line-height: 1;
        `;
        closeButton.onclick = () => document.body.removeChild(overlay);

        const contentSection = document.createElement('div');
        contentSection.style.cssText = `
            padding: 20px;
            overflow-y: auto;
            flex-grow: 1;
        `;
        
        headerSection.appendChild(title);
        headerSection.appendChild(closeButton);
        modalContent.appendChild(headerSection);
        const progressBar = createProgressBar();
        modalContent.appendChild(progressBar);
        modalContent.appendChild(contentSection);

        undoRecords.forEach((record, index) => {
            try {
                const recordDiv = document.createElement('div');
                recordDiv.style.cssText = `
                    border: 1px solid #ccc;
                    border-radius: 5px;
                    padding: 15px;
                    margin-bottom: ${index < undoRecords.length - 1 ? '15px' : '0'};
                    ${record.undone ? 'text-decoration: line-through;' : ''}
                `;

                const actionInfo = document.createElement('p');
                actionInfo.textContent = `${record.action} - ${new Date(record.timestamp).toLocaleString()}`;
                actionInfo.style.margin = '0 0 10px 0';
                recordDiv.appendChild(actionInfo);

                // Add disclaimers
                const disclaimers = [];
                        
                // Check for DQI removal actions with robust error handling
                if (record && record.observations && Object.values(record.observations).some(obs => 
                    obs && Array.isArray(obs.undoActions) && obs.undoActions.some(action => 
                        action && action.type === 'qualityMetric' && action.vote === 'remove'
                    )
                )) {
                    disclaimers.push("Note: Removed DQI votes cannot be restored due to API limitations.");
                }

                if (disclaimers.length > 0) {
                    const disclaimerParagraph = document.createElement('p');
                    disclaimerParagraph.style.color = 'red';
                    disclaimerParagraph.style.fontStyle = 'italic';
                    disclaimerParagraph.style.fontSize = '0.9em';
                    disclaimerParagraph.textContent = disclaimers.join(' ');
                    recordDiv.appendChild(disclaimerParagraph);
                }

                const observationIds = Object.keys(record.observations);
                const observationUrl = generateObservationURL(observationIds);

                const linkParagraph = document.createElement('a');
                linkParagraph.href = observationUrl;
                linkParagraph.textContent = `View ${record.affectedObservationsCount} affected observation${record.affectedObservationsCount !== 1 ? 's' : ''}`;
                linkParagraph.target = '_blank';
                linkParagraph.style.display = 'block';
                linkParagraph.style.marginBottom = '10px';
                recordDiv.appendChild(linkParagraph);

                const undoButton = document.createElement('button');
                undoButton.textContent = record.undone ? 'Undone' : 'Undo';
                undoButton.disabled = record.undone;
                undoButton.onclick = async function() {
                    progressBar.style.display = 'block'; // Show progress bar
                    const progressFill = progressBar.querySelector('.progress-fill');
                    try {
                        const result = await performUndoActions(record, progressFill);
                        await updateProgressBar(progressFill, 100);
                        await new Promise(resolve => setTimeout(resolve, 300));
                        if (result.success) {
                            markRecordAsUndone(record.id);
                            undoButton.textContent = 'Undone';
                            undoButton.disabled = true;
                            recordDiv.style.textDecoration = 'line-through';
                            console.log('All undo actions completed successfully:', result.results);
                        } else {
                            console.error('Some undo actions failed:', result.results);
                            alert('Some undo actions failed. Please check the console for details.');
                        }
                    } catch (error) {
                        console.error('Error in performUndoActions:', error);
                        alert(`Error performing undo actions: ${error.message}`);
                    } finally {
                        progressBar.style.display = 'none'; // Hide progress bar after completion
                    }
                };
                recordDiv.appendChild(undoButton);
                contentSection.appendChild(recordDiv);
            } catch (error) {
                console.error('Error processing undo record:', error);
                // Optionally, add an error message to the modal
                const errorDiv = document.createElement('div');
                errorDiv.textContent = `Error processing undo record: ${error.message}`;
                errorDiv.style.color = 'red';
                contentSection.appendChild(errorDiv);
            }
        });

        overlay.appendChild(modalContent);
        return overlay;
    } catch (error) {
        console.error('Error creating undo records modal:', error);
        alert('An error occurred while creating the undo records modal. Please check the console for more details.');
        return null;
    }
}

function getUndoRecords(callback) {
    browserAPI.storage.local.get('undoRecords', function(result) {
        const records = result.undoRecords || [];
        // Sort records by timestamp, newest first
        records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        console.log('Sorted undo records:', records);
        callback(records);
    });
}

async function performUndoActions(undoRecord, progressFill) {
    console.log('Performing undo actions for record:', JSON.stringify(undoRecord, null, 2));
    let allActionsSuccessful = true;
    const results = [];

    const totalActions = Object.values(undoRecord.observations).reduce((sum, obs) => sum + obs.undoActions.length, 0);
    let completedActions = 0;

    for (const [observationId, observationData] of Object.entries(undoRecord.observations)) {
        console.log(`Processing undo actions for observation ${observationId}:`, observationData);
        for (const undoAction of observationData.undoActions) { 
            try {
                const result = await performSingleUndoAction(observationId, undoAction);
                console.log('Undo action result:', result);
                if (result.success) {
                    results.push({ observationId, action: result.action, message: result.message });
                } else {
                    allActionsSuccessful = false;
                    console.error('Undo action failed:', undoAction, 'Result:', result);
                    results.push({ observationId, action: undoAction.type, error: result.error });
                }
            } catch (error) {
                console.error('Error performing undo action:', undoAction, 'Error:', error);
                allActionsSuccessful = false;
                results.push({ observationId, action: undoAction.type, error: error.toString() });
            }

            completedActions++;
            await updateProgressBar(progressFill, (completedActions / totalActions) * 100);
        }
    }

    return { success: allActionsSuccessful, results };
}

function markRecordAsUndone(recordId) {
    browserAPI.storage.local.get('undoRecords', function(result) {
        let undoRecords = result.undoRecords || [];
        const recordIndex = undoRecords.findIndex(r => r.id === recordId);
        if (recordIndex !== -1) {
            undoRecords[recordIndex].undone = true;
            browserAPI.storage.local.set({undoRecords: undoRecords}, function() {
                console.log('Undo record marked as undone');
            });
        }
    });
}

async function performSingleUndoAction(observationId, undoAction) {
    console.log('Performing undo action:', undoAction, 'for observation:', observationId);
    switch (undoAction.type) {
            case 'follow':
                if (undoAction.alreadyInDesiredState) {
                    console.log('No follow toggle needed for undo; already in desired state.');
                    return { success: true, message: 'No action needed for follow undo' };
                }
            
                console.log('Restoring original follow state:', undoAction.originalState);
                try {
                    const result = await toggleFollowObservation(observationId, undoAction.originalState === 'followed');
                    return {
                        success: true,
                        action: 'follow',
                        message: `Follow state restored to ${undoAction.originalState}`
                    };
                } catch (error) {
                    console.error('Error restoring follow state:', error);
                    return { success: false, error: error.toString() };
                }
            case 'reviewed':
                console.log('Undo action for review:', {
                    undoAction,
                    originalState: undoAction.originalState,
                    observationId
                });
                const shouldMarkAsReviewed = undoAction.originalState === 'reviewed';
                console.log('Should mark as reviewed?', {
                    shouldMarkAsReviewed,
                    originalState: undoAction.originalState,
                    comparison: undoAction.originalState === 'reviewed'
                });
                try {
                    const result = await markObservationReviewed(observationId, shouldMarkAsReviewed);                return {
                    success: true,
                    action: 'reviewed',
                    message: `Restored reviewed state to ${undoAction.originalState}`
                };
            } catch (error) {
                console.error('Error restoring reviewed state for undo:', error);
                return { success: false, error: error.toString() };
            }    
            case 'removeAnnotation':
                if (undoAction.uuid) {
                    try {
                        const response = await makeAPIRequest(`/annotations/${undoAction.uuid}`, { method: 'DELETE' });
                        console.log('Annotation deletion response:', response);
                        return { success: true, action: 'removeAnnotation', message: 'Annotation removed successfully' };
                    } catch (error) {
                        console.error('Error removing annotation:', error);
                        if (error.message && error.message.includes('HTTP error! status: 404')) {
                            console.log('Annotation not found (404). It may have been already deleted.');
                            return { success: true, action: 'removeAnnotation', message: 'Annotation already removed or not found' };
                        }
                        return { success: false, error: error.toString() };
                    }
                } else {
                    console.error('Annotation UUID not found for undo action');
                    return { success: false, error: 'Annotation UUID not found' };
                }
            case 'updateObservationField':
                // First, get the current state of the observation
                const observationResponse = await makeAPIRequest(`/observations/${observationId}`);
                console.log('Current observation state:', observationResponse.results[0]);
                
                const ofv = observationResponse.results[0].ofvs.find(ofv => ofv.field_id === parseInt(undoAction.fieldId));
                
                if (ofv) {
                    console.log('Found existing OFV:', ofv);
                    
                    // Delete the current value
                    const deleteResult = await makeAPIRequest(`/observation_field_values/${ofv.id}`, {
                        method: 'DELETE'
                    });
                    console.log('Delete result:', deleteResult);
                    
                    // Verify the deletion
                    const checkResponse = await makeAPIRequest(`/observations/${observationId}`);
                    const checkOfv = checkResponse.results[0].ofvs.find(ofv => ofv.field_id === parseInt(undoAction.fieldId));
                    
                    if (!checkOfv) {
                        // Deletion successful, now restore original value if it exists
                        if (undoAction.originalValue !== undefined && undoAction.originalValue !== null) {
                            console.log('Restoring original value:', undoAction.originalValue);
                            const restoreResult = await makeAPIRequest('/observation_field_values', {
                                method: 'POST',
                                body: JSON.stringify({
                                    observation_field_value: {
                                        observation_id: observationId,
                                        observation_field_id: undoAction.fieldId,
                                        value: undoAction.originalValue
                                    }
                                })
                            });
                            return { success: true, action: 'restored', fieldId: undoAction.fieldId, value: undoAction.originalValue };
                        }
                        return { success: true, action: 'deleted', fieldId: undoAction.fieldId };
                    } else {
                        console.error('Field value not deleted successfully');
                        return { success: false, error: 'Failed to delete field value' };
                    }
                } else if (undoAction.originalValue) {
                    // No current value but we have an original value to restore
                    console.log('No current value, restoring original:', undoAction.originalValue);
                    const restoreResult = await makeAPIRequest('/observation_field_values', {
                        method: 'POST',
                        body: JSON.stringify({
                            observation_field_value: {
                                observation_id: observationId,
                                observation_field_id: undoAction.fieldId,
                                value: undoAction.originalValue
                            }
                        })
                    });
                    return { success: true, action: 'restored', fieldId: undoAction.fieldId, value: undoAction.originalValue };
                }
                
                console.warn(`No action needed for field ID ${undoAction.fieldId} on observation ${observationId}`);
                return { success: true, message: 'No action needed' };
            case 'removeFromProject':
                if (!undoAction.actionApplied) {
                    console.log(`Skipping undo for observation ${observationId} - original action wasn't applied. Reason: ${undoAction.reason}`);
                    return {
                        success: true,
                        message: 'No undo needed - original action was not applied',
                        reason: undoAction.reason
                    };
                }
            
                try {
                    // Pass the remove parameter so that "remove: true" calls the removal path.
                    const result = await performProjectAction(
                        observationId, 
                        undoAction.projectId, 
                        undoAction.remove
                    );
                    return result;
                } catch (error) {
                    console.error('Error in project undo action:', error);
                    return {
                        success: false,
                        error: error.toString(),
                        projectId: undoAction.projectId,
                        projectName: undoAction.projectName
                    };
                }
                        
            case 'removeComment':
                console.log('Attempting to remove comment:', undoAction);
                if (undoAction.commentUUID) {
                    try {
                        const response = await makeAPIRequest(`/comments/${undoAction.commentUUID}`, { method: 'DELETE' });
                        console.log('Comment deletion response:', response);
                        return { success: true, action: 'removeComment', message: 'Comment removed successfully' };
                    } catch (error) {
                        console.error('Error removing comment:', error);
                        if (error.message && error.message.includes('HTTP error! status: 404')) {
                            console.log('Comment not found (404). It may have been already deleted.');
                            return { success: true, action: 'removeComment', message: 'Comment already removed or not found' };
                        }
                        return { success: false, error: error.toString() };
                    }
                } else {
                    console.error('Comment UUID not found for undo action:', undoAction);
                    return { success: false, error: 'Comment UUID not found' };
                }
            case 'removeIdentification':
                if (undoAction.identificationUUID) {
                    try {
                        console.log('Removing identification:', undoAction.identificationUUID);
                        await makeAPIRequest(`/identifications/${undoAction.identificationUUID}`, { method: 'DELETE' });
                        console.log('Identification successfully deleted');
            
                        if (undoAction.previousIdentificationUUID) {
                            console.log('Restoring previous identification:', undoAction.previousIdentificationUUID);
                            await makeAPIRequest(`/identifications/${undoAction.previousIdentificationUUID}`, {
                                method: 'PUT',
                                body: JSON.stringify({ current: true })
                            });
                            console.log('Previous identification restored');
                        }
            
                        return { 
                            success: true, 
                            action: 'removeIdentification', 
                            message: 'Identification removed and previous restored if available'
                        };
                    } catch (error) {
                        console.error('Error in removeIdentification action:', error);
                        return { success: false, error: error.toString() };
                    }
                } else {
                    console.error('Identification UUID not found for undo action');
                    return { success: false, error: 'Identification UUID not found' };
                }
            case 'restoreIdentification':
                if (undoAction.identificationUUID) {
                    try {
                        console.log('Restoring withdrawn identification:', undoAction.identificationUUID);
                        await makeAPIRequest(`/identifications/${undoAction.identificationUUID}`, {
                            method: 'PUT',
                            body: JSON.stringify({ current: true })
                        });
                        return { 
                            success: true, 
                            action: 'restoreIdentification', 
                            message: 'Withdrawn identification restored'
                        };
                    } catch (error) {
                        console.error('Error in restoreIdentification action:', error);
                        return { success: false, error: error.toString() };
                    }
                } else {
                    console.error('Identification UUID not found for undo action');
                    return { success: false, error: 'Identification UUID not found' };
                }    
            case 'qualityMetric':
                if (undoAction.vote === 'remove') {
                    console.log('Skipping undo for DQI removal as it\'s not supported');
                    return { success: true, action: 'qualityMetric', message: 'Undo of DQI removal not supported' };
                }
                
                const isNeedsId = undoAction.metric === 'needs_id';
                const endpoint = isNeedsId
                    ? `/votes/unvote/observation/${observationId}?scope=needs_id`
                    : `/observations/${observationId}/quality/${undoAction.metric}`;
                
                try {
                    const response = await makeAPIRequest(endpoint, { method: 'DELETE' });
                    console.log(`Quality metric vote removal response for ${undoAction.metric}:`, response);
                    
                    return {
                        success: true,
                        action: 'qualityMetric',
                        message: `Removed ${undoAction.metric} vote`
                    };
                } catch (error) {
                    console.error(`Error in quality metric undo action for ${undoAction.metric}:`, error);
                    return { success: false, error: error.toString() };
                }
            case 'addToList':
                try {
                    const result = await addOrRemoveObservationFromList(observationId, undoAction.listId, undoAction.remove);
                    return {
                        success: true,
                        action: undoAction.remove ? 'removedFromList' : 'addedToList',
                        listId: undoAction.listId,
                        message: result.message
                    };
                } catch (error) {
                    console.error('Error in undo addToList action:', error);
                    return { success: false, error: error.toString() };
            }
            default:
                console.warn(`Unknown undo action type: ${undoAction.type}`);
                return Promise.resolve({ success: false, error: 'Unknown undo action type' }

                );
    }
}

function createProgressBar() {
    console.log('Creating progress bar');
    const progressBarContainer = document.createElement('div');
    progressBarContainer.style.cssText = `
        width: 100%;
        padding: 0 20px;
        box-sizing: border-box;
    `;

    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        width: 100%;
        height: 20px;
        background-color: #f0f0f0;
        border-radius: 10px;
        overflow: hidden;
        margin: 10px 0;
    `;

    const progressFill = document.createElement('div');
    progressFill.classList.add('progress-fill');
    progressFill.style.cssText = `
        width: 0%;
        height: 100%;
        background-color: #4CAF50;
        transition: width 0.3s ease;
    `;

    progressBar.appendChild(progressFill);
    progressBarContainer.appendChild(progressBar);
    progressBarContainer.style.display = 'block'; 

    return progressBarContainer;
}

async function updateProgressBar(progressFill, progress) {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            progressFill.style.width = `${progress}%`;
            void progressFill.offsetWidth;
            requestAnimationFrame(resolve);
        });
    });
}

async function makeAPIRequest(endpoint, options = {}) {
    const jwt = await getJWT();
    if (!jwt) {
        console.error('No JWT available');
        throw new Error('No JWT available');
    }
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${jwt}`
    };
    let fullUrl = `${API_URL}${endpoint}`;
    if (options.method === 'DELETE') {
        fullUrl += '?delete=true';
    }
    console.log(`Making ${options.method || 'GET'} request to: ${fullUrl}`);
    try {
        const response = await fetch(fullUrl, {
            ...options,
            headers
        });
        console.log(`Response status: ${response.status}`);
        console.log('Response headers:', response.headers);
        const responseText = await response.text();
        if (!response.ok) {
            // This is where we modify the error object
            const error = new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
            error.status = response.status;
            error.responseBody = responseText;
            throw error;
        }
        if (responseText) {
            try {
                const responseData = JSON.parse(responseText);
                return responseData;
            } catch (e) {
                return responseText;
            }
        }
        return null;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Initialize and test JWT when the script loads
(async function() {
    const jwt = await getJWT();
    if (jwt) {
        const isValid = await testJWT();
        if (isValid) {
            console.log('JWT is valid');
        } else {
            console.log('JWT is invalid, will try to get a new one on next API call');
            currentJWT = null;
            if (isOptionsPage()) {
                showJWTAlert();
            }
        }
    } else {
        console.log('No JWT found');
        if (isOptionsPage()) {
            showJWTAlert();
        }
    }
})();

function isOptionsPage() {
    return window.location.pathname.endsWith('options.html');
}

function showJWTAlert() {
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        z-index: 9999;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.4);
        display: flex;
        justify-content: center;
        align-items: center;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background-color: #fefefe;
        padding: 20px;
        border: 1px solid #888;
        width: 80%;
        max-width: 500px;
        border-radius: 5px;
        text-align: center;
    `;

    // Add message and link
    modalContent.innerHTML = `
        <h2 style="margin-top: 0;">JWT Required</h2>
        <p>To use this extension, you need to log in and open an iNaturalist Identify page first.</p>
        <a href="https://www.inaturalist.org/observations/identify" target="_blank" style="color: blue; text-decoration: underline;">Open Identify Page</a>
        <button id="closeJWTAlert" style="display: block; margin: 20px auto 0; padding: 10px 20px;">Close</button>
    `;

    // Append modal content to modal container
    modal.appendChild(modalContent);

    // Append modal to body
    document.body.appendChild(modal);

    // Close modal when close button is clicked
    document.getElementById('closeJWTAlert').onclick = function() {
        document.body.removeChild(modal);
    };

    // Close modal when clicking outside of it
    modal.onclick = function(event) {
        if (event.target == modal) {
            document.body.removeChild(modal);
        }
    };
}


function getJWTFromPage() {
    const metaTag = document.querySelector('meta[name="inaturalist-api-token"]');
    return metaTag ? metaTag.getAttribute('content') : null;
}

async function getJWT() {
    if (currentJWT) return currentJWT;
    
    currentJWT = getJWTFromPage();
    if (currentJWT) {
        browserAPI.storage.local.set({jwt: currentJWT});
        return currentJWT;
    }
    
    // If not on page, try to get from storage
    const stored = await browserAPI.storage.local.get('jwt');
    if (stored.jwt) {
        currentJWT = stored.jwt;
        return currentJWT;
    }
    
    console.error('No JWT available');
    return null;
}


async function testJWT() {
    try {
        const response = await makeAPIRequest('/users/me');
        console.log('JWT test response:', response);
        return response && response.results && response.results[0] && response.results[0].id;
    } catch (error) {
        console.error('Error in JWT test:', error);
        return false;
    }
}

function generateListObservationURL(listId) {
    return new Promise((resolve) => {
        browserAPI.storage.local.get('customLists', function(data) {
            const customLists = data.customLists || [];
            const list = customLists.find(l => l.id === listId);
            if (list && list.observations.length > 0) {
                const baseURL = 'https://www.inaturalist.org/observations/identify?quality_grade=casual,needs_id,research&reviewed=any&verifiable=any&place_id=any';
                const url = `${baseURL}&per_page=${list.observations.length}&id=${list.observations.join(',')}`;
                resolve(url);
            } else {
                resolve(null);
            }
        });
    });
}


async function addOrRemoveObservationFromList(observationId, listId, isRemove = false) {
    return new Promise((resolve, reject) => {
        browserAPI.storage.local.get('customLists', function(data) {
            const customLists = data.customLists || [];
            const listIndex = customLists.findIndex(list => list.id === listId);
            if (listIndex !== -1) {
                const observationIndex = customLists[listIndex].observations.indexOf(observationId);
                if (isRemove) {
                    if (observationIndex !== -1) {
                        customLists[listIndex].observations.splice(observationIndex, 1);
                        browserAPI.storage.local.set({customLists: customLists}, function() {
                            console.log(`Observation ${observationId} removed from list ${customLists[listIndex].name}`);
                            resolve({ success: true, message: `Observation removed from list: ${customLists[listIndex].name}` });
                        });
                    } else {
                        console.log(`Observation ${observationId} not in list ${customLists[listIndex].name}`);
                        resolve({ success: true, message: 'Observation not in list' });
                    }
                } else {
                    if (observationIndex === -1) {
                        customLists[listIndex].observations.push(observationId);
                        browserAPI.storage.local.set({customLists: customLists}, function() {
                            console.log(`Observation ${observationId} added to list ${customLists[listIndex].name}`);
                            resolve({ success: true, message: `Observation added to list: ${customLists[listIndex].name}` });
                        });
                    } else {
                        console.log(`Observation ${observationId} already in list ${customLists[listIndex].name}`);
                        resolve({ success: true, message: 'Observation already in list' });
                    }
                }
            } else {
                console.error(`List with ID ${listId} not found`);
                reject(new Error('List not found'));
            }
        });
    });
}

async function lookupTaxonById(taxonId) {
    const baseUrl = 'https://api.inaturalist.org/v1/taxa';
    const response = await fetch(`${baseUrl}/${taxonId}`);
    const data = await response.json();
    return data.results;
}

async function getFieldValueDetails(observationId, fieldId) {
    try {
        console.log('getFieldValueDetails starting for:', {observationId, fieldId});
        const response = await makeAPIRequest(`/observations/${observationId}`);
        const observation = response.results[0];
        const fieldValue = observation.ofvs.find(ofv => ofv.field_id === parseInt(fieldId));
        console.log('Found field value:', fieldValue);
        
        if (!fieldValue) {
            return null;
        }

        console.log('Field datatype:', fieldValue.datatype);
        if (fieldValue.datatype === 'taxon' && fieldValue.value) {
            try {
                const taxonData = await lookupTaxonById(fieldValue.value);
                if (taxonData && taxonData[0]) {
                    return {
                        value: fieldValue.value,
                        displayValue: taxonData[0].preferred_common_name ? 
                            `${taxonData[0].preferred_common_name} (${taxonData[0].name})` : 
                            taxonData[0].name,
                        timestamp: fieldValue.updated_at || fieldValue.created_at
                    };
                }
            } catch (error) {
                console.error('Error looking up taxon:', error);
            }
        }
        
        const result = {
            value: fieldValue.value,
            timestamp: fieldValue.updated_at || fieldValue.created_at
        };
        console.log('Returning without display value:', result);
        return result;
    } catch (error) {
        console.error('Error getting field value details:', error);
        throw error;
    }
}

function compareFieldValues(existingValue, newValue, datatype) {
    if (!existingValue) return true; // No existing value means values are different

    switch (datatype) {
        case 'numeric':
            return parseFloat(existingValue) !== parseFloat(newValue);
        case 'date':
        case 'datetime':
            return new Date(existingValue).getTime() !== new Date(newValue).getTime();
        default:
            return existingValue !== newValue;
    }
}

async function markObservationReviewed(observationId, markAsReviewed) {
    const jwt = await getJWT(); // Ensure the user is authenticated
    if (!jwt) {
        console.error('No JWT found');
        return { success: false, error: 'No JWT found' };
    }

    // Step 1: Check the current reviewed state
    const checkUrl = `https://api.inaturalist.org/v1/observations/${observationId}`;
    try {
        const response = await fetch(checkUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${jwt}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to check reviewed state. Status: ${response.status}`);
        }

        const data = await response.json();
        const observation = data.results[0]; // Assuming the observation is the first result
        const isCurrentlyReviewed = observation.reviewed;

        // Step 2: Determine if action is needed
        if (markAsReviewed === isCurrentlyReviewed) {
            console.log(`Observation ${observationId} is already in the desired reviewed state (${markAsReviewed ? 'reviewed' : 'unreviewed'}). No action taken.`);
            return { success: true, originalState: isCurrentlyReviewed ? 'reviewed' : 'unreviewed' };
        }

        // Step 3: Perform the action
        const url = `https://api.inaturalist.org/v1/observations/${observationId}/review`;
        const method = markAsReviewed ? 'POST' : 'DELETE';
        const body = markAsReviewed ? JSON.stringify({ reviewed: "true" }) : null;

        const actionResponse = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${jwt}`,
                'Content-Type': 'application/json',
            },
            body,
        });

        if (!actionResponse.ok) {
            throw new Error(`Failed to mark as ${markAsReviewed ? 'reviewed' : 'unreviewed'}. Status: ${actionResponse.status}`);
        }

        console.log(`Successfully marked observation ${observationId} as ${markAsReviewed ? 'reviewed' : 'unreviewed'}`);
        return { success: true, originalState: isCurrentlyReviewed ? 'reviewed' : 'unreviewed' };
    } catch (error) {
        console.error(`Error marking observation ${observationId} as reviewed/unreviewed:`, error);
        throw error;
    }
}

async function toggleFollowObservation(observationId) {
    try {
        const response = await makeAPIRequest(`/subscriptions/Observation/${observationId}/subscribe`, {
            method: 'POST'
        });

        console.log(`Successfully toggled follow state for observation ${observationId}`);
        return { success: true };
    } catch (error) {
        console.error(`Error toggling follow state for observation ${observationId}:`, error);
        return { success: false, error: error.toString() };
    }
}

async function performProjectAction(observationId, projectId, remove = false) {
    try {
        // Fetch observation details
        const observation = await makeAPIRequest(`/observations/${observationId}`);
        
        if (!observation || !observation.results || !observation.results[0]) {
            console.error('Failed to fetch observation details:', observation);
            return {
                success: false,
                message: 'Failed to fetch observation details',
                explicitlyRemoved: false,
                reason: 'fetch_error'
            };
        }

        const isExplicitlyInProject = observation.results[0].project_observations.some(
            po => po.project.id === parseInt(projectId)
        );

        // For adding observations
        if (!remove) {
            // If already in project, consider it a success but flag it as no action needed
            if (isExplicitlyInProject) {
                return {
                    success: true,
                    message: 'Already in project',
                    reason: 'already_member',
                    noActionNeeded: true
                };
            }

            try {
                const response = await makeAPIRequest('/project_observations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_observation: {
                            observation_id: observationId,
                            project_id: projectId
                        }
                    })
                });

                if (response.uuid) {
                    return {
                        success: true,
                        message: 'Added to project successfully',
                        additionUUID: response.uuid
                    };
                } else {
                    throw new Error(`Failed to add to project: ${response.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error adding to project:', error);
                return {
                    success: false,
                    message: error.toString(),
                    reason: 'addition_failed'
                };
            }
        }
        
        // For removing observations
        else {
            // If not explicitly in project, check for dynamic inclusion
            if (!isExplicitlyInProject) {
                const dynamicInclusionCheck = await makeAPIRequest(`/observations?project_id=${projectId}&id=${observationId}`);
                const isDynamicallyIncluded = dynamicInclusionCheck.total_results > 0;

                if (isDynamicallyIncluded) {
                    return {
                        success: false,
                        message: 'Cannot remove - observation is automatically included',
                        reason: 'dynamic_inclusion',
                        requiresWarning: true
                    };
                } else {
                    return {
                        success: true,
                        message: 'Not in project, no action needed',
                        reason: 'not_in_project',
                        noActionNeeded: true
                    };
                }
            }
            
            try {
                await makeAPIRequest(`/projects/${projectId}/remove?observation_id=${observationId}`, {
                    method: 'DELETE'
                });
                return { 
                    success: true, 
                    message: 'Observation removed successfully', 
                    explicitlyRemoved: true 
                };
            } catch (error) {
                if (error.message && error.message.includes("you don't have permission to remove")) {
                    return {
                        success: false,
                        message: 'Permission denied',
                        reason: 'permission_denied',
                        requiresWarning: true
                    };
                }
                throw error;
            }
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        return { 
            success: false, 
            message: error.toString(), 
            reason: 'unexpected_error' 
        };
    }
}


function handleProjectActionResults(results) {
    console.log('Raw results:', results);
    const summary = {
        success: [],
        skipped: [],
        failed: [],
        warnings: []
    };

    results.forEach(result => {
        const observationId = result.observationId;
        console.log('Processing result:', result);
        if (result.success) {
            if (result.noActionNeeded) {
                summary.skipped.push({
                    observationId,
                    reason: result.reason,
                    message: result.message
                });
            } else {
                summary.success.push({
                    observationId,
                    message: result.message,
                    additionUUID: result.additionUUID,
                    explicitlyRemoved: result.explicitlyRemoved
                });
            }
        } else {
            if (result.requiresWarning) {
                summary.warnings.push({
                    observationId,
                    message: result.message,
                    reason: result.reason
                });
            }
            summary.failed.push({
                observationId,
                message: result.message,
                reason: result.reason
            });
        }
    });

    return summary;
}

function createProjectActionResultsModal(summary, projectName, wasRemoval = false) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background-color: white;
        padding: 20px;
        border-radius: 5px;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;
    `;

    let contentHTML = `<h2>Project Action Results</h2>`;

    // Success section
    if (summary.success.length > 0) {
        contentHTML += `
            <div style="margin: 15px 0;">
                <h3>Successful Actions (${summary.success.length})</h3>
                <p>${wasRemoval ? 'Removed from' : 'Added to'} project "${projectName}"</p>
                <div class="observation-list">
                    ${generateObservationList(summary.success.map(s => s.observationId))}
                </div>
            </div>
        `;
    }

    // Skipped section
    if (summary.skipped.length > 0) {
        contentHTML += `
            <div style="margin: 15px 0; padding: 10px; background: #fff3e0; border-radius: 4px;">
                <h3>Skipped Actions (${summary.skipped.length})</h3>
                <p>Observations already in desired state (if this is surprising, confirm you selected the right project)</p>
                <div class="observation-list">
                    ${generateObservationList(summary.skipped.map(s => s.observationId))}
                </div>
            </div>
        `;
    }

    // Warnings section
    if (summary.warnings.length > 0) {
        contentHTML += `
            <div style="margin: 15px 0; padding: 10px; background: #ffebee; border-radius: 4px;">
                <h3>Warnings (${summary.warnings.length})</h3>
                <ul>
                    ${summary.warnings.map(warning => `
                        <li>
                            <strong>Observation ${warning.observationId}:</strong> ${warning.message}
                            ${
                                warning.reason === 'dynamic_inclusion' 
                                    ? ' (Automatically included by project rules)'
                                    : warning.reason === 'permission_denied'
                                        ? ' (Insufficient permissions)'
                                        : ''
                            }
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    // Failed section (excluding ones that are also in warnings)
    const nonWarningFailures = summary.failed.filter(f => 
        !summary.warnings.some(w => w.observationId === f.observationId)
    );
    console.log('Failures to display:', nonWarningFailures);
    if (nonWarningFailures.length > 0) {
        contentHTML += `
            <div style="margin: 15px 0; padding: 10px; background: #ffebee; border-radius: 4px;">
                <h3>Failed Actions (${nonWarningFailures.length})</h3>
                <p><a href="https://www.inaturalist.org/observations/identify?quality_grade=casual,needs_id,research&reviewed=any&verifiable=any&place_id=any&id=${nonWarningFailures.map(f => f.observationId).join(',')}" 
                      target="_blank" 
                      style="color: #0077cc; text-decoration: underline;">
                    View all failed observations
                </a></p>
                <ul>
                    ${nonWarningFailures.map(failure => `
                        <li>
                            <a href="https://www.inaturalist.org/observations/${failure.observationId}" 
                               target="_blank"
                               style="color: #0077cc; text-decoration: underline;">
                                Observation ${failure.observationId}
                            </a>: 
                            ${getCleanErrorMessage(failure.message)}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    contentHTML += `<button onclick="this.closest('.modal').remove()" class="modal-button">Close</button>`;
    
    content.innerHTML = contentHTML;
    modal.appendChild(content);
    modal.className = 'modal';

    return modal;
}

function generateObservationList(observationIds) {
    const url = generateObservationURL(observationIds);
    return `<a href="${url}" target="_blank">View ${observationIds.length} observation${observationIds.length !== 1 ? 's' : ''}</a>`;
}

function getCleanErrorMessage(error) {
    const match = error.match(/Didn't pass rule: (.+?)"/);
    return match ? match[1] : 'Unknown error';
}