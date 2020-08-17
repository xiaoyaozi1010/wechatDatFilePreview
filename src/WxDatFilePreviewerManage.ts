import * as vscode from 'vscode';
import * as dayjs from 'dayjs';
import { Disposable } from './Disposable';
import BinarySizeStatusBarEntry from './BinarySizeStatusBar';
import DimensionStatusBarEntry from './DimensionStatusBar';
import CreateTimeStatusBarEntry from './CreateTimeStatusBar';
import FileNameStatusBarEntry from './FileNameStatusBar';

interface ImageContent {
  base64: string
  buffer: Buffer
}

const enum FILE_TYPE_HEADER_IDENTIFY {
  JPEG = 0xEE,
  GIF = 1,
  PNG = 0x98,
  TIFF = 0x5C,
}
const enum FILE_TYPE_HEAD_BASE {
  JPEG = 0xFF,
  GIF = 0x47,
  PNG = 0X89,
  TIFF = 0x49,
}

export default class WxDatFilePreviewerManage implements vscode.CustomReadonlyEditorProvider {
  private static viewType = 'wxDatFile.viewer';
  static register(
    context: vscode.ExtensionContext,
    binarySizeStatusBarEntry: BinarySizeStatusBarEntry,
    dimensionStatusBarEntry: DimensionStatusBarEntry,
    createTimeStatusBarEntry: CreateTimeStatusBarEntry,
    filenameStatusBarEntry: FileNameStatusBarEntry
  ) {
    const previewer = new WxDatFilePreviewerManage(context.extensionUri, binarySizeStatusBarEntry, dimensionStatusBarEntry, createTimeStatusBarEntry, filenameStatusBarEntry);
    return vscode.window.registerCustomEditorProvider(this.viewType, previewer, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    });
  }
  private readonly _previews = new Set<Preview>();
  private _activePreview: Preview | undefined;
  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly binarySizeStatusBarEntry: BinarySizeStatusBarEntry,
    private readonly dimensionStatusBarEntry: DimensionStatusBarEntry,
    private readonly createTimeStatusBarEntry: CreateTimeStatusBarEntry,
    private readonly filenameStatusBarEntry: FileNameStatusBarEntry,
  ) { }
  public openCustomDocument(uri: vscode.Uri) {
    return { uri, dispose: () => { } };
  }
  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webview: vscode.WebviewPanel
  ): Promise<void> {
    const preview = new Preview(this.extensionRoot, document.uri, webview, this.binarySizeStatusBarEntry, this.dimensionStatusBarEntry, this.createTimeStatusBarEntry, this.filenameStatusBarEntry);
    this._previews.add(preview);
    this.setActivePreview(preview);
    // webview销毁删除当前预览
    webview.onDidDispose(() => {
      this._previews.delete(preview);
    });
    // webview更新状态
    webview.onDidChangeViewState(() => {
      if (webview.active) {
        this.setActivePreview(preview);
      }
      else if (this._activePreview === preview && !webview.active) {
        this.setActivePreview(undefined);
      }
    });
  }
  public get activePreview() {
    return this._activePreview;
  }
  private setActivePreview(preview: Preview | undefined): void {
    this._activePreview = preview;
    this.setPreviewActiveContext(!!preview);
  }
  private setPreviewActiveContext(value: boolean) {
    vscode.commands.executeCommand('setContext', 'imagePreviewFocus', value);
  }
}

const enum PreviewState {
  Disposed,
  Visible,
  Active,
}

class Preview extends Disposable {
  private readonly id: string = `${Date.now()}-${Math.random().toString()}`;
  private _previewState = PreviewState.Visible;
  private _imageSize: string | undefined;
  private _imageBinarySize: number | undefined;
  private _createTime: number | string | undefined;
  private _filename: string | undefined;
  private readonly emptyDataUri = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR42gEFAPr/AP///wAI/AL+Sr4t6gAAAABJRU5ErkJggg==`;
  private resourceRoot: vscode.Uri;
  private _saveTargetUri: vscode.Uri | undefined;
  private siblingsFiles: [string, vscode.FileType][];
  constructor(
    private readonly extensionRoot: vscode.Uri,
    private resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel,
    private readonly binarySizeStatusBarEntry: BinarySizeStatusBarEntry,
    private readonly dimensionStatusBarEntry: DimensionStatusBarEntry,
    private readonly createTimeStatusBarEntry: CreateTimeStatusBarEntry,
    private readonly filenameStatusBarEntry: FileNameStatusBarEntry
  ) {
    super();
    // 通过
    this.siblingsFiles = [];
    this._filename = resource.fsPath;
    const resourceRoot = resource.with({
      path: resource.path.replace(/\/[^\/]+?\.\w+$/, '/'),
    });
    this.resourceRoot = resourceRoot;
    webviewEditor.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        resourceRoot,
        extensionRoot,
      ]
    };
    // 监听编辑器发送过来的事件，修改状态栏
    this._register(webviewEditor.webview.onDidReceiveMessage(message => {
      switch (message.type) {
        case 'size':
          this._imageSize = message.value;
          this.update();
          break;
        // 文本编辑器打开，调用vscode原生命令
        case 'reopen-as-text':
          vscode.commands.executeCommand('vscode.openWith', resource, 'default', webviewEditor.viewColumn);
          break;
        case 'next':
          // this.renderNext();
          vscode.commands.executeCommand('wxDatFilePreview.openNext', this);
          break;
        case 'previous':
          vscode.commands.executeCommand('wxDatFilePreview.openPrevious', this);
          break;
        case 'export':
          this.saveFile();
          break;
      }
    }));
    // 编辑器状态更新
    this._register(webviewEditor.onDidChangeViewState(() => {
      this.update();
      this.webviewEditor.webview.postMessage({ type: 'setActive', value: this.webviewEditor.active });
    }));
    // 编辑器被销毁
    this._register(webviewEditor.onDidDispose(() => {
      if (this._previewState === PreviewState.Active) {
        // 隐藏状态栏信息
        this.binarySizeStatusBarEntry.hide(this.id);
        this.dimensionStatusBarEntry.hide(this.id);
        this.createTimeStatusBarEntry.hide(this.id);
        this.filenameStatusBarEntry.hide(this.id);
      }
      this._previewState = PreviewState.Disposed;
    }));
    // 监听资源文件变化
    const watcher = this._register(vscode.workspace.createFileSystemWatcher(resource.fsPath));
    // 文件变化更新预览
    this._register(watcher.onDidChange((e) => {
      if (e.toString() === this.resource.toString()) {
        this.render();
      }
    }));
    // 监听器删除后关闭当前webview
    this._register(watcher.onDidDelete(e => {
      if (e.toString() === this.resource.toString()) {
        this.webviewEditor.dispose();
      }
    }));
    this.render();
    this.update();
    this.webviewEditor.webview.postMessage({ type: 'setActive', value: this.webviewEditor.active });
  }
  // 更新状态栏
  private update() {
    if (this._previewState === PreviewState.Disposed) {
      return;
    }
    vscode.workspace.fs.stat(this.resource).then((res) => {
      this._imageBinarySize = res.size;
      this._createTime = `${dayjs(res.ctime).format(`YYYY-MM-DD HH:mm:ss`)}`;
    });
    this._filename = this.resource.fsPath;
    // 当前编辑器激活态
    if (this.webviewEditor.active) {
      this._previewState = PreviewState.Active;
      // 更新status bar的各种状态：文件大小，缩放比例，图片尺寸
      this.binarySizeStatusBarEntry.show(this.id, this._imageBinarySize as number);
      this.dimensionStatusBarEntry.show(this.id, `${this._imageSize}`);
      this.createTimeStatusBarEntry.show(this.id, this._createTime as string);
      this.filenameStatusBarEntry.show(this.id, `${this._filename}`);
    }
    else {
      // 当前预览状态激活
      if (this._previewState === PreviewState.Active) {
        // 隐藏status bar的各种状态
      }
      this._previewState = PreviewState.Visible;
    }
  }
  private async render() {
    // 只更新Visible和Active状态的视图
    if (this._previewState !== PreviewState.Disposed) {
      this.webviewEditor.webview.postMessage({ type: 'loading', value: {} });
      const webviewHtml = await this.getWebviewContents();
      this.webviewEditor.webview.html = webviewHtml;
      this.webviewEditor.webview.postMessage({ type: 'loading-success', value: {} });
    }
  }
  private async getWebviewContents() {
    const version = Date.now().toString();
    const settings = {
      isMac: process.platform === 'darwin',
      src: await this.getResourcePath(this.webviewEditor, this.resource, version),
    };
    const nonce = Date.now().toString();
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">

	<!-- Disable pinch zooming -->
	<meta name="viewport"
		content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">

	<title>Image Preview</title>

	<link rel="stylesheet" href="${escapeAttribute(this.extensionResource('/media/main.css'))}" type="text/css" media="screen" nonce="${nonce}">

	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src 'none'; img-src 'self' data: ${this.webviewEditor.webview.cspSource}; script-src 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}';">
  <meta id="image-preview-settings" data-settings="${escapeAttribute(JSON.stringify(settings))}">
  <script src="${escapeAttribute(this.extensionResource('/media/statics/iconfont.js'))}" nonce="${nonce}"></script>
</head>
<body class="container image scale-to-fit">
  <div class="image-wrapper" id="imageWrapper">
    <div class="action-container">
      <div class="icon-wrapper__left">
        <a href="#" class="action-item next" id="previous" title="上一张">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-arrow-left-bold"></use>
          </svg>
        </a>
        <a href="#" class="action-item next" id="next" title="下一张">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-arrow-right-bold"></use>
          </svg>
        </a>
      </div>
      <div class="icon-wrapper__right">
        <a href="#" class="action-item export" id="export" title="导出">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-export"></use>
          </svg>
        </a>
      </div>
    </div>
    <div class="image-error__container">
      <div class="error-msg">
        <p class="tip-icon">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-error"></use>
          </svg>
        </p>
        <p>当前文件解析出错，您可以<a href="#" class="open-file-link" id="openFile">&nbsp;&nbsp;打开源文件</a></p>
      </div>
    </div>
    <div class="loading" id="loading"><div class="lds-dual-ring"></div></div>
  </div>
	<script src="${escapeAttribute(this.extensionResource('/media/main.js'))}" nonce="${nonce}"></script>
</body>
</html>`;
  }
  private async getResourcePath(webviewEditor: vscode.WebviewPanel, resource: vscode.Uri, version: string) {
    if (resource.scheme === 'git') {
      // 获取元数据
      const stat = await vscode.workspace.fs.stat(resource);
      if (stat.size === 0) {
        return this.emptyDataUri;
      }
    }
    return this.convertSourceType(resource, 'base64');
    // 已经转过的，直接拿结果
    if (resource.query) {
      // 本地路径转为vscode能使用的路径
      return this.convertSourceType(resource);
    }
  }
  private extensionResource(path: string) {
    return this.webviewEditor.webview.asWebviewUri(this.extensionRoot.with({
      path: this.extensionRoot.path + path,
    }));
  }
  // 源文件转为base64
  private async convertSourceType(resource: vscode.Uri, type?: 'base64' | 'buffer'): Promise<string | Uint8Array> {
    // const filePath = this.webviewEditor.webview.asWebviewUri(resource);
    const fileData = await vscode.workspace.fs.readFile(resource);
    const buffer: Buffer = Buffer.from(fileData);
    const first = buffer[0];
    let base: number = 0xff;
    let fileType = 'jpeg';
    // let v = first ^ base;
    base = findBase(first) || base;
    switch (base) {
      case FILE_TYPE_HEAD_BASE.TIFF:
        fileType = 'tiff';
        break;
      case FILE_TYPE_HEAD_BASE.GIF:
        fileType = 'gif';
        break;
      case FILE_TYPE_HEAD_BASE.PNG:
        fileType = 'png';
        break;
    }
    const key = first ^ base;
    const content = buffer.map(_ => _ ^ key);
    if (type === 'base64') {
      return `data:image/${fileType};base64,${Buffer.from(content).toString('base64')}`;
    }
    else {
      return content;
    }
  }
  // 获取当前文件所在文件夹下所有同类型资源
  private async getSiblingsFile(resource: vscode.Uri): Promise<Array<vscode.Uri>> {
    let files: [string, vscode.FileType][] = [];
    if (this.siblingsFiles && this.siblingsFiles.length) {
      files = this.siblingsFiles;
    }
    else {
      files = await vscode.workspace.fs.readDirectory(resource);
      this.siblingsFiles = files;
    }
    return files.filter(_ => {
        const tmp = _[0].split('.');
        return tmp[tmp.length - 1] === 'dat';
      })
      .map(_ => {
        return vscode.Uri.joinPath(resource, _[0]);
      });
  }
  // 获取当前文件在文件树中的索引
  private getCurrentFileIndex(current: vscode.Uri, all: Array<vscode.Uri>) {
    return all.findIndex(_ => _.path === current.path);
  }
  public async renderNext() {
    const allFiles = await this.getSiblingsFile(this.resourceRoot);
    const currentFileIndex = this.getCurrentFileIndex(this.resource, allFiles);
    const nextFile = allFiles[currentFileIndex + 1];
    if (!nextFile) {
      return;
    }
    // 初始化实例状态
    this._previewState = PreviewState.Active;
    this.resource = nextFile;
    this.render();
  }
  public async renderPrevious() {
    const allFiles = await this.getSiblingsFile(this.resourceRoot);
    const currentFileIndex = this.getCurrentFileIndex(this.resource, allFiles);
    const previousFile = allFiles[currentFileIndex - 1];
    if (!previousFile) {
      return;
    }
    // 初始化实例状态
    this._previewState = PreviewState.Active;
    this.resource = previousFile;
    this.render();
  }
  // 保存文件到硬盘
  private async saveFile() {
    const defaultUri = vscode.Uri.joinPath(this.resourceRoot, `${this._createTime}.png`.replace(/\:/g, '_'));
    let targetUri = this._saveTargetUri || defaultUri;
    this._saveTargetUri = await vscode.window.showSaveDialog({
      defaultUri: targetUri,
      title: `${this._createTime}`,
    });
  
    const content = await this.convertSourceType(this.resource, 'buffer');
    if (!targetUri) {
      return;
    }
    await vscode.workspace.fs.writeFile(targetUri, content as Uint8Array);
  }
}

function escapeAttribute(value: string | vscode.Uri): string {
  return value.toString().replace(/"/g, '&quot;');
}

function findBase(biteValue: number) {
  const validBase = [0xFF, 0x47, 0X89, 0x49];
  return validBase.find(_ => {
    // 尝试获取key
    let key = biteValue ^ _;
    // 用获取到的key验证解密出来的值
    const val = biteValue ^ key;
    return val === _;
  });
}
