# vendor/opencc：刻本字的简→繁词表

`s2t.js` 由 `tools/newui/build-hant.cjs` 生成，勿手改。原件是 OpenCC（https://github.com/BYVoid/OpenCC ）
`data/dictionary` 下的 `STCharacters.txt`、`STPhrases.txt`，取自提交 `fae2a0a911c30764e669a7d8b0591cd8e852934a`。
OpenCC 以 Apache License 2.0 发布，许可原文在同目录 `LICENSE`；本目录只是把两张表压成一个数据模块，词条未增删。

用处：新前端用齐伋体（`--f-print`）印邸报、实录、金榜、书签。那字体只会一字对一字地换繁体，一简多繁的字不换，
所以先由 `web/ui/core/hant.js` 按词转成繁体再交给字体。本朝专名的补正（台吉、征夷、颁布等）写在 `hant.js` 里，不改这里。

重新生成：

```
node tools/newui/build-hant.cjs --src <放 STCharacters.txt、STPhrases.txt、COMMIT 的目录>
```
