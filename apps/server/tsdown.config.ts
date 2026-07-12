import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/lambda.ts"],
	format: "esm",
	outDir: "./dist",
	clean: true,
	platform: "node",
	// Lambda 部署包必须自包含:打包全部依赖,不依赖运行时 node_modules
	noExternal: /.*/,
	// pg 的可选原生绑定,pg 内部 try/catch 加载,缺失不影响运行
	external: ["pg-native"],
});
