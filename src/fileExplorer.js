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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileExplorer = exports.FileSystemProvider = exports.FileStat = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const mkdirp_1 = __importDefault(require("mkdirp"));
const rimraf_1 = __importDefault(require("rimraf"));
//#region Utilities
var _;
(function (_) {
    function handleResult(resolve, reject, error, result) {
        if (error) {
            reject(massageError(error));
        }
        else {
            resolve(result);
        }
    }
    function massageError(error) {
        if (error.code === 'ENOENT') {
            return vscode.FileSystemError.FileNotFound();
        }
        if (error.code === 'EISDIR') {
            return vscode.FileSystemError.FileIsADirectory();
        }
        if (error.code === 'EEXIST') {
            return vscode.FileSystemError.FileExists();
        }
        if (error.code === 'EPERM' || error.code === 'EACCES') {
            return vscode.FileSystemError.NoPermissions();
        }
        return error;
    }
    function checkCancellation(token) {
        if (token.isCancellationRequested) {
            throw new Error('Operation cancelled');
        }
    }
    _.checkCancellation = checkCancellation;
    function normalizeNFC(items) {
        if (process.platform !== 'darwin') {
            return items;
        }
        if (Array.isArray(items)) {
            return items.map(item => item.normalize('NFC'));
        }
        return items.normalize('NFC');
    }
    _.normalizeNFC = normalizeNFC;
    function readdir(path) {
        return new Promise((resolve, reject) => {
            fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)));
        });
    }
    _.readdir = readdir;
    function stat(path) {
        return new Promise((resolve, reject) => {
            fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
        });
    }
    _.stat = stat;
    function readfile(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer));
        });
    }
    _.readfile = readfile;
    function writefile(path, content) {
        return new Promise((resolve, reject) => {
            fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
        });
    }
    _.writefile = writefile;
    function exists(path) {
        return new Promise((resolve, reject) => {
            fs.exists(path, exists => handleResult(resolve, reject, null, exists));
        });
    }
    _.exists = exists;
    function rmrf(path) {
        return new Promise((resolve, reject) => {
            (0, rimraf_1.default)(path, (error) => handleResult(resolve, reject, error, void 0));
        });
    }
    _.rmrf = rmrf;
    function mkdir(path) {
        return new Promise((resolve, reject) => {
            // fs.mkdir(path, error => handleResult(resolve, reject, error, void 0));
            (0, mkdirp_1.default)(path, (error) => handleResult(resolve, reject, error, void 0));
        });
    }
    _.mkdir = mkdir;
    function rename(oldPath, newPath) {
        return new Promise((resolve, reject) => {
            fs.rename(oldPath, newPath, error => handleResult(resolve, reject, error, void 0));
        });
    }
    _.rename = rename;
    function unlink(path) {
        return new Promise((resolve, reject) => {
            fs.unlink(path, error => handleResult(resolve, reject, error, void 0));
        });
    }
    _.unlink = unlink;
})(_ || (_ = {}));
class FileStat {
    fsStat;
    constructor(fsStat) {
        this.fsStat = fsStat;
    }
    get type() {
        return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
    }
    get isFile() {
        return this.fsStat.isFile();
    }
    get isDirectory() {
        return this.fsStat.isDirectory();
    }
    get isSymbolicLink() {
        return this.fsStat.isSymbolicLink();
    }
    get size() {
        return this.fsStat.size;
    }
    get ctime() {
        return this.fsStat.ctime.getTime();
    }
    get mtime() {
        return this.fsStat.mtime.getTime();
    }
}
exports.FileStat = FileStat;
//#endregion
class FileSystemProvider {
    _onDidChangeFile;
    root;
    context;
    constructor(context) {
        let root = context.globalState.get("entry") || '';
        this.context = context;
        this.root = root;
        this._onDidChangeFile = new vscode.EventEmitter();
    }
    get onDidChangeFile() {
        return this._onDidChangeFile.event;
    }
    watch(uri, options) {
        const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event, filename) => {
            if (filename) {
                const filepath = path.join(uri.fsPath, _.normalizeNFC(filename.toString()));
                // TODO support excludes (using minimatch library?)
                this._onDidChangeFile.fire([{
                        type: event === 'change' ? vscode.FileChangeType.Changed : await _.exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
                        uri: uri.with({ path: filepath })
                    }]);
            }
        });
        return { dispose: () => watcher.close() };
    }
    stat(uri) {
        return this._stat(uri.fsPath);
    }
    async _stat(path) {
        return new FileStat(await _.stat(path));
    }
    readDirectory(uri) {
        return this._readDirectory(uri);
    }
    async _readDirectory(uri) {
        const children = await _.readdir(uri.fsPath);
        const result = [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const stat = await this._stat(path.join(uri.fsPath, child));
            result.push([child, stat.type]);
        }
        return Promise.resolve(result);
    }
    createDirectory(uri) {
        return _.mkdir(uri.fsPath);
    }
    readFile(uri) {
        return _.readfile(uri.fsPath);
    }
    writeFile(uri, content, options) {
        return this._writeFile(uri, content, options);
    }
    async _writeFile(uri, content, options) {
        const exists = await _.exists(uri.fsPath);
        if (!exists) {
            if (!options.create) {
                throw vscode.FileSystemError.FileNotFound();
            }
            await _.mkdir(path.dirname(uri.fsPath));
        }
        else {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            }
        }
        return _.writefile(uri.fsPath, content);
    }
    delete(uri, options) {
        if (options.recursive) {
            return _.rmrf(uri.fsPath);
        }
        return _.unlink(uri.fsPath);
    }
    rename(oldUri, newUri, options) {
        return this._rename(oldUri, newUri, options);
    }
    async _rename(oldUri, newUri, options) {
        const exists = await _.exists(newUri.fsPath);
        if (exists) {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            }
            else {
                await _.rmrf(newUri.fsPath);
            }
        }
        const parentExists = await _.exists(path.dirname(newUri.fsPath));
        if (!parentExists) {
            await _.mkdir(path.dirname(newUri.fsPath));
        }
        return _.rename(oldUri.fsPath, newUri.fsPath);
    }
    // tree data provider
    async getChildren(element) {
        if (element) {
            const children = await this.readDirectory(element.uri);
            return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
        }
        // no element: init
        let root = this.root;
        let root_uri = vscode.Uri.file(this.root);
        if (root) {
            const children = await this.readDirectory(root_uri);
            if (children.length == 0) {
                children.push(['empty dir', vscode.FileType.Unknown]);
            }
            children.sort((a, b) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }
                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });
            let ret = children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(this.root, name)), type }));
            console.log(ret);
            return ret;
        }
        return [];
    }
    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        if (element.type === vscode.FileType.File) {
            treeItem.command = { command: 'fileExplorer.openFile', title: "Open File", arguments: [element.uri], };
            treeItem.contextValue = 'file';
        }
        return treeItem;
    }
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh() {
        this.root = this.context.globalState.get('entry') || '';
        this._onDidChangeTreeData.fire();
    }
}
exports.FileSystemProvider = FileSystemProvider;
class FileExplorer {
    context;
    treeDataProvider;
    constructor(context) {
        this.context = context;
        let treeDataProvider = new FileSystemProvider(context);
        this.treeDataProvider = treeDataProvider;
        context.subscriptions.push(vscode.window.createTreeView('fileExplorer', { treeDataProvider }));
        vscode.commands.registerCommand('fileExplorer.openFile', (resource) => this.openResource(resource));
        vscode.commands.registerCommand('fileExplorer.addEntry', async () => await this.addEntry());
        vscode.commands.registerCommand('fileExplorer.refresh', () => treeDataProvider.refresh());
        vscode.commands.registerCommand('fileExplorer.newFile', async () => await this.newFile());
    }
    openResource(resource) {
        vscode.window.showTextDocument(resource);
    }
    async newFile() {
        // // prompt user for new note name
        // vscode.window.showInputBox({
        //     prompt: 'New note name?',
        // }).then(noteName => {
        //     if (!noteName) {
        //         return;
        //     }
        //     // set new not name (may do something special with file types in the future)
        //     let newNoteName = noteName;
        //     // check for existing note with the same name
        //     let dirname = path.dirname(this.now_selected_path);
        //     let newPath = `${dirname}/${noteName}`;
        //     console.log(newPath);
        //     // let newNotePath = path.join(dirname, newNoteName);
        //     // if (fs.existsSync(newNotePath)) {
        //     //     vscode.window.showWarningMessage(`'${newNoteName}' already exists.`);
        //     //     // do nothing
        //     //     return;
        //     // }
        //     // // else save the note
        //     // vscode.window.showInformationMessage(`'${element.label}' renamed to '${newNoteName}'.`);
        //     // fs.renameSync(element.path, newNotePath);
        //     // // refresh tree after renaming note
        //     // this._onDidChangeTreeData.fire();
        // });
    }
    async addEntry() {
        await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            title: 'choose directory',
            canSelectMany: false,
        }).then(uris => {
            if (uris) {
                let path = uris[0].fsPath;
                this.context.globalState.update('entry', path); // save uri
                console.log(`set entry ${path}`);
            }
        });
        vscode.commands.executeCommand("fileExplorer.refresh");
    }
}
exports.FileExplorer = FileExplorer;
//# sourceMappingURL=fileExplorer.js.map