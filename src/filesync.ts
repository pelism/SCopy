import * as ssh2 from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export default class FileSync {
    private username: string;
    private password: string;
    private host: string; 
    private port: number;
    private outputChannel: vscode.OutputChannel;

    public constructor(username: string, host: string, password?: string, port?: number) {
        this.username = username;
        this.password = password || '';
        this.host = host
        this.port = port || 22;
        this.outputChannel = vscode.window.createOutputChannel('SCopy');
    }
    
    public setPassword(password: string) {
        this.password = password;
    }

    public transfer(files: string[], remotePath: string): Promise<string> {
        var client = new ssh2.Client();
        this.outputChannel.show();
        var channel = this.outputChannel;
        return new Promise<string>((resolve, reject) => {
            try {
                client.on('ready', function(err: Error, stream) {
                    return client.sftp(function(err, sftp) {
                        if (err) { reject(err.message); return; }
                        var dir;
                        sftp.readdir(remotePath, function(err, entries){
                            if (err) { 
                                reject(err.message); return; 
                            }
                            
                            dir = entries;
                        });
                        files.forEach(file => {
                            var remote = (remotePath + file['remotePath']).replace('\\', '/');
                            if (dir === undefined || !dir.indexOf(path.dirname(remote))) {
                                var newDir = path.dirname(remote).replace(" ", "\ ");
                                sftp.mkdir(newDir, function(err) {
                                    if (err) { 
                                        reject(err.message); return; 
                                    }

                                    channel.appendLine('Creating directory ' + newDir);
                                });
                            }
                            
                            sftp.fastPut(file['fullPath'], remote, function(err: Error) {
                                if (err) { 
                                    reject(err.message); return; 
                                }

                                channel.appendLine('Uploading file ' + file['fullPath']);
                            });
                        });

                        resolve('');
                    });
                }).on('error', function(err: Error) {
                    reject(err.message);
                    return false;
                }).connect({
                    host: this.host,
                    port: this.port,
                    username: this.username,
                    password: this.password
                    //, debug: console.log
                    //privateKey: require('fs').readFileSync('/here/is/my/key')
                });
            }
            catch (e) {
                reject(e.message);
                return false;
            }
        });
    }
}
