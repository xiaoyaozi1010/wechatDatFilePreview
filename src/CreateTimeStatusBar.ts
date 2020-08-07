import * as vscode from 'vscode';
import StatusBarEntry from './StatusBarEntry';

export default class CreateTimeStatusBarEntry extends StatusBarEntry {
  constructor() {
    super({
      alignment: vscode.StatusBarAlignment.Right,
      priority: 3,
    });
  }
  public show(owner: string, text: string) {
    this.showItem(owner, text);
  }
}
