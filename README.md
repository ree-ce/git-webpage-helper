# Git Webpage Helper

Enhanced Git integration for VS Code that makes working with remote repositories easier.

## Features

- Open current file on web (GitHub, GitLab, Bitbucket)
- Open current branch on web

## Requirements

- Git installed and available in PATH
- Active internet connection
- File must be part of a Git repository

## Extension Settings

This extension contributes the following settings:

* `gitWebpageHelper.hostMapping`: Custom mapping from SSH host aliases to actual domain names. This is useful when using multiple Git accounts with custom SSH host configurations.

Example configuration:
```json
"gitWebpageHelper.hostMapping": {
  "github_account_a": "github.com",
  "github_account_b": "github.com",
  "gitlab_personal": "gitlab.com"
}
```

## Usage with Multiple Git Accounts

If you use multiple Git accounts with custom SSH host configurations, follow these steps:

1. Configure your SSH hosts in `~/.ssh/config`:

```ssh
# Personal GitHub account
Host github_personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_personal
    
# Work GitHub account
Host github_work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_work
```

1. Configure the Git remote with the custom host:

```bash
git remote add origin git@github_personal:username/repo.git
# or
git remote add origin git@github_work:organization/repo.git
```

1. Configure the extension in VS Code settings.json:

```json
"gitWebpageHelper.hostMapping": {
  "github_personal": "github.com",
  "github_work": "github.com"
}
```

Now, when you use "Open File on Web" or "Copy File URL", the extension will correctly generate URLs for github.com, even though your remote URL uses a custom SSH host alias.

## Known Issues

Please report issues on the GitHub repository.

## Release Notes

### 0.1.0

Initial release of Git Helper with basic functionality:
- Open file on web
- Open branch on web
