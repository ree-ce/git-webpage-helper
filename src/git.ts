import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RepositoryInfo {
    rootPath: string;
    remoteUrl: string;
    currentBranch: string;
}

export class GitService {
    /**
     * Gets information about the Git repository containing the given file
     */
    async getRepositoryInfo(fileUri: vscode.Uri): Promise<RepositoryInfo | null> {
        try {
            const filePath = fileUri.fsPath;
            const workingDir = path.dirname(filePath);
            
            // Get repository root path
            const { stdout: rootPathOutput } = await execAsync('git rev-parse --show-toplevel', { cwd: workingDir });
            const rootPath = rootPathOutput.trim();
            
            // Get remote URL
            const { stdout: remoteOutput } = await execAsync('git remote get-url origin', { cwd: workingDir });
            const remoteUrl = remoteOutput.trim();
            
            // Get current branch
            const { stdout: branchOutput } = await execAsync('git symbolic-ref --short HEAD', { cwd: workingDir });
            const currentBranch = branchOutput.trim();
            
            return { rootPath, remoteUrl, currentBranch };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Gets the file path relative to the repository root
     */
    async getRelativeFilePath(fileUri: vscode.Uri, rootPath: string): Promise<string> {
        const filePath = fileUri.fsPath;
        return path.relative(rootPath, filePath).replace(/\\/g, '/');
    }
    
    /**
     * Gets a list of recent branches in the repository
     */
    async getRecentBranches(fileUri: vscode.Uri): Promise<string[]> {
        try {
            const filePath = fileUri.fsPath;
            const workingDir = path.dirname(filePath);
            
            // Get recent branches
            const { stdout: branchOutput } = await execAsync(
                'git for-each-ref --sort=-committerdate refs/heads/ --format="%(refname:short)"', 
                { cwd: workingDir }
            );
            
            return branchOutput
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean);
        } catch (error) {
            return [];
        }
    }
}
