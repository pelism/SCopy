'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import filesync from "./filesync";

export function activate(context: vscode.ExtensionContext) {
    var fileChanges = [];
    var config = {};
    var password: string;

    function configHasErrors(config): boolean {
        if (config['user'] === '' ||
            config['host'] === '' ||
            config['localPath'] === '' ||
            config['remotePath'] === '') {
                vscode.window.showErrorMessage("Please check settings. One or more values is missing.");
                return true;
        }
    
        return false;
    }

    function getPassword(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (password !== undefined) {
                resolve(password);
                return;
            }

            let options: vscode.InputBoxOptions = {
                password: true,
                placeHolder: '',
                prompt: 'Enter password:'
            }

            vscode.window.showInputBox(options).then(result => {
                if (result === undefined) {
                    reject('Password not set.');
                    return;
                }

                password = result;
                resolve(password);
            });
        });
    }

    function fileSystemWalk(dir): any[] {
        var results = [];
        var list = fs.readdirSync(dir);
        list.forEach(entry => {
            var resolvePath = path.resolve(dir, entry);
            var stat = fs.statSync(resolvePath)
            if (stat && stat.isDirectory()) {
                results = results.concat(fileSystemWalk(resolvePath));
            } else {
                var file = {};
                file['fullPath'] = resolvePath;
                file['remotePath'] = resolvePath.replace(config['localPath'], '');
                results.push(file);
            }
        });

        return results;
    }   

    let reload = vscode.commands.registerCommand('extension.scopy.reload', () => {
        var scopy = vscode.workspace.getConfiguration('scopy');
        config['host'] = scopy.has('host') ? scopy.get('host').toString() : '';
        config['port'] = scopy.has('port') ? parseInt(scopy.get('port').toString()) : 22;
        config['user'] = scopy.has('user') ? scopy.get('user').toString() : '';
        config['localPath'] = scopy.has('localPath') ? scopy.get('localPath').toString() : '';
        config['remotePath'] = scopy.has('remotePath') ? scopy.get('remotePath').toString() : '';
    });

    context.subscriptions.push(reload);

    let full = vscode.commands.registerCommand('extension.scopy.syncFull', () => {
        fileChanges = [];
        fileChanges = fileSystemWalk(config['localPath']);
        vscode.commands.executeCommand('extension.scopy.syncIncrement');
    });

    context.subscriptions.push(full);

    let increment = vscode.commands.registerCommand('extension.scopy.syncIncrement', () => {
        if (configHasErrors(config)) return;

        if (fileChanges.length == 0) {
            vscode.window.showInformationMessage('No files to sync');
            return;
        }

        getPassword()
            .then(result => {
                if (result === undefined) return;
                var sync = new filesync(config['user'], config['host'], result);
                sync.transfer(fileChanges, config['remotePath'])
                    .then(resolve => {
                        vscode.window.showInformationMessage('Sync complete');
                        fileChanges = [];
                    })
                    .catch(reject => {
                        password = '';
                        vscode.window.showErrorMessage(reject);
                    });
            }).catch(reason => {
                vscode.window.showErrorMessage(reason);
        });
    });

    context.subscriptions.push(increment);

    let onSave = vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
        var localPath = config['localPath'];
        if (document.fileName.startsWith(localPath)) {
            var file = {};
            file['fullPath'] = document.fileName;
            file['remotePath'] = document.fileName.replace(localPath, '');
		    fileChanges.push(file);
        }
	});

    context.subscriptions.push(onSave);

    vscode.commands.executeCommand('extension.scopy.reload');
}

export function deactivate() {
}
