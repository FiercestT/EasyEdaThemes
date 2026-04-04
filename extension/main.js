/*
    This file contains the main code for running the EasyEDA Themes extension.
*/

const COMMANDID = {
    OPEN_CSS_DIALOG: "open_css_dialog",
    CSS_APPLY:       "css_apply",
    REFRESH:         "refresh",
    APPLY_THEME:     "apply",
    OPEN_SETTINGS:  "open_settings",
    SAVE_SETTINGS:   "save_settings"
}

const STOREID = {
    LAST_THEME:        "lastTheme",
    SCHEMATIC_THEME:   "schematicTheme",
    USE_CUSTOM_ICONS:  "useCustomIcons"
}

const releasesUrl = "https://github.com/FiercestT/EasyEdaThemes/releases/latest"

var _themes, _css, _defaultTheme, _activeTheme, _editCssDialog, _editSettingsDialog
var _useCustomIcons = false
var _tabObserverInterval = null

const extensionId = Object.entries(easyeda.extension.instances).filter(e => e[1].blobURLs && e[1].blobURLs["manifest.json"] == api("getRes",{file:"manifest.json"}))[0][1].id;
const instance = easyeda.extension.instances[extensionId];

const _ensure_id_at_install_ = "extension-themes-test"

const getCommandId = (name) => "extension-" + extensionId + "-" + name

class Helper 
{
    static createCommand(name, callback) {
        const id = getCommandId(name)
        let cmd={};
        cmd[id] = callback;
        api("createCommand", cmd);
        return id;
    }

    static get fileTypes() { 
        return {
            JSON : "json",
            TEXT : "text",
            OTHER: "other"
        }
    }

    static async loadFile(fileName, asType) {
        try {
            const response = await fetch(api("getRes",{file: fileName}));
            switch(asType)
            {
                case null:
                    return response
                case this.fileTypes.JSON:
                    return await response.json()
                case this.fileTypes.TEXT:
                    return await response.text()
                default:
                    return await response
            }
        } catch (error) {
            let msg = `Failed to load script '${fileName}' of extension '${extensionId}'. Maybe you didn't select all files for install?! Please reinstall! ${error}`;
            $.messager.error(msg);
            throw msg;
        }	
    }

    static setValue(key, value) {
        var conf = {};
        try {
            conf = localStorage.getItem(`extension.${extensionId}.config`) || "{}";
            conf = JSON.parse(conf);			
        } catch (error) {
            conf = {};
        }
        conf[key] = value;
        if(value === null) delete conf[key];
        localStorage.setItem(`extension.${extensionId}.config`,JSON.stringify(conf));
    }

    static getValue(key, defaultValue) {
        try {
            var conf = localStorage.getItem(`extension.${extensionId}.config`) || "{}";
            conf = JSON.parse(conf);
            if(!(key in conf)) return defaultValue;
            return conf[key];
        } catch (error) {
            return defaultValue;
        }
    }

    static checkUpdate() {
        (async ()=>{
            try {
                if(!("version" in instance.manifest)) return;

                let data = await (await fetch("https://api.github.com/repos/FiercestT/EasyEdaThemes/releases/latest")).json()
                let latestVersion = data["tag_name"].match(/(\d\.)+\d/g)
                if(!latestVersion || !latestVersion[0]) return;
                
                let curVersion = instance.manifest.version

                let latestParts = latestVersion[0].split(".")
                let curParts = curVersion.split(".")
                let maxLen = Math.max(latestParts.length, curParts.length)
                let needsUpdate = false

                for(let i = 0; i < maxLen; i++)
                {
                    let a = parseInt(latestParts[i] || "0")
                    let b = parseInt(curParts[i] || "0")
                    if(a > b) {
                        needsUpdate = true
                        break
                    }
                    if(a < b) break
                }

                if(!needsUpdate)
                    return

                var updateCmd = this.createCommand("updateVersion", ()=>{ window.open(releasesUrl,"_blank") });

                $.messager.show({
                    title: `Update Available for <b>${instance.manifest.name}</b>`,
                    msg: `<table>
                            <tr><td>Installed:</td><td>${instance.manifest.name} ${instance.manifest.version}</td></tr>
                            <tr><td>Available:</td><td>${latestVersion[0]}</td></tr>
                        </table>
                        <div class="dialog-button">
                            <a tabindex="0" cmd="${updateCmd};dialog-close" class="l-btn"><span class="l-btn-left"><span class="l-btn-text i18n">Download</span></span></a>
                            <a tabindex="0" cmd="dialog-close" class="l-btn"><span class="l-btn-left"><span class="l-btn-text i18n">Close</span></span></a>
                        </div>
                        `,
                    height: "auto",
                    timeout: 30e3,
                    showType: "slide"
                });
            } catch (error) {
                console.log("Update check failed: "+error);
            }
        })();
    }
}

function getThemes() {
    return _themes
}

function getDefaultTheme() {
    if(!_defaultTheme)
        _defaultTheme = Object.keys(getThemes())[0]
    return _defaultTheme
}

function getActiveTheme() {
    if(!_activeTheme)
        _activeTheme = getDefaultTheme()
    return _activeTheme
}

function getSchematicThemeName() {
    let stored = Helper.getValue(STOREID.SCHEMATIC_THEME, "same")
    return stored
}

function getUseCustomIcons() {
    return _useCustomIcons
}

function getCssPatches() {
    let patches = []
    
    if(_useCustomIcons) {
        let iconUrl = api("getRes", "icons.png")
        let PATCH_ICONS = `.icon-add,.icon-align,.icon-align_bottom,.icon-align_dish,.icon-align_disv,.icon-align_grid,.icon-align_hmiddle,.icon-align_horizontal_center,.icon-align_horizontal_equidistant,.icon-align_left,.icon-align_left_side_edge_equidistant,.icon-align_right,.icon-align_top,.icon-align_top_side_edge_equidistant,.icon-align_vertical_center,.icon-align_vertical_equidistant,.icon-align_vmiddle,.icon-back,.icon-bom,.icon-bring-to-front,.icon-bug,.icon-cancel,.icon-checked,.icon-checked0,.icon-clone,.icon-code,.icon-config,.icon-config-waveform,.icon-copy,.icon-copy_dis,.icon-cut,.icon-database,.icon-delete,.icon-dos,.icon-down,.icon-edit,.icon-edit_dis,.icon-export,.icon-eye,.icon-favorite,.icon-file,.icon-file2,.icon-filesave,.icon-fitwindow,.icon-fliph,.icon-flipv,.icon-folder,.icon-folder-closed,.icon-fork,.icon-fullscreen,.icon-fullscreen_exit,.icon-help,.icon-help2,.icon-help3,.icon-home,.icon-import,.icon-import_changes,.icon-info,.icon-keyboard,.icon-language,.icon-measureLine,.icon-menu,.icon-netlist,.icon-new,.icon-new_dis,.icon-newprj,.icon-no,.icon-none,.icon-ok,.icon-open,.icon-open_dis,.icon-other,.icon-page,.icon-page_range,.icon-part0,.icon-paste,.icon-paste_dis,.icon-pcb,.icon-pcb3d,.icon-pcblib,.icon-pcblib3d,.icon-place,.icon-place2,.icon-place_dis,.icon-presentation,.icon-preview,.icon-print,.icon-print2,.icon-print_dis,.icon-prj,.icon-question,.icon-redo,.icon-redo2,.icon-redo2_dis,.icon-redo_dis,.icon-refresh,.icon-reload,.icon-reload_dis,.icon-remove,.icon-rotate,.icon-rotate_dis,.icon-rotate_left,.icon-rotate_left_dis,.icon-rotate_right,.icon-rotate_right.disabled,.icon-rotate_right_dis,.icon-run,.icon-save,.icon-save_as,.icon-save_as_dis,.icon-save_dis,.icon-sch,.icon-sch2,.icon-schlib,.icon-schlib2,.icon-schlib3d,.icon-schmatic,.icon-search,.icon-search2,.icon-selected,.icon-selection,.icon-send-to-back,.icon-settings,.icon-share1,.icon-share2,.icon-spicesymbol,.icon-subckt,.icon-tag,.icon-undo,.icon-undo2,.icon-undo2_dis,.icon-unfold,.icon-unlock,.icon-up,.icon-warning,.icon-wire,.icon-workdir_design,.icon-zin,.icon-zoomback,.icon-zoomin,.icon-zoomreset,.icon-zoomSel,.sch-sheet,.sch-sheet-ghost,.sch-subpart{background-image: url(${iconUrl}); background-repeat: no-repeat; opacity: 0.8;}`
        patches.push(PATCH_ICONS)
        patches.push(`div[cmd^="extension-${extensionId}-apply"] { position: relative; padding-left: 25px; }`)
    }
    
    patches.push(`.layout-toggler>div { visibility: visible !important; }`)
    
    return patches.join("")
}

function setEditorTheme(schematicTheme) {
    if(!schematicTheme) {
        api("doCommand", "applyThemeOriginalTheme")
        return
    }
    api("doCommand", "applyThemeUserDefine")
    api("editorCall", {
       cmd: "setColors",
       args: [{
           activeTheme: "user-define",
           color: schematicTheme
     }]})
}

function getSchematicThemeForTheme(themeName) {
    let schematicThemeSetting = getSchematicThemeName()
    
    if(schematicThemeSetting === "none") {
        return null
    }
    
    let theme = getThemes()[themeName]
    if(!theme) return null
    
    if(schematicThemeSetting === "same" || schematicThemeSetting === "") {
        return theme.schematic
    }
    
    if(getThemes()[schematicThemeSetting]) {
        return getThemes()[schematicThemeSetting].schematic
    }
    
    return theme.schematic
}

function cb_ApplyTheme(themeName) 
{ 
    if(!themeName || !Object.keys(getThemes()).includes(themeName))
        return
    
    let theme = getThemes()[themeName]
    let appTheme = theme.app
    let schematicTheme = getSchematicThemeForTheme(themeName)
    
    let _cssVars = ":root {\n"
    for(let key in appTheme)
        _cssVars += `--${key}: ${appTheme[key]};\n`
    _cssVars += "}"

    $("#themer_style").remove();
    $("head").append(`<style id="themer_style" rel="stylesheet" type="text/css">${_cssVars + _css + getCssPatches()}</style>`)

    setEditorTheme(schematicTheme)
    
    $("span[id*='theme_selected_checkmark']").remove()
    $(`div[cmd="${getCommandId(`${COMMANDID.APPLY_THEME}(${themeName})`)}"]`).prepend('<span id="theme_selected_checkmark" style="position: absolute; left: 5px; color: var(--accent_color, #88c0d0);">●</span>')

    _activeTheme = themeName
    Helper.setValue(STOREID.LAST_THEME, getActiveTheme())
}

function cb_RefreshTheme() {
    cb_ApplyTheme(getActiveTheme())
}

function cb_ApplyCss() {
    _css = $("#themes_css_textarea").val()
    cb_RefreshTheme()
}

function cb_OpenCssDialog() {
    _editCssDialog.dialog("open")
    $("#themes_css_textarea").val(_css)
}

function cb_OpenSettingsDialog() {
    _editSettingsDialog.dialog("open")
    
    $("#settings_app_theme").val(getActiveTheme())
    $("#settings_schematic_theme").val(getSchematicThemeName())
    $("#settings_use_custom_icons").prop("checked", getUseCustomIcons())
}

function cb_SaveSettings() {
    let appTheme = $("#settings_app_theme").val()
    let schematicTheme = $("#settings_schematic_theme").val()
    let useCustomIcons = $("#settings_use_custom_icons").is(":checked")
    
    Helper.setValue(STOREID.SCHEMATIC_THEME, schematicTheme)
    Helper.setValue(STOREID.USE_CUSTOM_ICONS, useCustomIcons)
    _useCustomIcons = useCustomIcons
    
    _editSettingsDialog.dialog("close")
    
    cb_ApplyTheme(appTheme)
}

function InitUI() {
    let themeOptions = Array.from(Object.keys(getThemes())).map(THEME => {
        return {
            "text": THEME.replace(/_/g, " "),
            "cmd": getCommandId(`${COMMANDID.APPLY_THEME}(${THEME})`)
        }
    })
    
    let schematicOptions = [
        {"text": "Same as App Theme", "value": "same"},
        {"text": "Don't apply (EasyEDA default)", "value": "none"}
    ].concat(Array.from(Object.keys(getThemes())).map(THEME => {
        return {"text": THEME.replace(/_/g, " "), "value": THEME}
    }))

    let button = api("createToolbarButton", {
        icon: api("getRes", {file:"icon.svg"}),
        title: "Themes",
        menu:[
            {
                "text": "Select Theme", 
                "submenu": themeOptions
            },
            {
                "text": "Settings", 
                "cmd": getCommandId(COMMANDID.OPEN_SETTINGS)
            },
            {
                "text": "Edit CSS", 
                "cmd": getCommandId(COMMANDID.OPEN_CSS_DIALOG)
            },
        ]
    })
    button.find(".m-btn-downarrow").remove();

    for(let THEME in getThemes())
        $(`div[cmd="${getCommandId(`${COMMANDID.APPLY_THEME}(${THEME})`)}"]`).click(e => cb_ApplyTheme(THEME))

    _editCssDialog = api("createDialog", {
        title: "Themes CSS Editor",
        content: `<textarea id="themes_css_textarea" style="width:100%;height:99%;box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;"> ${CSS} </textarea>`,
        width: 300,
        height: 450,
        modal: false,
        buttons: [{
            text: "Apply",
            iconCls: "icon-eda-check",
            cmd: getCommandId(COMMANDID.CSS_APPLY)
        },
        {
            text: "Cancel",
            cmd: "dialog-close"
        },
        {
            text: "Refresh",
            cmd: getCommandId(COMMANDID.REFRESH)
        }]
    })
    
    let schematicOptionsHtml = schematicOptions.map(o => `<option value="${o.value}">${o.text}</option>`).join("")
    _editSettingsDialog = api("createDialog", {
        title: "Themes Settings",
        content: `<div style="padding: 10px;">
            <div style="margin-bottom: 10px;">
                <label style="display: inline-block; width: 120px;">App Theme:</label>
                <select id="settings_app_theme" style="width: 150px;">${Array.from(Object.keys(getThemes())).map(t => `<option value="${t}">${t.replace(/_/g, " ")}</option>`).join("")}</select>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: inline-block; width: 120px;">Schematic Theme:</label>
                <select id="settings_schematic_theme" style="width: 150px;">${schematicOptionsHtml}</select>
            </div>
            <div style="margin-bottom: 10px; display: flex; align-items: center;">
                <span style="width: 120px;">Use Custom Icons:</span>
                <input type="checkbox" id="settings_use_custom_icons" style="margin-left: 0;" />
            </div>
        </div>`,
        width: 320,
        height: 220,
        modal: false,
        buttons: [{
            text: "Save",
            iconCls: "icon-eda-check",
            cmd: getCommandId(COMMANDID.SAVE_SETTINGS)
        },
        {
            text: "Cancel",
            cmd: "dialog-close"
        }]
    })
}

var _lastActiveTabDoctype = null

function InitTabObserver() 
{
    if(_tabObserverInterval !== null) {
        clearTimeout(_tabObserverInterval)
    }
    _tabObserverInterval = setTimeout(() => {
        if(!easyeda.extension.instances[extensionId]) return
        let activeTab = $(".tabbar-tab.active")[0]
        if(!activeTab) return
        let doctype = activeTab.getAttribute("doctype")
        if([null, "2", "7", "13"].includes(doctype)) {
            setEditorTheme(getSchematicThemeForTheme(getActiveTheme()))
        }
        InitTabObserver()
    }, 1000)
}

async function main()
{
    Helper.checkUpdate()

    _themes = await Helper.loadFile("themes.json", Helper.fileTypes.JSON)
    _css = await Helper.loadFile("style.txt", Helper.fileTypes.TEXT)

    _useCustomIcons = Helper.getValue(STOREID.USE_CUSTOM_ICONS, false)

    Helper.createCommand(COMMANDID.OPEN_CSS_DIALOG, () => cb_OpenCssDialog())
    Helper.createCommand(COMMANDID.CSS_APPLY,       () => cb_ApplyCss())
    Helper.createCommand(COMMANDID.REFRESH,         () => cb_RefreshTheme())
    Helper.createCommand(COMMANDID.APPLY_THEME,     (themeName) => cb_ApplyTheme(themeName))
    Helper.createCommand(COMMANDID.OPEN_SETTINGS,  () => cb_OpenSettingsDialog())
    Helper.createCommand(COMMANDID.SAVE_SETTINGS,   () => cb_SaveSettings())

    InitUI()
    InitTabObserver()

    cb_ApplyTheme(Helper.getValue(STOREID.LAST_THEME, getDefaultTheme()))
}

main();

console.log(`EasyEDA Themes loaded for extension "${extensionId}"`);
