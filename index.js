/**
 * Model Injector - add model IDs to SillyTavern's hardcoded Chat Completion
 * dropdowns (Claude, Vertex AI, Google AI Studio, OpenAI, DeepSeek, xAI)
 * without waiting for an ST update.
 *
 * Optional "treat as": ST gates thinking / caching / sampling behaviour on
 * model-name regexes. With the companion server plugin installed, the request
 * is built as if the "treat as" model was selected, and the real model ID is
 * swapped back in right before it leaves the server.
 */

const MODULE = 'modelInjector';
const PLUGIN_URL = '/api/plugins/model-injector';
const GROUP_LABEL = 'Custom (Model Injector)';

const SOURCES = {
    claude: { label: 'Claude', select: '#model_claude_select' },
    vertexai: { label: 'Vertex AI', select: '#model_vertexai_select' },
    makersuite: { label: 'Google AI Studio', select: '#model_google_select' },
    openai: { label: 'OpenAI', select: '#model_openai_select' },
    deepseek: { label: 'DeepSeek', select: '#model_deepseek_select' },
    xai: { label: 'xAI', select: '#model_xai_select' },
};

let pluginOnline = false;
let warnedNoPlugin = false;
const observers = [];

const ctx = () => SillyTavern.getContext();

function settings() {
    const all = ctx().extensionSettings;
    all[MODULE] ??= {};
    const s = all[MODULE];
    s.models ??= [];
    s.lastSelected ??= {};
    return s;
}

const save = () => ctx().saveSettingsDebounced();

function builtinOptions(source) {
    return $(SOURCES[source].select)
        .find('option')
        .filter((_, o) => !o.dataset.cmi && o.value)
        .map((_, o) => o.value)
        .get();
}

function inject(source) {
    const $select = $(SOURCES[source].select);
    if (!$select.length) return;
    const models = settings().models.filter(m => m.source === source && m.id);
    const current = $select.val();
    $select.find('optgroup[data-cmi]').remove();
    if (models.length) {
        const $group = $('<optgroup>').attr({ label: GROUP_LABEL, 'data-cmi': '1' });
        for (const m of models) {
            const label = m.treatAs ? `${m.id} (as ${m.treatAs})` : m.id;
            $group.append($('<option>').attr({ value: m.id, 'data-cmi': '1' }).text(label));
        }
        $select.prepend($group);
    }
    if (current && $select.find(`option[value="${CSS.escape(current)}"]`).length) $select.val(current);
}

function injectAll() {
    Object.keys(SOURCES).forEach(inject);
}

// Dynamic lists (e.g. Google AI Studio) get rebuilt by ST; put our group back.
function watch(source) {
    const el = document.querySelector(SOURCES[source].select);
    if (!el) return;
    const obs = new MutationObserver(() => {
        if (settings().models.some(m => m.source === source) && !el.querySelector('optgroup[data-cmi]')) {
            obs.disconnect();
            inject(source);
            restore(source);
            obs.observe(el, { childList: true });
        }
    });
    obs.observe(el, { childList: true });
    observers.push(obs);
}

// ST loads its settings before extensions, so a saved custom model has no
// matching <option> at that point. Re-select it once our options exist.
function restore(source) {
    const wanted = settings().lastSelected[source];
    const $select = $(SOURCES[source].select);
    if (!wanted || $select.val() === wanted) return;
    if (!settings().models.some(m => m.source === source && m.id === wanted)) return;
    $select.val(wanted).trigger('change');
}

function track(source) {
    $(SOURCES[source].select).on('change.cmi', function () {
        const val = String($(this).val() || '');
        if (!val) return;
        settings().lastSelected[source] = val;
        save();
    });
}

async function probePlugin() {
    try {
        const res = await fetch(`${PLUGIN_URL}/probe`, { method: 'POST', headers: ctx().getRequestHeaders() });
        pluginOnline = res.ok;
    } catch {
        pluginOnline = false;
    }
    renderStatus();
}

async function onSettingsReady(data) {
    const source = data?.chat_completion_source;
    const entry = settings().models.find(m => m.source === source && m.id === data?.model && m.treatAs);
    if (!entry) return;
    if (!pluginOnline) {
        if (!warnedNoPlugin) {
            toastr.warning(`"Treat as" needs the Model Injector server plugin. Sending ${entry.id} without it.`, 'Model Injector');
            warnedNoPlugin = true;
        }
        return;
    }
    try {
        const res = await fetch(`${PLUGIN_URL}/arm`, {
            method: 'POST',
            headers: ctx().getRequestHeaders(),
            body: JSON.stringify({ alias: entry.treatAs, real: entry.id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data.model = entry.treatAs;
    } catch (err) {
        console.error('[Model Injector] arm failed', err);
        toastr.error(`Couldn't reach the server plugin; sending ${entry.id} as-is.`, 'Model Injector');
    }
}

// ---------- UI ----------

function renderStatus() {
    $('#cmi_plugin_status')
        .toggleClass('cmi-ok', pluginOnline)
        .text(pluginOnline ? 'Server plugin connected: "treat as" is active.' : 'Server plugin not detected: "treat as" is off. Adding models still works.');
}

function sourceOptions(selected) {
    return Object.entries(SOURCES)
        .map(([k, v]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${v.label}</option>`)
        .join('');
}

function treatAsOptions(source, selected) {
    const opts = builtinOptions(source);
    if (selected && !opts.includes(selected)) opts.unshift(selected);
    return ['<option value="">(none)</option>']
        .concat(opts.map(v => `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`))
        .join('');
}

function renderList() {
    const $list = $('#cmi_list').empty();
    const models = settings().models;
    if (!models.length) {
        $list.append('<div class="cmi-empty">No custom models yet. Click "Add model" to add one.</div>');
        return;
    }
    models.forEach((m, i) => {
        const $row = $(`
            <div class="cmi-row">
                <select class="text_pole cmi-source">${sourceOptions(m.source)}</select>
                <input class="text_pole cmi-id" type="text" placeholder="model id, e.g. claude-opus-5-1" spellcheck="false">
                <span class="cmi-as">treat as</span>
                <select class="text_pole cmi-treat" title="Make ST handle this model like an existing one (thinking, caching, sampling rules)">${treatAsOptions(m.source, m.treatAs)}</select>
                <div class="menu_button fa-solid fa-trash-can cmi-del" title="Remove"></div>
            </div>`);
        $row.find('.cmi-id').val(m.id);
        $row.find('.cmi-source').on('change', function () {
            const old = m.source;
            m.source = String($(this).val());
            m.treatAs = '';
            $row.find('.cmi-treat').html(treatAsOptions(m.source, ''));
            inject(old);
            inject(m.source);
            save();
        });
        $row.find('.cmi-id').on('change', function () {
            m.id = String($(this).val()).trim();
            $(this).val(m.id);
            inject(m.source);
            save();
        });
        $row.find('.cmi-treat').on('change', function () {
            m.treatAs = String($(this).val());
            inject(m.source);
            save();
        });
        $row.find('.cmi-del').on('click', () => {
            models.splice(i, 1);
            inject(m.source);
            save();
            renderList();
        });
        $list.append($row);
    });
}

function addModel() {
    const active = ctx().chatCompletionSettings?.chat_completion_source;
    settings().models.push({ source: SOURCES[active] ? active : 'claude', id: '', treatAs: '' });
    save();
    renderList();
    $('#cmi_list .cmi-row:last .cmi-id').trigger('focus');
}

function mountUi() {
    const html = `
        <div id="cmi_settings" class="cmi-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Model Injector</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <small class="cmi-help">Add model IDs to the Chat Completion model dropdowns. They show up at the top of the list under "${GROUP_LABEL}". Optional "treat as" makes ST use an existing model's thinking, caching and sampling rules for the new one.</small>
                    <div id="cmi_plugin_status" class="cmi-status"></div>
                    <div id="cmi_list"></div>
                    <div class="flex-container">
                        <div id="cmi_add" class="menu_button menu_button_icon"><i class="fa-solid fa-plus"></i><span>Add model</span></div>
                        <div id="cmi_recheck" class="menu_button menu_button_icon" title="Check for the server plugin again"><i class="fa-solid fa-rotate"></i><span>Recheck plugin</span></div>
                    </div>
                </div>
            </div>
        </div>`;
    $('#extensions_settings2').append(html);
    $('#cmi_add').on('click', addModel);
    $('#cmi_recheck').on('click', probePlugin);
    renderList();
    renderStatus();
}

jQuery(async () => {
    const { eventSource, event_types } = ctx();
    mountUi();
    injectAll();
    for (const source of Object.keys(SOURCES)) {
        track(source);
        watch(source);
        restore(source);
    }
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, onSettingsReady);
    await probePlugin();
});
