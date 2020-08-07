import * as vscode from 'vscode';
import StatusBarEntry from './StatusBarEntry';

export default class DimensionStatusBarEntry extends StatusBarEntry {
  constructor() {
    super({
      alignment: vscode.StatusBarAlignment.Right,
      priority: 2,
    });
  }
  public show(owner: string, text: string) {
    this.showItem(owner, text);
  }
}
