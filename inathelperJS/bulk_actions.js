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

    // Setup observation field inputs
    const addObservationFieldButton = document.getElementById('addObservationField');
    addObservationFieldButton.addEventListener('click', () => addActionToForm('observationField'));

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const url = generateURL();
        generatedUrlDiv.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
    });
});

function generateURL() {
    let url = 'https://www.inaturalist.org/observations?';
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
    if (reviewedStatus !== 'any') {
        params.append('reviewed', reviewedStatus);
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