import * as vscode from 'vscode';
import StatusBarEntry from './StatusBarEntry';

class BinarySize {
  static readonly KB = 1024;
  static readonly MB = BinarySize.KB * BinarySize.KB;
  static readonly GB = BinarySize.MB * BinarySize.KB;
  static formatSize(size: number): string {
    if (size < BinarySize.KB) {
      return `${size}Byte`;
    }
    if (size < BinarySize.MB) {
      return `${(size / BinarySize.KB).toFixed(2)}KB`;
    }
    if (size < BinarySize.GB) {
      return `${(size / BinarySize.MB).toFixed(2)}MB`;
    }
    return `图片过大`;
  }
}

export default class BinarySizeStatusBar extends StatusBarEntry {
  constructor() { 
    super({
      alignment: vscode.StatusBarAlignment.Right,
      priority: 1,
    });
  }
  public show(owner: string, text: number) {
    if (!text) {
      this.hide(owner);
    }
    else {
      this.showItem(owner, BinarySize.formatSize(text));
    }
  }
}
