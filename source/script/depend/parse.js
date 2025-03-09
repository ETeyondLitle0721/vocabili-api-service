/**
 * 解析命令行参数（field=value）
 * 
 * @param {string[]} content 参数列表
 * @param {(field: string, text: string) => any} parser 参数解析器
 * @returns {Object<string, string>} 解析结果
 */
export function command_parser(content, parser = (_, text) => text) {
    const result = {};

    for (let index = 0; index < content.length; index++) {
        const current = content[index];
        const parts = current.split("=").map(
            item => item.trim()
        );
        
        if (parts.length !== 2) continue;

        result[parts[0]] = parser(
            parts[0], parts[1]
        );
    }

    return result;
}