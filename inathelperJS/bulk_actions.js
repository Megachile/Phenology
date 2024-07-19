document.addEventListener('DOMContentLoaded', function() {
    const generatedUrlDiv = document.getElementById('generatedUrl');

    const addTaxonButton = document.getElementById('addTaxonButton');
    const addUserButton = document.getElementById('addUserButton');
    const addProjectButton = document.getElementById('addProjectButton');
    const addPlaceButton = document.getElementById('addPlaceButton');
    const addObservationFieldButton = document.getElementById('addObservationFieldButton');
    const addAnnotationButton = document.getElementById('addAnnotationButton');

    // Check if all buttons are found
    if (!addTaxonButton) console.error('addTaxonButton not found');
    if (!addUserButton) console.error('addUserButton not found');
    if (!addProjectButton) console.error('addProjectButton not found');
    if (!addPlaceButton) console.error('addPlaceButton not found');
    if (!addObservationFieldButton) console.error('addObservationFieldButton not found');
    if (!addAnnotationButton) console.error('addAnnotationButton not found');

    addTaxonButton.addEventListener('click', () => addField('taxon'));
    addUserButton.addEventListener('click', () => addField('user'));
    addProjectButton.addEventListener('click', () => addField('project'));
    addPlaceButton.addEventListener('click', () => addField('place'));
    addObservationFieldButton.addEventListener('click', () => addField('observationField'));
    addAnnotationButton.addEventListener('click', () => addField('annotation'));

    document.getElementById('generateUrlButton').addEventListener('click', function(e) {
        e.preventDefault();
        const url = generateURL();
        generatedUrlDiv.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
    });
});


function addField(type) {
    console.log(`Adding field of type: ${type}`);
    const container = document.getElementById(`${type}Container`);
    if (!container) {
        console.error(`Container for type '${type}' not found.`);
        return;
    }

    const fieldCount = container.querySelectorAll('.field-group').length;
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';

    if (type === 'observationField') {
        fieldGroup.innerHTML = `
            <input type="text" class="fieldName" id="${type}${fieldCount}" placeholder="Observation Field Name">
            <input type="number" class="fieldId" id="${type}Id${fieldCount}" placeholder="Field ID" readonly>
            <div class="fieldValueContainer">
                <input type="text" class="fieldValue" id="${type}Value${fieldCount}" placeholder="Field Value">
            </div>
            <p class="fieldDescription"></p>
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
        `;

        const fieldNameInput = fieldGroup.querySelector('.fieldName');
        const fieldIdInput = fieldGroup.querySelector('.fieldId');
        const fieldValueContainer = fieldGroup.querySelector('.fieldValueContainer');
        const fieldDescriptionElement = fieldGroup.querySelector('.fieldDescription');

        setupObservationFieldAutocomplete(fieldNameInput, fieldIdInput);

        fieldNameInput.addEventListener('change', () => {
            lookupObservationField(fieldNameInput.value).then(results => {
                const selectedField = results.find(f => f.id.toString() === fieldIdInput.value);
                if (selectedField) {
                    updateFieldValueInput(selectedField, fieldValueContainer);
                    fieldDescriptionElement.textContent = selectedField.description || '';
                }
            });
        });
    } else if (type === 'annotation') {
        fieldGroup.innerHTML = `
            <select id="${type}Field${fieldCount}">
                <option value="">Select Field</option>
            </select>
            <select id="${type}Value${fieldCount}">
                <option value="">Select Value</option>
            </select>
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
        `;
    } else {
        fieldGroup.innerHTML = `
            <input type="text" id="${type}${fieldCount}" placeholder="Enter ${type}">
            <input type="hidden" id="${type}Id${fieldCount}">
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
        `;
    }

    console.log(`Appending field group for type ${type} with index ${fieldCount}`);
    container.appendChild(fieldGroup);

    if (type === 'annotation') {
        setupAnnotationDropdowns(fieldCount);
    } else if (type !== 'observationField') {
        setupAutocomplete(type, fieldCount);
    }

    fieldGroup.querySelector('.removeFieldButton').addEventListener('click', removeField);
    fieldGroup.querySelector('.negationCheckbox').addEventListener('change', toggleNegation);
}

function setupAutocomplete(type, index) {
    let input, idInput;

    if (type === 'annotation') {
        input = document.getElementById(`${type}Field${index}`);
        idInput = document.getElementById(`${type}Value${index}`);
    } else {
        input = document.getElementById(`${type}${index}`);
        idInput = document.getElementById(`${type}Id${index}`);
    }

    if (!input) {
        console.error(`Input element with ID ${type}${index} not found`);
        return;
    }
    if (!idInput) {
        console.error(`ID input element with ID ${type}Id${index} not found`);
        return;
    }

    console.log(`Setting up autocomplete for type ${type} with index ${index}`);

    if (type === 'taxon') {
        setupTaxonAutocomplete(input, idInput);
    } else if (type === 'observationField') {
        setupObservationFieldAutocomplete(input, idInput);
    } else if (type === 'user') {
        setupUserAutocomplete(input, idInput);
    } else if (type === 'project') {
        setupProjectAutocomplete(input, idInput);
    } else if (type === 'annotation') {
        setupAnnotationDropdowns(index);
    } else {
        setupAutocompleteDropdown(input, window[`lookup${type.charAt(0).toUpperCase() + type.slice(1)}`], (result) => {
            idInput.value = result.id;
        });
    }

    input.addEventListener('input', () => {
        if (input.value === '') {
            clearFieldFromUrl(input.id);
        } else {
            generateURL();
        }
    });
}

function setupAnnotationDropdowns(index) {
    const fieldSelect = document.getElementById(`annotationField${index}`);
    const valueSelect = document.getElementById(`annotationValue${index}`);

    // Debugging logs
    if (!fieldSelect) {
        console.error(`fieldSelect with ID annotationField${index} not found`);
        return;
    }
    if (!valueSelect) {
        console.error(`valueSelect with ID annotationValue${index} not found`);
        return;
    }

    // Populate annotation fields
    Object.entries(controlledTerms).forEach(([term, data]) => {
        const option = document.createElement('option');
        option.value = data.id;
        option.textContent = term;
        fieldSelect.appendChild(option);
    });

    fieldSelect.addEventListener('change', () => {
        const selectedField = controlledTerms[fieldSelect.options[fieldSelect.selectedIndex].text];
        valueSelect.innerHTML = '<option value="">Select Value</option>';
        if (selectedField) {
            Object.entries(selectedField.values).forEach(([key, value]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = key;
                valueSelect.appendChild(option);
            });
        }
    });
}

function removeField(event) {
    event.target.closest('.field-group').remove();
    generateURL();
}

function toggleNegation(event) {
    const input = event.target.closest('.field-group').querySelector('input[type="text"]');
    input.dataset.negated = event.target.checked;
    generateURL();
}

function clearFieldFromUrl(fieldName) {
    const input = document.getElementById(fieldName);
    if (input) {
        input.value = '';
        input.dataset.id = '';
    }
    generateURL();
}

function generateURL() {
    console.log('Generating URL...');
    let url = 'https://www.inaturalist.org/observations/identify?';
    const params = new URLSearchParams();
    
    // Quality Grade
    const qualityGrades = Array.from(document.querySelectorAll('input[name="quality_grade"]:checked'))
        .map(input => input.value);
    if (qualityGrades.length > 0) {
        params.append('quality_grade', qualityGrades.join(','));
    }

    // Reviewed Status
    const reviewedStatus = document.querySelector('input[name="reviewed"]:checked');
    if (reviewedStatus) {
        params.append('reviewed', reviewedStatus.value);
    }

    // Taxon
    const taxonInputs = document.querySelectorAll('#taxonContainer input[type="text"]');
    console.log('Taxon inputs:', taxonInputs);
    const taxonIds = [];
    const withoutTaxonIds = [];
    taxonInputs.forEach(input => {
        const taxonId = input.nextElementSibling.value;
        if (taxonId) {
            if (input.dataset.negated === 'true') {
                withoutTaxonIds.push(taxonId);
            } else {
                taxonIds.push(taxonId);
            }
        }
    });
    if (taxonIds.length > 0) {
        params.append('taxon_ids', taxonIds.join(','));
    }
    if (withoutTaxonIds.length > 0) {
        params.append('without_taxon_id', withoutTaxonIds.join(','));
    }

    // User
    const userInputs = document.querySelectorAll('#userContainer input[type="text"]');
    console.log('User inputs:', userInputs);
    const userIds = [];
    const withoutUserIds = [];
    userInputs.forEach(input => {
        const userId = input.nextElementSibling.value;
        if (userId) {
            if (input.dataset.negated === 'true') {
                withoutUserIds.push(userId);
            } else {
                userIds.push(userId);
            }
        }
    });
    if (userIds.length > 0) {
        params.append('user_id', userIds.join(','));
    }
    if (withoutUserIds.length > 0) {
        params.append('not_user_id', withoutUserIds.join(','));
    }

    // Project
    const projectInputs = document.querySelectorAll('#projectContainer input[type="text"]');
    console.log('Project inputs:', projectInputs);
    const projectIds = [];
    const withoutProjectIds = [];
    projectInputs.forEach(input => {
        const projectId = input.nextElementSibling.value;
        if (projectId) {
            if (input.dataset.negated === 'true') {
                withoutProjectIds.push(projectId);
            } else {
                projectIds.push(projectId);
            }
        }
    });
    if (projectIds.length > 0) {
        params.append('project_id', projectIds.join(','));
    }
    if (withoutProjectIds.length > 0) {
        params.append('not_in_project', withoutProjectIds.join(','));
    }

    // Place
    const placeInputs = document.querySelectorAll('#placeContainer input[type="text"]');
    console.log('Place inputs:', placeInputs);
    const placeIds = [];
    const withoutPlaceIds = [];
    placeInputs.forEach(input => {
        const placeId = input.nextElementSibling.value;
        if (placeId) {
            if (input.dataset.negated === 'true') {
                withoutPlaceIds.push(placeId);
            } else {
                placeIds.push(placeId);
            }
        }
    });
    if (placeIds.length > 0) {
        params.append('place_id', placeIds.join(','));
    }
    if (withoutPlaceIds.length > 0) {
        params.append('not_in_place', withoutPlaceIds.join(','));
    }

    // Observation Field
    const ofInputs = document.querySelectorAll('#observationFieldContainer .field-group');
    console.log('Observation Field inputs:', ofInputs);
    ofInputs.forEach(group => {
        const fieldNameInput = group.querySelector('.fieldName');
        const fieldValueInput = group.querySelector('.fieldValue');
        const negated = group.querySelector('.negationCheckbox').checked;
        
        if (fieldNameInput && fieldValueInput) {
            const fieldName = fieldNameInput.value;
            let fieldValue = fieldValueInput.value;
            
            // Check if it's a taxon input
            if (fieldValueInput.classList.contains('taxonInput') && fieldValueInput.dataset.taxonId) {
                fieldValue = fieldValueInput.dataset.taxonId;
            }
            
            if (fieldName) {
                if (negated) {
                    params.append('without_field', fieldName);
                } else if (fieldValue) {
                    params.append(`field:${encodeURIComponent(fieldName)}`, fieldValue);
                } else {
                    params.append(`field:${encodeURIComponent(fieldName)}`, '');
                }
            }
        }
    });

    // Annotation
    const annotationInputs = document.querySelectorAll('#annotationContainer .field-group');
    console.log('Annotation inputs:', annotationInputs);
    annotationInputs.forEach(group => {
        const fieldId = group.querySelector('select:first-child').value;
        const valueId = group.querySelector('select:last-child').value;
        if (fieldId && valueId) {
            const negated = group.querySelector('.negationCheckbox').checked;
            if (negated) {
                params.append('without_term_id', fieldId);
            } else {
                params.append('term_id', fieldId);
                params.append('term_value_id', valueId);
            }
        }
    });

    const finalUrl = url + params.toString();
    console.log('Generated URL:', finalUrl);
    return finalUrl;
}

function setupUserAutocomplete(input, idInput) {
    setupAutocompleteDropdown(input, lookupUser, (result) => {
        idInput.value = result.id;
        input.value = result.login;
    });
}

function setupProjectAutocomplete(input, idInput) {
    setupAutocompleteDropdown(input, lookupProject, (result) => {
        idInput.value = result.id;
        input.value = result.title;
    });
}