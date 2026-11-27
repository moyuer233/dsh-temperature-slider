/**
 * 纯逻辑：把设置里的温度合并进一次模型调用的 LlmCallConfig。
 * 单独成文件是为了能被 test/ 直接跑（不依赖 DSH 运行时）。
 */

/**
 * @param {{ enabled?: boolean, temperature?: number } | undefined} config 插件设置
 * @param {Record<string, any>} resolved 机器本会使用的调用配置
 * @returns {Record<string, any>} 要生效的调用配置
 */
export function withTemperature(config, resolved) {
  if (config === undefined || config === null) return resolved;
  if (config.enabled !== true) return resolved;
  const value = Number(config.temperature);
  if (!Number.isFinite(value) || value < 0 || value > 2) return resolved;
  return { ...resolved, temperature: value };
}
