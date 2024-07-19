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
        per_page: perPage
    });
    const url = `${baseUrl}?${params.toString()}`;

    return fetch(url)
        .then(response => response.json())
        .then(data => data.results);
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
            displayName: user.login,
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
                        suggestion.textContent = result.name || result.title || result.login;
                        suggestion.addEventListener('click', () => {
                            onSelectFunction(result, inputElement);
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
    setupAutocompleteDropdown(fieldNameInput, lookupObservationField, (result) => {
        fieldIdInput.value = result.id;
        if (fieldDescriptionElement) {
            fieldDescriptionElement.textContent = result.description || '';
        }
        updateFieldValueInput(result, fieldValueContainer);
    });
}

function updateFieldValueInput(field, container) {
    container.innerHTML = '';
    let input;

    switch (field.datatype) {
        case 'taxon':
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'fieldValue taxonInput';
            input.placeholder = 'Enter species name';
            setupTaxonAutocomplete(input);
            break;
        case 'text':
        case 'date':
        case 'datetime':
        case 'time':
            input = document.createElement('input');
            input.type = field.datatype;
            input.className = 'fieldValue';
            break;
        case 'numeric':
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'fieldValue';
            break;
        case 'boolean':
            input = document.createElement('select');
            input.className = 'fieldValue';
            ['', 'Yes', 'No'].forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option;
                input.appendChild(opt);
            });
            break;
        default:
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'fieldValue';
    }

    input.placeholder = 'Field Value';
    container.appendChild(input);

    if (field.allowed_values && field.datatype !== 'taxon') {
        const datalist = document.createElement('datalist');
        datalist.id = `allowedValues-${field.id || Date.now()}`;
        field.allowed_values.split('|').forEach(value => {
            const option = document.createElement('option');
            option.value = value.trim();
            datalist.appendChild(option);
        });
        container.appendChild(datalist);
        input.setAttribute('list', datalist.id);
    }

    return input;
}

function setupTaxonAutocomplete(inputElement, idElement) {
    const suggestionContainer = document.createElement('div');
    suggestionContainer.className = 'taxonSuggestions';
    inputElement.parentNode.insertBefore(suggestionContainer, inputElement.nextSibling);

    let debounceTimeout;

    function showTaxonSuggestions() {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            if (inputElement.value.length < 2) {
                suggestionContainer.innerHTML = '';
                return;
            }
            lookupTaxon(inputElement.value)
                .then(taxa => {
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
                            }
                        });
                        suggestionContainer.appendChild(suggestion);
                    });
                    const inputRect = inputElement.getBoundingClientRect();
                    const containerRect = inputElement.closest('.taxonIdInputs').getBoundingClientRect();
                    suggestionContainer.style.top = `${inputRect.bottom - containerRect.top}px`;
                    suggestionContainer.style.left = `${inputRect.left - containerRect.left}px`;
                    suggestionContainer.style.width = `${inputRect.width}px`;
                })
                .catch(error => console.error('Error fetching taxa:', error));
        }, 300);
    }

    inputElement.addEventListener('input', showTaxonSuggestions);
    inputElement.addEventListener('focus', showTaxonSuggestions);

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!inputElement.contains(event.target) && !suggestionContainer.contains(event.target)) {
            suggestionContainer.innerHTML = '';
        }
    });
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