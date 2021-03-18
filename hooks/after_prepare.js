module.exports = function(context) {

    var path              = require('path'),
        fs                = require('fs'),
        Q                 = require('q'),
        JavaScriptObfuscator = require('javascript-obfuscator')
        cordova_util      = context.requireCordovaModule('cordova-lib/src/cordova/util'),
        platforms         = context.requireCordovaModule('cordova-lib/src/platforms/platforms'),
        ConfigParser      = context.requireCordovaModule('cordova-common').ConfigParser;

    var deferral = new Q.defer();
    var projectRoot = cordova_util.cdProjectRoot();

    var targetFiles = loadObfuscatedFileTargets();

    context.opts.platforms.forEach(function(platform) {
        var platformPath = path.join(projectRoot, 'platforms', platform);
        var platformApi = platforms.getPlatformApi(platform, platformPath);
        var platformInfo = platformApi.getPlatformInfo();
        var wwwDir = platformInfo.locations.www;

        findObfuscatedFiles(wwwDir).filter(function(file) {
            return fs.statSync(file).isFile() && isObfuscatedFile(file.replace(wwwDir, ''));
        }).forEach(function(file) {
            var content = fs.readFileSync(file, 'utf-8');
            fs.writeFileSync(file, obfuscatedData(content), 'utf-8');
            console.log('obfuscate: ' + file);
        });

    });

    deferral.resolve();
    return deferral.promise;


    function findObfuscatedFiles(dir) {
        var fileList = [];
        var list = fs.readdirSync(dir);
        list.forEach(function(file) {
            fileList.push(path.join(dir, file));
        });
        // sub dir
        list.filter(function(file) {
            return fs.statSync(path.join(dir, file)).isDirectory();
        }).forEach(function(file) {
            var subDir = path.join(dir, file)
            var subFileList = findObfuscatedFiles(subDir);
            fileList = fileList.concat(subFileList);
        });

        return fileList;
    }

    function loadObfuscatedFileTargets() {
        var xmlHelpers = context.requireCordovaModule('cordova-common').xmlHelpers;

        var pluginXml = path.join(context.opts.plugin.dir, 'plugin.xml');

        var include = [];
        var exclude = [];

        var doc = xmlHelpers.parseElementtreeSync(pluginXml);
        var obfuscatedfiles = doc.findall('cryptfiles');
        if (obfuscatedfiles.length > 0) {
            obfuscatedfiles[0]._children.forEach(function(elm) {
                elm._children.filter(function(celm) {
                    return celm.tag == 'file' && celm.attrib.regex && celm.attrib.regex.trim().length > 0;
                }).forEach(function(celm) {
                    if (elm.tag == 'include') {
                        include.push(celm.attrib.regex.trim());
                    } else if (elm.tag == 'exclude') {
                        exclude.push(celm.attrib.regex.trim());
                    }
                });
            })
        }

        return {'include': include, 'exclude': exclude};
    }

    function isObfuscatedFile(file) {
        if (!targetFiles.include.some(function(regexStr) { return new RegExp(regexStr).test(file); })) {
            return false;
        }
        if (targetFiles.exclude.some(function(regexStr) { return new RegExp(regexStr).test(file); })) {
            return false;
        }
        return true;
    }

    function obfuscatedData(input) {
        return JavaScriptObfuscator.obfuscate(input).getObfuscatedCode();
    }

}
