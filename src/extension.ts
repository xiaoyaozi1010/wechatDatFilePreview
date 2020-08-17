import * as vscode from 'vscode';
import WxDatFilePreviewerManage from './WxDatFilePreviewerManage';
import BinarySizeStatusBar from './BinarySizeStatusBar';
import DimensionStatusBar from './DimensionStatusBar';
import CreateTimeStatusBar from './CreateTimeStatusBar';
import FIleNameStatusBar from './FileNameStatusBar';

export function activate(context: vscode.ExtensionContext) {
	const binarySizeStatusBarEntry = new BinarySizeStatusBar();
	context.subscriptions.push(binarySizeStatusBarEntry);

	const dimensionStatusBarEntry = new DimensionStatusBar();
	context.subscriptions.push(dimensionStatusBarEntry);

	const createTimeStatusBarEntry = new CreateTimeStatusBar();
	context.subscriptions.push(createTimeStatusBarEntry);

	const filenameStatusBarEntry = new FIleNameStatusBar();
	context.subscriptions.push(filenameStatusBarEntry);

	context.subscriptions.push(WxDatFilePreviewerManage.register(context, binarySizeStatusBarEntry, dimensionStatusBarEntry, createTimeStatusBarEntry, filenameStatusBarEntry));

	context.subscriptions.push(vscode.commands.registerCommand('wxDatFilePreview.openNext', (previewer) => {
		previewer.renderNext();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('wxDatFilePreview.openPrevious', (previewer) => {
		previewer.renderPrevious();
	}));
}

export function deactivate() {}
