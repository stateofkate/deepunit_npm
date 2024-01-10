DeepUnitAI will automatically write unit tests for you after every commit you make. After a commit we grab a list of files modified and do the following for each file modified

1. Run the existing test. If it fails we will let you fix the test before modifying it.
2. Generate a new test and fix any errors in the test we generate
3. If there are uncommitted changes in the existing test file we will push them to the stash before saving the test.
4. At the end we will print a summary of the results of the run.

Setup
1. Move the post-commit file to .git/hooks
2. If you don't see any output after a commit the file may not be executable, try running chmod +X .git/hooks/post-commit

If you would like to rerun the process without making another commit use the manualRun.sh or manualRun.py file. It is exactly the same as post-commit, the only difference is the file extension.

Known issue:
Unusual python installs sometimes cause the post-commit hooks shebang to have issues finding python. In this case you will need to manually run the manualRun.py file. Please inform Justin that you've run into this issue so he can prioritize fixing this issue for you.
