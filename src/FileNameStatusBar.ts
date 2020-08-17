import * as vscode from 'vscode';
import StatusBarEntry from './StatusBarEntry';

export default class FileNameStatusBarEntry extends StatusBarEntry {
  constructor() {
    super({
      alignment: vscode.StatusBarAlignment.Left,
      priority: 1,
    });
  }
  public show(owner: string, text: string) {
    this.showItem(owner, text);
  }
}

