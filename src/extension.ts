// 模块 'vscode' 包含VS Code的扩展API
// 导入模块并使用别名vscode在代码中引用
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { promisify } from 'util';
import AdmZip from 'adm-zip';
import { getWorkspaceFolder, validZipExist, renderFile, replaceFileByTag } from './utils';
import { initializeProject, extractFastapiTemplate, customizeProjectSettings, configurePypiSource, installDependencies } from './cmdBuildProject';

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
	const buildFastapiCommand = vscode.commands.registerCommand('fastapi-helper.createProject', async (uri: vscode.Uri) => {
		try {
			// 获取工作区文件夹
			const workspaceFolder = getWorkspaceFolder();
			if (!workspaceFolder) {
				return;
			}

			const projectZip = 'project_template.zip';
			const zipFile = validZipExist(context, projectZip);
			if (!zipFile) {
				vscode.window.showErrorMessage(`未找到${projectZip}文件`);
				return;
			}

			const projectInitTool = await vscode.window.showQuickPick(['uv', 'poetry'], {
				placeHolder: '选择项目初始化工具',
				canPickMany: false
			});

			if (projectInitTool !== "poetry" && projectInitTool !== "uv") {
				vscode.window.showErrorMessage(`未支持的项目初始化工具: ${projectInitTool}`);
				return;
			}

			vscode.window.showInformationMessage("[1/2] 项目初始化......");
			await initializeProject(workspaceFolder, projectInitTool);
			await extractFastapiTemplate(zipFile, workspaceFolder);
			await customizeProjectSettings(workspaceFolder);
			await configurePypiSource(workspaceFolder, projectInitTool);

			vscode.window.showInformationMessage(`[2/2] 安装依赖......`);
			await installDependencies(workspaceFolder, projectInitTool);

			vscode.window.showInformationMessage(`FastAPI项目已成功初始化: ${workspaceFolder}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	});

	// 注册Create Module命令
	const createModuleCommand = vscode.commands.registerCommand('fastapi-helper.createModule', async (uri: vscode.Uri) => {
		try {
			// 获取工作区文件夹
			const workspaceFolder = getWorkspaceFolder();
			if (!workspaceFolder) {
				return;
			}

			// 验证zip文件存在
			const moduleZipPath = path.join(context.extensionPath, 'assets', 'module_template.zip');
			if (!fs.existsSync(moduleZipPath)) {
				vscode.window.showErrorMessage(`在${moduleZipPath}未找到module_template.zip文件`);
				return;
			}

			// 获取用户输入的模块名称
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
				throw new Error('用户取消了模块名称输入');
			}

			// 创建模块目录
			const moduleDir = path.join(workspaceFolder, 'src', moduleName);
			if (fs.existsSync(moduleDir)) {
				const overwrite = await vscode.window.showQuickPick(['是', '否'], {
					placeHolder: `模块 ${moduleName} 已存在，是否覆盖？`,
					canPickMany: false
				});

				if (overwrite !== '是') {
					vscode.window.showInformationMessage('已取消创建模块');
					return;
				}
			}

			// 解压模块模板
			await extractModuleTemplate(moduleZipPath, workspaceFolder, moduleName);

			// 更新模块模板
			await updateModuleTemplate(workspaceFolder, moduleName);

			vscode.window.showInformationMessage(`模块 ${moduleName} 已成功创建！`);
		} catch (error) {
			console.error('创建模块时出错:', error);
			vscode.window.showErrorMessage(`创建模块失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	});

	// 注册Initialize Database命令
	const initializeDatabaseCommand = vscode.commands.registerCommand('fastapi-helper.initializeDatabase', async (uri: vscode.Uri) => {
		try {
			// 获取工作区文件夹
			const workspaceFolder = getWorkspaceFolder();
			if (!workspaceFolder) {
				return;
			}

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
				vscode.window.showErrorMessage('数据库地址不能为空');
				return;
			}
			dbConfig['${db_host}'] = dbHost;

			const dbPort = await vscode.window.showInputBox({
				prompt: '请输入数据库端口',
				value: '5432'
			});
			if (!dbPort) {
				vscode.window.showErrorMessage('数据库端口不能为空');
				return;
			}
			dbConfig['${db_port}'] = dbPort;

			const dbUsername = await vscode.window.showInputBox({
				prompt: '请输入数据库账号',
				value: 'postgres'
			});
			if (!dbUsername) {
				vscode.window.showErrorMessage('数据库账号不能为空');
				return;
			}
			dbConfig['${db_username}'] = dbUsername;

			const dbPassword = await vscode.window.showInputBox({
				prompt: '请输入数据库密码',
				value: 'postgres'
			});
			if (!dbPassword) {
				vscode.window.showErrorMessage('数据库密码不能为空');
				return;
			}
			dbConfig['${db_password}'] = dbPassword;

			const dbName = await vscode.window.showInputBox({
				prompt: '请输入数据库名称',
				value: 'fastapi'
			});
			if (!dbName) {
				vscode.window.showErrorMessage('数据库名称不能为空');
				return;
			}
			dbConfig['${db_name}'] = dbName;

			// 执行数据库初始化步骤
			await initializeAlembic(workspaceFolder);
			await updateCoreSettings(workspaceFolder, dbConfig);
			await updateAlembicIni(workspaceFolder, dbConfig);
			await updateScriptPyMako(workspaceFolder);
			await updateAlembicEnv(workspaceFolder);

			vscode.window.showInformationMessage('FastAPI Helper: 数据库初始化完成！');
		} catch (error) {
			console.error('FastAPI Helper: 初始化数据库时出错:', error);
			vscode.window.showErrorMessage(`FastAPI Helper: 初始化数据库失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	});

	// 步骤1：初始化Alembic
	async function initializeAlembic(workspaceFolder: string): Promise<void> {
		try {
			await exec('poetry run alembic init alembic -t async', { cwd: workspaceFolder });
		} catch (error) {
			console.error('FastAPI Helper: 初始化Alembic时出错:', error);
			throw new Error(`初始化Alembic失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	// 步骤2：更新core/settings.py
	async function updateCoreSettings(workspaceFolder: string, dbConfig: Record<string, string>): Promise<void> {
		const settingsPath = path.join(workspaceFolder, 'src', 'core', 'settings.py');
		if (fs.existsSync(settingsPath)) {
			try {
				renderFile(settingsPath, dbConfig);
			} catch (error) {
				console.error('FastAPI Helper: 更新settings.py时出错:', error);
				throw new Error(`更新settings.py失败: ${error instanceof Error ? error.message : '未知错误'}`);
			}
		} else {
			vscode.window.showWarningMessage('FastAPI Helper: 未找到core/settings.py文件，请确保项目结构正确');
		}
	}

	// 步骤3：更新alembic.ini
	async function updateAlembicIni(workspaceFolder: string, dbConfig: Record<string, string>): Promise<void> {
		const uriConfig: Record<string, string> = {
			'driver://user:pass@localhost/dbname': `postgresql+asyncpg://${dbConfig["${db_username}"]}:${dbConfig["${db_password}"]}@${dbConfig["${db_host}"]}:${dbConfig["${db_port}"]}/${dbConfig["${db_name}"]}`
		};
		const alembicIniPath = path.join(workspaceFolder, 'alembic.ini');
		if (fs.existsSync(alembicIniPath)) {
			try {
				renderFile(alembicIniPath, uriConfig);
			} catch (error) {
				console.error('FastAPI Helper: 更新alembic.ini时出错:', error);
				throw new Error(`更新alembic.ini失败: ${error instanceof Error ? error.message : '未知错误'}`);
			}
		} else {
			vscode.window.showWarningMessage('FastAPI Helper: 未找到alembic.ini文件，请确保项目结构正确');
		}
	}

	// 步骤4：更新alembic/script.py.mako
	async function updateScriptPyMako(workspaceFolder: string): Promise<void> {
		const scriptPyMakoPath = path.join(workspaceFolder, 'alembic', 'script.py.mako');
		if (fs.existsSync(scriptPyMakoPath)) {
			try {
				replaceFileByTag(scriptPyMakoPath, "import sqlalchemy as sa", "import sqlmodel.sql.sqltypes");
			} catch (error) {
				console.error('FastAPI Helper: 更新script.py.mako时出错:', error);
				throw new Error(`更新script.py.mako失败: ${error instanceof Error ? error.message : '未知错误'}`);
			}
		} else {
			vscode.window.showWarningMessage('FastAPI Helper: 未找到script.py.mako文件，请确保项目结构正确');
		}
	}

	// 步骤5：更新alembic/env.py
	async function updateAlembicEnv(workspaceFolder: string): Promise<void> {
		const envPyPath = path.join(workspaceFolder, 'alembic', 'env.py');
		if (fs.existsSync(envPyPath)) {
			try {
				const metaConfig: Record<string, string> = {
					"target_metadata = None": "target_metadata = SQLModel.metadata"
				};
				renderFile(envPyPath, metaConfig);
				replaceFileByTag(envPyPath, "from alembic import context", "from sqlmodel import SQLModel\n### auto generate start ###\n# ...\n### auto generate end ###\n");
			} catch (error) {
				console.error('FastAPI Helper: 更新env.py时出错:', error);
				throw new Error(`更新env.py失败: ${error instanceof Error ? error.message : '未知错误'}`);
			}
		} else {
			vscode.window.showWarningMessage('FastAPI Helper: 未找到env.py文件，请确保项目结构正确');
		}
	}

	// 更新模块模板，替换关键字
	async function updateModuleTemplate(workspaceFolder: string, moduleName: string): Promise<void> {
		try {
			// 创建一个字典，将key"${prefix}"和"${tag}"赋值
			const replacements: Record<string, string> = {
				'${router_name}': moduleName,
			};

			// 渲染新建模块下的router.py文件
			const routerPath = path.join(workspaceFolder, 'src', moduleName, 'router.py');
			if (fs.existsSync(routerPath)) {
				renderFile(routerPath, replacements);
			} else {
				console.error(`router.py文件不存在: ${routerPath}`);
			}
		} catch (error) {
			console.error('更新模块模板时出错:', error);
			throw new Error(`更新模块模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	// 解压模块模板并重命名
	async function extractModuleTemplate(zipPath: string, workspaceFolder: string, moduleName: string): Promise<void> {
		try {
			// 创建临时目录
			const tempDir = path.join(workspaceFolder, '.temp_module');
			if (fs.existsSync(tempDir)) {
				fs.rmSync(tempDir, { recursive: true, force: true });
			}
			fs.mkdirSync(tempDir, { recursive: true });

			// 解压模块模板到临时目录
			const zip = new AdmZip(zipPath);
			zip.extractAllTo(tempDir, true);

			// 确保src目录存在
			const srcDir = path.join(workspaceFolder, 'src');
			if (!fs.existsSync(srcDir)) {
				fs.mkdirSync(srcDir, { recursive: true });
			}

			// 创建模块目录
			const moduleDir = path.join(srcDir, moduleName);
			if (fs.existsSync(moduleDir)) {
				fs.rmSync(moduleDir, { recursive: true, force: true });
			}
			fs.mkdirSync(moduleDir, { recursive: true });

			// 复制并重命名模块文件
			const moduleTemplateDir = path.join(tempDir, 'module');
			if (fs.existsSync(moduleTemplateDir)) {
				const files = fs.readdirSync(moduleTemplateDir);
				for (const file of files) {
					const srcFile = path.join(moduleTemplateDir, file);
					const destFile = path.join(moduleDir, file);
					fs.copyFileSync(srcFile, destFile);

					// 替换文件内容中的模块名称
					if (file.endsWith('.py')) {
						let content = fs.readFileSync(destFile, 'utf8');
						content = content.replace(/module/g, moduleName);
						fs.writeFileSync(destFile, content, 'utf8');
					}
				}
			}

			// 清理临时目录
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (error) {
			console.error('解压模块模板时出错:', error);
			throw new Error(`解压模块模板失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	context.subscriptions.push(buildFastapiCommand, initializeDatabaseCommand, createModuleCommand);
}

// 当扩展被停用时会调用此方法
export function deactivate() { }
