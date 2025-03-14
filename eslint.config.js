import globals from "globals";
import pluginJs from "@eslint/js";


/** @type {import('eslint').Linter.Config[]} */
export default [
	{ languageOptions: { globals: globals.browser } },
	pluginJs.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: "latest", // 让 ESLint 支持 ES2021+ 语法
			sourceType: "module",
			globals: {
				process: "readonly",
				global: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				Buffer: "readonly",
				setImmediate: "readonly",
				clearImmediate: "readonly",
			},
		},
	}
];