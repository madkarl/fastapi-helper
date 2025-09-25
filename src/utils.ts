import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import AdmZip from 'adm-zip';

// 辅助函数：获取工作区文件夹
export function getWorkspaceFolder(): string {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        return workspaceFolder;
    } else {
        throw Error('workspace folder not found. please open a folder in vscode first.');
    }
}

/**
 * 渲染文件函数 - 根据键值对映射关系替换文件中的关键字
 * @param filePath 文件路径
 * @param replacements 键值对字典，用于替换文件中的关键字
 * @param outputPath 可选的输出文件路径，如果不提供则覆盖原文件
 */
export function renderFile(filePath: string, replacements: Record<string, string>, outputPath?: string): void {
    try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`file not exist: ${filePath}`);
        }

        // 读取文件内容
        let content = fs.readFileSync(filePath, 'utf-8');

        // 遍历替换字典，进行关键字替换（大小写敏感）
        for (const [key, value] of Object.entries(replacements)) {
            // 使用全局替换，大小写敏感
            const regex = new RegExp(escapeRegExp(key), 'g');
            content = content.replace(regex, value);
        }

        // 确定输出路径
        const targetPath = outputPath || filePath;

        // 确保输出目录存在
        const outputDir = path.dirname(targetPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 写入文件
        fs.writeFileSync(targetPath, content, 'utf-8');
    } catch (error) {
        throw Error(`render file failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

/**
 * 转义正则表达式特殊字符
 * @param string 需要转义的字符串
 * @returns 转义后的字符串
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateSecretKey() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 在文件中找到标志字符串，并在其下一行追加内容
 * @param filePath 待修改的文件路径
 * @param appendTag 标志字符串
 * @param appendText 待追加的字符串（可能是多行）
 * @param outputPath 文件输出路径，如果为空则输出到原文件位置
 */
export function replaceFileByTag(filePath: string, appendTag: string, appendText: string, outputPath?: string): void {
    try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`file not exist: ${filePath}`);
        }

        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // 查找标志字符串所在的行
        let targetLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(appendTag)) {
                targetLineIndex = i;
                break;
            }
        }

        if (targetLineIndex === -1) {
            throw new Error(`tag not found: ${appendTag}`);
        }

        // 在标志字符串的下一行插入新内容
        const appendLines = appendText.split('\n');
        lines.splice(targetLineIndex + 1, 0, ...appendLines);

        // 重新组合文件内容
        const newContent = lines.join('\n');

        // 确定输出路径
        const targetPath = outputPath || filePath;

        // 确保输出目录存在
        const outputDir = path.dirname(targetPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 写入文件
        fs.writeFileSync(targetPath, newContent, 'utf-8');
    } catch (error) {
        throw Error(`replace failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

export function validZipExist(context: vscode.ExtensionContext, zipName: string): string {
    const zipPath = path.join(context.extensionPath, 'assets', zipName);
    if (!fs.existsSync(zipPath)) {
        throw Error(`file not exist: ${zipName}`);
    }
    return zipPath;
}

export function appendToFile(filePath: string, appendText: string, outputPath?: string): void {
    try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`file not exist: ${filePath}`);
        }

        // 读取文件内容
        let content = fs.readFileSync(filePath, 'utf-8');

        // 在文件末尾追加内容
        // 如果文件不以换行符结尾，先添加一个换行符
        if (content.length > 0 && !content.endsWith('\n')) {
            content += '\n';
        }
        content += appendText;

        // 确定输出路径
        const targetPath = outputPath || filePath;

        // 确保输出目录存在
        const outputDir = path.dirname(targetPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 写入文件
        fs.writeFileSync(targetPath, content, 'utf-8');
    } catch (error) {
        throw Error(`append content to file failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

/**
 * 将对应的schema模板内容追加到当前schema.py文件
 */
export function appendFromTemplateFile(context: vscode.ExtensionContext, templateFileName: string, schemaFilePath: string) {
    try {
        const sourceFile = path.join(context.extensionPath, 'assets', templateFileName);

        if (!fs.existsSync(sourceFile)) {
            throw new Error(`template file not exist: ${sourceFile}`);
        }

        // 读取模板内容
        const templateContent = fs.readFileSync(sourceFile, 'utf8');

        // 追加到schema.py文件
        appendToFile(schemaFilePath, '\n' + templateContent);

    } catch (error) {
        throw new Error(`append template content failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

export async function extractTemplate(context: vscode.ExtensionContext, zipName: string, targetDir: string, createDir: boolean) {
    try {
        const zipPath = validZipExist(context, zipName);
        const zip = new AdmZip(zipPath);
        if (createDir) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        zip.extractAllTo(targetDir, true);
    } catch (error) {
        throw new Error(`extract template failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

/**
 * 验证当前文件名
 */
export function validateFileName(uri: vscode.Uri, name: string): void {
    const fileName = path.basename(uri.fsPath);
    if (fileName !== name) {
        throw new Error(`current file is not ${name}`);
    }
}