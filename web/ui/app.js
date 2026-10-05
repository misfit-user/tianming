// 应用壳（地基第五片接着做）：载入 → 启幕 → 御案 → 入图 / 奏疏 …
export async function startApp(root) {
  root.dataset.stage = 'pending';
  console.info('[newui] 应用壳尚在搭建：先用 ?bench=kernel 看适配层，或 ui/dev/stage.html 看场景');
  document.body.dataset.ready = '1';
}
