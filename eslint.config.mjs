import js from "@eslint/js";
import globals from "globals";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";
import stylistic from '@stylistic/eslint-plugin';

const customGlobals = {
	$: 'readonly',
	jquery: 'readonly',
	jQuery: 'readonly',
	io: 'readonly',
	require: 'readonly'
};

export default defineConfig([
	{ files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
	{ files: ["**/*.js"], languageOptions: { sourceType: "module" } },
	{ files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
	{
		plugins: {
			'@stylistic': stylistic
		},
		rules: {
			"no-unused-vars": "warn",
			"no-undef": "warn",
			'@stylistic/semi': ['error', 'always'],
			'@stylistic/indent': ['error', 'tab'],
		},
		languageOptions: {
			ecmaVersion: 2021,
			globals: { ...globals.browser, ...customGlobals },
		}
	}
]);