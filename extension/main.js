/*
    This file contains the main code for running the extension.
    CSS code is included in 'style.css' and 'style.txt'. Only 'style.txt' can be uploaded with the extension,
    so write any changes from 'style.css' into that.
    Themes are included in 'themes.json'. You can add themes simply by copying the existing structure with a new name.
*/

var THEMES
var CSS

var currentTheme
var CssDiag

///Creates the command string for the name.
///E.g. getCmd('apply') -> 'extension-themes-apply'
var getCmd = (name) => `extension-themes-${name}`

Init();

async function Init()
{
    //Load themes and style async
    THEMES = await (await fetch(api('getRes', 'themes.json'))).json()
    CSS = await (await fetch(api('getRes', 'style.txt'))).text()

    InitCommands()
    InitUI()

    //Load prefs
    var tempTheme = window.localStorage.getItem('easyeda-extension-themes-lasttheme')
    if(tempTheme || !Object.keys(THEMES).includes(tempTheme))
        ApplyTheme(tempTheme)
    else
        ApplyTheme(Object.keys(THEMES)[0])
}

//#region Commands
///Creates the Commands for the EasyEda API
function InitCommands()
{
    //Create commands by indexing them using the pkg names.
    let commands = {}
    commands[getCmd('open_css_diag')] = () => OpenCssDiag()
    commands[getCmd('css_apply')]     = () => ApplyCss()
    commands[getCmd('refresh')]       = () => RefreshTheme()
    commands[getCmd('apply')] = (themeName) => ApplyTheme(themeName)
    /* ^ This exists so that 3rd party extensions can change the theme via:
    api('doCommand', {
        cmd: 'extension-themes-apply',
        args: ['OneDark'] //Or some other theme
    })*/
    api('createCommand', commands) //Register the Commands
}
//#endregion

//#region UI
function InitUI()
{
    ///Add the toolbar buttons
    var button = api('createToolbarButton', {
        icon: api('getRes', {file:'icon.svg'}),
        title:'Theme Settings',
        menu:[
            {'text': 'Select Theme', 'submenu': Array.from(Object.keys(THEMES)).map(THEME => {return {
                'text': THEME.replace('_', ' '),
                'cmd': getCmd('apply(' + THEME + ')')
            }})},
            //{'text': 'Refresh', 'cmd': getCmd('refresh')}, This button has been moved to the css editor
            {'text': 'Edit CSS', 'cmd': getCmd('open_css_diag')},
        ]
    })
    button.find('.m-btn-downarrow').remove();

    //We can now bind the API calls to the buttons directly, since we can't pass arguments to a createToolbarButton
    for(let THEME in THEMES)
        $(`div[cmd="${getCmd(`apply(${THEME})`)}"]`).click(e => ApplyTheme(THEME))

    CssDiag = api('createDialog', {
        title: 'Theme Settings CSS Editor',
        content: `
            <textarea id="themes_css_textarea" style="width:100%;height:99%;box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;">
            ${CSS}
            </textarea>
        `,
        width: 300,
        height: 450,
        modal: false,
        buttons: [{
            text: 'Apply',
            iconCls: 'icon-eda-check',
            cmd: getCmd('css_apply')
        },
        {
            text: 'Cancel',
            cmd: 'dialog-close'
        },
        {
            text: 'Refresh',
            cmd: getCmd('refresh')
        }]
    })
}
//#endregion

//#region Commands
///Opens the editable CSS Dialog
function OpenCssDiag()
{
    CssDiag.dialog('open')
    $('#themes_css_textarea').val(CSS)
}

///Applies the CSS in the Edit CSS textarea
function ApplyCss()
{
    CSS = $('#themes_css_textarea').val()
    RefreshTheme()
}

///Reinjects the CSS Theme
function RefreshTheme()
{
    if(!currentTheme)
        ApplyTheme(Object.keys(THEMES)[0])
    else
        ApplyTheme(currentTheme)
}

function AppendCSS(css)
{
    const head = document.head || document.getElementsByTagName('head')[0];
    const style = document.createElement('style');

    if (document.body && !document.body.contains(document.getElementById('theme'))) {
        head.appendChild(style);
        style.setAttribute('id', 'theme');
        style.setAttribute('rel', 'stylesheet');
        style.setAttribute('type', 'text/css');
    }
    style.appendChild(document.createTextNode(css));
};

///Applies the theme based on the passed theme name according to its name in 'THEMES' below
function ApplyTheme(themeName)
{
    if(!themeName || !Object.keys(THEMES).includes(themeName))
        return

    var theme = THEMES[themeName] //Get the theme object

    $('#theme').remove();

    //Write the new CSS
    var CSS_VAR = ':root {\n'
    for(var key in theme)
      CSS_VAR += `--${key}: ${theme[key]};\n`
    CSS_VAR += '}'

    //Add CSS
    AppendCSS(CSS_VAR + CSS + getCssPatches().join(''));

    //All this below is some hacky code to apply the theme to the schematic
    api('doCommand', 'applyThemeUserDefine')

    var MAPPING = {
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
        junction:     theme.Attributes_Color,     //Junction (2 intersecting wires)
    }

    //Some hacky stuff to apply the theme to the schematic every time
    var i = 0
    var values = Object.values(MAPPING)
    $("#dlg-theme-setting-items button[data-key]").each(() => {
        $(this).attr('value', values[i])
        $(this).css('background-color', values[i])
        console.log('applying $i')
        i++
    });
    $('#dlg-theme-new-schematic').prop('checked', true)
    $('#dlg-theme-opening-existed').prop('checked', true)

    //Set Schematic Editor Theme
    api('editorCall', {
        cmd: 'setColors',
        args: [{
            activeTheme: 'user-define',
            color: { //Note: Cannot use 'MAPPING' variable, does not apply change!
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
                junction:     theme.Attributes_Color,     //Junction (2 intersecting wires)
            }
        }]
    })

    //Override the config setting in local storage
    var prefs = JSON.parse(window.localStorage.getItem('easyeda.preferences'))
    prefs.themeColor = MAPPING
    window.localStorage.setItem('easyeda.preferences', JSON.stringify(prefs))

    //Add google fonts for Roboto
    if(!($('#font').length))
        $('head').append('<link rel="preconnect" href="https://fonts.gstatic.com"> \n <link id="font" "href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet">')

    //Set new current theme
    currentTheme = themeName

    //Write to preferences
    window.localStorage.setItem('easyeda-extension-themes-lasttheme', themeName)

    //Update the checkmark
    let selected = $('#theme_selected')
    if(selected)
    {
        selected.remove();
    }
    $(`div[cmd="${getCmd(`apply(${themeName})`)}"]`).prepend('<div id="theme_selected" class="menu-icon icon-selected"/>')
}

///Extra stuff we want to patch into the CSS
function getCssPatches()
{
    let PATCH_IMAGES = `.icon-add,.icon-align,.icon-align_bottom,.icon-align_dish,.icon-align_disv,.icon-align_grid,.icon-align_hmiddle,.icon-align_horizontal_center,.icon-align_horizontal_equidistant,.icon-align_left,.icon-align_left_side_edge_equidistant,.icon-align_right,.icon-align_top,.icon-align_top_side_edge_equidistant,.icon-align_vertical_center,.icon-align_vertical_equidistant,.icon-align_vmiddle,.icon-back,.icon-bom,.icon-bring-to-front,.icon-bug,.icon-cancel,.icon-checked,.icon-checked0,.icon-clone,.icon-code,.icon-config,.icon-config-waveform,.icon-copy,.icon-copy_dis,.icon-cut,.icon-database,.icon-delete,.icon-dos,.icon-down,.icon-edit,.icon-edit_dis,.icon-export,.icon-eye,.icon-favorite,.icon-file,.icon-file2,.icon-filesave,.icon-fitwindow,.icon-fliph,.icon-flipv,.icon-folder,.icon-folder-closed,.icon-fork,.icon-fullscreen,.icon-fullscreen_exit,.icon-help,.icon-help2,.icon-help3,.icon-home,.icon-import,.icon-import_changes,.icon-info,.icon-keyboard,.icon-language,.icon-measureLine,.icon-menu,.icon-netlist,.icon-new,.icon-new_dis,.icon-newprj,.icon-no,.icon-none,.icon-ok,.icon-open,.icon-open_dis,.icon-other,.icon-page,.icon-page_range,.icon-part0,.icon-paste,.icon-paste_dis,.icon-pcb,.icon-pcb3d,.icon-pcblib,.icon-pcblib3d,.icon-place,.icon-place2,.icon-place_dis,.icon-presentation,.icon-preview,.icon-print,.icon-print2,.icon-print_dis,.icon-prj,.icon-question,.icon-redo,.icon-redo2,.icon-redo2_dis,.icon-redo_dis,.icon-refresh,.icon-reload,.icon-reload_dis,.icon-remove,.icon-rotate,.icon-rotate_dis,.icon-rotate_left,.icon-rotate_left_dis,.icon-rotate_right,.icon-rotate_right.disabled,.icon-rotate_right_dis,.icon-run,.icon-save,.icon-save_as,.icon-save_as_dis,.icon-save_dis,.icon-sch,.icon-sch2,.icon-schlib,.icon-schlib2,.icon-schlib3d,.icon-schmatic,.icon-search,.icon-search2,.icon-selected,.icon-selection,.icon-send-to-back,.icon-settings,.icon-share1,.icon-share2,.icon-spicesymbol,.icon-subckt,.icon-tag,.icon-undo,.icon-undo2,.icon-undo2_dis,.icon-undo_dis,.icon-unfavorite,.icon-up,.icon-waveform,.icon-zback,.icon-zfront,.icon-zoom_in,.icon-zoom_out {
    background-image: url(${api('getRes', 'icons.png')});
    background-repeat: no-repeat;
    opacity: 0.8;}`

    return [
        PATCH_IMAGES
    ]
}
//#endregion