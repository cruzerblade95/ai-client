import { execFileSync } from "node:child_process";

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

import { tmpdir } from "node:os";

import { join, resolve } from "node:path";

const projectDirectory = process.cwd();

const temporaryDirectory = mkdtempSync(join(tmpdir(), "ai-client-smoke-"));

const consumerDirectory = join(temporaryDirectory, "consumer");

const pnpmCommand = "pnpm";

function run(command, args, workingDirectory) {
  const needsWindowsShell = process.platform === "win32" && command === pnpmCommand;

  execFileSync(command, args, {
    cwd: workingDirectory,
    stdio: "inherit",
    shell: needsWindowsShell
  });
}

try {
  console.log("Building package...");

  run(pnpmCommand, ["build"], projectDirectory);

  console.log("Packing package...");

  run(pnpmCommand, ["pack", "--pack-destination", temporaryDirectory], projectDirectory);

  const tarballName = readdirSync(temporaryDirectory).find((fileName) => fileName.endsWith(".tgz"));

  if (!tarballName) {
    throw new Error("Package tarball was not created");
  }

  const tarballPath = resolve(temporaryDirectory, tarballName);

  if (!existsSync(tarballPath)) {
    throw new Error("Package tarball could not be found");
  }

  console.log(`Testing package: ${tarballName}`);

  run(
    process.execPath,
    [
      "-e",
      `
        const fs = require("node:fs");
        fs.mkdirSync(
          ${JSON.stringify(consumerDirectory)},
          { recursive: true }
        );
      `
    ],
    projectDirectory
  );

  writeFileSync(
    join(consumerDirectory, "package.json"),
    JSON.stringify(
      {
        name: "ai-client-smoke-test",
        version: "1.0.0",
        private: true,
        type: "module"
      },
      null,
      2
    )
  );

  run(pnpmCommand, ["add", tarballPath, "--ignore-workspace"], consumerDirectory);

  const smokeTestPath = join(consumerDirectory, "smoke-test.mjs");

  writeFileSync(
    smokeTestPath,
    `
      import {
        AIClient,
        AIClientError,
        BedrockProvider,
      } from "@cruzerblade95/ai-client";

      if (typeof AIClient !== "function") {
        throw new Error(
          "AIClient export is missing"
        );
      }

      if (
        typeof AIClientError !== "function"
      ) {
        throw new Error(
          "AIClientError export is missing"
        );
      }

      if (
        typeof BedrockProvider !== "function"
      ) {
        throw new Error(
          "BedrockProvider export is missing"
        );
      }

      const customProvider = {
        async generateText(request) {
          return {
            text:
              "Smoke response: " +
              request.prompt,
            model: "smoke-model",
            provider: "custom",
          };
        },
      };

      const client = new AIClient({
        provider: customProvider,
        timeout: 5_000,
      });

      const response =
        await client.generateText({
          prompt: "Hello",
        });

      if (
        response.text !==
        "Smoke response: Hello"
      ) {
        throw new Error(
          "Installed package returned an unexpected result"
        );
      }

      client.destroy();

      console.log(
        "Package smoke test passed"
      );
    `
  );

  run(process.execPath, [smokeTestPath], consumerDirectory);

  const installedPackageJson = join(
    consumerDirectory,
    "node_modules",
    "@cruzerblade95",
    "ai-client",
    "package.json"
  );

  if (!existsSync(installedPackageJson)) {
    throw new Error("Installed package.json was not found");
  }

  const packageContents = JSON.parse(readFileSync(installedPackageJson, "utf8"));

  if (packageContents.name !== "@cruzerblade95/ai-client") {
    throw new Error("The installed package has the wrong name");
  }

  console.log("Package installation verification passed");
} finally {
  rmSync(temporaryDirectory, {
    recursive: true,
    force: true
  });
}
