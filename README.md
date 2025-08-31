# fastapi-helper README

A VS Code extension that provides a FastAPI helper. This extension allows you to quickly set up a FastAPI project by extracting a pre-configured template directly into your workspace.

## Features

- Adds a "build fastapi-helper" option to the explorer context menu (right-click menu)
- Extracts a FastAPI template (fastapi.zip) to the root directory of your current project
- Easy to use - just right-click in the explorer and select the option

## Usage

1. Open a folder in VS Code where you want to create your FastAPI project
2. Right-click in the explorer panel (left sidebar)
3. Select "FastAPI Helper -> Build A Basic Project" from the context menu
4. The extension will extract the FastAPI template to your project root directory

## Requirements

- Visual Studio Code 1.54.0 or higher
- No additional dependencies are required after installing the extension

## Extension Settings

This extension does not contribute any settings.

## Known Issues

- The fastapi.zip file provided is currently empty. You should replace it with your actual FastAPI template files before packaging the extension.
- If no workspace folder is open, the extension will display an error message.

## Release Notes

### 0.0.1

Initial release of fastapi-helper extension
- Basic functionality to extract template zip file
- Explorer context menu integration

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
