import assert from "node:assert/strict";
import { withTemperature } from "../lib/merge.js";

const base = { provider: "trae", model: "deepseek-v4.1-flash" };

// 1. 关闭覆盖：原样返回（连引用都不换）
assert.equal(withTemperature({ enabled: false, temperature: 0.3 }, base), base);

// 2. 打开覆盖：温度进配置，其它字段保留
assert.deepEqual(withTemperature({ enabled: true, temperature: 0.3 }, base), { ...base, temperature: 0.3 });

// 3. 越界/非法值：不生效
assert.equal(withTemperature({ enabled: true, temperature: 3 }, base), base);
assert.equal(withTemperature({ enabled: true, temperature: -1 }, base), base);
assert.equal(withTemperature({ enabled: true, temperature: "abc" }, base), base);

// 4. 边界值 0 和 2 是合法的（0 不能被当成 falsy 丢掉）
assert.equal(withTemperature({ enabled: true, temperature: 0 }, base).temperature, 0);
assert.equal(withTemperature({ enabled: true, temperature: 2 }, base).temperature, 2);

// 5. 没有设置：原样返回
assert.equal(withTemperature(undefined, base), base);

console.log("merge.test: 5/5 通过");
