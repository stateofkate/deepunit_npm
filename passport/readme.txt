We have changed the default location of our git hooks so we can version control them.
The default location is .git/hooks/ We are using git_hooks/

To Configure git to use the alternative location
git config core.hooksPath git_hooks
cd git_hooks
chmod +x pre-commit //Or whatever git hooks we are using

To Reset to default config
git config core.hooksPath .git/hooks

To view the current config
git config --get core.hooksPath

If you encounter the error 'Error: This command is not available when running the Angular CLI outside a workspace.'
You are likely in a monorepo. The git hooks must be stored within the angular workspace.
git config core.hooksPath passport/git_hooks
