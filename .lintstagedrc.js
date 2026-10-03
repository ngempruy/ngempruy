const path = require("path");

const buildNextEslintCommand = filenames =>
  `yarn next:lint --fix --file ${filenames.map(f => path.relative(path.join("packages", "nextjs"), f)).join(" --file ")}`;

const checkTypesNextCommand = () => "yarn next:check-types";

const buildHardhatEslintCommand = filenames =>
  `yarn hardhat:lint-staged --fix ${filenames.map(f => path.relative(path.join("packages", "hardhat"), f)).join(" ")}`;

// Globs must not overlap: lint-staged runs them concurrently.
module.exports = {
  "packages/nextjs/**/*.{ts,tsx}": ["prettier --write", buildNextEslintCommand, checkTypesNextCommand],
  "packages/hardhat/**/*.ts": ["prettier --write", buildHardhatEslintCommand],
  "packages/shared/**/*.ts": ["prettier --write"],
  "**/*.{js,cjs,mjs,json,md,sol,css,yml,yaml}": ["prettier --write"],
};
