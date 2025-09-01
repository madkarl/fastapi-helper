// 模块 'vscode' 包含VS Code的扩展API
// 导入模块并使用别名vscode在代码中引用
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { promisify } from 'util';
import AdmZip from 'adm-zip';
import { generateSecretKey, renderFile } from './utils';

const exec = promisify(cp.exec);

// 当扩展被激活时会调用此方法
// 扩展在第一次执行命令时被激活
export function activate(context: vscode.ExtensionContext) {

	// 使用控制台输出诊断信息(console.log)和错误信息(console.error)
	// 这行代码只在扩展被激活时执行一次
	console.log('恭喜，您的扩展 "FastAPI Helper" 现在已激活！');

	// 命令已在package.json文件中定义
	// 现在通过registerCommand提供命令的实现
	// commandId参数必须与package.json中的command字段匹配

	// 注册build fastapi-helper命令
	const buildFastapiCommand = vscode.commands.registerCommand('fastapi-helper.buildFastapiHelper', async (uri: vscode.Uri) => {
		try {
			// 获取工作区文件夹
			const workspaceFolder = getWorkspaceFolder();
			if (!workspaceFolder) {
				return;
			}
			vscode.window.showInformationMessage(`工作区:${workspaceFolder}...`);

			// 验证zip文件存在
			const zipPath = path.join(context.extensionPath, 'assets', 'fastapi.zip');
			if (!fs.existsSync(zipPath)) {
				vscode.window.showErrorMessage(`在${zipPath}未找到fastapi.zip文件`);
				return;
			}

			// 执行初始化步骤
			await initializePoetryProject(workspaceFolder);
			await extractFastapiTemplate(zipPath, workspaceFolder);
			await customizeProjectSettings(workspaceFolder);
			await configurePypiSource(workspaceFolder);
			await installDependencies(workspaceFolder);

			vscode.window.showInformationMessage(`FastAPI项目已成功初始化：${workspaceFolder}`);
		} catch (error) {
			console.error('构建fastapi-helper时出错:', error);
			vscode.window.showErrorMessage(`构建fastapi-helper失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	});

	// 辅助函数：获取工作区文件夹
	function getWorkspaceFolder(): string | undefined {
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
			console.log(`工作区根目录: ${workspaceFolder}`);
			return workspaceFolder;
		} else {
			vscode.window.showErrorMessage('未找到工作区文件夹。请先在VS Code中打开一个文件夹。');
			return undefined;
		}
	}

	// 步骤1：初始化Poetry项目
	async function initializePoetryProject(workspaceFolder: string): Promise<void> {
		vscode.window.showInformationMessage('[1/5] 正在初始化Poetry项目...');
		try {
			await exec('poetry init --no-interaction', { cwd: workspaceFolder });
			vscode.window.showInformationMessage('Poetry项目初始化完成');
		} catch (error) {
			console.error('初始化Poetry项目时出错:', error);
			throw new Error(`初始化Poetry项目失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	// 步骤2：解压FastAPI项目模板
	async function extractFastapiTemplate(zipPath: string, workspaceFolder: string): Promise<void> {
		vscode.window.showInformationMessage('[2/5] 正在解压FastAPI项目模板...');
		try {
			const zip = new AdmZip(zipPath);
			zip.extractAllTo(workspaceFolder, true);
			vscode.window.showInformationMessage('FastAPI项目模板解压完成');
		} catch (error) {
			console.error('解压FastAPI项目模板时出错:', error);
			throw new Error(`解压FastAPI项目模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	// 步骤3：自定义项目设置
	async function customizeProjectSettings(workspaceFolder: string): Promise<void> {
		vscode.window.showInformationMessage('[3/5] 正在自定义项目设置...');

		// 获取用户输入的项目名称
		const projectName = await vscode.window.showInputBox({
			prompt: '请输入项目名称',
			placeHolder: '例如: my-fastapi-project',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return '项目名称不能为空';
				}
				return null;
			}
		});

		if (!projectName) {
			throw new Error('用户取消了项目名称输入');
		}

		// 获取用户输入的项目描述
		let description = await vscode.window.showInputBox({
			prompt: '请输入项目描述',
			placeHolder: '例如: 一个基于FastAPI的Web应用程序',
		});

		if (!description) {
			description = 'Powered by FastAPI Helper';
		}

		// 创建键值对字典
		const replacements: Record<string, string> = {
			'${project_name}': projectName.trim(),
			'${description}': description.trim(),
			'${secret}': generateSecretKey(),
		};

		// 调用render_file函数处理settings.py文件
		const settingsPath = path.join(workspaceFolder, 'core', 'settings.py');

		try {
			renderFile(settingsPath, replacements);
			vscode.window.showInformationMessage('项目设置自定义完成');
		} catch (error) {
			console.error('自定义项目设置时出错:', error);
			throw new Error(`自定义项目设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	// 步骤4：配置PyPI源
	async function configurePypiSource(workspaceFolder: string): Promise<void> {
		vscode.window.showInformationMessage('[4/5] 正在配置PyPI源...');
		const useTsinghua = await vscode.window.showQuickPick(['是', '否'], {
			placeHolder: '是否使用清华PyPI源？(推荐中国大陆用户选择是)',
			canPickMany: false
		});

		if (useTsinghua === '是') {
			try {
				await exec('poetry source add --priority=primary mirrors https://mirrors4.tuna.tsinghua.edu.cn/pypi/web/simple/', { cwd: workspaceFolder });
				vscode.window.showInformationMessage('清华PyPI源配置完成');
			} catch (error) {
				console.error('配置清华PyPI源时出错:', error);
				throw new Error(`配置清华PyPI源失败: ${error instanceof Error ? error.message : '未知错误'}`);
			}
		} else if (useTsinghua === '否') {
			vscode.window.showInformationMessage('将使用默认PyPI源');
		} else {
			// 用户取消了选择
			throw new Error('用户取消了PyPI源配置');
		}
	}

	// 步骤5：安装依赖
	async function installDependencies(workspaceFolder: string): Promise<void> {
		vscode.window.showInformationMessage('[5/5] 正在安装依赖...');
		try {
			// 显示进度提示
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: '正在安装FastAPI依赖包...',
				cancellable: false
			}, async (progress) => {
				progress.report({ increment: 0, message: '开始安装依赖...' });
				await exec('poetry add fastapi[standard] sqlmodel alembic psycopg2-binary asyncpg pydantic_settings', { cwd: workspaceFolder });
				progress.report({ increment: 100, message: '依赖安装完成' });
			});
			vscode.window.showInformationMessage('所有依赖安装完成');
		} catch (error) {
			console.error('安装依赖时出错:', error);
			throw new Error(`安装依赖失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	
	context.subscriptions.push(buildFastapiCommand);
}

// 当扩展被停用时会调用此方法
export function deactivate() { }
