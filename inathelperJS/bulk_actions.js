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
    let url = 'https://www.inaturalist.org/observations?';
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

    // Add other parameters here...

    return url + params.toString();
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