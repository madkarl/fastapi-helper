// 模块 'vscode' 包含VS Code的扩展API
// 导入模块并使用别名vscode在代码中引用
import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkspaceFolder, extractTemplate, appendFromTemplateFile, renderFile, validateFileName } from './utils';
import { initializeProject, customizeProjectSettings, configurePypiSource, installDependencies as installDependencies } from './cmdCreateProject';
import { getDatabaseConfig, initializeAlembic, updateCoreSettings, updateAlembicIni, updateAlembicEnv, updateScriptPyMako } from './cmdInitializeDatabase';
import { getModuleName, updateModuleTemplate } from './cmdCreateModule';
import { getIdType, getSchemaPrefix, updateSchemaFile } from './cmdGenerateSchema';


// 当扩展被激活时会调用此方法
// 扩展在第一次执行命令时被激活
export function activate(context: vscode.ExtensionContext) {

	// 使用控制台输出诊断信息(console.log)和错误信息(console.error)
	// 这行代码只在扩展被激活时执行一次
	console.log('恭喜，您的扩展 "FastAPI Helper" 现在已激活！');

	// 注册 Create Project 命令
	const buildFastapiCommand = vscode.commands.registerCommand('fastapi-helper.createProject', async (uri: vscode.Uri) => {
		try {
			const workspaceFolder = getWorkspaceFolder();

			let projectInitTool = await vscode.window.showQuickPick(['uv', 'poetry'], {
				placeHolder: '选择项目初始化工具',
				canPickMany: false
			});

			if (projectInitTool !== "poetry" && projectInitTool !== "uv") {
				projectInitTool = 'uv';
			}

			vscode.window.showInformationMessage("[1/2] 项目初始化......");
			await initializeProject(workspaceFolder, projectInitTool);
			await extractTemplate(context, 'project_template.zip', workspaceFolder, false);
			await customizeProjectSettings(workspaceFolder);
			await configurePypiSource(workspaceFolder, projectInitTool);

			vscode.window.showInformationMessage(`[2/2] 安装依赖......`);
			await installDependencies(workspaceFolder, projectInitTool);

			vscode.window.showInformationMessage(`项目初始化完成！`);
		} catch (error) {
			vscode.window.showErrorMessage(`${error instanceof Error ? error.message : 'unknown error'}`);
		}
	});



	// 注册Initialize Database命令
	const initializeDatabaseCommand = vscode.commands.registerCommand('fastapi-helper.initializeDatabase', async (uri: vscode.Uri) => {
		try {
			// 获取工作区文件夹
			const workspaceFolder = getWorkspaceFolder();

			// 获取数据库配置信息
			const dbConfig = await getDatabaseConfig();

			// 执行数据库初始化步骤
			vscode.window.showInformationMessage("[1/2] alembic初始化......");
			await initializeAlembic(workspaceFolder);

			vscode.window.showInformationMessage("[2/2] 更新配置......");
			await updateCoreSettings(workspaceFolder, dbConfig);
			await updateAlembicIni(workspaceFolder, dbConfig);
			await updateScriptPyMako(workspaceFolder);
			await updateAlembicEnv(workspaceFolder);

			vscode.window.showInformationMessage('数据库初始化完成！');
		} catch (error) {
			vscode.window.showErrorMessage(`${error instanceof Error ? error.message : 'unknown error'}`);
		}
	});

	// 注册Create Module命令
	const createModuleCommand = vscode.commands.registerCommand('fastapi-helper.createModule', async (uri: vscode.Uri) => {
		try {
			const workspaceFolder = getWorkspaceFolder();
			const moduleName = await getModuleName(workspaceFolder);
			const modulePath = path.join(workspaceFolder, 'src', moduleName);

			// 解压模块模板
			await extractTemplate(context, 'module_template.zip', modulePath, true);
			// 更新模块模板
			await updateModuleTemplate(workspaceFolder, moduleName);

			vscode.window.showInformationMessage(`模块已成功创建!`);
		} catch (error) {
			vscode.window.showErrorMessage(`${error instanceof Error ? error.message : 'unknown error'}`);
		}
	});

	// 注册Generate Schema命令
	const generateSchemaCommand = vscode.commands.registerCommand('fastapi-helper.generateSchema', async (uri: vscode.Uri) => {
		try {
			validateFileName(uri, 'schema.py');
			const idType = await getIdType();
			const schemaPrefix = await getSchemaPrefix();

			appendFromTemplateFile(context, 'schema.py', uri.fsPath);
			updateSchemaFile(uri.fsPath, idType, schemaPrefix);

			vscode.window.showInformationMessage(`Generate successfully!`);
		} catch (error) {
			vscode.window.showErrorMessage(`${error instanceof Error ? error.message : 'unknown error'}`);
		}
	});

	// 注册Generate Router命令
	const generateRouterCommand = vscode.commands.registerCommand('fastapi-helper.generateRouter', async (uri: vscode.Uri) => {
		try {
			const filePath = uri ? uri.fsPath : vscode.window.activeTextEditor?.document.fileName;
			if (filePath) {
				vscode.window.showInformationMessage(`当前文件路径2: ${filePath}`);
			} else {
				vscode.window.showErrorMessage('无法获取当前文件路径');
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Generate router failed: ${error instanceof Error ? error.message : 'unknown error'}`);
		}
	});

	context.subscriptions.push(buildFastapiCommand, initializeDatabaseCommand, createModuleCommand, generateSchemaCommand, generateRouterCommand);
}

// 当扩展被停用时会调用此方法
export function deactivate() { }
