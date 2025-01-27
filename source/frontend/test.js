import ServiceRequester from "./default.js";

const reuqester = new ServiceRequester({
    "protocol": "http", "host": "127.0.0.1", "port": 51001, "point": "/"
});

console.log(await reuqester.get_current_board_info(
    "vocaloid-weekly", 50
));