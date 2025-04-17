import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { generateUrl } from './url-generator';

export function activate(context: vscode.ExtensionContext) {
    // Register command: Open file on web
    const openFileOnWeb = vscode.commands.registerCommand('git-helper.openFileOnWeb', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const selection = editor.selection;
            
            // Get Git repository information
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }
            
            // Build web URL
            const webUrl = buildWebUrl(repoInfo, filePath, selection);
            if (!webUrl) {
                vscode.window.showErrorMessage('Could not determine web URL for this repository');
                return;
            }
            
            // Open browser
            vscode.env.openExternal(vscode.Uri.parse(webUrl));
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    // Register command: Open branch on web
    const openBranchOnWeb = vscode.commands.registerCommand('git-helper.openBranchOnWeb', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const filePath = editor.document.uri.fsPath;
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
            
            // Build branch web URL
            const webUrl = buildBranchWebUrl(repoInfo, selectedBranch);
            if (!webUrl) {
                vscode.window.showErrorMessage('Could not determine web URL for this repository');
                return;
            }
            
            // Open browser
            vscode.env.openExternal(vscode.Uri.parse(webUrl));
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    
    // Register command: Copy file URL to clipboard
    const copyFileUrlToClipboard = vscode.commands.registerCommand('git-helper.copyFileUrlToClipboard', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const selection = editor.selection;
            
            // Get Git repository information
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }
            
            // Build web URL
            const webUrl = buildWebUrl(repoInfo, filePath, selection);
            if (!webUrl) {
                vscode.window.showErrorMessage('Could not determine web URL for this repository');
                return;
            }
            
            // Copy to clipboard
            await vscode.env.clipboard.writeText(webUrl);
            vscode.window.showInformationMessage('URL copied to clipboard!');
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    
    // Register command: Copy branch URL to clipboard
    const copyBranchUrlToClipboard = vscode.commands.registerCommand('git-helper.copyBranchUrlToClipboard', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const filePath = editor.document.uri.fsPath;
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
            
            // Build branch web URL
            const webUrl = buildBranchWebUrl(repoInfo, selectedBranch);
            if (!webUrl) {
                vscode.window.showErrorMessage('Could not determine web URL for this repository');
                return;
            }
            
            // Copy to clipboard
            await vscode.env.clipboard.writeText(webUrl);
            vscode.window.showInformationMessage('Branch URL copied to clipboard!');
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(
        openFileOnWeb, 
        openBranchOnWeb, 
        copyFileUrlToClipboard, 
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

// Build web URL
function buildWebUrl(repoInfo: {remoteUrl: string, branch: string, relativePath: string}, filePath: string, selection: vscode.Selection) {
    const { remoteUrl, branch, relativePath } = repoInfo;
    
    let lineStart, lineEnd;
    
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
        
        // Always include the current line number
        lineStart = editor.selection.active.line + 1;
        
        // If there is a selection, include both start and end lines
        if (!editor.selection.isEmpty) {
            lineStart = editor.selection.start.line + 1;
            lineEnd = editor.selection.end.line + 1;
            if (lineStart === lineEnd) {
                lineEnd = undefined;
            }
        }
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

export function deactivate() {}
