import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import * as config from './badNoteConfig'

//#region Utilities

namespace _ {

	function handleResult<T>(resolve: (result: T) => void, reject: (error: Error) => void, error: Error | null | undefined, result: T): void {
		if (error) {
			reject(massageError(error));
		} else {
			resolve(result);
		}
	}

	function massageError(error: Error & { code?: string }): Error {
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

	export function checkCancellation(token: vscode.CancellationToken): void {
		if (token.isCancellationRequested) {
			throw new Error('Operation cancelled');
		}
	}

	export function normalizeNFC(items: string): string;
	export function normalizeNFC(items: string[]): string[];
	export function normalizeNFC(items: string | string[]): string | string[] {
		if (process.platform !== 'darwin') {
			return items;
		}

		if (Array.isArray(items)) {
			return items.map(item => item.normalize('NFC'));
		}

		return items.normalize('NFC');
	}

	export function readdir(path: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)));
		});
	}

	export function stat(path: string): Promise<fs.Stats> {
		return new Promise<fs.Stats>((resolve, reject) => {
			fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
		});
	}

	export function readfile(path: string): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer));
		});
	}

	export function writefile(path: string, content: Buffer): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function exists(path: string): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			fs.exists(path, exists => handleResult(resolve, reject, null, exists));
		});
	}

	export function rmrf(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			// rimraf(path, (error: Error | null | undefined) => handleResult(resolve, reject, error, void 0));
			fs.rm(path, { recursive: true }, (error: Error | null | undefined) => handleResult(resolve, reject, error, void 0));
		});
	}

	export function mkdir(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			// mkdirp(path, (error: Error | null | undefined) => handleResult(resolve, reject, error, void 0));
			fs.mkdir(path, { recursive: true }, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function rename(oldPath: string, newPath: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.rename(oldPath, newPath, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function unlink(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.unlink(path, error => handleResult(resolve, reject, error, void 0));
		});
	}
}

export class FileStat implements vscode.FileStat {

	constructor(private fsStat: fs.Stats) { }

	get type(): vscode.FileType {
		return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
	}

	get isFile(): boolean | undefined {
		return this.fsStat.isFile();
	}

	get isDirectory(): boolean | undefined {
		return this.fsStat.isDirectory();
	}

	get isSymbolicLink(): boolean | undefined {
		return this.fsStat.isSymbolicLink();
	}

	get size(): number {
		return this.fsStat.size;
	}

	get ctime(): number {
		return this.fsStat.ctime.getTime();
	}

	get mtime(): number {
		return this.fsStat.mtime.getTime();
	}
}

interface Entry {
	uri: vscode.Uri;
	type: vscode.FileType;
}

//#endregion

export class FileSystemProvider implements vscode.TreeDataProvider<Entry>, vscode.FileSystemProvider {

	private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;

	constructor() {
		this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	}

	get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
		return this._onDidChangeFile.event;
	}

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
		const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event, filename) => {
			if (filename) {
				const filepath = path.join(uri.fsPath, _.normalizeNFC(filename.toString()));

				// TODO support excludes (using minimatch library?)

				this._onDidChangeFile.fire([{
					type: event === 'change' ? vscode.FileChangeType.Changed : await _.exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
					uri: uri.with({ path: filepath })
				} as vscode.FileChangeEvent]);
			}
		});

		return { dispose: () => watcher.close() };
	}

	stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
		return this._stat(uri.fsPath);
	}

	async _stat(path: string): Promise<vscode.FileStat> {
		return new FileStat(await _.stat(path));
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
		return this._readDirectory(uri);
	}

	async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		const children = await _.readdir(uri.fsPath);

		const result: [string, vscode.FileType][] = [];
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const stat = await this._stat(path.join(uri.fsPath, child));
			result.push([child, stat.type]);
		}

		return Promise.resolve(result);
	}

	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		return _.mkdir(uri.fsPath);
	}

	readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
		return _.readfile(uri.fsPath);
	}

	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
		return this._writeFile(uri, content, options);
	}

	async _writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
		const exists = await _.exists(uri.fsPath);
		if (!exists) {
			if (!options.create) {
				throw vscode.FileSystemError.FileNotFound();
			}
			console.log("mkdir", path.dirname(uri.fsPath));
			await _.mkdir(path.dirname(uri.fsPath));
		} else {
			if (!options.overwrite) {
				throw vscode.FileSystemError.FileExists();
			}
		}
		console.log("mkdir", path.dirname(uri.fsPath));
		return _.writefile(uri.fsPath, content as Buffer);
	}

	delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
		if (options.recursive) {
			return _.rmrf(uri.fsPath);
		}

		return _.unlink(uri.fsPath);
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		return this._rename(oldUri, newUri, options);
	}

	async _rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
		const exists = await _.exists(newUri.fsPath);
		if (exists) {
			if (!options.overwrite) {
				let e = vscode.FileSystemError.FileExists();
				vscode.window.showErrorMessage(JSON.stringify(e));
				throw e;
			} else {
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

	async getChildren(element?: Entry): Promise<Entry[]> {

		if (element) {
			const children = await this.readDirectory(element.uri);
			children.sort((a, b) => {
				if (a[1] === b[1]) {
					return a[0].localeCompare(b[0]);
				}
				return a[1] === vscode.FileType.Directory ? -1 : 1;
			});
			return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
		}

		// no element: init
		let root = config.getEntry();
		let root_uri = vscode.Uri.file(root);
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
			let ret = children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(root, name)), type }));
			return ret;
		}

		return [];
	}

	getTreeItem(element: Entry): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		if (element.type === vscode.FileType.File) {
			treeItem.command = { command: 'fileExplorer.openFile', title: "Open File", arguments: [element.uri], };
			treeItem.contextValue = 'file';
		}
		return treeItem;
	}

	private _onDidChangeTreeData: vscode.EventEmitter<Entry | undefined | null | void> = new vscode.EventEmitter<Entry | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<Entry | undefined | null | void> = this._onDidChangeTreeData.event;
	public refresh(): void {
		config.getEntryFromConfig();
		this._onDidChangeTreeData.fire();
	}
}

export class FileExplorer {

	private context: vscode.ExtensionContext;
	private treeDataProvider: FileSystemProvider;
	private selected: string;
	private copyHelper: CopyHelper;

	constructor(context: vscode.ExtensionContext) {
		// 初始化
		let entry = config.getEntryFromConfig();
		this.context = context;
		this.selected = entry;
		this.copyHelper = new CopyHelper();

		// 初始化 tree view
		// 当树支持多选并且从树执行命令时， 命令的第一个参数是执行该命令的树项，第二个参数是 包含所有选定的树项目的数组。
		let treeDataProvider = new FileSystemProvider();
		this.treeDataProvider = treeDataProvider;
		let treeView = vscode.window.createTreeView('fileExplorer', { treeDataProvider, canSelectMany: true });
		context.subscriptions.push(treeView);

		// 注册 Change Selection 事件
		treeView.onDidChangeSelection(e => {
			this.onDidChangeSelection(e);
		})

		config.setListenerOnDidChangeConfiguration();

		// 注册命令
		vscode.commands.registerCommand('fileExplorer.openFile', (resource) => this.openResource(resource));
		vscode.commands.registerCommand('fileExplorer.addEntry', async () => await this.addEntry());
		vscode.commands.registerCommand('fileExplorer.refresh', () => treeDataProvider.refresh());
		vscode.commands.registerCommand('fileExplorer.newFile', async () => await this.newFile());
		vscode.commands.registerCommand('fileExplorer.newDir', async () => await this.newDir());
		vscode.commands.registerCommand('fileExplorer.renameFile', async (item) => await this.renameFile(item));
		vscode.commands.registerCommand('fileExplorer.deleteFile', async (item, selections) => await this.deleteFile(item, selections));
		vscode.commands.registerCommand('fileExplorer.moveFile', async (item, selections) => this.setCopyHelper(selections, CopyMode.Move));
		vscode.commands.registerCommand('fileExplorer.copyFile', async (item, selections) => this.setCopyHelper(selections, CopyMode.Copy));
		vscode.commands.registerCommand('fileExplorer.pasteFile', async (item, selections) => this.pasteFile());

		vscode.commands.registerCommand('fileExplorer.addNotesToWorkspace', async () => this.addNotesToWorkspace());
		

	}

	private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument(resource);
	}


	private addNotesToWorkspace(){
		let entry = config.getEntryFromConfig();
		vscode.commands.executeCommand('workbench.action.addRootFolder');
	}

	private setCopyHelper(selections: Entry[], mode: CopyMode) {
		let files = selections.map(x => x.uri.fsPath);
		this.copyHelper.set(files, mode);
	}

	private pasteFile() {
		let dest = this.selected;
		let files = this.copyHelper.files;
		let mode = this.copyHelper.mode;
		if (mode == CopyMode.Copy) {
			vscode.window.showInformationMessage('unimpl');
		} else if (mode === CopyMode.Move) {
			for (let f of files) {
				let newp = path.join(dest, path.basename(f));
				this.treeDataProvider.rename(
					vscode.Uri.file(f),
					vscode.Uri.file(newp),
					{ overwrite: false }
				)
			}
		}
		vscode.commands.executeCommand('fileExplorer.refresh');
	}

	private onDidChangeSelection(e: vscode.TreeViewSelectionChangeEvent<Entry>) {
		if (e.selection.length == 0) {
			this.selected = config.getEntry();
		}
		else {
			let uri = e.selection[0].uri;
			let type = e.selection[0].type;
			if (type === vscode.FileType.Directory) {
				this.selected = uri.fsPath;
			} else {
				this.selected = path.dirname(uri.fsPath);
			}
		}
		console.log(this.selected);
	}

	private async newDir() {
		let dirname = this.selected;
		// // prompt user for new note name
		await vscode.window.showInputBox({ prompt: 'New Dir in ' + this.selected }).then(name => {
			if (!name) { return; }
			let p = path.join(dirname, name);
			this.treeDataProvider.createDirectory(vscode.Uri.file(p));
			vscode.commands.executeCommand('fileExplorer.refresh');
		});
	}

	private async renameFile(resource: Entry) {
		// prompt user for new note name
		vscode.window.showInputBox({
			prompt: 'New File in ' + this.selected,
		}).then(newName => {
			if (!newName) {
				return;
			}

			console.log(`resource = `, resource)

			let newPath = path.join(config.getEntry(), newName);

			this.treeDataProvider.rename(
				resource.uri,
				vscode.Uri.file(newPath),
				{ overwrite: false }
			);

			vscode.commands.executeCommand('fileExplorer.refresh');
		});
	}


	private async deleteFile(resource: Entry, selections: Entry[]) {
		if (!selections || selections.length == 0) {
			selections = [resource];
		}
		console.log(selections);

		let msg = `删除:\n`;
		for (let sele of selections) {
			let p = sele.uri.fsPath;
			msg += `${p}\n`;
		}

		vscode.window.showInformationMessage(msg, '确认', '取消').then(v => {
			if (v == '确认') {
				for (let sele of selections) {
					this.treeDataProvider.delete(sele.uri, { recursive: true });
				}
				vscode.commands.executeCommand('fileExplorer.refresh');
			}
		});
	}

	private async newFile() {
		let dirname = this.selected;
		// // prompt user for new note name
		await vscode.window.showInputBox({ prompt: 'New File in: ' + this.selected }).then(async (name) => {
			if (!name) { return; }
			let p = vscode.Uri.file(path.join(dirname, name));
			console.log(path.join(dirname, name));
			this.treeDataProvider.writeFile(p, new Uint8Array(), { create: true, overwrite: false })
			await vscode.commands.executeCommand('fileExplorer.refresh').then(v => {
				vscode.commands.executeCommand('vscode.open', p);
			});
		});
	}

	private async addEntry() {
		await vscode.commands.executeCommand('workbench.action.openSettings', config.settingID);
	}











}


enum CopyMode {
	None = 0,
	Copy = 1,
	Move = 2,
}

class CopyHelper {
	public files: string[] = [];
	public mode: CopyMode = CopyMode.None;

	constructor() { }

	public set(files: string[], mode: CopyMode) {
		this.files = files;
		this.mode = mode;
	}

	public isCopy() { return this.mode === CopyMode.Copy }
	public isMove() { return this.mode === CopyMode.Move }
}
