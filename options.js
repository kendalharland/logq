// Function to create a new rule element
function createRuleElement() {
    const template = document.getElementById('ruleTemplate');
    const ruleElement = template.content.cloneNode(true);
    document.getElementById('rulesContainer').appendChild(ruleElement);
}

// Function to validate and save rules
async function saveRules() {
    const rules = [];
    const containers = document.querySelectorAll('.rule-container');
    const saveStatus = document.getElementById('saveStatus');

    for (const container of containers) {
        const pattern = container.querySelector('.pattern-input').value;
        const replacement = container.querySelector('.code-editor').value;
        const errorDiv = container.querySelector('.error');

        try {
            rules.push({
                pattern,
                // TODO: Use a well-known templating engine.
                replacement,
            });

            errorDiv.style.display = 'none';
        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
            errorDiv.style.display = 'block';
            saveStatus.textContent = 'Error saving rules. Please check the errors above.';
            return;
        }
    }

    // Save to Chrome storage
    await chrome.storage.local.set({ highlightRules: rules });
    saveStatus.textContent = 'Rules saved successfully!';
    setTimeout(() => {
        saveStatus.textContent = '';
    }, 2000);
}

// Function to load saved rules
async function loadRules() {
    const { highlightRules = [] } = await chrome.storage.local.get('highlightRules');
    
    highlightRules.forEach(rule => {
        createRuleElement();
        const container = document.querySelector('.rule-container:last-child');
        container.querySelector('.pattern-input').value = rule.pattern;
        container.querySelector('.code-editor').value = rule.replacement;
    });

    if (highlightRules.length === 0) {
        createRuleElement();
    }
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadRules();

    document.getElementById('addRule').addEventListener('click', createRuleElement);
    document.getElementById('saveRules').addEventListener('click', saveRules);

    // Event delegation for dynamic elements
    document.getElementById('rulesContainer').addEventListener('click', (e) => {
        if (e.target.classList.contains('test-rule')) {
            testRule(e.target.closest('.rule-container'));
        } else if (e.target.classList.contains('remove-rule')) {
            const containers = document.querySelectorAll('.rule-container');
            if (containers.length > 1) {
                e.target.closest('.rule-container').remove();
            } else {
                alert('You must have at least one rule');
            }
        }
    });
});