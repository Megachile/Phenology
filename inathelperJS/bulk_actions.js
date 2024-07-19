// bulk_actions.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('observationSelectionForm');
    const generatedUrlDiv = document.getElementById('generatedUrl');

    // Setup autocomplete for taxon, place, project inputs
    setupAutocompleteDropdown(document.getElementById('taxonInput'), lookupTaxon, (result) => {
        document.getElementById('taxonId').value = result.id;
    });

    setupAutocompleteDropdown(document.getElementById('placeInput'), lookupPlace, (result) => {
        document.getElementById('placeId').value = result.id;
    });

    setupAutocompleteDropdown(document.getElementById('projectInput'), lookupProject, (result) => {
        document.getElementById('projectId').value = result.id;
    });

    // Setup autocomplete for user input
    setupAutocompleteDropdown(document.getElementById('userInput'), lookupUser, (result) => {
        document.getElementById('userId').value = result.id;
    });

    const observationFieldNameInput = document.getElementById('observationFieldName');
    const observationFieldIdInput = document.getElementById('observationFieldId');
    const fieldValueContainer = document.getElementById('fieldValueContainer');
    const fieldDescription = document.getElementById('fieldDescription');

    setupFieldAutocomplete(observationFieldNameInput, observationFieldIdInput, fieldValueContainer, fieldDescription);

    document.getElementById('addTaxonButton').addEventListener('click', () => addField('taxon'));
    document.getElementById('addUserButton').addEventListener('click', () => addField('user'));
    document.getElementById('addProjectButton').addEventListener('click', () => addField('project'));

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const url = generateURL();
        generatedUrlDiv.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
    });
});

function generateURL() {
    let url = 'https://www.inaturalist.org/observations/identify?';
    const params = new URLSearchParams();

    // Quality Grade
    const qualityGrades = Array.from(document.querySelectorAll('input[name="quality_grade"]:checked'))
        .map(input => input.value);
    if (qualityGrades.length > 0) {
        params.append('quality_grade', qualityGrades.join(','));
        // Add verifiable=any if casual is selected
        if (qualityGrades.includes('casual')) {
            params.append('verifiable', 'any');
        }
    }

    // Reviewed Status
    const reviewedStatus = document.querySelector('input[name="reviewed"]:checked').value;
    if (reviewedStatus === 'true') {
        params.append('reviewed', 'true');
    } else if (reviewedStatus === 'any') {
        params.append('reviewed', 'any');
    } else if (reviewedStatus === 'false') {       
    }

    // Taxon
    const taxonId = document.getElementById('taxonId').value;
    if (taxonId) {
        params.append('taxon_id', taxonId);
    }

    // Place
    const placeId = document.getElementById('placeId').value;
    if (placeId) {
        params.append('place_id', placeId);
    }

    // User
    const userId = document.getElementById('userId').value;
    if (userId) {
        params.append('user_id', userId);
    }

    // Project
    const projectId = document.getElementById('projectId').value;
    if (projectId) {
        params.append('project_id', projectId);
    }

    // Observation Fields
    const observationFields = document.querySelectorAll('.action-item[data-action-type="observationField"]');
    observationFields.forEach(field => {
        const fieldId = field.querySelector('.fieldId').value;
        const fieldValue = field.querySelector('.fieldValue').value;
        if (fieldId && fieldValue) {
            params.append(`field:${fieldId}`, fieldValue);
        }
    });

    return url + params.toString();
}

function clearFieldFromUrl(fieldName) {
    const input = document.getElementById(fieldName);
    if (input) {
        input.value = '';
        input.dataset.id = '';
    }
    generateURL();
}

document.querySelectorAll('input[type="text"]').forEach(input => {
    input.addEventListener('input', () => {
        if (input.value === '') {
            clearFieldFromUrl(input.id);
        } else {
            generateURL();
        }
    });
});

function addField(type) {
    const container = document.getElementById(`${type}Container`);
    const fieldCount = container.querySelectorAll('.field-group').length;
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    fieldGroup.innerHTML = `
        <input type="text" id="${type}${fieldCount}" placeholder="Enter ${type}">
        <input type="hidden" id="${type}Id${fieldCount}">
        <button class="removeFieldButton">Remove</button>
        <label><input type="checkbox" class="negationCheckbox"> Negate</label>
    `;
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
    } else {
        setupAutocompleteDropdown(input, window[`lookup${type.charAt(0).toUpperCase() + type.slice(1)}`], (result) => {
            idInput.value = result.id;
        });
    }
}