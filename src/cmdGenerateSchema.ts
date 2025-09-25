import * as vscode from 'vscode';
import { renderFile } from './utils';

/**
 * 获取用户选择的ID类型
 */
export async function getIdType(): Promise<string> {
    const idType = await vscode.window.showQuickPick(
        [
            { label: 'int', description: '使用整数类型ID' },
            { label: 'UUID', description: '使用UUID类型ID' }
        ],
        {
            placeHolder: '请选择ID类型',
            canPickMany: false
        }
    );

    if (!idType) {
        throw new Error('必须选择ID类型');
    }

    return idType.label;
}

/**
 * 获取用户输入的Schema名称前缀
 */
export async function getSchemaPrefix(): Promise<string> {
    const schemaPrefix = await vscode.window.showInputBox({
        prompt: '请输入Schema名称',
        placeHolder: '例如: User, Product, Order',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Schema名称前缀不能为空';
            }
            if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
                return 'Schema名称前缀必须以大写字母开头，只能包含字母和数字';
            }
            return null;
        }
    });

    if (!schemaPrefix) {
        throw new Error('Schema名称前缀不能为空');
    }

    return schemaPrefix;
}

export function updateSchemaFile(schemaFilePath: string, idType: string, schemaPrefix: string): void {
    try {
        const replacements: Record<string, string> = {
            '${id_type}': idType,
            '${schema_prefix}': schemaPrefix,
            '${id_config}': idType === 'int' ? 'primary_key=True' : 'default_factory=uuid4, primary_key=True',
        };

        renderFile(schemaFilePath, replacements);
    } catch (error) {
        throw new Error(`update schema file failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}