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
                return;
            }
            lookupFunction(inputElement.value)
        .then(results => {
            suggestionContainer.innerHTML = '';
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
                });
                suggestionContainer.appendChild(suggestion);
            });
        })
        .catch(error => console.error('Error fetching suggestions:', error));
        }, 300);
    });

    document.addEventListener('click', (event) => {
        if (!inputElement.contains(event.target) && !suggestionContainer.contains(event.target)) {
            suggestionContainer.innerHTML = '';
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


function setupFieldAutocomplete(fieldNameInput, fieldIdInput, fieldValueContainer, fieldDescriptionElement) {
    console.log('Setting up field autocomplete');
    setupAutocompleteDropdown(fieldNameInput, lookupObservationField, (result) => {
        console.log('Field selected:', result);
        fieldIdInput.value = result.id;
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
                                inputElement.value = taxon.preferred_common_name ? 
                                    `${taxon.preferred_common_name} (${taxon.name})` : 
                                    taxon.name;
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
    console.log('Updating field value input for:', field);
    
    // Always clear the container
    container.innerHTML = '';
    
    let input;

    console.log('Field datatype:', field.datatype);

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
            console.log('Setting up taxon autocomplete for taxon input');
            setupTaxonAutocomplete(input);
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

    container.appendChild(input);

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
        z-index: 10002;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background-color: white;
        padding: 20px;
        border-radius: 5px;
        width: 80%;
        max-width: 600px;
        max-height: 80%;
        overflow-y: auto;
        position: relative;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '\u2715'; // Unicode "times" symbol
    closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
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
    closeButton.onclick = () => document.body.removeChild(modal);
    modalContent.appendChild(closeButton);

    const title = document.createElement('h2');
    title.textContent = 'Undo Records';
    title.style.marginTop = '0';
    modalContent.appendChild(title);

    undoRecords.forEach(record => {
        const recordDiv = document.createElement('div');
        recordDiv.style.cssText = `
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 10px;
            ${record.undone ? 'text-decoration: line-through;' : ''}
        `;

        const actionInfo = document.createElement('p');
        actionInfo.textContent = `${record.action} - ${new Date(record.timestamp).toLocaleString()}`;
        actionInfo.style.margin = '0 0 10px 0';
        recordDiv.appendChild(actionInfo);

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
        undoButton.onclick = function() {
            performUndoActions(record)
                .then((result) => {
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
                })
                .catch(error => {
                    console.error('Error in performUndoActions:', error);
                    alert(`Error performing undo actions: ${error.message}`);
                });
        };
        recordDiv.appendChild(undoButton);

        modalContent.appendChild(recordDiv);
    });

    modal.appendChild(modalContent);
    return modal;
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

async function performUndoActions(undoRecord) {
    console.log('Performing undo actions for record:', undoRecord);
    let allActionsSuccessful = true;
    const results = [];

    for (const [observationId, observationData] of Object.entries(undoRecord.observations)) {
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
        case 'removeAnnotation':
            if (undoAction.uuid) {
                try {
                    const response = await makeAPIRequest(`/annotations/${undoAction.uuid}`, { method: 'DELETE' });
                    console.log('Annotation deletion response:', response);
                    // iNaturalist might return a 204 No Content for successful deletion
                    return { success: true, action: 'removeAnnotation', message: 'Annotation removed successfully' };
                } catch (error) {
                    console.error('Error removing annotation:', error);
                    // If the error is 404 Not Found, the annotation might have already been deleted
                    if (error.status === 404) {
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
                    
                    // Attempt to delete the field value
                    const deleteResult = await makeAPIRequest(`/observation_field_values/${ofv.id}`, {
                        method: 'DELETE'
                    });
                    console.log('Delete result:', deleteResult);
                    
                    // Check if the field value was actually deleted
                    const checkResponse = await makeAPIRequest(`/observations/${observationId}`);
                    const checkOfv = checkResponse.results[0].ofvs.find(ofv => ofv.field_id === parseInt(undoAction.fieldId));
                    
                    if (checkOfv) {
                        console.error('Field value still exists after deletion attempt');
                        return { success: false, error: 'Field value not deleted' };
                    } else {
                        console.log('Field value successfully deleted');
                        return { success: true, action: 'deleted', fieldId: undoAction.fieldId };
                    }                                        
                } else if (undoAction.originalValue) {
                    // If there was an original value, restore it
                    console.log('Restoring original value:', undoAction.originalValue);
                    return makeAPIRequest('/observation_field_values', {
                        method: 'POST',
                        body: JSON.stringify({
                            observation_field_value: {
                                observation_id: observationId,
                                observation_field_id: undoAction.fieldId,
                                value: undoAction.originalValue
                            }
                        })
                    });
                } else {
                    console.warn(`Observation field value not found for field ID ${undoAction.fieldId} on observation ${observationId}`);
                    return { success: true, message: 'No action needed' };
                }
        case 'removeFromProject':
            return makeAPIRequest(`/project_observations`, {
                method: 'DELETE',
                body: JSON.stringify({ observation_id: observationId, project_id: undoAction.projectId })
            });
        case 'removeComment':
            return makeAPIRequest(`/comments/${undoAction.commentId}`, { method: 'DELETE' });
        case 'removeIdentification':
            return makeAPIRequest(`/identifications/${undoAction.identificationId}`, { method: 'DELETE' });
        case 'removeQualityMetric':
            if (undoAction.metric === 'needs_id') {
                return makeAPIRequest(`/votes/unvote/observation/${observationId}?scope=needs_id`, { method: 'DELETE' });
            } else {
                return makeAPIRequest(`/observations/${observationId}/quality/${undoAction.metric}`, { method: 'DELETE' });
            }
        default:
            console.warn(`Unknown undo action type: ${undoAction.type}`);
            return Promise.resolve({ success: false, error: 'Unknown undo action type' });
    }
}