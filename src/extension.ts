import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { generateUrl } from './url-generator';

export function activate(context: vscode.ExtensionContext) {
    // Register command: Open file on web (from Editor)
    const openFileOnWebFromEditor = vscode.commands.registerCommand('git-helper.openFileOnWeb', async (lineNumber?: number) => {
        await handleGitAction({
            actionType: 'open',
            targetType: 'file',
            lineNumber
        });
    });
    
    // Register command: Open file on web (from Explorer)
    const openFileOnWebFromExplorer = vscode.commands.registerCommand('git-helper.openFileFromExplorer', async (uri: vscode.Uri) => {
        await handleGitAction({
            actionType: 'open',
            targetType: 'file',
            uri
        });
    });
    
    // Register command: Copy file URL to clipboard (from Editor)
    const copyFileUrlToClipboardFromEditor = vscode.commands.registerCommand('git-helper.copyFileUrlToClipboard', async (lineNumber?: number) => {
        await handleGitAction({
            actionType: 'copy',
            targetType: 'file',
            lineNumber
        });
    });
    
    // Register command: Copy file URL to clipboard (from Explorer)
    const copyFileUrlToClipboardFromExplorer = vscode.commands.registerCommand('git-helper.copyFileFromExplorer', async (uri: vscode.Uri) => {
        await handleGitAction({
            actionType: 'copy',
            targetType: 'file',
            uri
        });
    });

    // Register command: Open branch on web from Editor
    const openBranchOnWeb = vscode.commands.registerCommand('git-helper.openBranchOnWeb', async (lineNumber?: number) => {
        await handleGitAction({
            actionType: 'open',
            targetType: 'branch',
            lineNumber
        });
    });
    
    // Register command: Open branch on web from Explorer
    const openBranchFromExplorer = vscode.commands.registerCommand('git-helper.openBranchFromExplorer', async (uri: vscode.Uri) => {
        await handleGitAction({
            actionType: 'open',
            targetType: 'branch',
            uri
        });
    });
    
    // Register command: Copy branch URL to clipboard from Editor
    const copyBranchUrlToClipboard = vscode.commands.registerCommand('git-helper.copyBranchUrlToClipboard', async (lineNumber?: number) => {
        await handleGitAction({
            actionType: 'copy',
            targetType: 'branch',
            lineNumber
        });
    });
    
    // Register command: Copy branch URL to clipboard from Explorer
    const copyBranchFromExplorer = vscode.commands.registerCommand('git-helper.copyBranchFromExplorer', async (uri: vscode.Uri) => {
        await handleGitAction({
            actionType: 'copy',
            targetType: 'branch',
            uri
        });
    });

    context.subscriptions.push(
        openFileOnWebFromEditor,
        openFileOnWebFromExplorer,
        copyFileUrlToClipboardFromEditor,
        copyFileUrlToClipboardFromExplorer,
        openBranchOnWeb,
        openBranchFromExplorer,
        copyBranchUrlToClipboard,
        copyBranchFromExplorer
    );
}

// Get Git repository information
async function getGitRepoInfo(filePath: string) {
    try {
        const dirPath = path.dirname(filePath);
        
        // Get remote repository URL
        const remoteUrlCmd = await execCommand('git config --get remote.origin.url', dirPath);
        if (!remoteUrlCmd.success) {
            return null;
        }
        const remoteUrl = remoteUrlCmd.stdout.trim();
        
        // Get current branch
        const branchCmd = await execCommand('git rev-parse --abbrev-ref HEAD', dirPath);
        if (!branchCmd.success) {
            return null;
        }
        const branch = branchCmd.stdout.trim();
        
        // Get file path relative to repository root
        const repoRootCmd = await execCommand('git rev-parse --show-toplevel', dirPath);
        if (!repoRootCmd.success) {
            return null;
        }
        const repoRoot = repoRootCmd.stdout.trim();
        const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
        
        return { remoteUrl, branch, relativePath, repoRoot };
    } catch (error) {
        console.error('Failed to get Git repo info:', error);
        return null;
    }
}

// Execute command and get output
function execCommand(command: string, cwd: string): Promise<{success: boolean, stdout: string, stderr: string}> {
    return new Promise((resolve) => {
        cp.exec(command, { cwd }, (error, stdout, stderr) => {
            resolve({
                success: !error,
                stdout: stdout || '',
                stderr: stderr || ''
            });
        });
    });
}

// Add this new function after getGitRepoInfo
async function getBranchSelection(dirPath: string): Promise<string | undefined> {
    const branchesCmd = await execCommand('git branch', dirPath);
    if (!branchesCmd.success) {
        throw new Error('Failed to get branches');
    }

    const branches = branchesCmd.stdout
        .split('\n')
        .map(b => b.trim())
        .filter(b => b)
        .map(b => b.startsWith('*') ? b.substring(1).trim() : b);

    return vscode.window.showQuickPick(branches, {
        placeHolder: 'Select a branch'
    });
}

// 提取共用的處理選擇範圍和行號的函數
function processSelection(selection?: vscode.Selection): { lineStart?: number, lineEnd?: number } {
    let lineStart: number | undefined;
    let lineEnd: number | undefined;
    
    if (selection) {
        // Always include the current line number, even when there's no selection
        lineStart = selection.active.line + 1;
        
        // If there is a selection, include both start and end lines
        if (!selection.isEmpty) {
            lineStart = selection.start.line + 1;
            lineEnd = selection.end.line + 1;
            if (lineStart === lineEnd) {
                lineEnd = undefined;
            }
        }
    }
    
    return { lineStart, lineEnd };
}

// Build file URL
function generateFileUrl(repoInfo: {remoteUrl: string, branch: string, relativePath: string}, selection?: vscode.Selection) {
    const { remoteUrl, branch, relativePath } = repoInfo;
    const { lineStart, lineEnd } = processSelection(selection);
    
    return generateUrl({
        remoteUrl,
        branch,
        filePath: relativePath,
        lineStart,
        lineEnd
    });
}

// Build branch URL
function generateBranchUrl(
    repoInfo: {remoteUrl: string, branch: string, relativePath: string}, 
    customBranch?: string, 
    fromExplorer: boolean = false,
    selection?: vscode.Selection // Add selection parameter
) {
    const { remoteUrl, relativePath } = repoInfo;
    const branch = customBranch || repoInfo.branch;
    
    let filePath = relativePath; // Default to include the file path
    let lineStart: number | undefined;
    let lineEnd: number | undefined;
    
    // Get the active editor to check if we have a file open
    const editor = vscode.window.activeTextEditor;
    
    console.log(`generateBranchUrl called: fromExplorer=${fromExplorer}, editor=${!!editor}, customBranch=${customBranch}, selection=${!!selection}`);
    
    // If a specific selection is provided, use it first (from line number menu)
    if (selection) {
        const selectionInfo = processSelection(selection);
        lineStart = selectionInfo.lineStart;
        lineEnd = selectionInfo.lineEnd;
        console.log(`Selection from parameter: lineStart=${lineStart}, lineEnd=${lineEnd}`);
    }
    // Otherwise, use the active editor's selection when called from editor (not explorer)
    else if (editor && !fromExplorer) {
        // If we're viewing a file in editor (not from explorer), include its path and selection in the branch URL
        const selectionInfo = processSelection(editor.selection);
        lineStart = selectionInfo.lineStart;
        lineEnd = selectionInfo.lineEnd;
        console.log(`Selection from editor: lineStart=${lineStart}, lineEnd=${lineEnd}`);
    } else {
        console.log(`No line numbers included: fromExplorer=${fromExplorer}, editor=${!!editor}`);
    }

    // Check if this is a branch-only operation (no file path)
    const includeFilePath = filePath.length > 0;
    
    return generateUrl({
        remoteUrl,
        branch,
        filePath,
        lineStart,
        lineEnd,
        includeFilePath
    });
}

// 通用處理函數：從編輯器或工作區獲取檔案路徑
async function getFilePathFromContext(uri?: vscode.Uri): Promise<string | null> {
    if (uri) {
        // 從 Explorer 面板呼叫，使用所提供的檔案路徑
        return uri.fsPath;
    } else {
        // 從編輯器或命令列呼叫，使用當前編輯器
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return null;
        }
        return editor.document.uri.fsPath;
    }
}

// 通用處理函數：處理選擇範圍（包括從行號參數創建選擇範圍）
function getSelectionFromContext(lineNumber?: number): vscode.Selection | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }
    
    if (typeof lineNumber === 'number') {
        // 從行號右鍵選單呼叫，創建僅包含該行的選擇範圍
        return new vscode.Selection(lineNumber - 1, 0, lineNumber - 1, 0);
    } else {
        // 從編輯器內容呼叫，使用當前選擇範圍
        return editor.selection;
    }
}

/**
 * 處理URL操作的核心函數
 * 根據操作類型和URL類型執行不同的操作
 */
async function performUrlAction(
    options: {
        actionType: 'open' | 'copy',
        url: string,
        targetType: 'file' | 'branch'
    }
): Promise<boolean> {
    try {
        const { actionType, url, targetType } = options;
        
        if (!url) {
            vscode.window.showErrorMessage('Could not determine web URL for this repository');
            return false;
        }
        
        if (actionType === 'open') {
            // 打開瀏覽器
            await vscode.env.openExternal(vscode.Uri.parse(url));
            return true;
        } else { // copy
            // 複製到剪貼簿
            await vscode.env.clipboard.writeText(url);
            vscode.window.showInformationMessage(`${targetType === 'file' ? 'URL' : 'Branch URL'} copied to clipboard!`);
            return true;
        }
    } catch (error) {
        const action = options.actionType === 'open' ? 'opening browser' : 'copying to clipboard';
        vscode.window.showErrorMessage(`Error ${action}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/**
 * 統一處理不同來源和操作的函數
 * 
 * @param options 操作選項
 * @returns Promise<boolean> 操作是否成功
 */
async function handleGitAction(
    options: {
        // 操作類型：在瀏覽器中打開或複製到剪貼簿
        actionType: 'open' | 'copy',
        // 操作對象：文件或分支
        targetType: 'file' | 'branch',
        // 從編輯器或資源管理器觸發
        uri?: vscode.Uri,
        // 編輯器行號（從編輯器右鍵菜單觸發時可能提供）
        lineNumber?: number,
        // 自定義分支（用於分支操作時）
        customBranch?: string
    }
): Promise<boolean> {
    try {
        // 確定來源：Explorer 或 Editor
        const source = options.uri ? 'explorer' : 'editor';
        const fromExplorer = source === 'explorer';
        
        console.log(`handleGitAction: actionType=${options.actionType}, targetType=${options.targetType}, source=${source}, fromExplorer=${fromExplorer}, lineNumber=${options.lineNumber}, customBranch=${options.customBranch}`);
        
        // 獲取文件路徑
        const filePath = await getFilePathFromContext(options.uri);
        if (!filePath) {
            return false;
        }
        
        // 獲取 Git 倉庫信息
        const repoInfo = await getGitRepoInfo(filePath);
        if (!repoInfo) {
            vscode.window.showErrorMessage('Failed to get repository information');
            return false;
        }
        
        // 處理分支選擇（如果是分支操作且沒有提供自定義分支）
        let selectedBranch = options.customBranch;
        if (options.targetType === 'branch' && !selectedBranch) {
            const dirPath = path.dirname(filePath);
            selectedBranch = await getBranchSelection(dirPath);
            if (!selectedBranch) {
                return false; // 用戶取消了選擇
            }
        }
        
        // 獲取編輯器選擇範圍（如果是從編輯器觸發且提供了行號）
        const selection = options.lineNumber ? 
            getSelectionFromContext(options.lineNumber) : 
            (source === 'editor' ? getSelectionFromContext() : undefined);
        
        // 根據操作對象生成適當的URL
        let url: string;
        if (options.targetType === 'file') {
            url = generateFileUrl(repoInfo, selection);
        } else { // branch
            url = generateBranchUrl(repoInfo, selectedBranch, fromExplorer, selection);
        }
        
        // 執行URL操作（開啟或複製）
        return await performUrlAction({
            actionType: options.actionType,
            url,
            targetType: options.targetType
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

export function deactivate() {}
