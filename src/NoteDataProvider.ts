// import * as vscode from 'vscode';
// import * as fs from 'fs';
// import * as path from 'path';

// // 实现 TreeDataProvider 需要实现两个方法 getChildren getTreeItem
// // 当用户打开 tree view 时, 此时没有任何元素, 调用 getChildren 应该返回顶级 item
// // item 的 collapsibleState 表示是否折叠
// // - 默认值 TreeItemCollapsibleState.None 表示这是个树叶, 不会再对其调用 getChildren
// // - TreeItemCollapsibleState.Collapsed, 则显示为折叠状态
// // - TreeItemCollapsibleState.Expanded 变成展开状态
// export class NoteDataProvider implements vscode.TreeDataProvider<Dependency> {

//     public now_selected_path: string = '';

//     constructor(private noteRoot: string) { }

//     // getTreeItem(element: T): TreeItem | Thenable<TreeItem> 
//     // 返回 view 中显示的元素的 UI 表示形式
//     getTreeItem(element: Dependency): vscode.TreeItem {
//         return element;
//     }

//     // getChildren(element?: T): ProviderResult<T[]> : 返回给定元素的子元素
//     getChildren(element?: Dependency): Thenable<Dependency[]> {
//         if (!this.noteRoot) {
//             vscode.window.showInformationMessage('No dependency in empty workspace');
//             return Promise.resolve([]);
//         }

//         if (element) {
//             return Promise.resolve(this.parsePath(element.path));
//         }
//         // 用户刚刚打开 tree view, 此时 element 为空, getChildren 应该返回顶级 item
//         else {
//             return Promise.resolve(this.parseNoteRoot());
//         }
//     }

//     private parsePath(path: string): Dependency[] {
//         let ret: Dependency[] = [];

//         console.log("path, ", path);

//         let file_names = fs.readdirSync(path, { withFileTypes: true });
//         for (let f of file_names) {
//             let d = new Dependency(f.name, `${path}/${f.name}`, f.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
//             ret.push(d);
//         }

//         return ret;
//     }


//     /**
//      * parse noteRoot, return the tree view of dir
//      */
//     private parseNoteRoot(): Dependency[] {
//         // read dir

//         let ret: Dependency[] = [];

//         let file_names = fs.readdirSync(this.noteRoot, { withFileTypes: true });
//         for (let f of file_names) {
//             let d = new Dependency(f.name, `${this.noteRoot}/${f.name}`, f.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
//             ret.push(d);
//         }

//         return ret;

//     }


//     private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | null | void> = new vscode.EventEmitter<Dependency | undefined | null | void>();
//     readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | null | void> = this._onDidChangeTreeData.event;

//     refresh(context: vscode.ExtensionContext): void {
//         this.noteRoot = context.globalState.get('dirname') || '';
//         this.parseNoteRoot();
//         this._onDidChangeTreeData.fire();
//     }

//     rename_file(element: Dependency) {
//         // prompt user for new note name
//         vscode.window.showInputBox({
//             prompt: 'New note name?',
//             value: element.label
//         }).then(noteName => {
//             // if no new note name or note name didn't change
//             if (!noteName || noteName === element.label) {
//                 // do nothing
//                 return;
//             }

//             // set new not name (may do something special with file types in the future)
//             let newNoteName = noteName;

//             // check for existing note with the same name
//             let dirname = path.dirname(element.path);
//             let newNotePath = path.join(dirname, newNoteName);
//             if (fs.existsSync(newNotePath)) {
//                 vscode.window.showWarningMessage(`'${newNoteName}' already exists.`);
//                 // do nothing
//                 return;
//             }

//             // else save the note
//             vscode.window.showInformationMessage(`'${element.label}' renamed to '${newNoteName}'.`);
//             fs.renameSync(element.path, newNotePath);

//             // refresh tree after renaming note
//             this._onDidChangeTreeData.fire();
//         });
//     }


//     new_file() {
//         // prompt user for new note name
//         vscode.window.showInputBox({
//             prompt: 'New note name?',
//         }).then(noteName => {
//             if (!noteName) {
//                 return;
//             }

//             // set new not name (may do something special with file types in the future)
//             let newNoteName = noteName;

//             // check for existing note with the same name
//             let dirname = path.dirname(this.now_selected_path);
//             let newPath = `${dirname}/${noteName}`;
//             console.log(newPath);
//             // let newNotePath = path.join(dirname, newNoteName);
//             // if (fs.existsSync(newNotePath)) {
//             //     vscode.window.showWarningMessage(`'${newNoteName}' already exists.`);
//             //     // do nothing
//             //     return;
//             // }

//             // // else save the note
//             // vscode.window.showInformationMessage(`'${element.label}' renamed to '${newNoteName}'.`);
//             // fs.renameSync(element.path, newNotePath);

//             // // refresh tree after renaming note
//             // this._onDidChangeTreeData.fire();
//         });
//     }



//     new_dir() {
//         // prompt user for new note name
//         // vscode.window.showInputBox({
//         //     prompt: 'New note name?',
//         //     value: element.label
//         // }).then(noteName => {
//         //     // if no new note name or note name didn't change
//         //     if (!noteName || noteName === element.label) {
//         //         // do nothing
//         //         return;
//         //     }

//         //     // set new not name (may do something special with file types in the future)
//         //     let newNoteName = noteName;

//         //     // check for existing note with the same name
//         //     let dirname = path.dirname(element.path);
//         //     let newNotePath = path.join(dirname, newNoteName);
//         //     if (fs.existsSync(newNotePath)) {
//         //         vscode.window.showWarningMessage(`'${newNoteName}' already exists.`);
//         //         // do nothing
//         //         return;
//         //     }

//         //     // else save the note
//         //     vscode.window.showInformationMessage(`'${element.label}' renamed to '${newNoteName}'.`);
//         //     fs.renameSync(element.path, newNotePath);

//         //     // refresh tree after renaming note
//         //     this._onDidChangeTreeData.fire();
//         // });
//     }






// }

// class Dependency extends vscode.TreeItem {

//     constructor(
//         public readonly label: string,
//         public path: string,
//         public readonly collapsibleState: vscode.TreeItemCollapsibleState
//     ) {
//         super(label, collapsibleState);
//         this.path = path;
//         this.tooltip = this.path;
//         this.description = '';

//         if (collapsibleState == vscode.TreeItemCollapsibleState.None) {
//             this.command = {
//                 title: "treeitemclick",
//                 command: "noteExplorer.openFile",
//                 arguments: [path],
//             };
//         }






//     }

//     // iconPath = {
//     //     light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
//     //     dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
//     // };
// }