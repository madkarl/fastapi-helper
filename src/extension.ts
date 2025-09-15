// 模块 'vscode' 包含VS Code的扩展API
// 导入模块并使用别名vscode在代码中引用
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { promisify } from 'util';
import AdmZip from 'adm-zip';
import { generateSecretKey, renderFile, appendToFile } from './utils';

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
		const settingsPath = path.join(workspaceFolder, 'src', 'core', 'settings.py');

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
			console.error('FastAPI Helper: 安装依赖时出错:', error);
			throw new Error(`FastAPI Helper: 安装依赖失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	// 注册Create Module命令
	const createModuleCommand = vscode.commands.registerCommand('fastapi-helper.createModule', async (uri: vscode.Uri) => {
		try {
			// 获取工作区文件夹
			const workspaceFolder = getWorkspaceFolder();
			if (!workspaceFolder) {
				return;
			}

			// 验证zip文件存在
			const moduleZipPath = path.join(context.extensionPath, 'assets', 'module.zip');
			if (!fs.existsSync(moduleZipPath)) {
				vscode.window.showErrorMessage(`在${moduleZipPath}未找到module.zip文件`);
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
				appendToFile(scriptPyMakoPath, "import sqlalchemy as sa", "import sqlmodel.sql.sqltypes");
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
				appendToFile(envPyPath, "from alembic import context", "from sqlmodel import SQLModel\n### auto generate start ###\n# ...\n### auto generate end ###\n");
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
				'${prefix}': moduleName,
				'${tag}': moduleName
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
