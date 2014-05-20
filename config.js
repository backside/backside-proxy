
var path = require("path")
var dependable = require("dependable")
var container = dependable.container()
var _ = require("underscore")
var winston = require("winston")

var defaults = {
  PORT: 5000,
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
