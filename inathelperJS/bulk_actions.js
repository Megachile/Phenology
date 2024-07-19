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
        const encodedUrl = encodeURI(url); // Properly encode the URL
        const link = document.createElement('a');
        link.href = encodedUrl;
        link.target = '_blank';
        link.textContent = url; // Use raw URL as text content to avoid HTML entity issues
        generatedUrlDiv.innerHTML = ''; // Clear previous content
        generatedUrlDiv.appendChild(link); // Append new link
    });
});


function addField(type) {
    const container = document.getElementById(`${type}Container`);
    if (!container) {
        console.error(`Container for type '${type}' not found.`);
        return;
    }

    const fieldCount = container.querySelectorAll('.field-group').length;
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';

    if (type === 'taxon') {
        fieldGroup.innerHTML = `
            <input type="text" id="${type}${fieldCount}" placeholder="Enter ${type}">
            <input type="text" id="${type}Id${fieldCount}" placeholder="${type} ID" readonly>
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
        `;
    } else {
        fieldGroup.innerHTML = `
            <input type="text" id="${type}${fieldCount}" placeholder="Enter ${type}">
            <input type="text" id="${type}Id${fieldCount}" placeholder="${type} ID" readonly>
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
        `;
    }

    console.log(`Adding field of type: ${type}`);
    container.appendChild(fieldGroup);

    if (type === 'annotation') {
        setupAnnotationDropdowns(fieldCount);
    } else {
        setupAutocomplete(type, fieldCount);
    }

    fieldGroup.querySelector('.removeFieldButton').addEventListener('click', removeField);
    fieldGroup.querySelector('.negationCheckbox').addEventListener('change', toggleNegation);

    console.log(`Field added: `, fieldGroup);
}

function setupAutocomplete(type, index) {
    let input = document.getElementById(`${type}${index}`);
    let idInput = document.getElementById(`${type}Id${index}`);

    if (!input || !idInput) {
        console.error(`Input elements not found for ${type}${index}`);
        return;
    }

    console.log(`Setting up autocomplete for type ${type} with index ${index}`);

    if (type === 'taxon') {
        setupTaxonAutocomplete(input, idInput);
    } else {
        setupAutocompleteDropdown(input, window[`lookup${type.charAt(0).toUpperCase() + type.slice(1)}`], (result) => {
            idInput.value = result.id;
            input.value = result.name || result.title || result.login;
            console.log(`Autocomplete selection for ${type}:`, { value: input.value, id: idInput.value });
            console.log(`ID input (${type}Id${index}) value set to:`, idInput.value);
        });
    }

    input.addEventListener('input', () => {
        if (input.value === '') {
            idInput.value = '';
            console.log(`Cleared ID for ${type}${index}`);
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
    let params = [];

    // Quality Grade
    const qualityGrades = Array.from(document.querySelectorAll('input[name="quality_grade"]:checked'))
        .map(input => input.value);
    if (qualityGrades.length > 0) {
        params.push(`quality_grade=${encodeURIComponent(qualityGrades.join(','))}`);
        console.log('Added quality grade:', params[params.length - 1]);
    }

    // Reviewed Status
    const reviewedStatus = document.querySelector('input[name="reviewed"]:checked');
    if (reviewedStatus) {
        params.push(`reviewed=${encodeURIComponent(reviewedStatus.value)}`);
        console.log('Added reviewed status:', params[params.length - 1]);
    }

    function processInputs(type) {
        const container = document.getElementById(`${type}Container`);
        const inputGroups = container.querySelectorAll('.field-group');
        const ids = [];
        const withoutIds = [];

        inputGroups.forEach((group, index) => {
            const input = group.querySelector(`#${type}${index}`);
            const idInput = group.querySelector(`#${type}Id${index}`);
            const negated = group.querySelector('.negationCheckbox').checked;

            if (input && idInput && idInput.value) {
                console.log(`${type} input ${index}:`, {
                    value: input.value,
                    id: idInput.value,
                    negated: negated
                });

                if (negated) {
                    withoutIds.push(idInput.value);
                } else {
                    ids.push(idInput.value);
                }
            }
        });

        return { ids, withoutIds };
    }

    // Process each input type
    const types = ['taxon', 'user', 'project', 'place'];
    types.forEach(type => {
        const { ids, withoutIds } = processInputs(type);
        
        if (ids.length > 0) {
            params.push(`${type}_id=${encodeURIComponent(ids.join(','))}`);
            console.log(`Added ${type} ids:`, params[params.length - 1]);
        }
        if (withoutIds.length > 0) {
            let withoutParam;
            switch(type) {
                case 'place':
                    withoutParam = 'not_in_place';
                    break;
                case 'user':
                    withoutParam = 'not_user_id';
                    break;
                case 'project':
                    withoutParam = 'not_in_project';
                    break;
                case 'taxon':
                    withoutParam = 'without_taxon_id';
                    break;
            }
            params.push(`${withoutParam}=${encodeURIComponent(withoutIds.join(','))}`);
            console.log(`Added ${type} without ids:`, params[params.length - 1]);
        }
    });

    // Observation Field
    const ofInputs = document.querySelectorAll('#observationFieldContainer .field-group');
    ofInputs.forEach((group, index) => {
        const fieldNameInput = group.querySelector('.fieldName');
        const fieldValueInput = group.querySelector('.fieldValue');
        const negated = group.querySelector('.negationCheckbox').checked;
        
        if (fieldNameInput && fieldValueInput) {
            const fieldName = fieldNameInput.value;
            let fieldValue = fieldValueInput.value;
            
            console.log(`Observation Field ${index}:`, { fieldName, fieldValue, negated });
            
            if (fieldName) {
                if (negated) {
                    params.push(`without_field=${encodeURIComponent(fieldName)}`);
                } else if (fieldValue) {
                    params.push(`field:${encodeURIComponent(fieldName)}=${encodeURIComponent(fieldValue)}`);
                } else {
                    params.push(`field:${encodeURIComponent(fieldName)}=`);
                }
                console.log('Added Observation Field:', params[params.length - 1]);
            }
        }
    });

    // Annotation
    const annotationInputs = document.querySelectorAll('#annotationContainer .field-group');
    annotationInputs.forEach((group, index) => {
        const fieldSelect = group.querySelector('select:first-child');
        const valueSelect = group.querySelector('select:last-child');
        
        if (fieldSelect && valueSelect) {
            const fieldId = fieldSelect.value;
            const valueId = valueSelect.value;
            const negated = group.querySelector('.negationCheckbox').checked;
            
            console.log(`Annotation ${index}:`, { fieldId, valueId, negated });
            
            if (fieldId && valueId) {
                if (negated) {
                    params.push(`without_term_id=${encodeURIComponent(fieldId)}`);
                } else {
                    params.push(`term_id=${encodeURIComponent(fieldId)}`);
                    params.push(`term_value_id=${encodeURIComponent(valueId)}`);
                }
                console.log('Added Annotation:', params[params.length - 1]);
            }
        }
    });

    const rawUrl = url + params.join('&');
    console.log('Raw generated URL:', rawUrl);

    // Check for any unexpected encodings
    const encodedUrl = encodeURI(rawUrl);
    console.log('Encoded URL:', encodedUrl);

    if (rawUrl !== encodedUrl) {
        console.warn('URL encoding changed some characters. Differences:');
        for (let i = 0; i < rawUrl.length; i++) {
            if (rawUrl[i] !== encodedUrl[i]) {
                console.warn(`Position ${i}: '${rawUrl[i]}' became '${encodedUrl[i]}'`);
            }
        }
    }

    return rawUrl;
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