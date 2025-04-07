import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { URL } from 'url';

export function activate(context: vscode.ExtensionContext) {
    // 註冊命令：在網頁上打開文件
    const openFileOnWeb = vscode.commands.registerCommand('git-helper.openFileOnWeb', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const selection = editor.selection;
            
            // 獲取 Git 存儲庫信息
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }
            
            // 構建網頁 URL
            const webUrl = buildWebUrl(repoInfo, filePath, selection);
            if (!webUrl) {
                vscode.window.showErrorMessage('Could not determine web URL for this repository');
                return;
            }
            
            // 打開瀏覽器
            vscode.env.openExternal(vscode.Uri.parse(webUrl));
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    // 註冊命令：在網頁上打開分支
    const openBranchOnWeb = vscode.commands.registerCommand('git-helper.openBranchOnWeb', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            
            // 獲取 Git 存儲庫信息
            const repoInfo = await getGitRepoInfo(filePath);
            if (!repoInfo) {
                vscode.window.showErrorMessage('Failed to get repository information');
                return;
            }
            
            // 構建分支網頁 URL
            const webUrl = buildBranchWebUrl(repoInfo);
            if (!webUrl) {
                vscode.window.showErrorMessage('Could not determine web URL for this repository');
                return;
            }
            
            // 打開瀏覽器
            vscode.env.openExternal(vscode.Uri.parse(webUrl));
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(openFileOnWeb, openBranchOnWeb);
}

// 獲取 Git 存儲庫信息
async function getGitRepoInfo(filePath: string) {
    try {
        const dirPath = path.dirname(filePath);
        
        // 獲取遠程倉庫 URL
        const remoteUrlCmd = await execCommand('git config --get remote.origin.url', dirPath);
        if (!remoteUrlCmd.success) {
            return null;
        }
        const remoteUrl = remoteUrlCmd.stdout.trim();
        
        // 獲取當前分支
        const branchCmd = await execCommand('git rev-parse --abbrev-ref HEAD', dirPath);
        if (!branchCmd.success) {
            return null;
        }
        const branch = branchCmd.stdout.trim();
        
        // 獲取相對於倉庫根目錄的文件路徑
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

// 執行命令並獲取輸出
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

// 構建網頁 URL
function buildWebUrl(repoInfo: {remoteUrl: string, branch: string, relativePath: string}, filePath: string, selection: vscode.Selection) {
    const { remoteUrl, branch, relativePath } = repoInfo;
    
    // 處理 GitHub URLs
    if (remoteUrl.includes('github.com')) {
        const baseUrl = remoteUrl
            .replace(/\.git$/, '')
            .replace(/^git@github\.com:/, 'https://github.com/')
            .replace(/^https:\/\/.*?@github\.com\//, 'https://github.com/');
        
        let url = `${baseUrl}/blob/${branch}/${relativePath}`;
        
        // 添加行號選擇
        if (!selection.isEmpty) {
            const start = selection.start.line + 1;
            const end = selection.end.line + 1;
            url += start === end ? `#L${start}` : `#L${start}-L${end}`;
        }
        
        return url;
    }
    
    // 這裡可以添加對其他 Git 服務例如 GitLab、Bitbucket 的支持
    
    return null;
}

// 構建分支網頁 URL
function buildBranchWebUrl(repoInfo: {remoteUrl: string, branch: string}) {
    const { remoteUrl, branch } = repoInfo;
    
    // 處理 GitHub URLs
    if (remoteUrl.includes('github.com')) {
        const baseUrl = remoteUrl
            .replace(/\.git$/, '')
            .replace(/^git@github\.com:/, 'https://github.com/')
            .replace(/^https:\/\/.*?@github\.com\//, 'https://github.com/');
        
        return `${baseUrl}/tree/${branch}`;
    }
    
    // 這裡可以添加對其他 Git 服務例如 GitLab、Bitbucket 的支持
    
    return null;
}

export function deactivate() {}
