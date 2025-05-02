import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { generateUrl } from './url-generator';

export function activate(context: vscode.ExtensionContext) {
    // Register command: Open file on web (from Editor)
    const openFileOnWebFromEditor = vscode.commands.registerCommand('git-helper.openFileOnWeb', async (lineNumber?: number) => {
        try {
            console.log('openFileOnWeb called with lineNumber:', lineNumber);
            
            const filePath = await getFilePathFromContext();
            if (!filePath) {
                return;
            }
            
            const selection = getSelectionFromContext(lineNumber);
            
            // Get Git repository information
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }
            
            // Open browser
            await openInBrowser(repoInfo, filePath, selection);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    
    // Register command: Open file on web (from Explorer)
    const openFileOnWebFromExplorer = vscode.commands.registerCommand('git-helper.openFileFromExplorer', async (uri: vscode.Uri) => {
        try {
            console.log('openFileFromExplorer called with URI:', uri ? uri.fsPath : 'undefined');
            
            const filePath = await getFilePathFromContext(uri);
            if (!filePath) {
                return;
            }
            
            // Get Git repository information
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }
            
            // Open browser
            await openInBrowser(repoInfo, filePath);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    
    // Register command: Copy file URL to clipboard (from Editor)
    const copyFileUrlToClipboardFromEditor = vscode.commands.registerCommand('git-helper.copyFileUrlToClipboard', async (lineNumber?: number) => {
        try {
            console.log('copyFileUrlToClipboard called with lineNumber:', lineNumber);
            
            const filePath = await getFilePathFromContext();
            if (!filePath) {
                return;
            }
            
            const selection = getSelectionFromContext(lineNumber);
            
            // Get Git repository information
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }
            
            // Copy to clipboard
            await copyToClipboard(repoInfo, filePath, selection);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    
    // Register command: Copy file URL to clipboard (from Explorer)
    const copyFileUrlToClipboardFromExplorer = vscode.commands.registerCommand('git-helper.copyFileFromExplorer', async (uri: vscode.Uri) => {
        try {
            console.log('copyFileFromExplorer called with URI:', uri ? uri.fsPath : 'undefined');
            
            const filePath = await getFilePathFromContext(uri);
            if (!filePath) {
                return;
            }
            
            // Get Git repository information
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }
            
            // Copy to clipboard
            await copyToClipboard(repoInfo, filePath);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    // Register command: Open branch on web
    const openBranchOnWeb = vscode.commands.registerCommand('git-helper.openBranchOnWeb', async (uri?: vscode.Uri) => {
        try {
            const filePath = await getFilePathFromContext(uri);
            if (!filePath) {
                return;
            }

            const dirPath = path.dirname(filePath);
            
            // Get Git repository information
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }

            // Get branch selection
            const selectedBranch = await getBranchSelection(dirPath);
            if (!selectedBranch) {
                return; // User cancelled the selection
            }
            
            // Build branch web URL and open in browser
            await openBranchInBrowser(repoInfo, selectedBranch);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    
    // Register command: Copy branch URL to clipboard
    const copyBranchUrlToClipboard = vscode.commands.registerCommand('git-helper.copyBranchUrlToClipboard', async (uri?: vscode.Uri) => {
        try {
            const filePath = await getFilePathFromContext(uri);
            if (!filePath) {
                return;
            }

            const dirPath = path.dirname(filePath);
            
            // Get Git repository information
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }

            // Get branch selection
            const selectedBranch = await getBranchSelection(dirPath);
            if (!selectedBranch) {
                return; // User cancelled the selection
            }
            
            // Build branch web URL and copy to clipboard
            await copyBranchToClipboard(repoInfo, selectedBranch);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(
        openFileOnWebFromEditor,
        openFileOnWebFromExplorer,
        copyFileUrlToClipboardFromEditor,
        copyFileUrlToClipboardFromExplorer,
        openBranchOnWeb, 
        copyBranchUrlToClipboard
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

// Build web URL
function buildWebUrl(repoInfo: {remoteUrl: string, branch: string, relativePath: string}, filePath: string, selection?: vscode.Selection) {
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

// Build branch web URL
function buildBranchWebUrl(repoInfo: {remoteUrl: string, branch: string, relativePath: string}, customBranch?: string) {
    const { remoteUrl, relativePath } = repoInfo;
    const branch = customBranch || repoInfo.branch;
    
    // Get the active editor to check if we have a file open
    const editor = vscode.window.activeTextEditor;
    let filePath = '';
    let lineStart: number | undefined;
    let lineEnd: number | undefined;
    
    if (editor) {
        // If we're viewing a file, include its path in the branch URL
        filePath = relativePath;
        
        const selectionInfo = processSelection(editor.selection);
        lineStart = selectionInfo.lineStart;
        lineEnd = selectionInfo.lineEnd;
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

// 通用處理函數：生成 Web URL 並開啟瀏覽器
async function openInBrowser(repoInfo: any, filePath: string, selection?: vscode.Selection): Promise<boolean> {
    try {
        const webUrl = buildWebUrl(repoInfo, filePath, selection);
        if (!webUrl) {
            vscode.window.showErrorMessage('Could not determine web URL for this repository');
            return false;
        }
        
        await vscode.env.openExternal(vscode.Uri.parse(webUrl));
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Error opening browser: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

// 通用處理函數：生成 Web URL 並複製到剪貼簿
async function copyToClipboard(repoInfo: any, filePath: string, selection?: vscode.Selection): Promise<boolean> {
    try {
        const webUrl = buildWebUrl(repoInfo, filePath, selection);
        if (!webUrl) {
            vscode.window.showErrorMessage('Could not determine web URL for this repository');
            return false;
        }
        
        await vscode.env.clipboard.writeText(webUrl);
        vscode.window.showInformationMessage('URL copied to clipboard!');
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Error copying to clipboard: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

// 通用處理函數：生成 Branch Web URL 並開啟瀏覽器
async function openBranchInBrowser(repoInfo: any, customBranch?: string): Promise<boolean> {
    try {
        const webUrl = buildBranchWebUrl(repoInfo, customBranch);
        if (!webUrl) {
            vscode.window.showErrorMessage('Could not determine web URL for this repository');
            return false;
        }
        
        await vscode.env.openExternal(vscode.Uri.parse(webUrl));
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Error opening browser: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

// 通用處理函數：生成 Branch Web URL 並複製到剪貼簿
async function copyBranchToClipboard(repoInfo: any, customBranch?: string): Promise<boolean> {
    try {
        const webUrl = buildBranchWebUrl(repoInfo, customBranch);
        if (!webUrl) {
            vscode.window.showErrorMessage('Could not determine web URL for this repository');
            return false;
        }
        
        await vscode.env.clipboard.writeText(webUrl);
        vscode.window.showInformationMessage('Branch URL copied to clipboard!');
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Error copying to clipboard: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

export function deactivate() {}
