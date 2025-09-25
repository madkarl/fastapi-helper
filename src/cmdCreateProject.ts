import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateSecretKey, renderFile, appendToFile } from './utils';

const execAsync = promisify(exec);

export async function initializeProject(workspaceFolder: string, initTool: string): Promise<void> {
    try {
        let command: string = '';
        if (initTool === 'poetry') {
            command = 'poetry init --no-interaction';
        } else if (initTool === 'uv') {
            command = 'uv init --bare';
        }
        await exec(command, { cwd: workspaceFolder });
    } catch (error) {
        throw new Error(`调用${initTool}初始化项目出错: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

export async function customizeProjectSettings(workspaceFolder: string): Promise<void> {
    // // 获取用户输入的项目名称
    // const projectName = await vscode.window.showInputBox({
    //     prompt: '请输入项目名称',
    //     placeHolder: '例如: my-fastapi-project',
    //     validateInput: (value) => {
    //         if (!value || value.trim().length === 0) {
    //             return '项目名称不能为空';
    //         }
    //         return null;
    //     }
    // });

    // if (!projectName) {
    //     throw new Error('用户取消了项目名称输入');
    // }

    // // 获取用户输入的项目描述
    // let description = await vscode.window.showInputBox({
    //     prompt: '请输入项目描述',
    //     placeHolder: '例如: 一个基于FastAPI的Web应用程序',
    //     value: 'Powered by FastAPI Helper'
    // });

    // 创建键值对字典
    // const replacements: Record<string, string> = {
    //     '${project_name}': projectName.trim(),
    //     // '${description}': description.trim(),
    //     '${secret}': generateSecretKey(),
    // };

    // 创建键值对字典
    const replacements: Record<string, string> = {
        '${project_name}': path.basename(workspaceFolder),
        '${description}': 'Powered by FastAPI Helper',
        '${secret}': generateSecretKey(),
    };

    try {
        renderFile(path.join(workspaceFolder, 'src', 'core', 'settings.py'), replacements);
    } catch (error) {
        throw new Error(`自定义项目设置失败: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

export async function configurePypiSource(workspaceFolder: string, projectInitTool: string): Promise<void> {
    const useTsinghua = await vscode.window.showQuickPick(['否', '是'], {
        placeHolder: '是否使用清华PyPI源？',
        canPickMany: false
    });

    if (useTsinghua !== '是') {
        return;
    }

    try {
        let sourceConfig: string = '';
        if (projectInitTool === 'poetry') {
            sourceConfig = '\n[[tool.poetry.source]]\nname = \"mirrors\"\nurl = \"https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple/\"\npriority = \"primary\"';
        } else if (projectInitTool === 'uv') {
            sourceConfig = '[[tool.uv.index]]\nurl = \"https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple/\"\ndefault = true';
        }

        appendToFile(path.join(workspaceFolder, 'pyproject.toml'), sourceConfig);
    } catch (error) {
        throw new Error(`配置${projectInitTool}清华PyPI源失败: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

export async function installDependencies(workspaceFolder: string, projectInitTool: string): Promise<void> {
    try {
        // 显示进度提示
        await execAsync(`${projectInitTool} add fastapi[standard] sqlmodel alembic psycopg2-binary asyncpg pydantic_settings PyJWT bcrypt passlib[bcrypt]`, { cwd: workspaceFolder });
    } catch (error) {
        throw new Error(`安装依赖失败: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}