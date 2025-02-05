export function command_parser(content) {
    const result = {};

    for (let index = 0; index < content.length; index++) {
        const element = content[index], part = element.split("=").map(item => item.trim());
        
        if (part.length !== 2) continue;

        result[part[0]] = part[1];
    }

    return result;
}