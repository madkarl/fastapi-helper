import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { renderFile, replaceFileByTag } from './utils';

const execAsync = promisify(exec);

export async function getDatabaseConfig(): Promise<Record<string, string>> {
    // 生成键值对
    const dbConfig: Record<string, string> = {
        '${db_host}': '',
        '${db_port}': '',
        '${db_username}': '',
        '${db_password}': '',
        '${db_name}': ''
    };

    // 依次提示用户输入数据库信息
    const dbHost = await vscode.window.showInputBox({
        prompt: '请输入数据库地址',
        value: 'localhost'
    });
    if (!dbHost) {
        throw Error('数据库地址不能为空');
    }
    dbConfig['${db_host}'] = dbHost;

    const dbPort = await vscode.window.showInputBox({
        prompt: '请输入数据库端口',
        value: '5432'
    });
    if (!dbPort) {
        throw Error('数据库端口不能为空');
    }
    dbConfig['${db_port}'] = dbPort;

    const dbUsername = await vscode.window.showInputBox({
        prompt: '请输入数据库账号',
        value: 'postgres'
    });
    if (!dbUsername) {
        throw Error('数据库账号不能为空');
    }
    dbConfig['${db_username}'] = dbUsername;

    const dbPassword = await vscode.window.showInputBox({
        prompt: '请输入数据库密码',
        value: 'postgres'
    });
    if (!dbPassword) {
        throw Error('数据库密码不能为空');
    }
    dbConfig['${db_password}'] = dbPassword;

    const dbName = await vscode.window.showInputBox({
        prompt: '请输入数据库名称',
        value: 'fastapi'
    });
    if (!dbName) {
        throw Error('数据库名称不能为空');
    }
    dbConfig['${db_name}'] = dbName;

    return dbConfig;
}

export async function initializeAlembic(workspaceFolder: string): Promise<void> {
    try {
        // 检测项目使用的包管理工具
        let toolName: string;

        if (fs.existsSync(path.join(workspaceFolder, 'uv.lock'))) {
            toolName = 'uv';
        } else if (fs.existsSync(path.join(workspaceFolder, 'poetry.lock'))) {
            toolName = 'poetry';
        } else {
            throw new Error('初始化alembic失败: 未找到uv.lock/poetry.lock, 请确保项目使用 uv 或 poetry 进行管理');
        }

        await execAsync(`${toolName} run alembic init alembic -t async`, { cwd: workspaceFolder });
    } catch (error) {
        throw new Error(`初始化alembic失败: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

export async function updateCoreSettings(workspaceFolder: string, dbConfig: Record<string, string>): Promise<void> {
    const settingsPath = path.join(workspaceFolder, 'src', 'core', 'settings.py');
    if (fs.existsSync(settingsPath)) {
        try {
            renderFile(settingsPath, dbConfig);
        } catch (error) {
            throw new Error(`更新settings.py失败: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    } else {
        throw new Error('更新settings.py失败: 文件不存在');
    }
}

export async function updateAlembicIni(workspaceFolder: string, dbConfig: Record<string, string>): Promise<void> {
    const uriConfig: Record<string, string> = {
        'driver://user:pass@localhost/dbname': `postgresql+asyncpg://${dbConfig["${db_username}"]}:${dbConfig["${db_password}"]}@${dbConfig["${db_host}"]}:${dbConfig["${db_port}"]}/${dbConfig["${db_name}"]}`
    };
    const alembicIniPath = path.join(workspaceFolder, 'alembic.ini');
    if (fs.existsSync(alembicIniPath)) {
        try {
            renderFile(alembicIniPath, uriConfig);
        } catch (error) {
            throw new Error(`更新alembic.ini失败: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    } else {
        throw new Error('更新alembic.ini失败: 文件不存在');
    }
}

export async function updateScriptPyMako(workspaceFolder: string): Promise<void> {
    const scriptPyMakoPath = path.join(workspaceFolder, 'alembic', 'script.py.mako');
    if (fs.existsSync(scriptPyMakoPath)) {
        try {
            replaceFileByTag(scriptPyMakoPath, "import sqlalchemy as sa", "import sqlmodel.sql.sqltypes");
        } catch (error) {
            throw new Error(`更新script.py.mako失败: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    } else {
        throw new Error('更新script.py.mako失败: 文件不存在');
    }
}

export async function updateAlembicEnv(workspaceFolder: string): Promise<void> {
    const envPyPath = path.join(workspaceFolder, 'alembic', 'env.py');
    if (fs.existsSync(envPyPath)) {
        try {
            const metaConfig: Record<string, string> = {
                "target_metadata = None": "target_metadata = SQLModel.metadata"
            };
            renderFile(envPyPath, metaConfig);
            replaceFileByTag(envPyPath, "from alembic import context", "from sqlmodel import SQLModel\n### auto generate start ###\n# ...\n### auto generate end ###\n");
        } catch (error) {
            throw new Error(`更新alembic/env.py失败: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    } else {
        throw new Error('更新alembic/env.py失败: 文件不存在');
    }
}

