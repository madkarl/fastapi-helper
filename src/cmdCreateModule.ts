import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { renderFile } from './utils';

export async function getModuleName(workspaceFolder: string): Promise<string> {
    const moduleName = await vscode.window.showInputBox({
        prompt: '请输入模块名称',
        placeHolder: '例如: user, product, order',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return '模块名称不能为空';
            }
            if (!/^[a-z][a-z0-9_]*$/.test(value)) {
                return '模块名称必须以小写字母开头，只能包含小写字母、数字和下划线';
            }
            return null;
        }
    });

    if (!moduleName) {
        throw new Error('模块名称不能为空');
    }

    // 创建模块目录路径
    const moduleDir = path.join(workspaceFolder, 'src', moduleName);
    if (fs.existsSync(moduleDir)) {
        throw new Error("模块已存在");
    }

    return moduleName;
}

export async function updateModuleTemplate(workspaceFolder: string, moduleName: string): Promise<void> {
    try {
        const replacements: Record<string, string> = {
            '${router_name}': moduleName,
        };

        // 渲染新建模块下的router.py文件
        const routerPath = path.join(workspaceFolder, 'src', moduleName, 'router.py');
        if (fs.existsSync(routerPath)) {
            renderFile(routerPath, replacements);
        } else {
            throw new Error(`router.py文件不存在: ${routerPath}`);
        }
    } catch (error) {
        throw new Error(`${error instanceof Error ? error.message : '未知错误'}`);
    }
}