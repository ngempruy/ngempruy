// One formatter config for every package. Plugin order matters: tailwindcss must be last.
/** @type {import("prettier").Config} */
module.exports = {
  printWidth: 120,
  tabWidth: 2,
  trailingComma: "all",
  arrowParens: "avoid",
  endOfLine: "lf",
  plugins: [
    require.resolve("prettier-plugin-solidity"),
    require.resolve("@trivago/prettier-plugin-sort-imports"),
    require.resolve("prettier-plugin-tailwindcss"),
  ],
  importOrder: [
    "^react$",
    "^next(/.*)?$",
    "<THIRD_PARTY_MODULES>",
    "^@heroicons/(.*)$",
    "^@sh/(.*)$",
    "^~~/(.*)$",
    "^[./]",
  ],
  importOrderSortSpecifiers: true,
  tailwindStylesheet: "./packages/nextjs/styles/globals.css",
  overrides: [
    { files: "*.sol", options: { tabWidth: 4, singleQuote: false, bracketSpacing: true } },
    { files: "*.md", options: { proseWrap: "preserve" } },
  ],
};
