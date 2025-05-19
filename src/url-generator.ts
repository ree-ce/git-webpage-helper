import * as vscode from 'vscode';

interface UrlGeneratorOptions {
    remoteUrl: string;
    branch: string;
    filePath: string;
    lineStart?: number;
    lineEnd?: number;
    includeFilePath?: boolean; // Option to include file path in branch URLs
}

/**
 * Generate a web URL for a file in a Git repository
 */
export function generateUrl(options: UrlGeneratorOptions): string {
    const { remoteUrl, branch, filePath, lineStart, lineEnd, includeFilePath = true } = options;
    
    // Parse the remote URL to extract host, owner, and repo
    const { host, owner, repo } = parseRemoteUrl(remoteUrl);
    
    // If includeFilePath is false or filePath is empty, generate a branch-only URL
    if (!includeFilePath || !filePath) {
        if (host === 'github.com') {
            return `https://${host}/${owner}/${repo}/tree/${branch}`;
        } else if (host === 'gitlab.com') {
            return `https://${host}/${owner}/${repo}/-/tree/${branch}`;
        } else if (host === 'bitbucket.org') {
            return `https://${host}/${owner}/${repo}/src/${branch}`;
        } else if (host.includes('dev.azure.com') || host.includes('visualstudio.com')) {
            if (host.includes('dev.azure.com')) {
                const [org, project] = owner.split('/');
                return `https://${host}/${org}/${project}/_git/${repo}?version=GB${branch}`;
            } else {
                return `https://${host}/${owner}/_git/${repo}?version=GB${branch}`;
            }
        } else {
            return `https://${host}/${owner}/${repo}/tree/${branch}`;
        }
    }
    
    // Generate the appropriate URL based on the hosting service with file path and line numbers
    if (host === 'github.com') {
        return generateGitHubUrl(host, owner, repo, branch, filePath, lineStart, lineEnd);
    } else if (host === 'gitlab.com') {
        return generateGitLabUrl(host, owner, repo, branch, filePath, lineStart, lineEnd);
    } else if (host === 'bitbucket.org') {
        return generateBitbucketUrl(host, owner, repo, branch, filePath, lineStart, lineEnd);
    } else if (host.includes('dev.azure.com') || host.includes('visualstudio.com')) {
        return generateAzureDevOpsUrl(host, owner, repo, branch, filePath, lineStart, lineEnd);
    } else {
        // Generic Git web URL (might not work for all hosts)
        let url = `https://${host}/${owner}/${repo}/blob/${branch}/${filePath}`;
        // Add line numbers for generic URL if available
        if (lineStart) {
            url += `#L${lineStart}`;
            if (lineEnd && lineEnd !== lineStart) {
                url += `-L${lineEnd}`;
            }
        }
        return url;
    }
}

/**
 * Parse a Git remote URL into components
 */
function parseRemoteUrl(url: string): { host: string; owner: string; repo: string } {
    // Get host mappings from user settings
    const config = vscode.workspace.getConfiguration('gitWebpageHelper');
    const userHostMapping = config.get<Record<string, string>>('hostMapping') || {};
    
    // Combine default mappings with user mappings
    const hostMap: Record<string, string> = {
        'github.com': 'github.com',
        'gitlab.com': 'gitlab.com',
        'bitbucket.org': 'bitbucket.org',
        ...userHostMapping
    };

    // Extract host, owner, and repo from the URL
    let host: string;
    let owner: string;
    let repo: string;

    // Handle SSH URLs (git@github.com:owner/repo.git)
    if (url.startsWith('git@')) {
        const sshMatch = url.match(/git@([^:]+):([^\/]+)\/(.+)\.git/);
        if (sshMatch) {
            host = sshMatch[1];
            owner = sshMatch[2];
            repo = sshMatch[3];
        } else {
            // If we can't parse it with the regex, fallback to manual parsing
            const parts = url.replace(/\.git$/, '').split(/[\/:]/).filter(Boolean);
            host = parts[0].replace(/^git@/, '');
            owner = parts[parts.length - 2] || '';
            repo = parts[parts.length - 1] || '';
        }
    }
    // Handle HTTPS URLs (https://github.com/owner/repo.git)
    else if (url.startsWith('http')) {
        const httpsMatch = url.match(/https?:\/\/([^\/]+)\/([^\/]+)\/(.+?)(\.git)?$/);
        if (httpsMatch) {
            host = httpsMatch[1];
            owner = httpsMatch[2];
            repo = httpsMatch[3].replace('.git', '');
        } else {
            // If we can't parse it with the regex, fallback to manual parsing
            const parts = url.replace(/\.git$/, '').split(/[\/]/).filter(Boolean);
            host = parts[1];
            owner = parts[parts.length - 2] || '';
            repo = parts[parts.length - 1] || '';
        }
    }
    // Fallback for other formats
    else {
        const parts = url.replace(/\.git$/, '').split(/[\/:]/).filter(Boolean);
        host = parts[0].replace(/^git@/, '');
        owner = parts[parts.length - 2] || '';
        repo = parts[parts.length - 1] || '';
    }

    // Normalize the host based on known patterns
    const normalizedHost = normalizeGitHost(host);
    
    return {
        host: normalizedHost,
        owner,
        repo
    };
}

/**
 * Normalize Git host names to their canonical web URLs
 */
function normalizeGitHost(host: string): string {
    // Get host mappings from user settings
    const config = vscode.workspace.getConfiguration('gitWebpageHelper');
    const userHostMapping = config.get<Record<string, string>>('hostMapping') || {};
    
    // Check if there's a direct mapping in user settings
    if (userHostMapping[host]) {
        return userHostMapping[host];
    }
    
    // Custom host mapping for SSH configs
    if (host.includes('github')) {
        return 'github.com';
    } else if (host.includes('gitlab')) {
        return 'gitlab.com';
    } else if (host.includes('bitbucket')) {
        return 'bitbucket.org';
    } else if (host.includes('azure') || host.includes('visualstudio')) {
        // Keep Azure DevOps hosts as is since they can be custom
        return host;
    }
    
    // Return original if no match
    return host;
}

/**
 * Generate a GitHub URL
 */
function generateGitHubUrl(
    host: string,
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
    lineStart?: number,
    lineEnd?: number
): string {
    let url = `https://${host}/${owner}/${repo}/blob/${branch}/${filePath}`;
    
    if (lineStart) {
        if (lineEnd && lineEnd !== lineStart) {
            url += `#L${lineStart}-L${lineEnd}`;
        } else {
            url += `#L${lineStart}`;
        }
    }
    
    return url;
}

/**
 * Generate a GitLab URL
 */
function generateGitLabUrl(
    host: string,
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
    lineStart?: number,
    lineEnd?: number
): string {
    let url = `https://${host}/${owner}/${repo}/-/blob/${branch}/${filePath}`;
    
    if (lineStart) {
        if (lineEnd && lineEnd !== lineStart) {
            url += `#L${lineStart}-${lineEnd}`;
        } else {
            url += `#L${lineStart}`;
        }
    }
    
    return url;
}

/**
 * Generate a Bitbucket URL
 */
function generateBitbucketUrl(
    host: string,
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
    lineStart?: number,
    lineEnd?: number
): string {
    let url = `https://${host}/${owner}/${repo}/src/${branch}/${filePath}`;
    
    if (lineStart) {
        url += `#lines-${lineStart}`;
        if (lineEnd && lineEnd !== lineStart) {
            url += `:${lineEnd}`;
        }
    }
    
    return url;
}

/**
 * Generate an Azure DevOps URL
 */
function generateAzureDevOpsUrl(
    host: string,
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
    lineStart?: number,
    lineEnd?: number
): string {
    // Azure DevOps URLs have a different structure
    let url: string;
    
    if (host.includes('dev.azure.com')) {
        const [org, project] = owner.split('/');
        url = `https://${host}/${org}/${project}/_git/${repo}?path=${encodeURIComponent(filePath)}&version=GB${branch}`;
    } else {
        // Old visualstudio.com format
        url = `https://${host}/${owner}/_git/${repo}?path=${encodeURIComponent(filePath)}&version=GB${branch}`;
    }
    
    if (lineStart) {
        url += `&line=${lineStart}`;
        if (lineEnd && lineEnd !== lineStart) {
            url += `&lineEnd=${lineEnd}`;
        }
    }
    
    return url;
}
