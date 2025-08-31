import * as fs from 'fs';
import * as path from 'path';

/**
 * 渲染文件函数 - 根据键值对映射关系替换文件中的关键字
 * @param filePath 文件路径
 * @param replacements 键值对字典，用于替换文件中的关键字
 * @param outputPath 可选的输出文件路径，如果不提供则覆盖原文件
 */
export function render_file(filePath: string, replacements: Record<string, string>, outputPath?: string): void {
    try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
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
        
        console.log(`文件渲染完成: ${targetPath}`);
    } catch (error) {
        console.error('文件渲染失败:', error);
        throw error;
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