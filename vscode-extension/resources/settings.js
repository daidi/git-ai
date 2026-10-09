(function () {
    'use strict';

    var vscode = acquireVsCodeApi();
    var dataElement = document.getElementById('settings-data');
    var initialData = {};
    try {
        initialData = dataElement && dataElement.textContent
            ? JSON.parse(dataElement.textContent)
            : {};
    } catch (_error) {
        initialData = {};
    }

    var prefixes = ['g', 'p'];
    var persisted = vscode.getState() || {};
    var currentScope = persisted.scope === 'project' ? 'project' : 'global';
    var initialSnapshots = {};
    var hostBusy = initialData.busy === true;
    var configLoaded = initialData.loaded === true;

    function fieldElements(prefix) {
        return Array.prototype.slice.call(
            document.querySelectorAll('[data-scope="' + prefix + '"][data-key]')
        );
    }

    function rawFields(prefix, includeSecret) {
        var values = {};
        fieldElements(prefix).forEach(function (element) {
            var key = element.getAttribute('data-key');
            if (!key || (!includeSecret && key === 'api_key')) {
                return;
            }
            if (element.type === 'checkbox') {
                values[key] = !!element.checked;
            } else {
                values[key] = String(element.value || '');
            }
        });
        return values;
    }

    function applyDraft(prefix, draft) {
        if (!draft || typeof draft !== 'object') {
            return;
        }
        fieldElements(prefix).forEach(function (element) {
            var key = element.getAttribute('data-key');
            if (!key || key === 'api_key' || !Object.prototype.hasOwnProperty.call(draft, key)) {
                return;
            }
            if (element.type === 'checkbox') {
                element.checked = !!draft[key];
            } else {
                element.value = String(draft[key] == null ? '' : draft[key]);
            }
        });
    }

    prefixes.forEach(function (prefix) {
        initialSnapshots[prefix] = JSON.stringify(rawFields(prefix, true));
    });

    if (persisted.drafts) {
        applyDraft('g', persisted.drafts.g);
        applyDraft('p', persisted.drafts.p);
    }

    function effectiveValue(element) {
        if (!element) {
            return '';
        }
        var ownValue = element.type === 'checkbox'
            ? String(!!element.checked)
            : String(element.value || '').trim();
        if (ownValue) {
            return ownValue;
        }
        if (element.getAttribute('data-scope') === 'p') {
            var key = element.getAttribute('data-key');
            var globalElement = key
                ? document.querySelector('[data-scope="g"][data-key="' + key + '"]')
                : null;
            if (globalElement) {
                return effectiveValue(globalElement);
            }
        }
        return element.getAttribute('data-effective') || '';
    }

    function updateSummary(prefix) {
        var pane = document.getElementById(prefix === 'g' ? 'pane-global' : 'pane-project');
        if (!pane) {
            return;
        }
        var provider = pane.querySelector('[data-key="provider"]');
        var model = pane.querySelector('[data-key="model"]');
        var format = pane.querySelector('[data-key="message_format"]');
        var providerValue = effectiveValue(provider);
        var providerTarget = pane.querySelector('[data-summary="provider"]');
        var modelTarget = pane.querySelector('[data-summary="model"]');
        var formatTarget = pane.querySelector('[data-summary="format"]');
        if (providerTarget) providerTarget.textContent = providerValue || '—';
        if (modelTarget) modelTarget.textContent = effectiveValue(model) || '—';
        if (formatTarget) formatTarget.textContent = effectiveValue(format) || '—';

        var state = pane.querySelector('.connection-state');
        if (state) {
            var apiKey = document.querySelector('[data-scope="g"][data-key="api_key"]');
            var keyConfigured = initialData.apiKeyConfigured === true ||
                !!(apiKey && String(apiKey.value || '').trim());
            var isReady = providerValue === 'ollama' || keyConfigured;
            state.classList.toggle('is-ready', isReady);
            var credentialTarget = state.querySelector('[data-summary="credential"]');
            if (credentialTarget) {
                credentialTarget.textContent = providerValue === 'ollama'
                    ? 'Ollama'
                    : String(initialData.apiKeyLabel || 'API Key');
            }
        }

        if (prefix === 'g') {
            var apiField = pane.querySelector('[data-field-key="api_key"]');
            if (apiField) {
                apiField.hidden = providerValue === 'ollama';
            }
        }
    }

    function updatePromptDependencies(prefix) {
        var pane = document.getElementById(prefix === 'g' ? 'pane-global' : 'pane-project');
        if (!pane) {
            return;
        }
        var prompt = pane.querySelector('[data-key="prompt_template"]');
        var hasPrompt = !!(prompt && effectiveValue(prompt));
        ['message_format', 'smart_skip', 'explain'].forEach(function (key) {
            var control = pane.querySelector('[data-key="' + key + '"]');
            if (!control) {
                return;
            }
            control.disabled = hasPrompt || hostBusy || !configLoaded;
            control.title = hasPrompt ? String(initialData.disabledHint || '') : '';
            var field = control.closest('.field');
            if (field) field.classList.toggle('is-disabled', hasPrompt);
        });
    }

    function isDirty(prefix) {
        return JSON.stringify(rawFields(prefix, true)) !== initialSnapshots[prefix];
    }

    function paneForPrefix(prefix) {
        return document.getElementById(prefix === 'g' ? 'pane-global' : 'pane-project');
    }

    function updateActionState(prefix) {
        var pane = paneForPrefix(prefix);
        if (!pane) {
            return;
        }
        var dirty = isDirty(prefix);
        var anyDirty = prefixes.some(isDirty);
        var form = pane.querySelector('form');
        var valid = !form || form.checkValidity();
        pane.classList.toggle('is-dirty', dirty);

        var saveButton = pane.querySelector('[data-action="save"]');
        var testButton = pane.querySelector('[data-action="test"]');
        if (saveButton) saveButton.disabled = hostBusy || !configLoaded || !dirty || !valid;
        if (testButton) testButton.disabled = hostBusy || !configLoaded || anyDirty || !valid;
        var resetButton = pane.querySelector('[data-action="reset"]');
        if (resetButton) resetButton.disabled = hostBusy || !configLoaded;
    }

    function persistState() {
        if (!configLoaded) return;
        vscode.postMessage({ command: 'draftState', dirty: prefixes.some(isDirty) });
        vscode.setState({
            scope: currentScope,
            scrollY: window.scrollY,
            drafts: {
                g: rawFields('g', false),
                p: rawFields('p', false)
            }
        });
    }

    function switchTab(scope, focusTab) {
        currentScope = scope === 'project' ? 'project' : 'global';
        var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
        tabs.forEach(function (tab) {
            var active = tab.getAttribute('data-tab') === currentScope;
            tab.setAttribute('aria-selected', String(active));
            tab.setAttribute('tabindex', active ? '0' : '-1');
            if (active && focusTab) tab.focus();
        });

        Array.prototype.slice.call(document.querySelectorAll('.scope-pane')).forEach(function (pane) {
            var active = pane.id === 'pane-' + currentScope;
            pane.hidden = !active;
            pane.classList.toggle('is-active', active);
        });
        persistState();
    }

    function gatherFields(prefix) {
        var values = {};
        fieldElements(prefix).forEach(function (element) {
            var key = element.getAttribute('data-key');
            if (!key) return;
            if (element.type === 'checkbox') {
                if (key === 'install_hook' || element.getAttribute('data-value-type') === 'boolean') {
                    values[key] = !!element.checked;
                }
                return;
            }
            var value = String(element.value || '').trim();
            if (element.type === 'number' && value !== '') {
                var numberValue = parseInt(value, 10);
                if (!Number.isNaN(numberValue)) values[key] = numberValue;
                return;
            }
            if (value === 'true') values[key] = true;
            else if (value === 'false') values[key] = false;
            else if (value !== '') values[key] = value;
        });
        return values;
    }

    function setBusy(scope, action, active) {
        hostBusy = active;
        var pane = document.getElementById('pane-' + scope);
        if (!pane) return;
        Array.prototype.slice.call(pane.querySelectorAll('[data-action]')).forEach(function (button) {
            var isTarget = button.getAttribute('data-action') === action;
            button.classList.toggle('is-loading', isTarget && active);
            var icon = button.querySelector('.codicon');
            if (icon && isTarget && active && !icon.getAttribute('data-base-icon')) {
                var baseIcon = Array.prototype.find.call(icon.classList, function (className) {
                    return className.indexOf('codicon-') === 0 && className !== 'codicon-loading';
                });
                if (baseIcon) {
                    icon.setAttribute('data-base-icon', baseIcon);
                    icon.classList.remove(baseIcon);
                    icon.classList.add('codicon-loading');
                }
            } else if (icon && isTarget && !active) {
                var originalIcon = icon.getAttribute('data-base-icon');
                if (originalIcon) {
                    icon.classList.remove('codicon-loading');
                    icon.classList.add(originalIcon);
                    icon.removeAttribute('data-base-icon');
                }
            }
            button.disabled = active || (
                !active && (
                    (button.getAttribute('data-action') === 'save' && !isDirty(scope === 'global' ? 'g' : 'p')) ||
                    (button.getAttribute('data-action') === 'test' && isDirty(scope === 'global' ? 'g' : 'p'))
                )
            );
        });
    }

    window.addEventListener('message', function (event) {
        var message = event.data || {};
        if (message.command !== 'modelCatalog' || !message.catalog || !Array.isArray(message.catalog.models)) {
            return;
        }
        Array.prototype.slice.call(document.querySelectorAll('[data-model-options]')).forEach(function (list) {
            while (list.firstChild) list.removeChild(list.firstChild);
            message.catalog.models.forEach(function (model) {
                if (!model || !model.id) return;
                var option = document.createElement('option');
                option.value = String(model.id);
                if (model.display_name) option.label = String(model.display_name);
                list.appendChild(option);
            });
        });
    });

    function submitAction(action, scope) {
        if (hostBusy || !configLoaded) return;
        var pane = document.getElementById('pane-' + scope);
        var form = pane ? pane.querySelector('form') : null;
        if ((action === 'save' || action === 'test') && form && !form.reportValidity()) {
            return;
        }
        var prefix = scope === 'global' ? 'g' : 'p';
        setBusy(scope, action, true);
        updateControls();
        if (action === 'save' || action === 'reset') {
            vscode.setState({
                scope: scope,
                scrollY: 0,
                drafts: {
                    g: scope === 'global' ? {} : rawFields('g', false),
                    p: scope === 'project' ? {} : rawFields('p', false)
                }
            });
        }
        if (action === 'save') {
            vscode.postMessage({ command: 'save', scope: scope, data: gatherFields(prefix) });
        } else {
            vscode.postMessage({ command: action === 'test' ? 'testConfig' : 'reset', scope: scope });
        }
    }

    document.addEventListener('input', function (event) {
        var control = event.target && event.target.closest
            ? event.target.closest('[data-scope][data-key]')
            : null;
        if (!control) return;
        var prefix = control.getAttribute('data-scope');
        if (!prefix) return;
        updatePromptDependencies(prefix);
        updateSummary(prefix);
        if (prefix === 'g') {
            updatePromptDependencies('p');
            updateSummary('p');
        }
        prefixes.forEach(updateActionState);
        persistState();
    });

    document.addEventListener('change', function (event) {
        var control = event.target && event.target.closest
            ? event.target.closest('[data-scope][data-key]')
            : null;
        if (!control) return;
        var prefix = control.getAttribute('data-scope');
        if (!prefix) return;
        updatePromptDependencies(prefix);
        updateSummary(prefix);
        if (prefix === 'g') {
            updatePromptDependencies('p');
            updateSummary('p');
        }
        prefixes.forEach(updateActionState);
        persistState();
    });

    document.addEventListener('click', function (event) {
        var target = event.target && event.target.closest
            ? event.target.closest('[data-tab], [data-action], [data-secret-toggle], [data-cli-action]')
            : null;
        if (!target) return;
        var cliAction = target.getAttribute('data-cli-action');
        if (cliAction) {
            if (hostBusy) return;
            if (cliAction !== 'cliCheck' && prefixes.some(isDirty)) {
                var feedback = document.getElementById('cli-update-status');
                if (feedback) feedback.textContent = initialData.unsavedHint || '';
                return;
            }
            hostBusy = true;
            updateControls();
            vscode.postMessage({ command: cliAction });
            return;
        }

        var tab = target.getAttribute('data-tab');
        if (tab) {
            switchTab(tab, false);
            return;
        }

        if (target.hasAttribute('data-secret-toggle')) {
            var inputId = target.getAttribute('aria-controls');
            var input = inputId ? document.getElementById(inputId) : null;
            if (input) {
                var show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                var icon = target.querySelector('.codicon');
                if (icon) {
                    icon.classList.toggle('codicon-eye', !show);
                    icon.classList.toggle('codicon-eye-closed', show);
                }
            }
            return;
        }

        var action = target.getAttribute('data-action');
        var scope = target.getAttribute('data-config-scope');
        if (action && scope) submitAction(action, scope);
    });

    document.addEventListener('keydown', function (event) {
        var tab = event.target && event.target.closest ? event.target.closest('[role="tab"]') : null;
        if (tab && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault();
            var nextScope = tab.getAttribute('data-tab') === 'global' ? 'project' : 'global';
            var nextTab = document.querySelector('[data-tab="' + nextScope + '"]');
            if (nextTab && !nextTab.disabled) switchTab(nextScope, true);
            return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            var pane = document.getElementById('pane-' + currentScope);
            var saveButton = pane ? pane.querySelector('[data-action="save"]') : null;
            if (saveButton && !saveButton.disabled) submitAction('save', currentScope);
        }
    });

    window.addEventListener('message', function (event) {
        var message = event.data || {};
        if (message.command === 'cliState') {
            hostBusy = message.busy === true;
            configLoaded = message.loaded === true;
            var health = document.getElementById('cli-health');
            var updateStatus = document.getElementById('cli-update-status');
            if (health) health.textContent = message.health || '';
            if (updateStatus) updateStatus.textContent = message.updateStatus || '';
            updateControls();
        }
        if (message.command === 'actionState' && message.scope && message.action) {
            setBusy(message.scope, message.action, message.active === true);
            updateControls();
            if (message.active !== true) {
                prefixes.forEach(updateActionState);
                persistState();
            }
        }
    });

    window.addEventListener('scroll', persistState, { passive: true });

    function updateControls() {
        prefixes.forEach(function (prefix) {
            fieldElements(prefix).forEach(function (control) { control.disabled = hostBusy || !configLoaded; });
            updatePromptDependencies(prefix);
            updateActionState(prefix);
        });
        Array.prototype.slice.call(document.querySelectorAll('[data-cli-action]')).forEach(function (button) {
            button.disabled = hostBusy;
        });
    }

    prefixes.forEach(function (prefix) {
        updatePromptDependencies(prefix);
        updateSummary(prefix);
        updateActionState(prefix);
    });
    switchTab(currentScope, false);
    updateControls();
    vscode.postMessage({ command: 'ready' });
    if (typeof persisted.scrollY === 'number') {
        window.requestAnimationFrame(function () {
            window.scrollTo(0, persisted.scrollY);
        });
    }
})();
