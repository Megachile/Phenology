document.addEventListener('DOMContentLoaded', function() {
    const generatedUrlDiv = document.getElementById('generatedUrl');

    document.getElementById('addTaxonButton').addEventListener('click', () => addField('taxon'));
    document.getElementById('addUserButton').addEventListener('click', () => addField('user'));
    document.getElementById('addProjectButton').addEventListener('click', () => addField('project'));
    document.getElementById('addPlaceButton').addEventListener('click', () => addField('place'));
    document.getElementById('addObservationFieldButton').addEventListener('click', () => addField('observationField'));
    document.getElementById('addAnnotationButton').addEventListener('click', () => addField('annotation'));

    document.getElementById('generateUrlButton').addEventListener('click', function(e) {
        e.preventDefault();
        const url = generateURL();
        generatedUrlDiv.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
    });
});

function addField(type) {
    const container = document.getElementById(`${type}Container`);
    const fieldCount = container.querySelectorAll('.field-group').length;
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    
        let innerHTML = `
        <input type="text" id="${type}${fieldCount}" placeholder="Enter ${type}">
        <input type="hidden" id="${type}Id${fieldCount}">
    `;

    if (type === 'observationField') {
        innerHTML += `<input type="text" id="${type}Value${fieldCount}" placeholder="Field Value (optional)">`;
    } else if (type === 'annotation') {
        innerHTML = `
            <select id="${type}Field${fieldCount}">
                <option value="">Select Field</option>
            </select>
            <select id="${type}Value${fieldCount}">
                <option value="">Select Value</option>
            </select>
        `;
    }

    innerHTML += `
        <button class="removeFieldButton">Remove</button>
        <label><input type="checkbox" class="negationCheckbox"> Negate</label>
    `;

    fieldGroup.innerHTML = innerHTML;
    container.appendChild(fieldGroup);
    setupAutocomplete(type, fieldCount);

    fieldGroup.querySelector('.removeFieldButton').addEventListener('click', removeField);
    fieldGroup.querySelector('.negationCheckbox').addEventListener('change', toggleNegation);
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

function setupAutocomplete(type, index) {
    const input = document.getElementById(`${type}${index}`);
    const idInput = document.getElementById(`${type}Id${index}`);
    
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

function setupObservationFieldAutocomplete(input, idInput) {
    setupAutocompleteDropdown(input, lookupObservationField, (result) => {
        idInput.value = result.id;
        input.value = result.name;
        
        const container = input.closest('.field-group');
        const valueInput = container.querySelector('[id^="observationFieldValue"]');
        
        if (result.datatype === 'taxon') {
            setupTaxonAutocomplete(valueInput);
        }
    });
}

function setupAnnotationDropdowns(index) {
    const fieldSelect = document.getElementById(`annotationField${index}`);
    const valueSelect = document.getElementById(`annotationValue${index}`);

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