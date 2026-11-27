/**
 * dsh-temperature-slider — 宿主半边。
 *
 * 只做一件事：把设置里的 temperature 合并进每次模型调用。
 * 设置本身是插件条目的 config（0.2.x 的「设置」就是它），schema 由 Config 声明。
 */
import Schema from "@deepseek-ai/schemastery";
import { withTemperature } from "./merge.js";

export const name = "temperature-slider";

export const Config = Schema.object({
  // volatile = 运行时可调：设置层只接受带这个标记的字段做热更新。
  enabled: Schema.boolean().default(false).volatile().description("覆盖模型温度"),
  temperature: Schema.number().min(0).max(2).step(0.05).default(1).volatile().description("采样温度"),
});

/**
 * @param {any} ctx 宿主 cordis 上下文
 * @param {{ enabled?: boolean, temperature?: number }} config 本插件条目的配置
 */
export function apply(ctx, config) {
  // agent/request 是瀑布事件：next() 拿到机器本会使用的配置，返回替换值即生效。
  ctx.on("agent/request", async (_payload, next) => {
    const resolved = await next();
    try {
      return withTemperature(config, resolved);
    } catch {
      return resolved;
    }
  });
}

export default { name, Config, apply };
