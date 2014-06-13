
var path = require("path")
// use the same container as the api so its easy to override!
var backsideApi = require("backside-api")
var container = backsideApi.getContainer()
var winston = require("winston")

var defaults = {
  WS_PORT: 5000,
  TCP_PORT: 5001,
  STOMP_HOST: "localhost",
  STOMP_PORT: "61613",
  STOMP_USERNAME: "guest",
  STOMP_PASSWORD: "guest",
  STOMP_EXCHANGE: "backside",
  SOCK_PREFIX: "/socks"
}

for (var key in defaults) {
  container.register(key, process.env[key] || defaults[key])
}

container.register("logger", function() {
  return winston
})

container.load(path.join(__dirname, "lib"))

module.exports = container
