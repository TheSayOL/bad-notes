import * as vscode from 'vscode'
import * as fs from 'fs'

export const settingID: string = 'badNote.allEntry';
export let entry: string = '';

// 从缓存里拿 note 目录地址
export function getEntry(): string {
    return entry;
}

// 从设置里拿 note 目录地址
export function getEntryFromConfig(): string {

    // 设置里是个数组, 找到第一个有效的文件夹返回
    let ps = vscode.workspace.getConfiguration().get<string[]>(settingID) || [];
    for (let p of ps) {
        // 发现有效文件夹
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
            entry = p;
            return p;
        }
    }

    // 没找到, 提示用户设置
    vscode.window.showErrorMessage('错误路径, 请设置', '设置').then(async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', settingID);
    });

    return '';
}



// 监听设置改变事件, 如果改变的是 notes 路径, 更新信息
export function setListenerOnDidChangeConfiguration() {
    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(settingID)) {
            getEntryFromConfig();
        }
    })
}
