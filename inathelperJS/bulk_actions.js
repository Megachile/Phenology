document.addEventListener('DOMContentLoaded', function() {
    const generatedUrlDiv = document.getElementById('generatedUrl');

    const addTaxonButton = document.getElementById('addTaxonButton');
    const addUserButton = document.getElementById('addUserButton');
    const addProjectButton = document.getElementById('addProjectButton');
    const addPlaceButton = document.getElementById('addPlaceButton');
    const addObservationFieldButton = document.getElementById('addObservationFieldButton');
    const addAnnotationButton = document.getElementById('addAnnotationButton');
    const addIdTaxonButton = document.getElementById('addIdTaxonButton');
    const addIdentifierButton = document.getElementById('addIdentifierButton');
    setupDateSelector('observed');
    setupDateSelector('added');

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
    addIdTaxonButton.addEventListener('click', () => addField('idTaxon'));
    addIdentifierButton.addEventListener('click', () => addField('identifier'));
   
    const filtersFieldset = document.getElementById('additionalFilters');

    const toggleFiltersButton = document.getElementById('toggleFilters');
    const toggleAdditionalParamsButton = document.getElementById('toggleAdditionalParams');
    const additionalParamsFieldset = document.getElementById('additionalParams');

  function setupCollapsible(toggleButton, fieldset) {
    toggleButton.addEventListener('click', function() {
      fieldset.classList.toggle('collapsed');
      this.textContent = fieldset.classList.contains('collapsed') 
        ? this.textContent.replace('▲', '▼')
        : this.textContent.replace('▼', '▲');
    });
  }

  setupCollapsible(toggleFiltersButton, filtersFieldset);
  setupCollapsible(toggleAdditionalParamsButton, additionalParamsFieldset);
  setupCollapsible(toggleCategories, categoriesFieldset);
  setupCollapsible(toggleSortingRanking, sortingRankingFieldset);

   // Add event listeners for new inputs
   const newInputs = [
    'listIdInput', 'descriptionTagInput', 'accountAgeMin', 'accountAgeMax',
    'noPhotosToggle', 'noSoundsToggle', 'hasIdentificationsToggle'
  ];

  newInputs.forEach(inputId => {
    const element = document.getElementById(inputId);
    if (element) {
      element.addEventListener('change', generateURL);
    }
  });

  // Add event listeners for license checkboxes
  const licenseCheckboxes = document.querySelectorAll('#photoLicenses input, #soundLicenses input');
  licenseCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', generateURL);
  });

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

    setupToggleListeners();
    
});

function setupDateSelector(type) {
    const dateTypeInputs = document.querySelectorAll(`input[name="${type}DateType"]`);
    const containers = {
        exact: document.getElementById(`${type}ExactDateContainer`),
        range: document.getElementById(`${type}RangeDateContainer`),
        months: document.getElementById(`${type}MonthsContainer`),
        years: document.getElementById(`${type}YearsContainer`)
    };
    const monthCheckboxes = document.getElementById(`${type}MonthCheckboxes`);
    const yearSelect = document.getElementById(`${type}YearSelect`);

    if (!monthCheckboxes || !yearSelect) {
        console.error(`Required elements not found for ${type} date selector`);
        return;
    }

    // Populate month checkboxes
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    monthCheckboxes.innerHTML = ''; // Clear existing checkboxes
    months.forEach((month, index) => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${type}Month${index + 1}`;
        checkbox.value = index + 1;
        const label = document.createElement('label');
        label.htmlFor = `${type}Month${index + 1}`;
        label.textContent = month;
        monthCheckboxes.appendChild(checkbox);
        monthCheckboxes.appendChild(label);
        monthCheckboxes.appendChild(document.createElement('br'));
    });

    // Populate year select
    yearSelect.innerHTML = ''; // Clear existing options
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1900; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }

    // Handle radio button changes
    dateTypeInputs.forEach(input => {
        input.addEventListener('change', function() {
            Object.values(containers).forEach(container => {
                if (container) container.style.display = 'none';
            });
            if (this.value in containers && containers[this.value]) {
                containers[this.value].style.display = 'block';
            }
        });
    });

    // Handle Select All / Deselect All for months
    const selectAllButton = document.getElementById(`selectAll${type.charAt(0).toUpperCase() + type.slice(1)}Months`);
    const deselectAllButton = document.getElementById(`deselectAll${type.charAt(0).toUpperCase() + type.slice(1)}Months`);
    
    if (selectAllButton) {
        selectAllButton.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission
            monthCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        });
    } else {
        console.error(`Select All button not found for ${type} date selector`);
    }
    
    if (deselectAllButton) {
        deselectAllButton.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission
            monthCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        });
    } else {
        console.error(`Deselect All button not found for ${type} date selector`);
    }
}



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
            <label><input type="checkbox" class="exactCheckbox"> Exact</label>
        `;
    } else if (type === 'idTaxon') {
        fieldGroup.innerHTML = `
            <input type="text" id="${type}${fieldCount}" placeholder="Enter ID taxon">
            <input type="text" id="${type}Id${fieldCount}" placeholder="ID Taxon ID" readonly>
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
        `;
    } else if (type === 'identifier') {
        fieldGroup.innerHTML = `
            <input type="text" id="${type}${fieldCount}" placeholder="Enter identifier">
            <input type="text" id="${type}Id${fieldCount}" placeholder="Identifier ID" readonly>
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
        `;
    } else if (type === 'project') {
        fieldGroup.innerHTML = `
            <input type="text" id="${type}${fieldCount}" placeholder="Enter ${type}">
            <input type="text" id="${type}Id${fieldCount}" placeholder="${type} ID" readonly>
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
            <label><input type="checkbox" class="rulesCheckbox"> Follows Project Rules</label>
        `;
    } else if (type === 'annotation') {
        fieldGroup.innerHTML = `
            <select class="annotationField">
                <option value="">Select Field</option>
            </select>
            <select class="annotationValue" disabled>
                <option value="">Select Value</option>
            </select>
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
            <span class="negationNote" style="display:none; color: #888; font-style: italic;">No value: selects obs. blank for this annotation. With value: selects obs. with other values, not blank.</span>
        `;
        setupAnnotationDropdowns(fieldCount);
    } else if (type === 'observationField') {
        fieldGroup.innerHTML = `
            <input type="text" id="${type}${fieldCount}" placeholder="Enter ${type}">
            <input type="text" id="${type}Id${fieldCount}" placeholder="${type} ID" readonly>
            <button class="removeFieldButton">Remove</button>
            <label><input type="checkbox" class="negationCheckbox"> Without</label>
            <span class="negationNote" style="display:none; color: #888; font-style: italic;">Selects obs. without this field. Specific value exclusion not supported.</span>   
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
    } else if (type === 'idTaxon' || type === 'taxon') {
        setupTaxonAutocomplete(
            fieldGroup.querySelector(`#${type}${fieldCount}`),
            fieldGroup.querySelector(`#${type}Id${fieldCount}`)
        );
    } else if (type === 'identifier') {
        setupAutocompleteDropdown(
            fieldGroup.querySelector(`#${type}${fieldCount}`),
            lookupUser,
            (result) => {
                fieldGroup.querySelector(`#${type}Id${fieldCount}`).value = result.id;
            }
        );
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
    const fieldGroup = document.querySelectorAll('.field-group')[index];
    if (!fieldGroup) {
        console.error('Field group not found for index:', index);
        return;
    }

    const fieldSelect = fieldGroup.querySelector('.annotationField');
    const valueSelect = fieldGroup.querySelector('.annotationValue');

    if (!fieldSelect || !valueSelect) {
        console.error('Annotation selects not found in field group:', fieldGroup);
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
        if (selectedField && fieldSelect.value !== "") {
            Object.entries(selectedField.values).forEach(([key, value]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = key;
                valueSelect.appendChild(option);
            });
            valueSelect.disabled = false;
        } else {
            valueSelect.disabled = true;
        }
    });

    // Ensure value select is initially disabled
    valueSelect.disabled = true;
}

function removeField(event) {
    event.target.closest('.field-group').remove();
    generateURL();
}

function toggleNegation(event) {
    const fieldGroup = event.target.closest('.field-group');
    const isNegated = event.target.checked;
    const negationNote = fieldGroup.querySelector('.negationNote');
    
    negationNote.style.display = isNegated ? 'inline' : 'none';
    
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
        params.push(`quality_grade=${qualityGrades.join(',')}`);
    }

    // Reviewed Status
    const reviewedStatus = document.querySelector('input[name="reviewed"]:checked');
    if (reviewedStatus) {
        params.push(`reviewed=${encodeURIComponent(reviewedStatus.value)}`);
        console.log('Added reviewed status:', params[params.length - 1]);
    }

    // Handle toggles
    const toggles = ['captive', 'sounds', 'photos', 'threatened', 'introduced', 'native', 'popular', 'identified', 'description', 'tags', 'geo', 'mappable'];

    toggles.forEach(toggle => {
        const selectedValue = document.querySelector(`input[name="${toggle}"]:checked`).value;
        if (selectedValue !== 'any') {
            params.push(`${toggle}=${selectedValue}`);
        }
    });

    function processInputs(type) {
        const container = document.getElementById(`${type}Container`);
        const inputGroups = container.querySelectorAll('.field-group');
        const ids = [];
        const withoutIds = [];
        const exactIds = [];
        const withoutDirectIds = [];
        const applyRulesIds = [];
        const notMatchingRulesIds = [];
    
        inputGroups.forEach((group, index) => {
            const input = group.querySelector(`#${type}${index}`);
            const idInput = group.querySelector(`#${type}Id${index}`);
            const negated = group.querySelector('.negationCheckbox').checked;
            const exact = group.querySelector('.exactCheckbox')?.checked;
            const applyRules = group.querySelector('.rulesCheckbox')?.checked;
    
            if (input && idInput && idInput.value) {
                console.log(`${type} input ${index}:`, {
                    value: input.value,
                    id: idInput.value,
                    negated: negated,
                    exact: exact,
                    applyRules: applyRules
                });
    
                if (negated) {
                    if (type === 'taxon' && exact) {
                        withoutDirectIds.push(idInput.value);
                    } else if (type === 'project' && applyRules) {
                        notMatchingRulesIds.push(idInput.value);
                    } else {
                        withoutIds.push(idInput.value);
                    }
                } else if (exact) {
                    exactIds.push(idInput.value);
                } else if (applyRules) {
                    applyRulesIds.push(idInput.value);
                } else {
                    ids.push(idInput.value);
                }
            }
        });
    
        return { ids, withoutIds, exactIds, withoutDirectIds, applyRulesIds, notMatchingRulesIds };
    }
    
    const types = ['taxon', 'idTaxon', 'user', 'identifier', 'project', 'place'];
    types.forEach(type => {
        const { ids, withoutIds, exactIds, withoutDirectIds, applyRulesIds, notMatchingRulesIds } = processInputs(type);
        
        if (ids.length > 0) {
            switch(type) {
                case 'idTaxon':
                    params.push(`ident_taxon_id_exclusive=${encodeURIComponent(ids.join(','))}`);
                    break;
                case 'identifier':
                    params.push(`ident_user_id=${encodeURIComponent(ids.join(','))}`);
                    break;
                case 'project':
                    params.push(`project_id=${encodeURIComponent(ids.join(','))}`);
                    break;
                default:
                    params.push(`${type}_id=${encodeURIComponent(ids.join(','))}`);
            }
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
                case 'identifier':
                    withoutParam = 'without_ident_user_id';
                    break;
                case 'project':
                    withoutParam = 'not_in_project';
                    break;
                case 'taxon':
                    withoutParam = 'without_taxon_id';
                    break;
                case 'idTaxon':
                    withoutParam = 'without_ident_taxon_id';
                    break;
            }
            params.push(`${withoutParam}=${encodeURIComponent(withoutIds.join(','))}`);
            console.log(`Added ${type} without ids:`, params[params.length - 1]);
        }
        if (type === 'taxon') {
            if (exactIds.length > 0) {
                params.push(`exact_taxon_id=${encodeURIComponent(exactIds.join(','))}`);
                console.log(`Added exact taxon ids:`, params[params.length - 1]);
            }
            if (withoutDirectIds.length > 0) {
                params.push(`without_direct_taxon_id=${encodeURIComponent(withoutDirectIds.join(','))}`);
                console.log(`Added without direct taxon ids:`, params[params.length - 1]);
            }
        }
        if (type === 'project') {
            if (applyRulesIds.length > 0) {
                params.push(`apply_project_rules_for=${encodeURIComponent(applyRulesIds.join(','))}`);
                console.log(`Added apply project rules ids:`, params[params.length - 1]);
            }
            if (notMatchingRulesIds.length > 0) {
                params.push(`not_matching_project_rules_for=${encodeURIComponent(notMatchingRulesIds.join(','))}`);
                console.log(`Added not matching project rules ids:`, params[params.length - 1]);
            }
        }
    });

    // dates
    addDateParams('observed', params);
    addDateParams('added', params);


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
        const fieldSelect = group.querySelector('.annotationField');
        const valueSelect = group.querySelector('.annotationValue');
        const negated = group.querySelector('.negationCheckbox').checked;
        
        if (fieldSelect.value) {
            if (negated) {
                if (valueSelect.value) {
                    // Without a specific annotation value
                    params.push(`term_id=${encodeURIComponent(fieldSelect.value)}`);
                    params.push(`without_term_value_id=${encodeURIComponent(valueSelect.value)}`);
                } else {
                    // Without annotation (no value)
                    params.push(`without_term_id=${encodeURIComponent(fieldSelect.value)}`);
                }
            } else {
                // With Annotation
                params.push(`term_id=${encodeURIComponent(fieldSelect.value)}`);
                if (valueSelect.value) {
                    // With annotation and specific value
                    params.push(`term_value_id=${encodeURIComponent(valueSelect.value)}`);
                }
            }
            console.log('Added Annotation:', params[params.length - 1]);
        }
    });

    // List ID
    const listId = document.getElementById('listIdInput').value.trim();
    if (listId) {
        params.push(`list_id=${encodeURIComponent(listId)}`);
    }

    // Description/Tag Search
    const descriptionTag = document.getElementById('descriptionTagInput').value.trim();
    if (descriptionTag) {
        params.push(`q=${encodeURIComponent(descriptionTag)}`);
    }

    // Account Age
    const accountAgeMin = document.getElementById('accountAgeMin').value;
    const accountAgeMax = document.getElementById('accountAgeMax').value;
    if (accountAgeMin) params.push(`user_after=${accountAgeMin}w`);
    if (accountAgeMax) params.push(`user_before=${accountAgeMax}w`);

    // Photo Licenses
    const photoLicenses = Array.from(document.querySelectorAll('#photoLicenses input:checked'))
        .map(input => input.value);
    if (photoLicenses.length > 0) {
        params.push(`photo_license=${photoLicenses.join(',')}`);
    }

    // Sound Licenses
    const soundLicenses = Array.from(document.querySelectorAll('#soundLicenses input:checked'))
        .map(input => input.value);
    if (soundLicenses.length > 0) {
        params.push(`sound_license=${soundLicenses.join(',')}`);
    }

      // Sorting
      const sortBy = document.getElementById('sortBy').value;
        const sortOrder = document.getElementById('sortOrder').value;
        if (sortBy && sortBy !== 'created_at') {  // Only add if it's not the default value
            params.push(`order_by=${sortBy}`);
        }
        if (sortOrder === 'asc') {  // Only add if it's not the default (descending)
            params.push(`order=asc`);
        }
  
      // Ranking
      const rankHigh = document.getElementById('rankHigh').value;
      const rankLow = document.getElementById('rankLow').value;
      if (rankHigh) {
          params.push(`hrank=${rankHigh}`);
      }
      if (rankLow) {
          params.push(`lrank=${rankLow}`);
      }
  
      // Results per page
      const perPage = document.getElementById('perPage').value;
      if (perPage && perPage !== '30') {  // Only add if it's not the default value
          params.push(`per_page=${perPage}`);
      }

    // Categories
    const categories = Array.from(document.querySelectorAll('input[name="categories"]:checked'))
                            .map(checkbox => checkbox.value);
    if (categories.length > 0) {
        params.push(`iconic_taxa=${categories.join(',')}`);
    }
    

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


function addDateParams(type, params) {
    const dateType = document.querySelector(`input[name="${type}DateType"]:checked`);
    if (!dateType || dateType.value === 'any') return; // Exit if type is 'any'

    const prefix = type === 'added' ? 'created_' : '';
    
    switch(dateType.value) {
        case 'exact':
            const exactDate = document.getElementById(`${type}ExactDate`)?.value;
            if (exactDate) {
                params.push(`${prefix}d1=${exactDate}`);
                params.push(`${prefix}d2=${exactDate}`);
            }
            break;
        case 'range':
            const startDate = document.getElementById(`${type}RangeStart`)?.value;
            const endDate = document.getElementById(`${type}RangeEnd`)?.value;
            if (startDate) params.push(`${prefix}d1=${startDate}`);
            if (endDate) params.push(`${prefix}d2=${endDate}`);
            break;
        case 'months':
            const selectedMonths = Array.from(document.querySelectorAll(`#${type}MonthCheckboxes input:checked`))
                                        .map(cb => cb.value);
            if (selectedMonths.length > 0) {
                params.push(`${prefix}month=${selectedMonths.join(',')}`);
            }
            break;
        case 'years':
            const selectedYears = Array.from(document.getElementById(`${type}YearSelect`)?.selectedOptions || [])
                                       .map(option => option.value);
            if (selectedYears.length > 0) {
                const minYear = Math.min(...selectedYears);
                const maxYear = Math.max(...selectedYears);
                params.push(`${prefix}d1=${minYear}-01-01`);
                params.push(`${prefix}d2=${maxYear}-12-31`);
            }
            break;
    }

    if (type === 'added' && dateType.value !== 'any') {
        params.push(`createdDateType=${dateType.value}`);
    }
}

function setupToggleListeners() {
    const toggles = document.querySelectorAll('.toggle-group input[type="radio"]');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', generateURL);
    });
}