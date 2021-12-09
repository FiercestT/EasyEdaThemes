/*
    This file contains the main code for running the themer extension. More information is in the readme.
*/

const _ensure_id_at_install_ = 'extension-themer-test'
var _themes, _css, _defaultTheme, _activeTheme, _editCssDialog
const extensionId = Object.entries(easyeda.extension.instances).filter(e => e[1].blobURLs && e[1].blobURLs['manifest.json'] == api('getRes',{file:'manifest.json'}))[0][1].id;
const instance = easyeda.extension.instances[extensionId];
const Helper = instance.Helper

const getCommandId = (name) => `extension-${extensionId}-${name}` //Used to get the command name
const COMMANDID = { //Enum of command IDs
    OPEN_CSS_DIALOG: 'open_css_dialog',
    CSS_APPLY:       'css_apply',
    REFRESH:         'refresh',
    APPLY_THEME:     'apply'
}
const STOREID = { //LocalStorage Keys
    LAST_THEME: 'lastTheme',
}

main();

async function main()
{
    Helper.checkUpdate()
    
    _themes = await Helper.loadFile('themes.json', Helper.fileTypes.JSON)
    _css = await Helper.loadFile("style.txt", Helper.fileTypes.TEXT)

    //Create Commands
    Helper.createCommand(COMMANDID.OPEN_CSS_DIALOG, () => cb_OpenCssDialog())
    Helper.createCommand(COMMANDID.CSS_APPLY,       () => cb_ApplyCss())
    Helper.createCommand(COMMANDID.REFRESH,         () => cb_RefreshTheme())
    Helper.createCommand(COMMANDID.APPLY_THEME,     (themeName) => cb_ApplyTheme(themeName))

    InitUI()
    InitTabObserver()

    cb_ApplyTheme(Helper.getValue(STOREID.LAST_THEME, getDefaultTheme())) //Apply last theme from storage or use default
}

///Applies the theme based on the passed theme name according to its name in 'THEMES' below
function cb_ApplyTheme(themeName) 
{ 
    if(!themeName || !Object.keys(getThemes()).includes(themeName))
        return
    
    let theme = getThemes()[themeName]
    
    let _cssVars = ':root {\n' //Write the CSS header variables
    for(let key in theme)
        _cssVars += `--${key}: ${theme[key]};\n`
    _cssVars += '}'

    $('#themer_style').remove(); //Remove the old style from the head
    $('head').append(`<style id="themer_style" rel="stylesheet" type="text/css">${_cssVars + _css + getCssPatches()}</style>`) //Patch in the CSS

    setEditorTheme(theme)
    
    $("div[id*='theme_selected_checkmark'").each((i, el) => el.remove()) //Update the checkmark on the active theme, remove all previous checkmarks.
    $(`div[cmd="${getCommandId(`${COMMANDID.APPLY_THEME}(${themeName})`)}"]`).prepend('<div id="theme_selected_checkmark" class="menu-icon icon-selected"/>')

    _activeTheme = themeName
    Helper.setValue(STOREID.LAST_THEME, getActiveTheme()) //Store the new active theme
}

///Extra stuff we want to patch into the CSS
function getCssPatches() {
    let PATCH_ICONS = `.icon-add,.icon-align,.icon-align_bottom,.icon-align_dish,.icon-align_disv,.icon-align_grid,.icon-align_hmiddle,.icon-align_horizontal_center,.icon-align_horizontal_equidistant,.icon-align_left,.icon-align_left_side_edge_equidistant,.icon-align_right,.icon-align_top,.icon-align_top_side_edge_equidistant,.icon-align_vertical_center,.icon-align_vertical_equidistant,.icon-align_vmiddle,.icon-back,.icon-bom,.icon-bring-to-front,.icon-bug,.icon-cancel,.icon-checked,.icon-checked0,.icon-clone,.icon-code,.icon-config,.icon-config-waveform,.icon-copy,.icon-copy_dis,.icon-cut,.icon-database,.icon-delete,.icon-dos,.icon-down,.icon-edit,.icon-edit_dis,.icon-export,.icon-eye,.icon-favorite,.icon-file,.icon-file2,.icon-filesave,.icon-fitwindow,.icon-fliph,.icon-flipv,.icon-folder,.icon-folder-closed,.icon-fork,.icon-fullscreen,.icon-fullscreen_exit,.icon-help,.icon-help2,.icon-help3,.icon-home,.icon-import,.icon-import_changes,.icon-info,.icon-keyboard,.icon-language,.icon-measureLine,.icon-menu,.icon-netlist,.icon-new,.icon-new_dis,.icon-newprj,.icon-no,.icon-none,.icon-ok,.icon-open,.icon-open_dis,.icon-other,.icon-page,.icon-page_range,.icon-part0,.icon-paste,.icon-paste_dis,.icon-pcb,.icon-pcb3d,.icon-pcblib,.icon-pcblib3d,.icon-place,.icon-place2,.icon-place_dis,.icon-presentation,.icon-preview,.icon-print,.icon-print2,.icon-print_dis,.icon-prj,.icon-question,.icon-redo,.icon-redo2,.icon-redo2_dis,.icon-redo_dis,.icon-refresh,.icon-reload,.icon-reload_dis,.icon-remove,.icon-rotate,.icon-rotate_dis,.icon-rotate_left,.icon-rotate_left_dis,.icon-rotate_right,.icon-rotate_right.disabled,.icon-rotate_right_dis,.icon-run,.icon-save,.icon-save_as,.icon-save_as_dis,.icon-save_dis,.icon-sch,.icon-sch2,.icon-schlib,.icon-schlib2,.icon-schlib3d,.icon-schmatic,.icon-search,.icon-search2,.icon-selected,.icon-selection,.icon-send-to-back,.icon-settings,.icon-share1,.icon-share2,.icon-spicesymbol,.icon-subckt,.icon-tag,.icon-undo,.icon-undo2,.icon-undo2_dis,.icon-undo_dis,.icon-unfavorite,.icon-up,.icon-waveform,.icon-zback,.icon-zfront,.icon-zoom_in,.icon-zoom_out {
    background-image: linear-gradient(rgba(1, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${api('getRes', 'icons.png')});
    background-repeat: no-repeat;
    opacity: 0.8;}`

    return [
        PATCH_ICONS
    ].join('')
}

///Sets the schematic editor theme
function setEditorTheme(themeData) {
    api('doCommand', 'applyThemeUserDefine')
    api('editorCall', {
       cmd: 'setColors',
       args: [{
           activeTheme: 'user-define',
           color: MAPPING(themeData)
    }]})
}

///Opens the editable CSS Dialog
function cb_OpenCssDialog() {
    _editCssDialog.dialog('open')
    $('#themes_css_textarea').val(_css)
}

///Applies the CSS in the Edit CSS textarea
function cb_ApplyCss() {
    _css = $('#themes_css_textarea').val()
    cb_RefreshTheme()
}

///Reinjects the CSS Theme
function cb_RefreshTheme() {
    cb_ApplyTheme(getActiveTheme())
}

///Gets the default theme (index 0)
function getDefaultTheme() {
    if(!_defaultTheme)
        _defaultTheme = Object.keys(getThemes())[0]
    return _defaultTheme
}

///Gets the active theme, defaults to the default theme
function getActiveTheme() {
    if(!_activeTheme)
        _activeTheme = getDefaultTheme()
    return _activeTheme
}

///Returns an object of all of the loaded themes
function getThemes() {
    return _themes
}

///Inits the toolbar dropdown and UI surrounding that
function InitUI() {
    ///Add the toolbar buttons
    let button = api('createToolbarButton', {
        icon: api('getRes', {file:'icon.svg'}),
        title: 'Themer',
        menu:[
            {
                'text': 'Select Theme', 
                'submenu': Array.from(Object.keys(getThemes())).map(THEME => {
                    return {
                        'text': THEME.replace('_', ' '),
                        'cmd': getCommandId(`${COMMANDID.APPLY_THEME}(${THEME})`) //Commands can't be run with arguments, so we just fill this in to identify it in the DOM
                    }
                })
            },
            {
                'text': 'Edit CSS', 
                'cmd': getCommandId(COMMANDID.OPEN_CSS_DIALOG)
            },
        ]
    })
    button.find('.m-btn-downarrow').remove();

    //Bind button clicks to actual actions
    for(let THEME in getThemes())
        $(`div[cmd="${getCommandId(`${COMMANDID.APPLY_THEME}(${THEME})`)}"]`).click(e => cb_ApplyTheme(THEME))

    _editCssDialog = api('createDialog', {
        title: 'Themer CSS Editor',
        content: `<textarea id="themes_css_textarea" style="width:100%;height:99%;box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;"> ${CSS} </textarea>`,
        width: 300,
        height: 450,
        modal: false,
        buttons: [{
            text: 'Apply',
            iconCls: 'icon-eda-check',
            cmd: getCommandId(COMMANDID.CSS_APPLY)
        },
        {
            text: 'Cancel',
            cmd: 'dialog-close'
        },
        {
            text: 'Refresh',
            cmd: getCommandId(COMMANDID.REFRESH)
        }]
    })
}

///Observes tabs that are created on the tabbar and sets the schematic theme and view mode when a new tab is opened. For some reason the custom color scheme isn't consistent across restarts.
function InitTabObserver() 
{
    new MutationObserver(mutations => {
        for(let mutation of mutations) 
            if(mutation.addedNodes.length != 0 && [null, '2', '7', '13'].includes(mutation.addedNodes[0].getAttribute('doctype'))) //Only work for doctypes that are schlib
                new Promise(r => setTimeout(r, 200)).then(r => setEditorTheme(getThemes()[getActiveTheme()])) //Sleep some time before applying, janky but it works :)  
    }).observe($('.tabbar')[0], {
        childList: true,
    })
}

///Maps the schematic elements to the theme keys
const MAPPING = (theme) => { return {
    background:   theme.Second_Background,
    grid:         theme.Contrast,
    select:       theme.Selection_Foreground, //Hover
    wire:         theme.Strings_Color,        //Wire
    bus:          theme.Functions_Color,      //Bus
    busEntry:     theme.Links_Color,          //Bus Entryu
    netLabel:     theme.Links_Color,          //Net Label
    netFlag:      theme.Operators_Color,      //Net Flag (Special Net Label)
    noConnect:    theme.Tags_Color,           //No Connect X
    voltageProbe: theme.Operators_Color,      //Voltage Probe + Text
    text:         theme.Text,                 //Placed Text
    pin:          theme.Functions_Color,      //Pin Line
    pinName:      theme.Text,                 //Pin Name Color
    pinNumber:    theme.Text,                 //Pin Number Color
    partGraphics:       theme.Foreground,     //Part Outline
    partGraphicsPrefix: theme.Text,           //Part Number
    partGraphicsName:   theme.Text,           //Part Name
    sheet:        theme.Text,                 //?
    draw:         theme.Selection_Foreground, //Drawn Things
    drawFill:     theme.Selection_Background, //Drawn Things Fill
    arrow:        theme.Selection_Foreground, //?
    junction:     theme.Attributes_Color      //Junction (2 intersecting wires)
}}