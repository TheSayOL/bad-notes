"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteDataProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 实现 TreeDataProvider 需要实现两个方法 getChildren getTreeItem
// 当用户打开 tree view 时, 此时没有任何元素, 调用 getChildren 应该返回顶级 item
// item 的 collapsibleState 表示是否折叠
// - 默认值 TreeItemCollapsibleState.None 表示这是个树叶, 不会再对其调用 getChildren
// - TreeItemCollapsibleState.Collapsed, 则显示为折叠状态
// - TreeItemCollapsibleState.Expanded 变成展开状态
class NoteDataProvider {
    noteRoot;
    now_selected_path = '';
    constructor(noteRoot) {
        this.noteRoot = noteRoot;
    }
    // getTreeItem(element: T): TreeItem | Thenable<TreeItem> 
    // 返回 view 中显示的元素的 UI 表示形式
    getTreeItem(element) {
        return element;
    }
    // getChildren(element?: T): ProviderResult<T[]> : 返回给定元素的子元素
    getChildren(element) {
        if (!this.noteRoot) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return Promise.resolve([]);
        }
        if (element) {
            return Promise.resolve(this.parsePath(element.path));
        }
        // 用户刚刚打开 tree view, 此时 element 为空, getChildren 应该返回顶级 item
        else {
            return Promise.resolve(this.parseNoteRoot());
        }
    }
    parsePath(path) {
        let ret = [];
        console.log("path, ", path);
        let file_names = fs.readdirSync(path, { withFileTypes: true });
        for (let f of file_names) {
            let d = new Dependency(f.name, `${path}/${f.name}`, f.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
            ret.push(d);
        }
        return ret;
    }
    /**
     * parse noteRoot, return the tree view of dir
     */
    parseNoteRoot() {
        // read dir
        let ret = [];
        let file_names = fs.readdirSync(this.noteRoot, { withFileTypes: true });
        for (let f of file_names) {
            let d = new Dependency(f.name, `${this.noteRoot}/${f.name}`, f.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
            ret.push(d);
        }
        return ret;
    }
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh(context) {
        this.noteRoot = context.globalState.get('dirname') || '';
        this.parseNoteRoot();
        this._onDidChangeTreeData.fire();
    }
    rename_file(element) {
        // prompt user for new note name
        vscode.window.showInputBox({
            prompt: 'New note name?',
            value: element.label
        }).then(noteName => {
            // if no new note name or note name didn't change
            if (!noteName || noteName === element.label) {
                // do nothing
                return;
            }
            // set new not name (may do something special with file types in the future)
            let newNoteName = noteName;
            // check for existing note with the same name
            let dirname = path.dirname(element.path);
            let newNotePath = path.join(dirname, newNoteName);
            if (fs.existsSync(newNotePath)) {
                vscode.window.showWarningMessage(`'${newNoteName}' already exists.`);
                // do nothing
                return;
            }
            // else save the note
            vscode.window.showInformationMessage(`'${element.label}' renamed to '${newNoteName}'.`);
            fs.renameSync(element.path, newNotePath);
            // refresh tree after renaming note
            this._onDidChangeTreeData.fire();
        });
    }
    new_file() {
        // prompt user for new note name
        vscode.window.showInputBox({
            prompt: 'New note name?',
        }).then(noteName => {
            if (!noteName) {
                return;
            }
            // set new not name (may do something special with file types in the future)
            let newNoteName = noteName;
            // check for existing note with the same name
            let dirname = path.dirname(this.now_selected_path);
            let newPath = `${dirname}/${noteName}`;
            console.log(newPath);
            // let newNotePath = path.join(dirname, newNoteName);
            // if (fs.existsSync(newNotePath)) {
            //     vscode.window.showWarningMessage(`'${newNoteName}' already exists.`);
            //     // do nothing
            //     return;
            // }
            // // else save the note
            // vscode.window.showInformationMessage(`'${element.label}' renamed to '${newNoteName}'.`);
            // fs.renameSync(element.path, newNotePath);
            // // refresh tree after renaming note
            // this._onDidChangeTreeData.fire();
        });
    }
    new_dir() {
        // prompt user for new note name
        // vscode.window.showInputBox({
        //     prompt: 'New note name?',
        //     value: element.label
        // }).then(noteName => {
        //     // if no new note name or note name didn't change
        //     if (!noteName || noteName === element.label) {
        //         // do nothing
        //         return;
        //     }
        //     // set new not name (may do something special with file types in the future)
        //     let newNoteName = noteName;
        //     // check for existing note with the same name
        //     let dirname = path.dirname(element.path);
        //     let newNotePath = path.join(dirname, newNoteName);
        //     if (fs.existsSync(newNotePath)) {
        //         vscode.window.showWarningMessage(`'${newNoteName}' already exists.`);
        //         // do nothing
        //         return;
        //     }
        //     // else save the note
        //     vscode.window.showInformationMessage(`'${element.label}' renamed to '${newNoteName}'.`);
        //     fs.renameSync(element.path, newNotePath);
        //     // refresh tree after renaming note
        //     this._onDidChangeTreeData.fire();
        // });
    }
}
exports.NoteDataProvider = NoteDataProvider;
class Dependency extends vscode.TreeItem {
    label;
    path;
    collapsibleState;
    constructor(label, path, collapsibleState) {
        super(label, collapsibleState);
        this.label = label;
        this.path = path;
        this.collapsibleState = collapsibleState;
        this.path = path;
        this.tooltip = this.path;
        this.description = '';
        if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
            this.command = {
                title: "treeitemclick",
                command: "noteExplorer.openFile",
                arguments: [path],
            };
        }
    }
}
//# sourceMappingURL=NoteDataProvider.js.map