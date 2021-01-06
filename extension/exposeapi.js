///This will expose api(...) calls through the console. Extremely helpful when developing extensions.
if(!window.api)
{
    window.api = api
    console.log('[Theming] You can now use api() in console.')
}