/*
    Stolen with love and modified from https://github.com/xsrf/easyeda-svg-import <3
*/

const releasesUrl = 'https://github.com/FiercestT/EasyEdaThemes/releases/latest'
const extensionId = Object.entries(easyeda.extension.instances).filter(e => e[1].blobURLs && e[1].blobURLs['manifest.json'] == api('getRes',{file:'manifest.json'}))[0][1].id;
const instance = easyeda.extension.instances[extensionId];

instance.Helper = class Helper 
{
    static createCommand(name, callback) {
        const id = this.getCommandId(name)
        let cmd={};
        cmd[id] = callback;
        api('createCommand', cmd);
        return id;
    }

    static getCommandId(name) {
        return 'extension-' + extensionId + '-' + name
    }

    static get fileTypes() { 
        return {
            JSON : 'json',
            TEXT : 'text',
            OTHER: 'other'
        }
    }

    static async loadFile(fileName, asType) {
        try {
            const response = await fetch(api('getRes',{file: fileName}));
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
            const msg = `Failed to load script '${filename}' of extension '${extensionId}'. Maybe you didn't select all files for install?! Please reinstall! ${error}`;
            $.messager.error(msg);
            throw msg;
        }	

    }

    static setValue(key, value) {
        var conf = {};
        try {
            conf = localStorage.getItem(`extension.${extensionId}.config`) || '{}';
            conf = JSON.parse(conf);			
        } catch (error) {
            conf = {};
        }
        conf[key] = value;
        if(value === null) delete conf[value];
        localStorage.setItem(`extension.${extensionId}.config`,JSON.stringify(conf));
    }

    static getValue(key, defaultValue) {
        try {
            var conf = localStorage.getItem(`extension.${extensionId}.config`) || '{}';
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
                if(!('version' in instance.manifest)) return;

                let data = await (await fetch('https://api.github.com/repos/FiercestT/EasyEdaThemes/releases/latest')).json()
                let latestVersion = data["tag_name"].match(/(\d\.)+\d/g)
                let curVersion = instance.manifest.version

                //Semantic version check

                let latest = latestVersion[0].split('.')
                let cur = curVersion.split('.')
                let needsUpdate = false

                for(let i = 0; i < latest.length; i++)
                {
                    if(parseFloat(`0.${latest[i] || 0}`) > parseFloat(`0.${cur[i] || 0}`))
                    {
                        needsUpdate = true
                        break
                    }
                }

                if(!needsUpdate)
                    return

                var updateCmd = this.createCommand('updateVersion', ()=>{ window.open(releasesUrl,'_blank') });

                $.messager.show({
                    title: `Update Available for <b>${instance.manifest.name}</b>`,
                    msg: `<table>
                            <tr><td>Installed:</td><td>${instance.manifest.name} ${instance.manifest.version}</td></tr>
                            <tr><td>Available:</td><td>${latestVersion}</td></tr>
                        </table>
                        <div class="dialog-button">
                            <a tabindex="0" cmd="${updateCmd};dialog-close" class="l-btn"><span class="l-btn-left"><span class="l-btn-text i18n">Download</span></span></a>
                            <a tabindex="0" cmd="dialog-close" class="l-btn"><span class="l-btn-left"><span class="l-btn-text i18n">Close</span></span></a>
                        </div>
                        `,
                    height: 'auto',
                    timeout: 30e3,
                    showType: "slide"
                });
            } catch (error) {
                console.log('Update check failed: '+error);
            }
        })();
    }
}

console.log(`EasyEDA Helper loaded for extension "${extensionId}"`);