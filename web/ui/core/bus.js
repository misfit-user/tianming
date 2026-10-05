// 新前端的事件总线。事件名一律「域:事」，如 game:advanced、memorial:arrived、scene:shot。
// 载荷是纯数据快照，不传内核对象引用；订阅返回退订函数。

export function createBus() {
  const subs = new Map();
  return {
    on(name, fn) {
      if (!subs.has(name)) subs.set(name, new Set());
      subs.get(name).add(fn);
      return () => subs.get(name)?.delete(fn);
    },
    once(name, fn) {
      const off = this.on(name, (payload) => { off(); fn(payload); });
      return off;
    },
    emit(name, payload) {
      for (const fn of [...(subs.get(name) || [])]) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[ui-bus] ${name} 的订阅者出错`, err);
        }
      }
      // 「域:*」通配：调试面板、日志用
      const domain = name.split(':')[0] + ':*';
      for (const fn of [...(subs.get(domain) || [])]) fn({ name, payload });
    },
    // 等某个事件一次（带超时）
    wait(name, ms = 0) {
      return new Promise((resolve, reject) => {
        const off = this.once(name, resolve);
        if (ms) setTimeout(() => { off(); reject(new Error(`等 ${name} 超时`)); }, ms);
      });
    }
  };
}

// 全前端共用一条
export const bus = createBus();
