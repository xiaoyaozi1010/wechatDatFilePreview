import * as vscode from 'vscode';
import { Disposable } from './Disposable';

interface StatusBarOptions {
  alignment?: vscode.StatusBarAlignment
  priority?: number
}

// 状态栏基类
export default abstract class StatusBarEntry extends Disposable {
  private _showOwner: string | undefined;
  protected readonly entry: vscode.StatusBarItem;

  constructor(options: StatusBarOptions) {
    super();
    this.entry = this._register(vscode.window.createStatusBarItem(options.alignment, options.priority));
  }
  protected showItem(owner: string, text: string) {
    this._showOwner = owner;
    this.entry.text = text;
    this.entry.show();
  }
  public hide(owner: string) {
    if (this._showOwner === owner) {
      this.entry.hide();
      this._showOwner = '';
    }
  }
}
